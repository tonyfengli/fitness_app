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
import { getDerivedKpi, type DerivedKpiMonth } from "~/lib/kpi-derived";
import { armClassesJudgment, churnJudgment, newMembersJudgment } from "~/app/kpi/lib/metric-definitions";

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
    gymmasterTotal: number; // all GymMaster revenue (true total incl. Venmo/Zelle is in QuickBooks)
    recurring: number; // Classes + Open Gym
    classes: number;
    openGym: number;
    oneOffPT: number; // PT: mostly prepaid packages, lumpy month to month
    otherNetOfRefunds: number;
    newMemberRevenue: number;
    lostMemberRevenue: number;
  };
  metrics: {
    arm: number; // GymMaster revenue ÷ members
    armClasses: number | null; // Classes revenue ÷ class members; null if the month wasn't re-saved after Nov 3, 2026
    classMembers: number | null;
    churnRate: number | null;
  };
  judgment: {
    churn: string | null;
    newMembers: string;
    armClasses: string | null;
  };
  vsLastMonth: Record<string, number> | null; // this month minus last month, per figure
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
    const toMonthly = ({ month, year: y, status, derived: d, prevDerivedTotal }: DerivedKpiMonth): MonthlyData => {
      const churnRate = prevDerivedTotal ? round2((d.filteredLostCount / prevDerivedTotal) * 100) : null;
      const armClasses = d.armClasses != null && d.classMembers ? round2(d.armClasses) : null;
      return {
      month,
      monthName: MONTH_NAMES[month - 1] ?? String(month),
      status,
      dataStatus: monthStatusNote(status, month, y),
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
        gymmasterTotal: d.totalRevenue,
        recurring: round2(d.smallGroupRevenue + d.openGymRevenue),
        classes: d.smallGroupRevenue,
        openGym: d.openGymRevenue,
        oneOffPT: d.ptRevenue,
        otherNetOfRefunds: round2(d.totalRevenue - d.ptRevenue - d.smallGroupRevenue - d.openGymRevenue),
        newMemberRevenue: round2(d.filteredNewRevenue),
        lostMemberRevenue: round2(d.filteredLostRevenue),
      },
      metrics: {
        arm: d.derivedTotalMembers > 0 ? round2(d.totalRevenue / d.derivedTotalMembers) : 0,
        armClasses,
        classMembers: armClasses != null ? (d.classMembers ?? null) : null,
        // Same as the dashboard: lost ÷ the previous month's total; none for the first month
        churnRate,
      },
      judgment: {
        churn: churnRate != null ? churnJudgment(churnRate) : null,
        newMembers: newMembersJudgment(d.filteredNewCount),
        armClasses: armClasses != null ? armClassesJudgment(armClasses) : null,
      },
      vsLastMonth: null,
      };
    };

    // Each month vs the month before (from the full history, so a single month still gets it)
    const byKey = new Map(months.map((m) => [`${m.year}-${m.month}`, toMonthly(m)]));
    const delta = (a: number | null, b: number | null) => (a != null && b != null ? round2(a - b) : null);
    const monthlyData: MonthlyData[] = selected.map((m) => {
      const cur = byKey.get(`${m.year}-${m.month}`)!;
      const i = months.indexOf(m);
      const prev = i > 0 ? byKey.get(`${months[i - 1]!.year}-${months[i - 1]!.month}`) : undefined;
      if (!prev) return cur;
      const changes: Record<string, number | null> = {
        members: delta(cur.membership.totalMembers, prev.membership.totalMembers),
        newMembers: delta(cur.membership.newMembers, prev.membership.newMembers),
        lostMembers: delta(cur.membership.lostMembers, prev.membership.lostMembers),
        churnRatePoints: delta(cur.metrics.churnRate, prev.metrics.churnRate),
        gymmasterTotal: delta(cur.revenue.gymmasterTotal, prev.revenue.gymmasterTotal),
        recurring: delta(cur.revenue.recurring, prev.revenue.recurring),
        classes: delta(cur.revenue.classes, prev.revenue.classes),
        openGym: delta(cur.revenue.openGym, prev.revenue.openGym),
        oneOffPT: delta(cur.revenue.oneOffPT, prev.revenue.oneOffPT),
        arm: delta(cur.metrics.arm, prev.metrics.arm),
        armClasses: delta(cur.metrics.armClasses, prev.metrics.armClasses),
      };
      const vsLastMonth = Object.fromEntries(Object.entries(changes).filter(([, v]) => v != null)) as Record<string, number>;
      return { ...cur, vsLastMonth };
    });

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
        judgment: single.judgment,
        vsLastMonth: single.vsLastMonth,
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
      totalGymmasterRevenue: round2(monthlyData.reduce((sum, m) => sum + m.revenue.gymmasterTotal, 0)),
      totalNewMembers: monthlyData.reduce((sum, m) => sum + m.membership.newMembers, 0),
      totalLostMembers: monthlyData.reduce((sum, m) => sum + m.membership.lostMembers, 0),
      avgChurnRate: churnRates.length ? round2(churnRates.reduce((sum, r) => sum + r, 0) / churnRates.length) : null,
      avgArm: round2(monthlyData.reduce((sum, m) => sum + m.metrics.arm, 0) / monthlyData.length),
    };

    // First vs last month of the range (for "compare X with Y"), plus each month's churn
    const trends = monthlyData.length >= 2 ? {
      [`${first.monthName} → ${last.monthName}`]: {
        members: last.membership.totalMembers - first.membership.totalMembers,
        churnRatePoints: delta(last.metrics.churnRate, first.metrics.churnRate),
        gymmasterRevenue: round2(last.revenue.gymmasterTotal - first.revenue.gymmasterTotal),
        recurringRevenue: round2(last.revenue.recurring - first.revenue.recurring),
        armClasses: delta(last.metrics.armClasses, first.metrics.armClasses),
      },
      churnTrend: monthlyData.map(m => ({ month: m.monthName, churnRate: m.metrics.churnRate, judgment: m.judgment.churn })),
    } : null;

    return NextResponse.json({
      status: hasAnyDraft ? "partial" : "finalized",
      year,
      startMonth,
      endMonth,
      isRangeQuery: true,
      summary: {
        monthsCovered: monthlyData.length,
        range: `${first.monthName}–${last.monthName} ${year} (averages cover these months)`,
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
