/**
 * Frequency Alerts API for OpenClaw Retention Specialist
 * GET /api/agent/frequency-alerts
 *
 * Returns members with frequency-based alerts:
 * - Slowing: habit broke (50%+ drop from baseline)
 * - Below healthy: never built habit (<1.5 visits/week)
 * - New member risk: <8 weeks tenure with low engagement
 *
 * Uses booking data starting from BOOKING_DATA_START_DATE (2026-08-01)
 */

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiMemberOverride } from "@acme/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { getKpiRoster } from "~/lib/kpi-roster";
import { getPlanPrices } from "~/lib/plan-price";

export const dynamic = "force-dynamic";

// Booking data before this date is unreliable
const BOOKING_DATA_START_DATE = new Date("2026-08-01");

// Thresholds
const HEALTHY_VISITS_PER_WEEK = 1.5;
const SLOWING_DROP_THRESHOLD = 0.5; // 50% drop
const MIN_BASELINE_FOR_SLOWING = 1.5; // Must have been visiting 1.5+/week
const MIN_DROP_VISITS = 1; // Drop must be at least 1 visit/week

// Valid booking results that count as "attended"
const VALID_ATTENDANCE = ["Booking", "Showed", "Showed late"];

interface BookingRow {
  "Member ID": number;
  "Booking Date": string;
  "Booking Result": string;
}

interface CurrentMemberRow {
  "Member ID": number;
  "Member Name"?: string;
  "Membership Start Date": string;
  "Membership Type Name"?: string;
  "Member Cell"?: string;
}

interface WeeklyVisits {
  week0: number;
  week1: number;
  week2: number;
  week3: number;
  week4: number;
}

interface FrequencyMember {
  memberId: string;
  name: string;
  alertType: "slowing" | "below_healthy" | "new_member_risk";
  membershipType: string | null;
  planPrice?: string | null; // GymMaster plan price per month, e.g. "$148/mo"
  phone: string | null;
  tenureWeeks: number;
  // Frequency data
  baselineVisitsPerWeek: number | null; // null for new members
  recentVisitsPerWeek: number;
  dropPercent: number | null; // null if no baseline
  // For display
  recentVisits: number; // raw count last 4 weeks
  baselineVisits: number | null; // raw count weeks -12 to -5
  weeklyVisits: WeeklyVisits;
}

function parseGymMasterDate(dateStr: string): Date {
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;
  const parts = dateStr.match(/(\w+)\s+(\d+)\s+(\d+)/);
  if (parts) {
    return new Date(`${parts[1]} ${parts[2]}, ${parts[3]}`);
  }
  return new Date();
}

function getWeekNumber(date: Date, referenceDate: Date): number {
  // Returns how many weeks ago this date was relative to reference
  const diffTime = referenceDate.getTime() - date.getTime();
  return Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
}

function getWeekStart(weeksAgo: number, referenceDate: Date): Date {
  const date = new Date(referenceDate);
  // Go to start of current week (Monday)
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  // Go back X weeks
  date.setDate(date.getDate() - (weeksAgo * 7));
  return date;
}

