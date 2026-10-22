/**
 * At-Risk Members API for OpenClaw Retention Specialist
 * GET /api/agent/at-risk?month=10&year=2026
 *
 * Returns members who haven't attended a class/session recently.
 * Combines finalized KPI data (source of truth for paying members)
 * with live GymMaster booking data (attendance tracking).
 */

import { desc, eq, and, or, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiMonthlySnapshot, KpiMemberOverride } from "@acme/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { validateApiAccess } from "~/lib/api-auth";

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

interface AtRiskMember {
  memberId: string;
  name: string;
  daysGone: number;
  lastAttendance: string | null;
  lastAttendanceTime: string | null;
  statusTier: string;
  returnRate: number;
  monthlyRevenue: number;
  lastClass: string | null;
  memberSince: string | null;
}

interface CurrentMemberRow {
  "Member ID": number;
  Name: string;
  "Membership Start Date": string;
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
      report_id: 9, // Bookings report
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

  // Get current month date range
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
      report_id: 1, // Current Members report
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
  // Validate API key or session
  const authError = await validateApiAccess(request);
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
    // 1. Get the most recent finalized snapshot to determine paying members
    const snapshot = await db
      .select()
      .from(KpiMonthlySnapshot)
      .where(
        and(
          eq(KpiMonthlySnapshot.status, "finalized"),
        )
      )
      .orderBy(desc(KpiMonthlySnapshot.year), desc(KpiMonthlySnapshot.month))
      .limit(1);

    if (!snapshot.length) {
      return NextResponse.json({
        status: "no_data",
        message: "No finalized KPI snapshot found. Please finalize a month first.",
        atRiskMembers: [],
        _meta: {
          generatedAt: new Date().toISOString(),
        },
      });
    }

    const kpiData = snapshot[0].data;
    const payingMembers = kpiData.payingMembers || [];

    if (payingMembers.length === 0) {
      return NextResponse.json({
        status: "no_members",
        message: "No paying members found in the finalized snapshot.",
        atRiskMembers: [],
        _meta: {
          generatedAt: new Date().toISOString(),
          snapshotMonth: snapshot[0].month,
          snapshotYear: snapshot[0].year,
        },
      });
    }

    // 1b. Get member overrides to exclude from at-risk list
    // Respect both "exclude_from_at_risk" and "exclude_from_new" (data anomalies)
    const overrides = await db
      .select()
      .from(KpiMemberOverride)
      .where(
        or(
          eq(KpiMemberOverride.overrideType, "exclude_from_at_risk"),
          eq(KpiMemberOverride.overrideType, "exclude_from_new")
        )
      );

    const excludedMemberIds = new Set(overrides.map(o => o.memberId));

    // 2. Query GymMaster for booking data (last 60 days) and current members
    const endDate = now.toISOString().split("T")[0];
    const startDateObj = new Date(now);
    startDateObj.setDate(startDateObj.getDate() - 60);
    const startDate = startDateObj.toISOString().split("T")[0];

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

    // 3. Build a map of member ID -> membership start date
    const memberSinceMap = new Map<string, string>();
    for (const member of currentMembers) {
      const memberId = String(member["Member ID"]);
      const startDate = member["Membership Start Date"];
      if (memberId && startDate) {
        // Normalize date format to YYYY-MM-DD
        const parsed = parseGymMasterDate(startDate);
        if (!isNaN(parsed.getTime())) {
          memberSinceMap.set(memberId, parsed.toISOString().split("T")[0]);
        }
      }
    }

    // 4. Build a map of member ID -> last valid attendance
    const lastAttendanceMap = new Map<string, { date: Date; time: string | null; className: string | null }>();

    for (const booking of bookings) {
      if (!VALID_ATTENDANCE.includes(booking["Booking Result"])) continue;

      const memberId = String(booking["Member ID"]);
      const bookingDate = parseGymMasterDate(booking["Booking Date"]);
      const bookingTime = booking["Booking Start Time"] || null;
      const className = booking["Class Name"] || booking["Service"] || null;

      const existing = lastAttendanceMap.get(memberId);
      if (!existing || bookingDate > existing.date) {
        lastAttendanceMap.set(memberId, { date: bookingDate, time: bookingTime, className });
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
        lastAttendanceStr = lastAttendance.date.toISOString().split("T")[0];
        lastAttendanceTime = lastAttendance.time;
        lastClass = lastAttendance.className;
      } else {
        // No booking found in last 60 days
        daysGone = 60;
      }

      // Only include members who are "at risk" (14+ days gone) and not excluded
      if (daysGone >= 14 && !excludedMemberIds.has(member.memberId)) {
        const tier = getStatusTier(daysGone);
        atRiskMembers.push({
          memberId: member.memberId,
          name: member.name,
          daysGone,
          lastAttendance: lastAttendanceStr,
          lastAttendanceTime,
          statusTier: tier.label,
          returnRate: tier.returnRate,
          monthlyRevenue: member.revenue,
          lastClass,
          memberSince: memberSinceMap.get(member.memberId) || null,
        });
      }
    }

    // 5. Sort by days gone (most urgent first)
    atRiskMembers.sort((a, b) => b.daysGone - a.daysGone);

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
        snapshotMonth: snapshot[0].month,
        snapshotYear: snapshot[0].year,
        snapshotStatus: snapshot[0].status,
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
