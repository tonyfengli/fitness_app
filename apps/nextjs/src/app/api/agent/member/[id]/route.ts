/**
 * Member Deep-Dive API for OpenClaw Retention Specialist
 * GET /api/agent/member/[id]
 *
 * Returns comprehensive member profile:
 * - Current status (active/hold/cancelled)
 * - Attendance history
 * - Payment history
 * - At-risk tier (if applicable)
 * - Tenure and revenue value
 */

import { NextRequest, NextResponse } from "next/server";
import { validateApiAccess } from "~/lib/api-auth";

export const dynamic = "force-dynamic";

const REPORT_IDS = {
  CURRENT_MEMBERS: 1,
  ON_HOLD: 314,
  BOOKINGS: 9,
  PAYMENTS: 103,
};

const STATUS_TIERS = {
  BEST_ODDS: { maxDays: 14, label: "Best odds", returnRate: 63 },
  FADING: { maxDays: 30, label: "Fading", returnRate: 39 },
  LONG_SHOT: { maxDays: 45, label: "Long shot", returnRate: 28 },
  CRITICAL: { maxDays: Infinity, label: "Critical", returnRate: 15 },
};

const VALID_ATTENDANCE = ["Booking", "Showed", "Showed late"];

interface GymMasterRow {
  [key: string]: string | number | null;
}

