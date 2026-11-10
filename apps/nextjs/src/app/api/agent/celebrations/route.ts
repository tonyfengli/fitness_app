/**
 * Celebrations for the Retention tab and the gym Chief of Staff.
 * GET  /api/agent/celebrations   cards ready to post (soonest first) and the last 30 days of
 *                                posted/skipped ones. Founders, or the OpenClaw key (read-only).
 * POST /api/agent/celebrations   founders only. { id, action: "posted" | "skipped" | "reopen" | "rerender", reason? }
 *                                posted/skipped record who and when; reopen undoes either;
 *                                rerender rebuilds the card (new photo, new theme art).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq, or, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { Celebration, user } from "@acme/db/schema";
import { auth } from "~/auth/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { getGymBusinessId } from "~/lib/business";
import { renderCard } from "~/lib/celebrations/service";
import type { CelebrationRow } from "~/app/save-calls/components/CelebrationsView";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // rerender fetches the background and the photo

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 864e5;

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
      _meta: { generatedAt: new Date().toISOString(), today, recentSince: since },
    });
  } catch (err) {
    console.error("[API /agent/celebrations] Error:", err);
    return NextResponse.json({ error: "Failed to load celebrations", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const userId = session?.user.id;
  if (!userId) return NextResponse.json({ error: "Sign in as a founder." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { id?: string; action?: string; reason?: string };
  const { id, action } = body;
  if (!id || !action) return NextResponse.json({ error: "id and action are required" }, { status: 400 });

  try {
    const businessId = await getGymBusinessId();
    const [c] = await db.select({ id: Celebration.id, status: Celebration.status }).from(Celebration).where(and(eq(Celebration.id, id), eq(Celebration.businessId, businessId))).limit(1);
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
      const imageUrl = await renderCard(id);
      return NextResponse.json({ id, imageUrl, renderedAt: now.toISOString() });
    }
    return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[API /agent/celebrations] Error:", err);
    return NextResponse.json({ error: "Failed to update celebration", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
