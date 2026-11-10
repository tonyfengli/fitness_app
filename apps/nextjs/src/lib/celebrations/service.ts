/**
 * The celebrations workflow, deterministic end to end:
 *   current members with a birthday ≤ DAYS_AHEAD days out → one `celebration` row each
 *   (never a duplicate) → card rendered (cached AI background + photo + name) → Blob → the
 *   Retention tab's Celebrations view, where a founder posts it by hand and taps Posted.
 * The only model call is the theme background, made once per theme (celebration_background).
 * Design: ai-crew/docs/BUSINESS-ACCOUNTABILITY.md. Owner of this workflow: Tony.
 */

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { Celebration, CelebrationBackground } from "@acme/db/schema";

import { generateImage } from "../ai/images";
import { getGymBusinessId } from "../business";
import { getMemberProfile } from "../gymmaster-member";
import { getCurrentMembers } from "../kilo-members";
import { upcomingBirthdays } from "./birthdays";
import { composeCelebration } from "./compose";
import { fetchMemberPhoto, hasRealPhoto } from "./photo";
import { backgroundPath, cardPath, storePng } from "./storage";
import { DEFAULT_THEME, THEMES } from "./themes";
import type { Theme } from "./themes";

export const DAYS_AHEAD = 7;

export interface CelebrationRun {
  today: string;
  members: number;
  withDob: number;
  upcoming: { memberId: string; occasionDate: string; daysAway: number }[];
  created: string[]; // member ids
  rendered: string[];
  failed: { memberId: string; error: string }[];
  backgroundsGenerated: string[]; // theme keys
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The theme's background from Blob (generated and stored on first use) */
export async function getBackground(theme: Theme, businessId: string, run?: CelebrationRun): Promise<Buffer> {
  const [row] = await db
    .select({ imageUrl: CelebrationBackground.imageUrl })
    .from(CelebrationBackground)
    .where(and(eq(CelebrationBackground.businessId, businessId), eq(CelebrationBackground.themeKey, theme.key)))
    .limit(1);
  if (row) {
    const res = await fetch(row.imageUrl);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }
  const made = await generateImage({ prompt: theme.backgroundPrompt, purpose: `celebrations:${theme.type}`, quality: "medium" });
  const imageUrl = await storePng(backgroundPath(theme.key), made.png);
  await db
    .insert(CelebrationBackground)
    .values({ businessId, themeKey: theme.key, imageUrl, model: made.model, prompt: theme.backgroundPrompt })
    .onConflictDoUpdate({ target: [CelebrationBackground.businessId, CelebrationBackground.themeKey], set: { imageUrl, model: made.model, prompt: theme.backgroundPrompt } });
  run?.backgroundsGenerated.push(theme.key);
  return made.png;
}

/** Render (or re-render) one celebration's card and store it */
export async function renderCard(celebrationId: string, run?: CelebrationRun): Promise<string> {
  const [c] = await db.select().from(Celebration).where(eq(Celebration.id, celebrationId)).limit(1);
  if (!c) throw new Error(`celebration ${celebrationId} not found`);
  const theme = THEMES[c.themeKey];
  if (!theme) throw new Error(`unknown theme ${c.themeKey}`);
  const profile = await getMemberProfile(c.memberId);
  const candidates = [String(profile?.firstname ?? "").trim(), c.memberName.split(" ")[0] ?? "", "Member"];
  const firstName = candidates.find((s) => s.length > 0) ?? "Member";
  const photo = hasRealPhoto(profile?.memberimage) ? await fetchMemberPhoto(profile.memberimage) : null;
  const background = await getBackground(theme, c.businessId, run);
  const png = await composeCelebration({
    background,
    photo,
    firstName,
    headline: theme.headline(firstName),
    subline: theme.subline?.(c.detail ?? undefined),
  });
  const imageUrl = await storePng(cardPath(c.id), png);
  await db.update(Celebration).set({ imageUrl, renderedAt: new Date() }).where(eq(Celebration.id, c.id));
  return imageUrl;
}

/**
 * The daily run: find upcoming birthdays among current members, create the rows that don't
 * exist yet, render every card that has no image. With `apply: false` it only reports.
 */
export async function runCelebrations(opts: { apply: boolean; now?: Date; testMemberIds?: string[] }): Promise<CelebrationRun> {
  const now = opts.now ?? new Date();
  const today = iso(now);
  const run: CelebrationRun = { today, members: 0, withDob: 0, upcoming: [], created: [], rendered: [], failed: [], backgroundsGenerated: [] };
  const businessId = await getGymBusinessId();

  const members = opts.testMemberIds?.length
    ? opts.testMemberIds.map((memberId) => ({ memberId, name: "" }))
    : await getCurrentMembers(now);
  run.members = members.length;

  const candidates: { memberId: string; dob: string; name: string }[] = [];
  for (const m of members) {
    const p = await getMemberProfile(m.memberId).catch(() => null);
    const dob = typeof p?.dob === "string" ? p.dob.slice(0, 10) : "";
    if (!dob) continue;
    const name = [p?.firstname, p?.surname].filter(Boolean).join(" ").trim() || m.name || `Member ${m.memberId}`;
    candidates.push({ memberId: m.memberId, dob, name });
  }
  run.withDob = candidates.length;

  const upcoming = upcomingBirthdays(candidates, today, DAYS_AHEAD);
  run.upcoming = upcoming.map(({ memberId, occasionDate, daysAway }) => ({ memberId, occasionDate, daysAway }));
  if (!opts.apply) return run;

  const nameOf = new Map(candidates.map((c) => [c.memberId, c.name]));
  for (const b of upcoming) {
    const inserted = await db
      .insert(Celebration)
      .values({ businessId, memberId: b.memberId, memberName: nameOf.get(b.memberId) ?? `Member ${b.memberId}`, type: "birthday", occasionDate: b.occasionDate, themeKey: DEFAULT_THEME.birthday })
      .onConflictDoNothing({ target: [Celebration.businessId, Celebration.memberId, Celebration.type, Celebration.occasionDate] })
      .returning({ id: Celebration.id });
    if (inserted.length) run.created.push(b.memberId);
  }

  // Render whatever has no card yet (new rows, and earlier rows whose render failed)
  const pending = await db
    .select({ id: Celebration.id, memberId: Celebration.memberId })
    .from(Celebration)
    .where(and(eq(Celebration.businessId, businessId), eq(Celebration.status, "ready")));
  for (const c of pending) {
    const [row] = await db.select({ imageUrl: Celebration.imageUrl }).from(Celebration).where(eq(Celebration.id, c.id)).limit(1);
    if (row?.imageUrl) continue;
    try {
      await renderCard(c.id, run);
      run.rendered.push(c.memberId);
    } catch (err) {
      run.failed.push({ memberId: c.memberId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return run;
}
