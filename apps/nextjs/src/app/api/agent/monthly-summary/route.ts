/**
 * Monthly Summary API for OpenClaw Retention Specialist
 *
 * Single month: GET /api/agent/monthly-summary?month=10&year=2026
 * Range:        GET /api/agent/monthly-summary?startMonth=1&endMonth=9&year=2026
 *
 * Returns the KPI summary for the specified month(s) from KPI snapshots in Supabase
 * (finalized or draft; each month says which in dataStatus). Lost and new counts
 * apply the founders' exclude_from_lost / exclude_from_new overrides, matching
 * churned-members.
 */

import { eq, and, gte, lte } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiMonthlySnapshot, KpiMemberOverride } from "@acme/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { monthStatusNote, SNAPSHOT_COUNT_CAVEAT } from "~/lib/agent-kpi";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface MonthlyData {
  month: number;
  monthName: string;
  status: string;
  dataStatus: string;
  membership: {
    totalMembers: number;
    groupMembers: number;
    newMembers: number;
    lostMembers: number;
    onHold: number;
    netChange: number;
    excludedFromLost: number;
    excludedFromNew: number;
  };
  revenue: {
    total: number;
    pt: number;
    smallGroup: number;
    openGym: number;
    newMemberRevenue: number;
    lostMemberRevenue: number;
  };
  metrics: {
    arm: number;
    armGroups: number;
    churnRate: number;
  };
}

export async function GET(request: NextRequest) {
  // Validate API key or session
  const authError = await validateFounderAccess(request);
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
    // Get snapshots for the requested month range
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
        _meta: {
          generatedAt: new Date().toISOString(),
        },
      });
    }

    // Founder exclusions for the range, keyed "type:month"
    const overrides = await db
      .select()
      .from(KpiMemberOverride)
      .where(
        and(
          gte(KpiMemberOverride.month, startMonth),
          lte(KpiMemberOverride.month, endMonth),
          eq(KpiMemberOverride.year, year)
        )
      );
    const excludedIds = (type: string, month: number) =>
      new Set(overrides.filter((o) => o.overrideType === type && o.month === month).map((o) => o.memberId));
    const sumRevenue = (members: Array<{ revenue: number }>) =>
      Math.round(members.reduce((sum, m) => sum + m.revenue, 0) * 100) / 100;

    // Build monthly data array
    const monthlyData: MonthlyData[] = [];
    let hasAnyDraft = false;

    for (const snapshot of snapshots) {
      const month = snapshot.month;
      const kpiData = snapshot.data;

      if (snapshot.status === "draft") {
        hasAnyDraft = true;
      }

      // Apply exclusions to the saved member lists (fall back to saved counts for old snapshots without lists)
      const lostExcluded = excludedIds("exclude_from_lost", month);
      const newExcluded = excludedIds("exclude_from_new", month);
      const lostList = kpiData.lostMembers?.filter((m) => !lostExcluded.has(m.memberId));
      const newList = kpiData.newMembers?.filter((m) => !newExcluded.has(m.memberId));
      const lostCount = lostList ? lostList.length : kpiData.lostMembersCount;
      const lostRevenue = lostList ? sumRevenue(lostList) : kpiData.lostMembersRevenue;
      const newCount = newList ? newList.length : kpiData.newMembersCount;
      const newRevenue = newList ? sumRevenue(newList) : kpiData.newMembersRevenue;

      // Calculate churn rate
      const previousMonthTotal = kpiData.totalMembers + lostCount - newCount;
      const churnRate = previousMonthTotal > 0
        ? Math.round((lostCount / previousMonthTotal) * 10000) / 100
        : 0;

      monthlyData.push({
        month,
        monthName: MONTH_NAMES[month - 1],
        status: snapshot.status,
        dataStatus: monthStatusNote(snapshot.status, month, year),
        membership: {
          totalMembers: kpiData.totalMembers,
          groupMembers: kpiData.groupMembers,
          newMembers: newCount,
          lostMembers: lostCount,
          onHold: kpiData.onHoldCount,
          netChange: newCount - lostCount,
          excludedFromLost: lostList ? (kpiData.lostMembers?.length ?? 0) - lostList.length : 0,
          excludedFromNew: newList ? (kpiData.newMembers?.length ?? 0) - newList.length : 0,
        },
        revenue: {
          total: kpiData.totalRevenue,
          pt: kpiData.ptRevenue,
          smallGroup: kpiData.smallGroupRevenue,
          openGym: kpiData.openGymRevenue,
          newMemberRevenue: newRevenue,
          lostMemberRevenue: lostRevenue,
        },
        metrics: {
          arm: kpiData.arm,
          armGroups: kpiData.armGroups,
          churnRate,
        },
      });
    }

    // For single month queries, return flat response (backwards compatible)
    if (!isRangeQuery && monthlyData.length === 1) {
      const data = monthlyData[0];
      return NextResponse.json({
        status: data.status,
        dataStatus: data.dataStatus,
        month: data.month,
        year,
        monthName: data.monthName,
        membership: data.membership,
        revenue: data.revenue,
        metrics: data.metrics,
        _meta: {
          generatedAt: new Date().toISOString(),
          dataSource: "supabase",
          snapshotStatus: data.status,
          finalizedAt: snapshots[0].finalizedAt?.toISOString() || null,
          note: SNAPSHOT_COUNT_CAVEAT,
        },
      });
    }

    // For range queries, return aggregated response with trends
    const totals = {
      totalRevenue: monthlyData.reduce((sum, m) => sum + m.revenue.total, 0),
      totalNewMembers: monthlyData.reduce((sum, m) => sum + m.membership.newMembers, 0),
      totalLostMembers: monthlyData.reduce((sum, m) => sum + m.membership.lostMembers, 0),
      avgChurnRate: Math.round(
        (monthlyData.reduce((sum, m) => sum + m.metrics.churnRate, 0) / monthlyData.length) * 100
      ) / 100,
      avgArm: Math.round(
        (monthlyData.reduce((sum, m) => sum + m.metrics.arm, 0) / monthlyData.length) * 100
      ) / 100,
    };

    // Calculate month-over-month trends
    const trends = monthlyData.length >= 2 ? {
      membershipChange: monthlyData[monthlyData.length - 1].membership.totalMembers - monthlyData[0].membership.totalMembers,
      revenueChange: Math.round((monthlyData[monthlyData.length - 1].revenue.total - monthlyData[0].revenue.total) * 100) / 100,
      churnTrend: monthlyData.map(m => ({ month: m.monthName, churnRate: m.metrics.churnRate })),
    } : null;

    return NextResponse.json({
      status: hasAnyDraft ? "partial" : "finalized",
      year,
      startMonth,
      endMonth,
      isRangeQuery: true,
      summary: {
        monthsCovered: monthlyData.length,
        ...totals,
        netMemberChange: totals.totalNewMembers - totals.totalLostMembers,
      },
      trends,
      months: monthlyData,
      _meta: {
        generatedAt: new Date().toISOString(),
        dataSource: "supabase",
        monthsCovered: snapshots.length,
        monthsRequested: endMonth - startMonth + 1,
        note: hasAnyDraft
          ? `Some months are not finalized (see each month's dataStatus). ${SNAPSHOT_COUNT_CAVEAT}`
          : SNAPSHOT_COUNT_CAVEAT,
      },
    });
  } catch (error) {
    console.error("[API /agent/monthly-summary] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to fetch monthly summary: ${message}` },
      { status: 500 }
    );
  }
}
