/**
 * The celebrations workflow, deterministic end to end:
 *   current members with a birthday ≤ DAYS_AHEAD days out → one `celebration` row each
 *   (never a duplicate), its design taken in rotation → card rendered (cached AI background +
 *   photo + words; the no-photo layout when there is no photo) → Blob → the Retention tab's
 *   Celebrations view, where a founder posts it by hand and taps Posted.
 * A founder can change one card through the Chief of Staff (rebuildCard: design, words, photo
 * on/off, its own background) and have any card sent to someone in Slack (sendCard).
 * Photos: the member's GymMaster photo; when there is none, a picture from the members' GroupMe
 * group that a founder approved once (celebration_photo_match), cleaned into a portrait by the
 * image model. Until that yes the card is drafted without a photo.
 * Model calls: backgrounds (one per theme, one per card on request; prompt only), the portrait
 * cleanup on approval, and editCard, where a founder has the finished card redrawn. The last
 * two send the member's photo to OpenAI (Tony's decision, Nov 12 2026).
 * Design: ai-crew/docs/BUSINESS-ACCOUNTABILITY.md. Owner of this workflow: Tony.
 */

import sharp from "sharp";

import { and, desc, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { Celebration, CelebrationBackground, CelebrationPhotoMatch, TeamWorkflow } from "@acme/db/schema";

import { editImage, generateImage } from "../ai/images";
import { getGymBusinessId } from "../business";
import { getMemberDob, getMemberProfile } from "../gymmaster-member";
import { getCurrentMembers } from "../kilo-members";
import { upcomingBirthdays } from "./birthdays";
import { CARD, composeCelebration } from "./compose";
import { groupMeConfigured, groupMembers, suggestPhoto } from "./groupme";
import { fetchMemberPhoto, hasRealPhoto } from "./photo";
import { cleanPortrait } from "./portrait";
import { backgroundPath, cardBackgroundPath, cardPath, portraitPath, storePng } from "./storage";
import { nextTheme, themeAfter, THEMES, themesFor } from "./themes";
import type { Theme } from "./themes";
import { recordActivity } from "../team/activity";
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
  photosSuggested: string[]; // member ids with a GroupMe picture now waiting for a founder's yes/no
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
  photo: "shown" | "turned off" | "member has none" | "waiting for a yes on their GroupMe picture";
  background: "the design's" | "its own";
}

