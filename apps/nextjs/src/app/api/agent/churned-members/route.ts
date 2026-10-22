/**
 * Churned Members API for OpenClaw Retention Specialist
 *
 * Single month: GET /api/agent/churned-members?month=10&year=2026
 * Range:        GET /api/agent/churned-members?startMonth=1&endMonth=9&year=2026
 *
 * Returns members who left (cancelled or went on hold) in the specified month(s).
 * Reads from finalized KPI snapshots in Supabase.
 */

import { eq, and, gte, lte } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiMonthlySnapshot, KpiMemberOverride } from "@acme/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { validateApiAccess } from "~/lib/api-auth";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface ChurnedMember {
  memberId: string;
  name: string;
  revenue: number;
  type: string;
  month?: number;
  monthName?: string;
}

export async function GET(request: NextRequest) {
  // Validate API key or session
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const monthStr = searchParams.get("month");
  const startMonthStr = searchParams.get("startMonth");
  const endMonthStr = searchParams.get("endMonth");
  const yearStr = searchParams.get("year");

  // Default to current month/year if not specified
  const now = new Date();
  const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

  // Determine if this is a range query or single month
  const isRangeQuery = startMonthStr && endMonthStr;

  let startMonth: number;
  let endMonth: number;

  if (isRangeQuery) {
    startMonth = parseInt(startMonthStr, 10);
    endMonth = parseInt(endMonthStr, 10);
  } else {
    // Single month query (backwards compatible)
    const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
    startMonth = month;
    endMonth = month;
  }

  // Validate months
  if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
    return NextResponse.json(
      { error: "Invalid month. Must be 1-12." },
      { status: 400 }
    );
  }

  if (startMonth > endMonth) {
    return NextResponse.json(
      { error: "startMonth must be <= endMonth." },
      { status: 400 }
    );
  }

  try {
    // 1. Get snapshots for the requested month range
    const snapshots = await db
      .select()
      .from(KpiMonthlySnapshot)
      .where(
        and(
          gte(KpiMonthlySnapshot.month, startMonth),
          lte(KpiMonthlySnapshot.month, endMonth),
          eq(KpiMonthlySnapshot.year, year)
        )
      )
      .orderBy(KpiMonthlySnapshot.month);

    if (!snapshots.length) {
      const monthRange = isRangeQuery
        ? `${MONTH_NAMES[startMonth - 1]} - ${MONTH_NAMES[endMonth - 1]} ${year}`
        : `${MONTH_NAMES[startMonth - 1]} ${year}`;
      return NextResponse.json({
        status: "no_data",
        message: `No KPI data found for ${monthRange}. Load data in the KPI dashboard first.`,
        year,
        startMonth,
        endMonth,
        churnedMembers: [],
        _meta: {
          generatedAt: new Date().toISOString(),
        },
      });
    }

    // 2. Get all exclusions for the month range
    const overrides = await db
      .select()
      .from(KpiMemberOverride)
      .where(
        and(
          gte(KpiMemberOverride.month, startMonth),
          lte(KpiMemberOverride.month, endMonth),
          eq(KpiMemberOverride.year, year),
          eq(KpiMemberOverride.overrideType, "exclude_from_lost")
        )
      );

    // Build a map of month -> excluded member IDs
    const exclusionsByMonth = new Map<number, Set<string>>();
    for (const override of overrides) {
      if (!exclusionsByMonth.has(override.month)) {
        exclusionsByMonth.set(override.month, new Set());
      }
      exclusionsByMonth.get(override.month)!.add(override.memberId);
    }

    // 3. Aggregate churned members across all months
    const allChurnedMembers: ChurnedMember[] = [];
    const allExcludedMembers: Array<{ memberId: string; name: string; revenue: number; reason: string; month: number; monthName: string }> = [];
    const byMonth: Array<{ month: number; monthName: string; count: number; revenue: number }> = [];
    let hasAnyDraft = false;

    for (const snapshot of snapshots) {
      const month = snapshot.month;
      const kpiData = snapshot.data;
      const excludedIds = exclusionsByMonth.get(month) || new Set();

      if (snapshot.status === "draft") {
        hasAnyDraft = true;
      }

      const lostMembers = kpiData.lostMembers || [];
      const included = lostMembers.filter(m => !excludedIds.has(m.memberId));
      const excluded = lostMembers.filter(m => excludedIds.has(m.memberId));

      // Add to aggregated list with month info
      for (const m of included) {
        allChurnedMembers.push({
          memberId: m.memberId,
          name: m.name,
          revenue: m.revenue,
          type: m.type === "hold" ? "On Hold" : "Cancelled",
          month,
          monthName: MONTH_NAMES[month - 1],
        });
      }

      for (const m of excluded) {
        allExcludedMembers.push({
          memberId: m.memberId,
          name: m.name,
          revenue: m.revenue,
          reason: overrides.find(o => o.memberId === m.memberId && o.month === month)?.reason || "Data correction",
          month,
          monthName: MONTH_NAMES[month - 1],
        });
      }

      byMonth.push({
        month,
        monthName: MONTH_NAMES[month - 1],
        count: included.length,
        revenue: Math.round(included.reduce((sum, m) => sum + m.revenue, 0) * 100) / 100,
      });
    }

    // 4. Build response
    const response = {
      status: hasAnyDraft ? "partial" : "finalized",
      year,
      startMonth,
      endMonth,
      isRangeQuery,
      summary: {
        totalLost: allChurnedMembers.length,
        lostRevenue: Math.round(allChurnedMembers.reduce((sum, m) => sum + m.revenue, 0) * 100) / 100,
        excluded: allExcludedMembers.length,
        byType: {
          cancellations: allChurnedMembers.filter(m => m.type === "Cancelled").length,
          onHold: allChurnedMembers.filter(m => m.type === "On Hold").length,
        },
        byMonth,
      },
      churnedMembers: allChurnedMembers,
      excludedMembers: allExcludedMembers,
      _meta: {
        generatedAt: new Date().toISOString(),
        dataSource: "supabase",
        monthsCovered: snapshots.length,
        monthsRequested: endMonth - startMonth + 1,
        note: hasAnyDraft
          ? "Some months contain draft data that is not yet finalized."
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
