/**
 * The celebrations workflow, deterministic end to end:
 *   current members with a birthday ≤ DAYS_AHEAD days out → one `celebration` row each
 *   (never a duplicate), its design taken in rotation → card rendered (cached AI background +
 *   photo + words; the no-photo layout when there is no photo) → Blob → the Retention tab's
 *   Celebrations view, where a founder posts it by hand and taps Posted.
 * A founder can change one card through the Chief of Staff (rebuildCard: design, words, photo
 * on/off, its own background) and have any card sent to someone in Slack (sendCard).
 * The only model calls are backgrounds: one per theme (celebration_background), and one per
 * card when a founder asks for a new background. A member's photo never goes to a model.
 * Design: ai-crew/docs/BUSINESS-ACCOUNTABILITY.md. Owner of this workflow: Tony.
 */

import { and, desc, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { Celebration, CelebrationBackground, TeamWorkflow } from "@acme/db/schema";

import { generateImage } from "../ai/images";
import { getGymBusinessId } from "../business";
import { getMemberDob, getMemberProfile } from "../gymmaster-member";
import { getCurrentMembers } from "../kilo-members";
import { upcomingBirthdays } from "./birthdays";
import { composeCelebration } from "./compose";
import { fetchMemberPhoto, hasRealPhoto } from "./photo";
import { backgroundPath, cardBackgroundPath, cardPath, storePng } from "./storage";
import { nextTheme, themeAfter, THEMES, themesFor } from "./themes";
import type { Theme } from "./themes";
import { sendSlackDm } from "../team/notify";
import { cancel, complete, createTasks, findTask, TeamRuleError } from "../team/tasks";
import type { Actor } from "../team/tasks";

export const WORKFLOW_KEY = "celebrations";
const taskRef = (c: { memberId: string; type: string; occasionDate: string }) => `${c.type}:${c.memberId}:${c.occasionDate}`;

/** How far ahead a card is made: two weeks, so there is time to change it (Tony, Nov 12 2026) */
export const DAYS_AHEAD = 14;

export interface CelebrationRun {
  today: string;
  members: number;
  withDob: number;
  dobFromArchive: string[]; // member ids whose birthday came from the old account's record
  upcoming: { memberId: string; occasionDate: string; daysAway: number }[];
  created: string[]; // member ids
  rendered: string[];
  failed: { memberId: string; error: string }[];
  backgroundsGenerated: string[]; // theme keys
  tasksCreated: string[]; // member ids whose card got a team task this run
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

async function fetchPng(url: string): Promise<Buffer | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
  return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

export interface RenderedCard {
  imageUrl: string;
  themeKey: string;
  headline: string;
  subline: string | null;
  /** "shown", or why the card has no photo */
  photo: "shown" | "turned off" | "member has none";
  background: "the design's" | "its own";
}

/** Render (or re-render) one celebration's card from its row and store it */
export async function renderCard(celebrationId: string, run?: CelebrationRun, freshBackground?: Buffer): Promise<RenderedCard> {
  const [c] = await db.select().from(Celebration).where(eq(Celebration.id, celebrationId)).limit(1);
  if (!c) throw new Error(`celebration ${celebrationId} not found`);
  const theme = THEMES[c.themeKey];
  if (!theme) throw new Error(`unknown theme ${c.themeKey}`);
  const profile = await getMemberProfile(c.memberId);
  const candidates = [String(profile?.firstname ?? "").trim(), c.memberName.split(" ")[0] ?? "", "Member"];
  const firstName = candidates.find((s) => s.length > 0) ?? "Member";
  const photo = c.usePhoto && hasRealPhoto(profile?.memberimage) ? await fetchMemberPhoto(profile.memberimage) : null;
  // The card's own art if it has some (just generated: use those bytes, the stored copy may still be cached)
  const own = freshBackground ?? (c.backgroundUrl ? await fetchPng(c.backgroundUrl) : null);
  const background = own ?? (await getBackground(theme, c.businessId, run));
  const headline = c.headline?.trim() || theme.headline(firstName);
  const subline = (c.subline === null ? theme.subline?.(c.detail ?? undefined) : c.subline.trim()) || null; // "" = no second line
  const png = await composeCelebration({ background, photo, headline, subline: subline ?? undefined, accent: theme.accent });
  const imageUrl = await storePng(cardPath(c.id), png);
  await db.update(Celebration).set({ imageUrl, renderedAt: new Date(), photoSource: photo ? "gymmaster" : null }).where(eq(Celebration.id, c.id));
  await ensureTask({ ...c, imageUrl });
  return {
    imageUrl,
    themeKey: theme.key,
    headline,
    subline,
    photo: photo ? "shown" : c.usePhoto ? "member has none" : "turned off",
    background: own ? "its own" : "the design's",
  };
}

/** What a founder can change on one card. Anything left out stays as it is. */
export interface CardParts {
  /** A theme key, or "next" for the design after the current one */
  design?: string;
  /** New words; "" puts the design's own back */
  headline?: string;
  /** New second line; "" puts the design's own back; "none" removes the line */
  subline?: string;
  photo?: "on" | "off";
  /** "new": generate art for this card alone (the design's prompt, plus `backgroundHint`); "design": back to the shared one */
  background?: "new" | "design";
  backgroundHint?: string;
}

export class CardChangeError extends Error {}

/**
 * Rebuild one card from its parts. Deterministic except a "new" background, which is one image
 * call from the design's prompt (no people, no text); the member's photo is composited in code
 * afterwards and is never sent anywhere.
 */
export async function rebuildCard(celebrationId: string, parts: CardParts): Promise<RenderedCard> {
  const [c] = await db.select().from(Celebration).where(eq(Celebration.id, celebrationId)).limit(1);
  if (!c) throw new CardChangeError("No such card.");
  const set: Partial<typeof Celebration.$inferInsert> = {};

  let theme = THEMES[c.themeKey];
  if (parts.design !== undefined) {
    const options = themesFor(c.type);
    const wanted = parts.design === "next" ? themeAfter(c.themeKey) : options.find((t) => t.key === parts.design);
    if (!wanted) {
      throw new CardChangeError(
        parts.design === "next" && options.length < 2
          ? `There is only one ${c.type} design so far (${options[0]?.key ?? "none"}); nothing to switch to.`
          : `No ${c.type} design called "${parts.design}". Designs: ${options.map((t) => t.key).join(", ")}.`,
      );
    }
    theme = wanted;
    set.themeKey = wanted.key;
  }
  if (!theme) throw new CardChangeError(`This card's design (${c.themeKey}) no longer exists; pick one of: ${themesFor(c.type).map((t) => t.key).join(", ")}.`);

  if (parts.headline !== undefined) set.headline = parts.headline.trim().slice(0, 120) || null;
  if (parts.subline !== undefined) {
    const v = parts.subline.trim();
    set.subline = v === "" ? null : v.toLowerCase() === "none" ? "" : v.slice(0, 120);
  }
  if (parts.photo) set.usePhoto = parts.photo === "on";
  let freshBackground: Buffer | undefined;
  if (parts.background === "design") set.backgroundUrl = null;
  if (parts.background === "new") {
    const hint = parts.backgroundHint?.trim().slice(0, 300);
    const prompt = hint ? `${theme.backgroundPrompt} Also: ${hint}` : theme.backgroundPrompt;
    const made = await generateImage({ prompt, purpose: `celebrations:${theme.type}:card`, quality: "medium" });
    set.backgroundUrl = await storePng(cardBackgroundPath(c.id), made.png);
    freshBackground = made.png;
  }
  if (!Object.keys(set).length) throw new CardChangeError("Nothing to change: say which part (design, words, photo, background).");
  await db.update(Celebration).set(set).where(eq(Celebration.id, c.id));
  return renderCard(c.id, undefined, freshBackground);
}

/** DM a card's image to someone in Slack. The card is fetched fresh, so a rebuild a moment ago is what goes out. */
export async function sendCard(celebrationId: string, slackUserId: string, text?: string): Promise<{ externalId: string | null; memberName: string; occasionDate: string }> {
  const [c] = await db.select().from(Celebration).where(eq(Celebration.id, celebrationId)).limit(1);
  if (!c) throw new CardChangeError("No such card.");
  if (!c.imageUrl) throw new CardChangeError(`${c.memberName}'s card hasn't been rendered yet.`);
  const first = c.memberName.split(" ")[0] ?? c.memberName;
  const fresh = `${c.imageUrl}${c.imageUrl.includes("?") ? "&" : "?"}v=${c.renderedAt?.getTime() ?? Date.now()}`;
  const delivery = await sendSlackDm(slackUserId, text?.trim() || `${first}'s ${c.type} card (${c.occasionDate}):`, [{ url: fresh, filename: `${first}-${c.type}-${c.occasionDate}.png` }]);
  if (!delivery.imagesAttached) throw new Error("Slack took the message but not the image");
  return { externalId: delivery.externalId, memberName: c.memberName, occasionDate: c.occasionDate };
}

/**
 * The accountability hookup: a rendered card is a commitment for the workflow's owner to post
 * it. One task per card (the task's sourceRef is the card's occasion); nothing if the workflow
 * isn't registered yet (team-setup.ts), so celebrations keep working without the team layer.
 */
async function ensureTask(c: { id: string; memberId: string; memberName: string; type: string; occasionDate: string; imageUrl: string }, run?: CelebrationRun) {
  const [w] = await db.select({ ownerId: TeamWorkflow.ownerId, active: TeamWorkflow.active }).from(TeamWorkflow).where(eq(TeamWorkflow.key, WORKFLOW_KEY)).limit(1);
  if (!w?.active) return;
  const firstName = c.memberName.split(" ")[0] ?? c.memberName;
  const when = new Date(`${c.occasionDate}T17:00:00Z`); // 9am Pacific on the day
  try {
    const created = await createTasks(
      [
        {
          title: `Post ${firstName}'s ${c.type} card in GroupMe`,
          details: `${c.memberName} (#${c.memberId}), ${c.type} on ${c.occasionDate}. Save the card image and post it in the members' GroupMe; reply "posted" when it's up.`,
          context: { celebrationId: c.id, imageUrl: c.imageUrl, memberId: c.memberId },
          ownerId: w.ownerId,
          workflowKey: WORKFLOW_KEY,
          dueAt: when,
          hardDeadline: true,
          source: WORKFLOW_KEY,
          sourceRef: taskRef(c),
        },
      ],
      { kind: "workflow" },
    );
    if (created.length) run?.tasksCreated.push(c.memberId);
  } catch (err) {
    if (!(err instanceof TeamRuleError)) throw err;
    console.warn(`[celebrations] no task for ${c.memberId}: ${err.message}`);
  }
}

/** Posted → the task is done; skipped → cancelled. Called by the agent route with the founder as actor. */
export async function settleTask(c: { memberId: string; type: string; occasionDate: string }, outcome: "posted" | "skipped", actor: Actor): Promise<void> {
  const task = await findTask(WORKFLOW_KEY, taskRef(c));
  if (!task) return;
  if (outcome === "posted") await complete(task, actor, "dashboard", "Marked Posted on the Retention tab");
  else await cancel(task, { kind: "workflow" }, "dashboard", "Card skipped on the Retention tab");
}

/**
 * The daily run: find upcoming birthdays among current members, create the rows that don't
 * exist yet, render every card that has no image. With `apply: false` it only reports.
 */
export async function runCelebrations(opts: { apply: boolean; now?: Date; testMemberIds?: string[] }): Promise<CelebrationRun> {
  const now = opts.now ?? new Date();
  const today = iso(now);
  const run: CelebrationRun = { today, members: 0, withDob: 0, dobFromArchive: [], upcoming: [], created: [], rendered: [], failed: [], backgroundsGenerated: [], tasksCreated: [] };
  const businessId = await getGymBusinessId();

  const members = opts.testMemberIds?.length
    ? opts.testMemberIds.map((memberId) => ({ memberId, name: "" }))
    : await getCurrentMembers(now);
  run.members = members.length;

  const candidates: { memberId: string; dob: string; name: string }[] = [];
  for (const m of members) {
    const p = await getMemberProfile(m.memberId).catch(() => null);
    // The old account's birthday when the new record has none (re-entered without it)
    const dob = await getMemberDob(m.memberId, p).catch(() => null);
    if (!dob) continue;
    if (typeof p?.dob !== "string" || !p.dob) run.dobFromArchive.push(m.memberId);
    const name = [p?.firstname, p?.surname].filter(Boolean).join(" ").trim() || m.name || `Member ${m.memberId}`;
    candidates.push({ memberId: m.memberId, dob, name });
  }
  run.withDob = candidates.length;

  const upcoming = upcomingBirthdays(candidates, today, DAYS_AHEAD);
  run.upcoming = upcoming.map(({ memberId, occasionDate, daysAway }) => ({ memberId, occasionDate, daysAway }));
  if (!opts.apply) return run;

  const nameOf = new Map(candidates.map((c) => [c.memberId, c.name]));
  // Designs rotate: each new card takes the one used longest ago (newest first here)
  const recentThemes = (
    await db
      .select({ themeKey: Celebration.themeKey })
      .from(Celebration)
      .where(and(eq(Celebration.businessId, businessId), eq(Celebration.type, "birthday")))
      .orderBy(desc(Celebration.createdAt))
      .limit(50)
  ).map((r) => r.themeKey);
  for (const b of upcoming) {
    const theme = nextTheme("birthday", recentThemes);
    const inserted = await db
      .insert(Celebration)
      .values({ businessId, memberId: b.memberId, memberName: nameOf.get(b.memberId) ?? `Member ${b.memberId}`, type: "birthday", occasionDate: b.occasionDate, themeKey: theme.key })
      .onConflictDoNothing({ target: [Celebration.businessId, Celebration.memberId, Celebration.type, Celebration.occasionDate] })
      .returning({ id: Celebration.id });
    if (inserted.length) {
      run.created.push(b.memberId);
      recentThemes.unshift(theme.key);
    }
  }

  // Render whatever has no card yet (new rows, and earlier rows whose render failed);
  // make sure every ready card has its team task (rendered before the team layer existed, or a failed insert)
  const pending = await db.select().from(Celebration).where(and(eq(Celebration.businessId, businessId), eq(Celebration.status, "ready")));
  for (const c of pending) {
    try {
      if (c.imageUrl) await ensureTask({ ...c, imageUrl: c.imageUrl }, run);
      else {
        await renderCard(c.id, run);
        run.rendered.push(c.memberId);
      }
    } catch (err) {
      run.failed.push({ memberId: c.memberId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return run;
}
