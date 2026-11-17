/**
 * The meeting record for the gym Chief of Staff (lib/team/meetings.ts).
 * GET  /api/agent/meetings          the index: every saved meeting, newest first, one line each
 *                                   { meetings: [{ id, day, title, headings, url }] }
 * GET  /api/agent/meetings?q=words  the sections that mention those words, best first
 *                                   { words, meetingsSearched, hits: [{ meetingId, day, title, heading, text, matched }] }
 *                                   Founders, or the OpenClaw key (read-only).
 * POST /api/agent/meetings          save a meeting's summary { url, title, heldAt, notes }.
 *                                   The same note again replaces its text. The Mini's write key
 *                                   (X-TEAM-AGENT-KEY), or a signed-in founder.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { agentWriteKeyOk, resolveWriter } from "~/lib/team/auth";
import { listMeetings, saveMeeting, searchMeetings } from "~/lib/team/meetings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (q) return NextResponse.json(await searchMeetings(q));
    return NextResponse.json({ meetings: await listMeetings() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent/meetings] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!agentWriteKeyOk(request)) {
    const writer = await resolveWriter(request);
    if (writer instanceof NextResponse) return writer;
  }
  const body = (await request.json().catch(() => null)) as { url?: unknown; title?: unknown; heldAt?: unknown; notes?: unknown } | null;
  if (!body || typeof body.url !== "string" || typeof body.title !== "string" || typeof body.heldAt !== "string" || typeof body.notes !== "string") {
    return NextResponse.json({ error: "Send { url, title, heldAt, notes }" }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await saveMeeting({ url: body.url, title: body.title, heldAt: body.heldAt, notes: body.notes })) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent/meetings] save failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
