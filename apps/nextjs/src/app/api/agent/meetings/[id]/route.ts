/**
 * One meeting in full, for the gym Chief of Staff (lib/team/meetings.ts).
 * GET /api/agent/meetings/<id or YYYY-MM-DD>   { meetings: [{ id, day, title, headings, url, notes }] }
 * A day with several meetings returns them all; an unknown id or an empty day returns none.
 * Founders, or the OpenClaw key (read-only).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { getMeetings } from "~/lib/team/meetings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  try {
    const { id } = await params;
    return NextResponse.json({ meetings: await getMeetings(decodeURIComponent(id)) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent/meetings/id] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
