/**
 * Churned Members API for OpenClaw Retention Specialist
 * GET /api/agent/churned-members?month=10&year=2026
 *
 * Returns members who left (cancelled or went on hold) in the specified month.
 * Reads from finalized KPI snapshots in Supabase.
 */

import { eq, and } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiMonthlySnapshot, KpiMemberOverride } from "@acme/db/schema";
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
    // 1. Get the snapshot for the requested month
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
        churnedMembers: [],
        _meta: {
          generatedAt: new Date().toISOString(),
        },
      });
    }

    const kpiData = snapshot[0].data;
    const snapshotStatus = snapshot[0].status;

    // 2. Get any exclusions for this month
    const overrides = await db
      .select()
      .from(KpiMemberOverride)
      .where(
        and(
          eq(KpiMemberOverride.month, month),
          eq(KpiMemberOverride.year, year),
          eq(KpiMemberOverride.overrideType, "exclude_from_lost")
        )
      );

    const excludedMemberIds = new Set(overrides.map(o => o.memberId));

    // 3. Filter lost members (apply exclusions)
    const allLostMembers = kpiData.lostMembers || [];
    const includedMembers = allLostMembers.filter(m => !excludedMemberIds.has(m.memberId));
    const excludedMembers = allLostMembers.filter(m => excludedMemberIds.has(m.memberId));

    // 4. Build response
    const response = {
      status: snapshotStatus,
      month,
      year,
      monthName: MONTH_NAMES[month - 1],
      summary: {
        totalLost: includedMembers.length,
        lostRevenue: Math.round(includedMembers.reduce((sum, m) => sum + m.revenue, 0) * 100) / 100,
        excluded: excludedMembers.length,
        byType: {
          cancellations: includedMembers.filter(m => m.type === "loss").length,
          onHold: includedMembers.filter(m => m.type === "hold").length,
        },
      },
      churnedMembers: includedMembers.map(m => ({
        memberId: m.memberId,
        name: m.name,
        revenue: m.revenue,
        type: m.type === "hold" ? "On Hold" : "Cancelled",
      })),
      excludedMembers: excludedMembers.map(m => ({
        memberId: m.memberId,
        name: m.name,
        revenue: m.revenue,
        reason: overrides.find(o => o.memberId === m.memberId)?.reason || "Data correction",
      })),
      _meta: {
        generatedAt: new Date().toISOString(),
        dataSource: "supabase",
        snapshotStatus,
        note: snapshotStatus === "draft"
          ? "This data is not yet finalized. Numbers may change after month close."
          : null,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API /agent/churned-members] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to fetch churned members: ${message}` },
      { status: 500 }
    );
  }
}