/** Render (or re-render) one celebration's card from its row and store it */
export async function renderCard(celebrationId: string, run?: CelebrationRun, freshBackground?: Buffer, freshPortrait?: Buffer): Promise<RenderedCard> {
  const [c] = await db.select().from(Celebration).where(eq(Celebration.id, celebrationId)).limit(1);
  if (!c) throw new Error(`celebration ${celebrationId} not found`);
  const theme = THEMES[c.themeKey];
  if (!theme) throw new Error(`unknown theme ${c.themeKey}`);
  const profile = await getMemberProfile(c.memberId);
  const candidates = [String(profile?.firstname ?? "").trim(), c.memberName.split(" ")[0] ?? "", "Member"];
  const firstName = candidates.find((s) => s.length > 0) ?? "Member";
  // GymMaster's photo first; otherwise the approved GroupMe portrait
  let photo = c.usePhoto && hasRealPhoto(profile?.memberimage) ? await fetchMemberPhoto(profile.memberimage) : null;
  let photoSource: "gymmaster" | "groupme" | null = photo ? "gymmaster" : null;
  let waiting = false;
  if (c.usePhoto && !photo) {
    const [match] = await db.select().from(CelebrationPhotoMatch).where(and(eq(CelebrationPhotoMatch.businessId, c.businessId), eq(CelebrationPhotoMatch.memberId, c.memberId))).limit(1);
    if (match?.status === "approved" && match.portraitUrl) {
      photo = freshPortrait ?? (await fetchPng(match.portraitUrl));
      if (photo) photoSource = "groupme";
    }
    waiting = match?.status === "suggested";
  }
  // The card's own art if it has some (just generated: use those bytes, the stored copy may still be cached)
  const own = freshBackground ?? (c.backgroundUrl ? await fetchPng(c.backgroundUrl) : null);
  const background = own ?? (await getBackground(theme, c.businessId, run));
  const headline = c.headline?.trim() || theme.headline(firstName);
  const subline = (c.subline === null ? theme.subline?.(c.detail ?? undefined) : c.subline.trim()) || null; // "" = no second line
  const png = await composeCelebration({ background, photo, headline, subline: subline ?? undefined, accent: theme.accent });
  const imageUrl = await storePng(cardPath(c.id), png);
  await db.update(Celebration).set({ imageUrl, renderedAt: new Date(), photoSource, aiEditPrompt: null }).where(eq(Celebration.id, c.id));
  await ensureTask({ ...c, imageUrl });
  return {
    imageUrl,
    themeKey: theme.key,
    headline,
    subline,
    photo: photo ? "shown" : !c.usePhoto ? "turned off" : waiting ? "waiting for a yes on their GroupMe picture" : "member has none",
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

/**
 * Have the image model redraw the finished card the way a founder asked ("make it more fun",
 * "warmer colors"). The current card image, photo included, goes to OpenAI. The result replaces
 * the stored card; a rebuild from parts (rebuildCard, renderCard) returns to the code-built one.
 */
export async function editCard(celebrationId: string, instruction: string): Promise<{ imageUrl: string }> {
  const [c] = await db.select().from(Celebration).where(eq(Celebration.id, celebrationId)).limit(1);
  if (!c) throw new CardChangeError("No such card.");
  if (!c.imageUrl) throw new CardChangeError(`${c.memberName}'s card hasn't been rendered yet.`);
  const ask = instruction.trim().slice(0, 600);
  if (!ask) throw new CardChangeError("Say what to change.");
  const current = await fetchPng(`${c.imageUrl}?v=${Date.now()}`);
  if (!current) throw new Error("Couldn't load the current card");
  const prompt =
    `This is a square ${c.type} card for a gym member. Change it as follows: ${ask}. ` +
    "Keep it a finished, postable card. Keep every word of the text spelled exactly as it is unless the change asks for different words. " +
    "If a person is shown, keep them the same person with the same face and likeness.";
  const made = await editImage({ images: [current], prompt, purpose: `celebrations:${c.type}:edit`, quality: "medium" });
  const png = await sharp(made.png).resize(CARD, CARD, { fit: "cover" }).png().toBuffer();
  const imageUrl = await storePng(cardPath(c.id), png);
  await db.update(Celebration).set({ imageUrl, renderedAt: new Date(), aiEditPrompt: ask }).where(eq(Celebration.id, c.id));
  return { imageUrl };
}

// ---------------------------------------------------------------------------
// Photos from the members' GroupMe group (members with no GymMaster photo)
// ---------------------------------------------------------------------------

/**
 * For members with a card coming up and no GymMaster photo: find their likely GroupMe picture
 * and record it as a suggestion, once. Nothing is used until a founder says yes (decidePhoto).
 * A member who already has a row is left alone: an approved portrait keeps being used and a
 * rejection is never asked again. Only a still-unanswered suggestion follows a changed picture.
 */
async function suggestPhotos(businessId: string, cards: { memberId: string }[], run: CelebrationRun): Promise<void> {
  if (!groupMeConfigured() || !cards.length) return;
  const group = await groupMembers();
  const existing = new Map((await db.select().from(CelebrationPhotoMatch).where(eq(CelebrationPhotoMatch.businessId, businessId))).map((r) => [r.memberId, r]));
  for (const memberId of new Set(cards.map((c) => c.memberId))) {
    const row = existing.get(memberId);
    if (row?.status === "rejected") continue;
    const profile = await getMemberProfile(memberId).catch(() => null);
    if (!profile) continue;
    if (hasRealPhoto(profile.memberimage) && (await fetchMemberPhoto(profile.memberimage))) continue; // GymMaster has one
    if (row) {
      // Still unanswered and they changed their picture: the question is now about the new one
      const now = group.find((g) => g.userId === row.sourceUserId);
      if (!now?.imageUrl || now.imageUrl === row.sourceImageUrl || row.status !== "suggested") continue;
      await db.update(CelebrationPhotoMatch).set({ sourceImageUrl: now.imageUrl, nickname: now.nickname }).where(eq(CelebrationPhotoMatch.id, row.id));
      continue;
    }
    const found = suggestPhoto(String(profile.firstname ?? ""), String(profile.surname ?? ""), group);
    if (!found) continue;
    const inserted = await db
      .insert(CelebrationPhotoMatch)
      .values({ businessId, memberId, sourceUserId: found.member.userId, nickname: found.member.nickname, sourceImageUrl: found.member.imageUrl, exactName: found.exactName })
      .onConflictDoNothing({ target: [CelebrationPhotoMatch.businessId, CelebrationPhotoMatch.memberId] })
      .returning({ id: CelebrationPhotoMatch.id });
    if (inserted.length) run.photosSuggested.push(memberId);
  }
}

/** The GroupMe picture waiting for (or given) a founder's answer for this card's member */
export async function photoSuggestion(celebrationId: string) {
  const [c] = await db.select().from(Celebration).where(eq(Celebration.id, celebrationId)).limit(1);
  if (!c) throw new CardChangeError("No such card.");
  const [match] = await db.select().from(CelebrationPhotoMatch).where(and(eq(CelebrationPhotoMatch.businessId, c.businessId), eq(CelebrationPhotoMatch.memberId, c.memberId))).limit(1);
  if (!match) throw new CardChangeError(`No GroupMe picture was found for ${c.memberName} (not in the group under a matching name, or no profile picture).`);
  return { card: c, match };
}

/** DM the suggested GroupMe picture itself to a founder, so they can say yes or no */
export async function showPhoto(celebrationId: string, slackUserId: string): Promise<{ memberName: string; nickname: string; status: string }> {
  const { card, match } = await photoSuggestion(celebrationId);
  const sure = match.exactName ? "same name" : "name is only a partial match, so check it's the same person";
  const text = `GroupMe picture for ${card.memberName}'s card: "${match.nickname}" in the members' group (${sure}). Currently ${match.status}.`;
  const delivery = await sendSlackDm(slackUserId, text, [{ url: match.sourceImageUrl, filename: `groupme-${card.memberId}.jpg` }]);
  if (!delivery.imagesAttached) throw new Error("Slack took the message but not the picture");
  await recordActivity({ slackUserId, kind: "card_photo_shown", subjectType: "card", subjectId: card.id, summary: `Showed them the GroupMe picture of "${match.nickname}" for ${card.memberName}'s ${card.type} card (${card.occasionDate}); waiting for use it / no` });
  return { memberName: card.memberName, nickname: match.nickname, status: match.status };
}

/**
 * A founder's one-time answer on a member's GroupMe picture.
 *  use     the picture goes to the image model once to become a clean portrait of the member
 *          (`note` = who they are in it, for family or group shots), the portrait is stored, and
 *          the member's waiting cards are rebuilt with it.
 *  reject  never use it; not suggested again.
 */
export async function decidePhoto(celebrationId: string, decision: "use" | "reject", userId: string, note?: string): Promise<{ memberName: string; nickname: string; card: RenderedCard | null }> {
  const { card, match } = await photoSuggestion(celebrationId);
  if (decision === "reject") {
    await db.update(CelebrationPhotoMatch).set({ status: "rejected", decidedBy: userId, decidedAt: new Date(), note: note?.trim().slice(0, 300) ?? null }).where(eq(CelebrationPhotoMatch.id, match.id));
    const rendered = card.status === "ready" ? await renderCard(card.id) : null;
    return { memberName: card.memberName, nickname: match.nickname, card: rendered };
  }
  const source = await fetchMemberPhoto(match.sourceImageUrl);
  if (!source) throw new CardChangeError(`Couldn't download ${match.nickname}'s GroupMe picture; they may have removed it.`);
  const who = note?.trim().slice(0, 300) ?? match.note ?? undefined;
  const portrait = await cleanPortrait(source, who);
  const portraitUrl = await storePng(portraitPath(card.memberId), portrait.png);
  await db.update(CelebrationPhotoMatch).set({ status: "approved", decidedBy: userId, decidedAt: new Date(), note: who ?? null, portraitUrl }).where(eq(CelebrationPhotoMatch.id, match.id));
  // Every card of theirs still waiting to be posted gets the portrait; the one asked about is returned
  const waiting = await db.select({ id: Celebration.id }).from(Celebration).where(and(eq(Celebration.businessId, card.businessId), eq(Celebration.memberId, card.memberId), eq(Celebration.status, "ready")));
  let rendered: RenderedCard | null = null;
  for (const w of waiting) {
    const r = await renderCard(w.id, undefined, undefined, portrait.png);
    if (w.id === card.id) rendered = r;
  }
  return { memberName: card.memberName, nickname: match.nickname, card: rendered };
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
  await recordActivity({ slackUserId, kind: "card_sent", subjectType: "card", subjectId: c.id, summary: `Sent ${c.memberName}'s ${c.type} card (${c.occasionDate}) to their DM` });
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
  const run: CelebrationRun = { today, members: 0, withDob: 0, dobFromArchive: [], upcoming: [], created: [], rendered: [], failed: [], backgroundsGenerated: [], tasksCreated: [], photosSuggested: [] };
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
  // Before rendering, so a new draft already says a GroupMe picture is waiting for a yes
  await suggestPhotos(businessId, pending, run).catch((err) => console.warn("[celebrations] GroupMe suggestions skipped:", err instanceof Error ? err.message : err));
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
