/**
 * At-Risk Members API for OpenClaw Retention Specialist
 * GET /api/agent/at-risk?month=10&year=2026
 *
 * Returns members who haven't attended a class/session recently.
 * Combines finalized KPI data (source of truth for paying members)
 * with live GymMaster booking data (attendance tracking).
 */

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiMemberOverride } from "@acme/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { getKpiRoster } from "~/lib/kpi-roster";
import { getPlanPrices } from "~/lib/plan-price";
import { fetchGymMasterReport } from "~/lib/gymmaster-report";
import { getMemberPhone } from "~/lib/gymmaster-member";

export const dynamic = "force-dynamic";

// Status tiers based on days gone
const STATUS_TIERS = {
  BEST_ODDS: { maxDays: 14, label: "Best odds", returnRate: 63 },
  FADING: { maxDays: 30, label: "Fading", returnRate: 39 },
  LONG_SHOT: { maxDays: 45, label: "Long shot", returnRate: 28 },
  CRITICAL: { maxDays: Infinity, label: "Critical", returnRate: 15 },
};

// Valid booking results that count as "attended"
const VALID_ATTENDANCE = ["Booking", "Showed", "Showed late"];

interface BookingRow {
  "Member ID": number;
  Name: string;
  "Booking Date": string;
  "Booking Start Time": string;
  "Booking Result": string;
  "Class Name": string | null;
  Service: string;
}

interface WeeklyVisits {
  week0: number;
  week1: number;
  week2: number;
  week3: number;
  week4: number;
}

interface AtRiskMember {
  memberId: string;
  name: string;
  daysGone: number;
  lastAttendance: string | null;
  lastAttendanceTime: string | null;
  statusTier: string;
  returnRate: number;
  monthlyRevenue: number;
  paidBy: string | null; // payer's name when another member pays for them
  planPrice?: string | null; // GymMaster plan price per month, e.g. "$148/mo"
  lastClass: string | null;
  memberSince: string | null;
  membershipType: string | null;
  phone: string | null;
  tenureMonths: number;
  weeklyVisits: WeeklyVisits;
  totalVisits: number;
}

interface CurrentMemberRow {
  "Member ID": number;
  Name?: string;
  "Member Name"?: string;
  "Membership Start Date": string;
  "Membership Type Name"?: string;
  "Membership Type"?: string;
  "Member Cell"?: string;
  "Mobile"?: string;
  "Phone"?: string;
}

function getStatusTier(daysGone: number): { label: string; returnRate: number } {
  if (daysGone <= STATUS_TIERS.BEST_ODDS.maxDays) return STATUS_TIERS.BEST_ODDS;
  if (daysGone <= STATUS_TIERS.FADING.maxDays) return STATUS_TIERS.FADING;
  if (daysGone <= STATUS_TIERS.LONG_SHOT.maxDays) return STATUS_TIERS.LONG_SHOT;
  return STATUS_TIERS.CRITICAL;
}

function parseGymMasterDate(dateStr: string): Date {
  // GymMaster format: "Oct 1 2026"
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

  // Fallback parsing
  const parts = dateStr.match(/(\w+)\s+(\d+)\s+(\d+)/);
  if (parts) {
    return new Date(`${parts[1]} ${parts[2]}, ${parts[3]}`);
  }
  return new Date();
}

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getWeekNumber(date: Date, referenceDate: Date): number {
  const diffTime = referenceDate.getTime() - date.getTime();
  return Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
}

async function fetchGymMasterBookings(startDate: string, endDate: string): Promise<BookingRow[]> {
  return (await fetchGymMasterReport(9, startDate, endDate)) as unknown as BookingRow[];
}

async function fetchGymMasterCurrentMembers(): Promise<CurrentMemberRow[]> {
  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = now.toISOString().split("T")[0]!;
  return (await fetchGymMasterReport(1, startDate, endDate)) as unknown as CurrentMemberRow[];
}

