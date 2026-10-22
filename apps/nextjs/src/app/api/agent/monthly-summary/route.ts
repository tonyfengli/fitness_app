/**
 * Monthly Summary API for OpenClaw Retention Specialist
 * GET /api/agent/monthly-summary?month=10&year=2026
 *
 * Returns finalized KPI summary for the specified month.
 * Reads from finalized KPI snapshots in Supabase.
 */

import { eq, and } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiMonthlySnapshot } from "@acme/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { validateApiAccess } from "~/lib/api-auth";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

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
    // Get the snapshot for the requested month
    const snapshot = await db
      .select()
      .from(KpiMonthlySnapshot)
      .where(
        and(
          eq(KpiMonthlySnapshot.month, month),
          eq(KpiMonthlySnapshot.year, year)
        )
      )
      .limit(1);

    if (!snapshot.length) {
      return NextResponse.json({
        status: "no_data",
        message: `No KPI data found for ${MONTH_NAMES[month - 1]} ${year}. Load data in the KPI dashboard first.`,
        month,
        year,
        monthName: MONTH_NAMES[month - 1],
        _meta: {
          generatedAt: new Date().toISOString(),
        },
      });
    }

    const kpiData = snapshot[0].data;
    const snapshotStatus = snapshot[0].status;
    const finalizedAt = snapshot[0].finalizedAt;

    // Calculate churn rate
    const previousMonthTotal = kpiData.totalMembers + kpiData.lostMembersCount - kpiData.newMembersCount;
    const churnRate = previousMonthTotal > 0
      ? Math.round((kpiData.lostMembersCount / previousMonthTotal) * 10000) / 100
      : 0;

    // Build response
    const response = {
      status: snapshotStatus,
      month,
      year,
      monthName: MONTH_NAMES[month - 1],
      membership: {
        totalMembers: kpiData.totalMembers,
        groupMembers: kpiData.groupMembers,
        newMembers: kpiData.newMembersCount,
        lostMembers: kpiData.lostMembersCount,
        onHold: kpiData.onHoldCount,
        netChange: kpiData.newMembersCount - kpiData.lostMembersCount,
      },
      revenue: {
        total: kpiData.totalRevenue,
        pt: kpiData.ptRevenue,
        smallGroup: kpiData.smallGroupRevenue,
        openGym: kpiData.openGymRevenue,
        newMemberRevenue: kpiData.newMembersRevenue,
        lostMemberRevenue: kpiData.lostMembersRevenue,
      },
      metrics: {
        arm: kpiData.arm,
        armGroups: kpiData.armGroups,
        churnRate,
      },
      _meta: {
        generatedAt: new Date().toISOString(),
        dataSource: "supabase",
        snapshotStatus,
        finalizedAt: finalizedAt?.toISOString() || null,
        note: snapshotStatus === "draft"
          ? "This data is not yet finalized. Numbers may change after month close."
          : null,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API /agent/monthly-summary] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to fetch monthly summary: ${message}` },
      { status: 500 }
    );
  }
}
