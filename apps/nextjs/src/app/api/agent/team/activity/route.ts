/**
 * The shared activity record, as the Chief of Staff reads it.
 * GET /api/agent/team/activity?slackUserId=U…&minutes=60   what the Chief sent to or changed for
 *                                                          that person, newest first (default: last 60 minutes)
 * GET /api/agent/team/activity?all=1&minutes=1440          everyone's (only when a founder asks for it)
 * Founders, or the read-only OpenClaw key. Written by lib/team/activity.ts; nothing writes through this route.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { recentActivity } from "~/lib/team/activity";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  const q = request.nextUrl.searchParams;
  const slackUserId = q.get("slackUserId") ?? undefined;
  const all = q.get("all") === "1";
  if (!slackUserId && !all) return NextResponse.json({ error: "slackUserId is required (or all=1)" }, { status: 400 });
  const minutes = Math.min(Math.max(Number(q.get("minutes")) || 60, 1), 7 * 24 * 60);
  try {
    const activity = await recentActivity({ slackUserId: all ? undefined : slackUserId, minutes });
    return NextResponse.json({ status: "ok", for: all ? "everyone" : slackUserId, minutes, activity, _meta: { generatedAt: new Date().toISOString() } });
  } catch (err) {
    console.error("[API /agent/team/activity] Error:", err);
    return NextResponse.json({ error: "Failed to load activity", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
