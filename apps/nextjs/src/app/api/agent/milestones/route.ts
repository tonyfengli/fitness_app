/**
 * Milestones API for the Save Calls milestones tab
 * GET /api/agent/milestones
 *
 * Counts each KPI-roster member's attended classes since booking data became
 * reliable (Aug 1, 2026) and reports the milestones they've reached (25, 50, 60,
 * 80, 100, then every 25), with the date of each, and how far they are from the next.
 * Attendance follows the Retention rule: Booking, Showed and Showed late count
 * (classes and Open Gym); No show and cancellations don't.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { getKpiRoster } from "~/lib/kpi-roster";
import { getPlanPrices } from "~/lib/plan-price";
import type { MilestoneRow } from "~/app/save-calls/types";
import { milestoneGroups } from "~/app/save-calls/rules";

export const dynamic = "force-dynamic";

// Booking data before this date is unreliable
const COUNT_START_DATE = "2026-08-01";

// Valid booking results that count as "attended" (same as Retention)
const VALID_ATTENDANCE = ["Booking", "Showed", "Showed late"];

const BASE_MILESTONES = [25, 50, 60, 80, 100];
const MILESTONE_STEP_AFTER = 25; // 125, 150, ... after the base list

type ReportRow = Record<string, string | number | null>;

const iso = (d: Date) => d.toISOString().slice(0, 10);

function parseGymMasterDate(s: unknown): string {
  const d = new Date(String(s ?? ""));
  return isNaN(d.getTime()) ? "" : iso(d);
}

// Milestones up to and including the first one above `count`
function milestonesThrough(count: number): number[] {
  const list = [...BASE_MILESTONES];
  while (list[list.length - 1]! <= count) list.push(list[list.length - 1]! + MILESTONE_STEP_AFTER);
  return list;
}

async function fetchReport(reportId: number, startDate: string, endDate: string): Promise<ReportRow[]> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing GymMaster configuration");

  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": apiKey },
      body: JSON.stringify({ report_id: reportId, start_date: startDate, end_date: endDate }),
    });
    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 1500 * 2 ** attempt));
      continue;
    }
    if (!response.ok) throw new Error(`GymMaster report ${reportId} error: ${response.status}`);
    const data = await response.json();
    return data.result || [];
  }
  throw new Error(`GymMaster report ${reportId} rate limited`);
}

async function fetchMemberPhone(memberId: string): Promise<string | null> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_STAFF_API_KEY;
  if (!baseUrl || !apiKey) return null;
  const response = await fetch(`${baseUrl}/api/v3/member/${memberId}`, {
    headers: { Accept: "application/json", "X-GM-API-KEY": apiKey },
  });
  if (!response.ok) return null;
  const record = await response.json();
  const m = (Array.isArray(record) ? record[0] : record) as { phonecell?: string; phonehome?: string; phonework?: string } | undefined;
  return m?.phonecell || m?.phonehome || m?.phonework || null;
}

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  try {
    const roster = await getKpiRoster();
    if (!roster) {
      return NextResponse.json({
        status: "no_data",
        message: "No finalized KPI snapshot found. Please finalize a month first.",
        members: [],
      });
    }

    const now = new Date();
    const today = iso(now);
    const [bookings, currentMembers, planPrices] = await Promise.all([
      fetchReport(9, COUNT_START_DATE, today),
      fetchReport(1, `${today.slice(0, 7)}-01`, today),
      getPlanPrices(roster.members.map(m => m.memberId)),
    ]);

    // Attended class dates per member, oldest first
    const attended = new Map<string, string[]>();
    for (const b of bookings) {
      if (!VALID_ATTENDANCE.includes(String(b["Booking Result"] ?? ""))) continue;
      const date = parseGymMasterDate(b["Booking Date"]);
      if (!date || date < COUNT_START_DATE || date > today) continue;
      const memberId = String(b["Member ID"] ?? "");
      if (!attended.has(memberId)) attended.set(memberId, []);
      attended.get(memberId)!.push(date);
    }
    for (const dates of attended.values()) dates.sort();

    const currentById = new Map(currentMembers.map(r => [String(r["Member ID"] ?? ""), r]));
    const weeksCounted = Math.max(1, (Date.parse(today) - Date.parse(COUNT_START_DATE)) / (7 * 864e5));

    const members = await Promise.all(
      roster.members.map(async (m): Promise<MilestoneRow> => {
        const dates = attended.get(m.memberId) || [];
        const count = dates.length;
        const list = milestonesThrough(count);
        const row = currentById.get(m.memberId);
        let phone = row?.["Member Cell"] ? String(row["Member Cell"]) : null;
        if (!phone) phone = await fetchMemberPhone(m.memberId).catch(() => null);
        const next = list.find(n => n > count)!;
        return {
          memberId: m.memberId,
          name: m.name,
          plan: row?.["Membership Type Name"] ? String(row["Membership Type Name"]) : "",
          planPrice: planPrices.get(m.memberId) ?? null,
          phone,
          classes: count,
          // The Nth attended class is the day milestone N was reached
          reached: list.filter(n => n <= count).map(n => ({ milestone: n, date: dates[n - 1]! })),
          next,
          toGo: next - count,
          perWeek: Math.round((count / weeksCounted) * 10) / 10,
          lastClass: dates[dates.length - 1] ?? null,
        };
      })
    );

    members.sort((a, b) => b.classes - a.classes || a.name.localeCompare(b.name));

    // Same groups as the dashboard's "Just hit" and "Coming up" blocks
    const { justHit, comingUp } = milestoneGroups(members);
    return NextResponse.json({
      status: "ok",
      members,
      justHit: justHit.map(m => m.memberId),
      comingUp: comingUp.map(m => m.memberId),
      _meta: {
        generatedAt: new Date().toISOString(),
        countingSince: COUNT_START_DATE,
        snapshotMonth: roster.month,
        snapshotYear: roster.year,
      },
    });
  } catch (err) {
    console.error("[API /agent/milestones] Error:", err);
    return NextResponse.json(
      { error: "Failed to load milestones", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