async function fetchGymMasterReport(
  reportId: number,
  startDate: string,
  endDate: string
): Promise<GymMasterRow[]> {
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
      report_id: reportId,
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

function parseGymMasterDate(dateStr: string): Date {
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

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

function getStatusTier(daysGone: number): { label: string; returnRate: number } | null {
  if (daysGone < 14) return null; // Not at risk
  if (daysGone <= STATUS_TIERS.BEST_ODDS.maxDays) return STATUS_TIERS.BEST_ODDS;
  if (daysGone <= STATUS_TIERS.FADING.maxDays) return STATUS_TIERS.FADING;
  if (daysGone <= STATUS_TIERS.LONG_SHOT.maxDays) return STATUS_TIERS.LONG_SHOT;
  return STATUS_TIERS.CRITICAL;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const { id: memberId } = await params;

  if (!memberId) {
    return NextResponse.json(
      { error: "Member ID is required" },
      { status: 400 }
    );
  }

  const now = new Date();
  const currentYear = now.getFullYear();

  // Date ranges for queries
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;
  const attendanceLookbackDate = new Date(now);
  attendanceLookbackDate.setDate(attendanceLookbackDate.getDate() - 180); // 6 months
  const attendanceStart = attendanceLookbackDate.toISOString().split("T")[0];
  const attendanceEnd = now.toISOString().split("T")[0];

  try {
    // Fetch data in parallel
    const [currentMembers, onHoldMembers, bookings, payments] = await Promise.all([
      fetchGymMasterReport(REPORT_IDS.CURRENT_MEMBERS, yearStart, yearEnd),
      fetchGymMasterReport(REPORT_IDS.ON_HOLD, yearStart, yearEnd),
      fetchGymMasterReport(REPORT_IDS.BOOKINGS, attendanceStart, attendanceEnd),
      fetchGymMasterReport(REPORT_IDS.PAYMENTS, yearStart, yearEnd),
    ]);

    // Find member in current members
    const currentMember = currentMembers.find(
      (m) => String(m["Member ID"]) === memberId
    );

    // Find member in on-hold list
    const onHoldMember = onHoldMembers.find(
      (m) => String(m["Member ID"]) === memberId
    );

    // Determine status
    let status: "active" | "on_hold" | "not_found" = "not_found";
    let memberData: GymMasterRow | null = null;

    if (currentMember) {
      status = "active";
      memberData = currentMember;
    } else if (onHoldMember) {
      status = "on_hold";
      memberData = onHoldMember;
    }

    // Get member name for searching across reports
    const memberName = memberData
      ? String(memberData["Name"] || memberData["Member Name"] || "")
      : null;

    // Filter bookings for this member
    const memberBookings = bookings.filter(
      (b) => String(b["Member ID"]) === memberId
    );

    // Filter to actual attendance (not no-shows)
    const attendanceRecords = memberBookings
      .filter((b) => VALID_ATTENDANCE.includes(String(b["Booking Result"] || "")))
      .map((b) => ({
        date: String(b["Booking Date"] || ""),
        className: String(b["Class Name"] || b["Service"] || ""),
        result: String(b["Booking Result"] || ""),
      }))
      .sort((a, b) => {
        const dateA = parseGymMasterDate(a.date).getTime();
        const dateB = parseGymMasterDate(b.date).getTime();
        return dateB - dateA; // Most recent first
      });

    // Calculate days since last attendance
    let daysGone = 0;
    let lastAttendance: string | null = null;
    let lastClass: string | null = null;

    if (attendanceRecords.length > 0) {
      const lastRecord = attendanceRecords[0];
      lastAttendance = lastRecord.date;
      lastClass = lastRecord.className;
      daysGone = daysBetween(parseGymMasterDate(lastRecord.date), now);
    } else {
      daysGone = 180; // No attendance in 6 months
    }

    // Get at-risk tier
    const atRiskTier = status === "active" ? getStatusTier(daysGone) : null;

    // Filter payments for this member
    const memberPayments = payments.filter(
      (p) => String(p["Member ID"]) === memberId
    );

    const paymentRecords = memberPayments
      .map((p) => ({
        date: String(p["Payment Date"] || ""),
        amount: parseFloat(String(p["Payment Amount"] || p["Amount"] || "0").replace(/[$,]/g, "")),
        type: String(p["Payment Type"] || p["Type"] || ""),
        status: String(p["Status"] || p["Payment Status"] || ""),
      }))
      .sort((a, b) => {
        const dateA = parseGymMasterDate(a.date).getTime();
        const dateB = parseGymMasterDate(b.date).getTime();
        return dateB - dateA; // Most recent first
      });

    // Calculate revenue metrics
    const totalRevenue = paymentRecords
      .filter((p) => p.amount > 0)
      .reduce((sum, p) => sum + p.amount, 0);

    const monthsWithPayments = new Set(
      paymentRecords
        .filter((p) => p.amount > 0)
        .map((p) => {
          const date = parseGymMasterDate(p.date);
          return `${date.getFullYear()}-${date.getMonth()}`;
        })
    ).size;

    const avgMonthlyRevenue = monthsWithPayments > 0
      ? Math.round((totalRevenue / monthsWithPayments) * 100) / 100
      : 0;

    // Get membership tenure
    const memberSince = memberData
      ? String(memberData["Membership Start Date"] || memberData["Join Date"] || "")
      : null;

    let tenureMonths = 0;
    if (memberSince) {
      const startDate = parseGymMasterDate(memberSince);
      tenureMonths = Math.floor(
        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
    }

    // Get membership type
    const membershipType = memberData
      ? String(memberData["Membership Type"] || memberData["Membership"] || "Unknown")
      : null;

    // Build response
    const response = {
      memberId,
      name: memberName,
      status,
      membershipType,
      memberSince,
      tenureMonths,

      atRisk: atRiskTier ? {
        isAtRisk: true,
        tier: atRiskTier.label,
        returnRate: atRiskTier.returnRate,
        daysGone,
        lastAttendance,
        lastClass,
      } : {
        isAtRisk: false,
        daysGone,
        lastAttendance,
        lastClass,
      },

      revenue: {
        totalYtd: Math.round(totalRevenue * 100) / 100,
        avgMonthly: avgMonthlyRevenue,
        paymentCount: paymentRecords.filter((p) => p.amount > 0).length,
      },

      attendance: {
        totalSessions: attendanceRecords.length,
        lookbackDays: 180,
        recentSessions: attendanceRecords.slice(0, 10), // Last 10 sessions
      },

      payments: {
        recentPayments: paymentRecords.slice(0, 10), // Last 10 payments
      },

      _meta: {
        generatedAt: new Date().toISOString(),
        dataSource: "gymmaster",
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API /agent/member] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to fetch member data: ${message}` },
      { status: 500 }
    );
  }
}