export async function GET(request: NextRequest) {
  // Validate API key or session
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const monthStr = searchParams.get("month");
  const yearStr = searchParams.get("year");

  // Default to current month if not specified
  const now = new Date();
  const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
  const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

  if (month < 1 || month > 12) {
    return NextResponse.json(
      { error: "Invalid month. Must be 1-12." },
      { status: 400 }
    );
  }

  try {
    // 1. Members the KPI overview counts (rolled from finalized snapshots + KPI overrides)
    const roster = await getKpiRoster();

    if (!roster) {
      return NextResponse.json({
        status: "no_data",
        message: "No finalized KPI snapshot found. Please finalize a month first.",
        atRiskMembers: [],
        _meta: {
          generatedAt: new Date().toISOString(),
        },
      });
    }

    const snapshotData = { month: roster.month, year: roster.year, status: "finalized" };
    const payingMembers = roster.members;

    if (payingMembers.length === 0) {
      return NextResponse.json({
        status: "no_members",
        message: "No members in the KPI roster.",
        atRiskMembers: [],
        _meta: {
          generatedAt: new Date().toISOString(),
          snapshotMonth: snapshotData.month,
          snapshotYear: snapshotData.year,
        },
      });
    }

    // 1b. Members manually excluded from the at-risk list
    // (exclude_from_new / exclude_from_lost are already applied by the roster)
    let overrides: { memberId: string }[] = [];
    try {
      overrides = await db
        .select({ memberId: KpiMemberOverride.memberId })
        .from(KpiMemberOverride)
        .where(eq(KpiMemberOverride.overrideType, "exclude_from_at_risk"));
    } catch (err) {
      console.warn("[at-risk] exclude_from_at_risk enum not migrated, no at-risk exclusions applied");
    }

    const excludedMemberIds = new Set(overrides.map(o => o.memberId));

    // 2. Query GymMaster for booking data (last 60 days) and current members
    const endDate = now.toISOString().split("T")[0]!;
    const startDateObj = new Date(now);
    startDateObj.setDate(startDateObj.getDate() - 60);
    const startDate = startDateObj.toISOString().split("T")[0]!;

    let bookings: BookingRow[] = [];
    let currentMembers: CurrentMemberRow[] = [];
    let gymMasterError: string | null = null;

    try {
      // Fetch bookings and current members in parallel
      const [bookingsResult, membersResult] = await Promise.all([
        fetchGymMasterBookings(startDate, endDate),
        fetchGymMasterCurrentMembers(),
      ]);
      bookings = bookingsResult;
      currentMembers = membersResult;
    } catch (err) {
      gymMasterError = err instanceof Error ? err.message : "Unknown error";
      console.error("[API /agent/at-risk] GymMaster error:", gymMasterError);
    }

    // 3. Build a map of member ID -> member info (start date, type, phone)
    const memberInfoMap = new Map<string, {
      memberSince: string | null;
      membershipType: string | null;
      phone: string | null;
      tenureMonths: number;
    }>();
    for (const member of currentMembers) {
      const memberId = String(member["Member ID"]);
      const startDateStr = member["Membership Start Date"];
      const membershipType = member["Membership Type Name"] || member["Membership Type"] || null;
      const phone = member["Member Cell"] || member["Mobile"] || member["Phone"] || null;

      let memberSince: string | null = null;
      let tenureMonths = 0;

      if (startDateStr) {
        const parsed = parseGymMasterDate(startDateStr);
        if (!isNaN(parsed.getTime())) {
          memberSince = parsed.toISOString().split("T")[0] ?? null;
          tenureMonths = Math.floor((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 30));
        }
      }

      if (memberId) {
        memberInfoMap.set(memberId, {
          memberSince,
          membershipType: membershipType ? String(membershipType) : null,
          phone: phone ? String(phone) : null,
          tenureMonths,
        });
      }
    }

    // 4. Build a map of member ID -> last valid attendance AND weekly visits
    const lastAttendanceMap = new Map<string, { date: Date; time: string | null; className: string | null }>();
    const weeklyVisitsMap = new Map<string, WeeklyVisits>();

    for (const booking of bookings) {
      if (!VALID_ATTENDANCE.includes(booking["Booking Result"])) continue;

      const memberId = String(booking["Member ID"]);
      const bookingDate = parseGymMasterDate(booking["Booking Date"]);
      const bookingTime = booking["Booking Start Time"] || null;
      const className = booking["Class Name"] || booking["Service"] || null;

      // Track last attendance
      const existing = lastAttendanceMap.get(memberId);
      if (!existing || bookingDate > existing.date) {
        lastAttendanceMap.set(memberId, { date: bookingDate, time: bookingTime, className });
      }

      // Track weekly visits
      const weeksAgo = getWeekNumber(bookingDate, now);
      if (weeksAgo >= 0 && weeksAgo <= 4) {
        if (!weeklyVisitsMap.has(memberId)) {
          weeklyVisitsMap.set(memberId, { week0: 0, week1: 0, week2: 0, week3: 0, week4: 0 });
        }
        const visits = weeklyVisitsMap.get(memberId)!;
        if (weeksAgo === 0) visits.week0++;
        else if (weeksAgo === 1) visits.week1++;
        else if (weeksAgo === 2) visits.week2++;
        else if (weeksAgo === 3) visits.week3++;
        else if (weeksAgo === 4) visits.week4++;
      }
    }

    // 5. Calculate days gone for each paying member
    const atRiskMembers: AtRiskMember[] = [];

    for (const member of payingMembers) {
      const lastAttendance = lastAttendanceMap.get(member.memberId);

      let daysGone: number;
      let lastAttendanceStr: string | null = null;
      let lastAttendanceTime: string | null = null;
      let lastClass: string | null = null;

      if (lastAttendance) {
        daysGone = daysBetween(lastAttendance.date, now);
        lastAttendanceStr = lastAttendance.date.toISOString().split("T")[0] ?? null;
        lastAttendanceTime = lastAttendance.time;
        lastClass = lastAttendance.className;
      } else {
        // No booking found in last 60 days
        daysGone = 60;
      }

      // Only include members who are "at risk" (14+ days gone) and not excluded
      if (daysGone >= 14 && !excludedMemberIds.has(member.memberId)) {
        const tier = getStatusTier(daysGone);
        const memberInfo = memberInfoMap.get(member.memberId);
        const weeklyVisits = weeklyVisitsMap.get(member.memberId) || { week0: 0, week1: 0, week2: 0, week3: 0, week4: 0 };
        const totalVisits = weeklyVisits.week0 + weeklyVisits.week1 + weeklyVisits.week2 + weeklyVisits.week3;
        atRiskMembers.push({
          memberId: member.memberId,
          name: member.name,
          daysGone,
          lastAttendance: lastAttendanceStr,
          lastAttendanceTime,
          statusTier: tier.label,
          returnRate: tier.returnRate,
          monthlyRevenue: member.revenue,
          paidBy: member.paidBy?.name ?? null,
          lastClass,
          memberSince: memberInfo?.memberSince || null,
          membershipType: memberInfo?.membershipType || null,
          phone: memberInfo?.phone || null,
          tenureMonths: memberInfo?.tenureMonths || 0,
          weeklyVisits,
          totalVisits,
        });
      }
    }

    // 5. Sort by days gone (most urgent first)
    atRiskMembers.sort((a, b) => b.daysGone - a.daysGone);

    const planPrices = await getPlanPrices(atRiskMembers.map(m => m.memberId));
    for (const m of atRiskMembers) m.planPrice = planPrices.get(m.memberId) ?? null;
    // The new account's members report has no phone column: look the missing ones up
    await Promise.all(atRiskMembers.filter(m => !m.phone).map(async m => { m.phone = await getMemberPhone(m.memberId).catch(() => null); }));

    // 6. Build summary stats
    const summary = {
      totalAtRisk: atRiskMembers.length,
      byTier: {
        bestOdds: atRiskMembers.filter(m => m.statusTier === "Best odds").length,
        fading: atRiskMembers.filter(m => m.statusTier === "Fading").length,
        longShot: atRiskMembers.filter(m => m.statusTier === "Long shot").length,
        critical: atRiskMembers.filter(m => m.statusTier === "Critical").length,
      },
      revenueAtRisk: Math.round(atRiskMembers.reduce((sum, m) => sum + m.monthlyRevenue, 0) * 100) / 100,
    };

    return NextResponse.json({
      status: gymMasterError ? "partial" : "live",
      warning: gymMasterError ? `GymMaster unavailable: ${gymMasterError}. Showing members without recent attendance data.` : null,
      month,
      year,
      summary,
      atRiskMembers,
      _meta: {
        generatedAt: new Date().toISOString(),
        dataSource: gymMasterError ? "supabase_only" : "supabase+gymmaster",
        snapshotMonth: snapshotData.month,
        snapshotYear: snapshotData.year,
        snapshotStatus: snapshotData.status,
        bookingsQueried: bookings.length,
        lookbackDays: 60,
        excludedByOverride: excludedMemberIds.size,
      },
    });
  } catch (error) {
    console.error("[API /agent/at-risk] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to fetch at-risk members: ${message}` },
      { status: 500 }
    );
  }
}
