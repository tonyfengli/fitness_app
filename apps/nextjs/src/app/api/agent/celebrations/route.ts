/**
 * Celebrations for the Retention tab and the gym Chief of Staff.
 * GET  /api/agent/celebrations   cards ready to post (soonest first) and the last 30 days of
 *                                posted/skipped ones. Founders, or the OpenClaw key (read-only).
 * POST /api/agent/celebrations   { id, action, ... }. A signed-in founder: any action. The Chief of Staff
 *                                (X-TEAM-AGENT-KEY + actorSlackUserId, acting for the founder who asked):
 *                                rebuild and send only.
 *   posted | skipped (reason?)   record who and when          reopen    undo either
 *   rerender                     same parts, rendered again (the member's photo changed)
 *   rebuild                      change parts, then render: { design?: <theme key> | "next", headline?, subline?
 *                                ("" = the design's words back, subline "none" = no second line), photo?: "on" | "off",
 *                                background?: "new" | "design", backgroundHint? }. Only "new" calls a model
 *                                (art only; the photo never leaves). Optional sendToSlackUserId DMs the result.
 *   send                         DM the card image: { toSlackUserId | toName (a founder's name), text? }
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, desc, eq, or, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { Celebration, TeamProfile, user } from "@acme/db/schema";
import { validateFounderAccess } from "~/lib/api-auth";
import { getGymBusinessId } from "~/lib/business";
import { CardChangeError, DAYS_AHEAD, rebuildCard, renderCard, sendCard, settleTask } from "~/lib/celebrations/service";
import type { CardParts } from "~/lib/celebrations/service";
import { themesFor } from "~/lib/celebrations/themes";
import { resolveWriter } from "~/lib/team/auth";
import type { CelebrationRow } from "~/app/save-calls/components/CelebrationsView";

export const dynamic = "force-dynamic";
export const maxDuration = 180; // a render fetches the background and the photo; a new background is one image call (~15–60 s)

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 864e5;

/** A founder's Slack id by first name, full name or alias; null when none or several match, or they have no Slack */
async function slackIdByName(raw: string, businessId: string): Promise<string | null> {
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  const rows = await db
    .select({ name: user.name, aliases: TeamProfile.aliases, slackUserId: TeamProfile.slackUserId })
    .from(TeamProfile)
    .innerJoin(user, eq(user.id, TeamProfile.userId))
    .where(and(eq(TeamProfile.businessId, businessId), eq(TeamProfile.active, true)));
  const hits = rows.filter((r) => r.name.toLowerCase() === q || r.name.split(" ")[0]?.toLowerCase() === q || r.aliases.some((a) => a.toLowerCase() === q));
  return hits.length === 1 ? (hits[0]?.slackUserId ?? null) : null;
}

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  try {
    const businessId = await getGymBusinessId();
    const today = iso(new Date());
    const since = iso(new Date(Date.now() - 30 * DAY));
    const rows = await db
      .select({
        id: Celebration.id,
        memberId: Celebration.memberId,
        memberName: Celebration.memberName,
        type: Celebration.type,
        occasionDate: Celebration.occasionDate,
        detail: Celebration.detail,
        themeKey: Celebration.themeKey,
        headline: Celebration.headline,
        subline: Celebration.subline,
        usePhoto: Celebration.usePhoto,
        backgroundUrl: Celebration.backgroundUrl,
        photoSource: Celebration.photoSource,
        status: Celebration.status,
        imageUrl: Celebration.imageUrl,
        renderedAt: Celebration.renderedAt,
        postedAt: Celebration.postedAt,
        skippedAt: Celebration.skippedAt,
        skippedReason: Celebration.skippedReason,
        actedBy: user.name,
      })
      .from(Celebration)
      .leftJoin(user, eq(user.id, sql`coalesce(${Celebration.postedBy}, ${Celebration.skippedBy})`))
      .where(
        and(
          eq(Celebration.businessId, businessId),
          or(eq(Celebration.status, "ready"), sql`coalesce(${Celebration.postedAt}, ${Celebration.skippedAt}) >= ${since}::date`),
        ),
      )
      .orderBy(Celebration.occasionDate, desc(Celebration.createdAt));

    const celebrations: CelebrationRow[] = rows.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.memberName,
      type: r.type,
      occasionDate: r.occasionDate,
      daysAway: Math.round((Date.parse(r.occasionDate) - Date.parse(today)) / DAY),
      detail: r.detail,
      themeKey: r.themeKey,
      customWords: r.headline !== null || r.subline !== null,
      photo: r.photoSource ? "shown" : r.usePhoto ? "none" : "off",
      ownBackground: !!r.backgroundUrl,
      status: r.status,
      imageUrl: r.imageUrl,
      renderedAt: r.renderedAt?.toISOString() ?? null,
      postedAt: r.postedAt?.toISOString() ?? null,
      skippedAt: r.skippedAt?.toISOString() ?? null,
      skippedReason: r.skippedReason,
      actedBy: r.actedBy ?? null,
    }));
    return NextResponse.json({
      status: "ok",
      celebrations,
      ready: celebrations.filter((c) => c.status === "ready").map((c) => c.id),
      daysAhead: DAYS_AHEAD,
      designs: { birthday: themesFor("birthday").map((t) => t.key), milestone: themesFor("milestone").map((t) => t.key) },
      _meta: { generatedAt: new Date().toISOString(), today, recentSince: since },
    });
  } catch (err) {
    console.error("[API /agent/celebrations] Error:", err);
    return NextResponse.json({ error: "Failed to load celebrations", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

type PostBody = CardParts & {
  id?: string;
  action?: string;
  reason?: string;
  actorSlackUserId?: string;
  sendToSlackUserId?: string;
  toSlackUserId?: string;
  toName?: string;
  text?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as PostBody;
  const writer = await resolveWriter(request, body.actorSlackUserId);
  if (writer instanceof NextResponse) return writer;
  const userId = writer.userId;

  const { id, action } = body;
  if (!id || !action) return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  // The Chief of Staff changes and sends cards; posted/skipped go through the task (task_update)
  if (writer.via === "agent" && action !== "rebuild" && action !== "send") return NextResponse.json({ error: `The agent key can't ${action} a card` }, { status: 403 });

  try {
    const businessId = await getGymBusinessId();
    const [c] = await db
      .select({ id: Celebration.id, status: Celebration.status, memberId: Celebration.memberId, memberName: Celebration.memberName, type: Celebration.type, occasionDate: Celebration.occasionDate })
      .from(Celebration)
      .where(and(eq(Celebration.id, id), eq(Celebration.businessId, businessId)))
      .limit(1);
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const now = new Date();

    if (action === "posted" || action === "skipped") {
      if (c.status !== "ready") return NextResponse.json({ error: `Already ${c.status}` }, { status: 409 });
      await db
        .update(Celebration)
        .set(
          action === "posted"
            ? { status: "posted", postedAt: now, postedBy: userId }
            : { status: "skipped", skippedAt: now, skippedBy: userId, skippedReason: body.reason?.trim().slice(0, 500) ?? null },
        )
        .where(eq(Celebration.id, id));
      // The accountability side: the founder's task is done (posted) or cancelled (skipped)
      await settleTask(c, action, { kind: "person", userId }).catch((err) => console.warn("[API /agent/celebrations] task not settled:", err instanceof Error ? err.message : err));
      return NextResponse.json({ id, status: action, at: now.toISOString() });
    }
    if (action === "reopen") {
      await db
        .update(Celebration)
        .set({ status: "ready", postedAt: null, postedBy: null, skippedAt: null, skippedBy: null, skippedReason: null })
        .where(eq(Celebration.id, id));
      return NextResponse.json({ id, status: "ready" });
    }
    if (action === "rerender") {
      const card = await renderCard(id);
      return NextResponse.json({ id, imageUrl: card.imageUrl, renderedAt: now.toISOString() });
    }
    if (action === "rebuild") {
      const card = await rebuildCard(id, { design: body.design, headline: body.headline, subline: body.subline, photo: body.photo, background: body.background, backgroundHint: body.backgroundHint });
      console.log(`[API /agent/celebrations] ${writer.name} rebuilt card ${id} (${writer.via})`);
      let sent: boolean | string = false;
      if (body.sendToSlackUserId) {
        // The card is rebuilt either way; a failed DM is reported, not thrown
        sent = await sendCard(id, body.sendToSlackUserId).then(
          () => true,
          (err: unknown) => (err instanceof Error ? err.message : String(err)),
        );
      }
      return NextResponse.json({ id, memberName: c.memberName, occasionDate: c.occasionDate, card, renderedAt: now.toISOString(), sent });
    }
    if (action === "send") {
      const to = body.toSlackUserId ?? (body.toName ? await slackIdByName(body.toName, businessId) : null);
      if (!to) {
        const reason = body.toName ? `Couldn't find one founder with a Slack account called "${body.toName}".` : "toSlackUserId or toName is required";
        return NextResponse.json({ status: "refused", reason }, { status: 409 });
      }
      const sent = await sendCard(id, to, body.text);
      console.log(`[API /agent/celebrations] ${writer.name} sent card ${id} to ${to} (${writer.via})`);
      return NextResponse.json({ id, status: "sent", to, ...sent });
    }
    return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });
  } catch (err) {
    if (err instanceof CardChangeError) return NextResponse.json({ status: "refused", reason: err.message }, { status: 409 });
    console.error("[API /agent/celebrations] Error:", err);
    return NextResponse.json({ error: "Failed to update celebration", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
