/**
 * Monthly Summary API for OpenClaw Retention Specialist
 *
 * Single month: GET /api/agent/monthly-summary?month=10&year=2026
 * Range:        GET /api/agent/monthly-summary?startMonth=1&endMonth=9&year=2026
 *
 * Returns the KPI Overview's numbers for the specified month(s): the same running
 * member total, new/lost counts (after exclusions, manual losses and billing links),
 * ARM and churn the dashboard shows, computed by getDerivedKpi from saved snapshots.
 * Each month says how final it is in dataStatus.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { monthStatusNote, SNAPSHOT_COUNT_CAVEAT } from "~/lib/agent-kpi";
import { getDerivedKpi } from "~/lib/kpi-derived";

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
    payingMembers: number;
    manualLosses: number;
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
    churnRate: number | null;
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
    const { months, gaps } = await getDerivedKpi();
    const selected = months.filter((m) => m.year === year && m.month >= startMonth && m.month <= endMonth);

    if (!selected.length) {
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

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const hasAnyDraft = selected.some((m) => m.status === "draft");
    const monthlyData: MonthlyData[] = selected.map(({ month, status, derived: d, prevDerivedTotal }) => ({
      month,
      monthName: MONTH_NAMES[month - 1] ?? String(month),
      status,
      dataStatus: monthStatusNote(status, month, year),
      membership: {
        totalMembers: d.derivedTotalMembers,
        groupMembers: d.groupMembers,
        newMembers: d.filteredNewCount,
        lostMembers: d.filteredLostCount,
        onHold: d.filteredLostMembers.filter((m) => m.type === "hold").length,
        netChange: d.filteredNewCount - d.filteredLostCount,
        payingMembers: d.totalMembers,
        manualLosses: d.manualLost.length,
      },
      revenue: {
        total: d.totalRevenue,
        pt: d.ptRevenue,
        smallGroup: d.smallGroupRevenue,
        openGym: d.openGymRevenue,
        newMemberRevenue: round2(d.filteredNewRevenue),
        lostMemberRevenue: round2(d.filteredLostRevenue),
      },
      metrics: {
        arm: d.derivedTotalMembers > 0 ? round2(d.totalRevenue / d.derivedTotalMembers) : 0,
        armGroups: d.armGroups,
        // Same as the dashboard: lost ÷ the previous month's total; none for the first month
        churnRate: prevDerivedTotal ? round2((d.filteredLostCount / prevDerivedTotal) * 100) : null,
      },
    }));

    const note = gaps.length
      ? `${SNAPSHOT_COUNT_CAVEAT} Missing months (${gaps.join(", ")}) break the running total.`
      : SNAPSHOT_COUNT_CAVEAT;

    // For single month queries, return flat response (backwards compatible)
    const single = monthlyData[0];
    if (!isRangeQuery && single && monthlyData.length === 1) {
      return NextResponse.json({
        status: single.status,
        dataStatus: single.dataStatus,
        month: single.month,
        year,
        monthName: single.monthName,
        membership: single.membership,
        revenue: single.revenue,
        metrics: single.metrics,
        _meta: {
          generatedAt: new Date().toISOString(),
          dataSource: "supabase",
          snapshotStatus: single.status,
          finalizedAt: selected[0]?.finalizedAt?.toISOString() ?? null,
          note,
        },
      });
    }

    // For range queries, return aggregated response with trends
    const churnRates = monthlyData.map((m) => m.metrics.churnRate).filter((r): r is number => r !== null);
    const first = monthlyData[0]!;
    const last = monthlyData[monthlyData.length - 1]!;
    const totals = {
      totalRevenue: round2(monthlyData.reduce((sum, m) => sum + m.revenue.total, 0)),
      totalNewMembers: monthlyData.reduce((sum, m) => sum + m.membership.newMembers, 0),
      totalLostMembers: monthlyData.reduce((sum, m) => sum + m.membership.lostMembers, 0),
      avgChurnRate: churnRates.length ? round2(churnRates.reduce((sum, r) => sum + r, 0) / churnRates.length) : null,
      avgArm: round2(monthlyData.reduce((sum, m) => sum + m.metrics.arm, 0) / monthlyData.length),
    };

    // Calculate month-over-month trends
    const trends = monthlyData.length >= 2 ? {
      membershipChange: last.membership.totalMembers - first.membership.totalMembers,
      revenueChange: round2(last.revenue.total - first.revenue.total),
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
        monthsCovered: monthlyData.length,
        monthsRequested: endMonth - startMonth + 1,
        note: hasAnyDraft ? `Some months are not finalized (see each month's dataStatus). ${note}` : note,
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
