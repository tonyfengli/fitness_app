/**
 * Class attendance API for the Retention > Classes view
 * GET /api/agent/classes?start=YYYY-MM-DD&end=YYYY-MM-DD (default: the 28 days ending yesterday)
 *
 * Per class slot: sessions, visits and average attendance per session, for the range
 * and the previous period of the same length. Logic in ~/lib/class-attendance.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { addDays, DATA_START, getClassAttendance, iso } from "~/lib/class-attendance";

export const dynamic = "force-dynamic";

const isoDate = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  const params = request.nextUrl.searchParams;
  const yesterday = addDays(iso(new Date()), -1);
  const end = isoDate(params.get("end")) ?? yesterday;
  let start = isoDate(params.get("start")) ?? addDays(end, -27);
  if (start < DATA_START) start = DATA_START;
  if (start > end) return NextResponse.json({ error: "start must be on or before end" }, { status: 400 });

  try {
    const data = await getClassAttendance(start, end);
    return NextResponse.json({
      status: "ok",
      ...data,
      _meta: { generatedAt: new Date().toISOString(), countingSince: DATA_START },
    });
  } catch (err) {
    console.error("[API /agent/classes] Error:", err);
    return NextResponse.json(
      { error: "Failed to load class attendance", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
