/**
 * Class roster: who is booked into each class on one day (past or upcoming), live from GymMaster.
 * GET /api/agent/classes/roster?date=YYYY-MM-DD (default: today, Pacific)
 * Optional: classType (substring, case-insensitive), time ("5 pm", "5pm", "17:00").
 * Logic in ~/lib/class-attendance (getClassRoster).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { getClassRoster } from "~/lib/class-attendance";

export const dynamic = "force-dynamic";

const todayPacific = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());

// "5 pm" / "5pm" / "5:00 pm" / "17:00" → "5 pm"; "8:30am" → "8:30 am"
function normalizeTime(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  let m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (m) return `${Number(m[1])}${m[2] && m[2] !== "00" ? `:${m[2]}` : ""} ${m[3]}`;
  m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = Number(m[1]);
    return `${h % 12 || 12}${m[2] !== "00" ? `:${m[2]}` : ""} ${h >= 12 ? "pm" : "am"}`;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  const q = request.nextUrl.searchParams;
  const dateParam = q.get("date");
  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  const date = dateParam ?? todayPacific();
  const classType = q.get("classType")?.trim().toLowerCase();
  const timeParam = q.get("time");
  const time = timeParam ? normalizeTime(timeParam) : null;
  if (timeParam && !time) return NextResponse.json({ error: "time must look like 5pm, 5:30 am or 17:00" }, { status: 400 });

  try {
    let sessions = await getClassRoster(date);
    if (classType) sessions = sessions.filter((s) => s.classType.toLowerCase().includes(classType));
    if (time) sessions = sessions.filter((s) => s.time === time);
    return NextResponse.json({ status: "ok", date, filters: { classType: classType ?? null, time }, sessions, _meta: { generatedAt: new Date().toISOString() } });
  } catch (err) {
    console.error("[API /agent/classes/roster] Error:", err);
    return NextResponse.json({ error: "Failed to load class roster", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