async function fetchGymMasterBookings(startDate: string, endDate: string): Promise<BookingRow[]> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing GymMaster configuration");
  }

  const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-GM-API-KEY": apiKey,
    },
    body: JSON.stringify({
      report_id: 9,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  if (!response.ok) {
    throw new Error(`GymMaster API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result || [];
}

async function fetchGymMasterCurrentMembers(): Promise<CurrentMemberRow[]> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing GymMaster configuration");
  }

  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = now.toISOString().split("T")[0];

  const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-GM-API-KEY": apiKey,
    },
    body: JSON.stringify({
      report_id: 1,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  if (!response.ok) {
    throw new Error(`GymMaster API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result || [];
}

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  const now = new Date();

  try {
    // 1. Members the KPI overview counts (rolled from finalized snapshots + KPI overrides)
    const roster = await getKpiRoster();

    if (!roster) {
      return NextResponse.json({
        status: "no_data",
        message: "No finalized KPI snapshot found.",
        slowing: [],
        belowHealthy: [],
        newMemberRisk: [],
      });
    }

    const payingMembers = roster.members;

    if (payingMembers.length === 0) {
      return NextResponse.json({
        status: "no_members",
        slowing: [],
        belowHealthy: [],
        newMemberRisk: [],
      });
    }

    // 2. Members manually excluded from the at-risk lists
    // (exclude_from_new / exclude_from_lost are already applied by the roster)
    let overrides: { memberId: string }[] = [];
    try {
      overrides = await db
        .select({ memberId: KpiMemberOverride.memberId })
        .from(KpiMemberOverride)
        .where(eq(KpiMemberOverride.overrideType, "exclude_from_at_risk"));
    } catch {
      console.warn("[frequency-alerts] exclude_from_at_risk enum not migrated, no exclusions applied");
    }
    const excludedMemberIds = new Set(overrides.map(o => o.memberId));

    // 3. Fetch bookings (last 12 weeks + buffer)
    const bookingStartDate = BOOKING_DATA_START_DATE.toISOString().split("T")[0]!;
    const endDate = now.toISOString().split("T")[0]!;

    const [bookings, currentMembers] = await Promise.all([
      fetchGymMasterBookings(bookingStartDate, endDate),
      fetchGymMasterCurrentMembers(),
    ]);

    // 4. Build member info map
    const memberInfoMap = new Map<string, {
      name: string;
      memberSince: Date | null;
      membershipType: string | null;
      phone: string | null;
    }>();

    for (const member of currentMembers) {
      const memberId = String(member["Member ID"]);
      const startDateStr = member["Membership Start Date"];
      let memberSince: Date | null = null;

      if (startDateStr) {
        const parsed = parseGymMasterDate(startDateStr);
        if (!isNaN(parsed.getTime())) {
          memberSince = parsed;
        }
      }

      memberInfoMap.set(memberId, {
        name: member["Member Name"] || "Unknown",
        memberSince,
        membershipType: member["Membership Type Name"] || null,
        phone: member["Member Cell"] || null,
      });
    }

    // 5. Build visits by member by week
    // Week 0 = current week, Week 1 = last week, etc.
    const visitsByMemberByWeek = new Map<string, Map<number, number>>();

    for (const booking of bookings) {
      if (!VALID_ATTENDANCE.includes(booking["Booking Result"])) continue;

      const memberId = String(booking["Member ID"]);
      const bookingDate = parseGymMasterDate(booking["Booking Date"]);

      // Skip bookings before our data start date
      if (bookingDate < BOOKING_DATA_START_DATE) continue;

      const weeksAgo = getWeekNumber(bookingDate, now);
      if (weeksAgo < 0 || weeksAgo > 20) continue; // Only look at last 20 weeks

      if (!visitsByMemberByWeek.has(memberId)) {
        visitsByMemberByWeek.set(memberId, new Map());
      }
      const memberWeeks = visitsByMemberByWeek.get(memberId)!;
      memberWeeks.set(weeksAgo, (memberWeeks.get(weeksAgo) || 0) + 1);
    }

    // 6. Calculate frequency metrics for each paying member
    const slowing: FrequencyMember[] = [];
    const belowHealthy: FrequencyMember[] = [];
    const newMemberRisk: FrequencyMember[] = [];

    const payingMemberIds = new Set(payingMembers.map((m: { memberId: string }) => m.memberId));

    for (const member of payingMembers) {
      if (excludedMemberIds.has(member.memberId)) continue;

      const info = memberInfoMap.get(member.memberId);
      if (!info) continue;

      // Calculate tenure in weeks
      let tenureWeeks = 52; // Default if unknown
      if (info.memberSince) {
        tenureWeeks = Math.floor((now.getTime() - info.memberSince.getTime()) / (7 * 24 * 60 * 60 * 1000));
      }

      const memberWeeks = visitsByMemberByWeek.get(member.memberId) || new Map();

      // Recent period: last 4 weeks including current week (weeks 0-3)
      let recentVisits = 0;
      for (let w = 0; w <= 3; w++) {
        recentVisits += memberWeeks.get(w) || 0;
      }
      const recentVisitsPerWeek = recentVisits / 4;

      // Note: We no longer exclude at-risk members since retention tab combines both

      // Build weekly visits object
      const weeklyVisits: WeeklyVisits = {
        week0: memberWeeks.get(0) || 0,
        week1: memberWeeks.get(1) || 0,
        week2: memberWeeks.get(2) || 0,
        week3: memberWeeks.get(3) || 0,
        week4: memberWeeks.get(4) || 0,
      };

      // NEW MEMBER RISK: < 8 weeks tenure
      if (tenureWeeks < 8) {
        // Weeks 0-1: expect >= 3 visits
        // Weeks 0-3: expect >= 6 visits
        const weeks0to1Visits = (memberWeeks.get(0) || 0) + (memberWeeks.get(1) || 0);

        const isNewMemberRisk = (tenureWeeks >= 2 && weeks0to1Visits < 3) ||
                                 (tenureWeeks >= 4 && recentVisits < 6);

        if (isNewMemberRisk) {
          newMemberRisk.push({
            memberId: member.memberId,
            name: info.name || member.name,
            alertType: "new_member_risk",
            membershipType: info.membershipType,
            phone: info.phone,
            tenureWeeks,
            baselineVisitsPerWeek: null,
            recentVisitsPerWeek,
            dropPercent: null,
            recentVisits,
            baselineVisits: null,
            weeklyVisits,
          });
        }
        continue; // New members don't get slowing/below healthy alerts
      }

      // BASELINE: weeks -12 to -5 (8 weeks, ending 1 month ago)
      // This means weeks 5-12 ago
      let baselineVisits = 0;
      let baselineWeeksWithData = 0;
      for (let w = 5; w <= 12; w++) {
        const visits = memberWeeks.get(w) || 0;
        baselineVisits += visits;
        if (visits > 0) baselineWeeksWithData++;
      }

      // Only calculate baseline if we have enough data (at least 4 weeks with visits)
      const hasBaseline = baselineWeeksWithData >= 4;
      const baselineVisitsPerWeek = hasBaseline ? baselineVisits / 8 : null;

      // SLOWING: 50%+ drop, baseline was >= 1.5/week, drop >= 1 visit/week
      if (hasBaseline && baselineVisitsPerWeek !== null && baselineVisitsPerWeek >= MIN_BASELINE_FOR_SLOWING) {
        const dropPercent = 1 - (recentVisitsPerWeek / baselineVisitsPerWeek);
        const dropAmount = baselineVisitsPerWeek - recentVisitsPerWeek;

        if (dropPercent >= SLOWING_DROP_THRESHOLD && dropAmount >= MIN_DROP_VISITS) {
          slowing.push({
            memberId: member.memberId,
            name: info.name || member.name,
            alertType: "slowing",
            membershipType: info.membershipType,
            phone: info.phone,
            tenureWeeks,
            baselineVisitsPerWeek,
            recentVisitsPerWeek,
            dropPercent: Math.round(dropPercent * 100),
            recentVisits,
            baselineVisits,
            weeklyVisits,
          });
          continue; // Don't double-count in below healthy
        }
      }

      // BELOW HEALTHY: < 1.5 visits/week
      if (recentVisitsPerWeek < HEALTHY_VISITS_PER_WEEK) {
        belowHealthy.push({
          memberId: member.memberId,
          name: info.name || member.name,
          alertType: "below_healthy",
          membershipType: info.membershipType,
          phone: info.phone,
          tenureWeeks,
          baselineVisitsPerWeek,
          recentVisitsPerWeek,
          dropPercent: baselineVisitsPerWeek ? Math.round((1 - recentVisitsPerWeek / baselineVisitsPerWeek) * 100) : null,
          recentVisits,
          baselineVisits: hasBaseline ? baselineVisits : null,
          weeklyVisits,
        });
      }
    }

    // Sort by severity
    slowing.sort((a, b) => (b.dropPercent || 0) - (a.dropPercent || 0));
    belowHealthy.sort((a, b) => a.recentVisitsPerWeek - b.recentVisitsPerWeek);
    newMemberRisk.sort((a, b) => a.recentVisits - b.recentVisits);

    const listed = [...slowing, ...belowHealthy, ...newMemberRisk];
    const planPrices = await getPlanPrices(listed.map(m => m.memberId));
    for (const m of listed) m.planPrice = planPrices.get(m.memberId) ?? null;

    return NextResponse.json({
      status: "ok",
      slowing,
      belowHealthy,
      newMemberRisk,
      _meta: {
        generatedAt: now.toISOString(),
        bookingDataStartDate: BOOKING_DATA_START_DATE.toISOString().split("T")[0],
        bookingsAnalyzed: bookings.length,
        payingMembersCount: payingMembers.length,
        excludedCount: excludedMemberIds.size,
        thresholds: {
          healthyVisitsPerWeek: HEALTHY_VISITS_PER_WEEK,
          slowingDropThreshold: `${SLOWING_DROP_THRESHOLD * 100}%`,
          minBaselineForSlowing: MIN_BASELINE_FOR_SLOWING,
        },
      },
    });
  } catch (error) {
    console.error("[API /agent/frequency-alerts] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch frequency alerts: ${message}` },
      { status: 500 }
    );
  }
}
