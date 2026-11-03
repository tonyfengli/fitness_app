/**
 * Churned Members API for OpenClaw Retention Specialist
 *
 * Single month: GET /api/agent/churned-members?month=10&year=2026
 * Range:        GET /api/agent/churned-members?startMonth=1&endMonth=9&year=2026
 *
 * Returns members who left (cancelled, went on hold, marked lost by hand, or lost with
 * the member paying for them) in the specified month(s): the same lost list the KPI
 * dashboard Overview shows, from getDerivedKpi. Excluded members are listed separately.
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
    const { months, gaps, overrides } = await getDerivedKpi();
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
        churnedMembers: [],
        _meta: {
          generatedAt: new Date().toISOString(),
        },
      });
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const allChurnedMembers: ChurnedMember[] = [];
    const allExcludedMembers: Array<{ memberId: string; name: string; revenue: number; reason: string; month: number; monthName: string }> = [];
    const byMonth: Array<{ month: number; monthName: string; dataStatus: string; count: number; revenue: number }> = [];

    for (const { month, status, derived: d } of selected) {
      const monthName = MONTH_NAMES[month - 1] ?? String(month);
      const idx = months.findIndex((m) => m.year === year && m.month === month);
      // A manual loss takes what they paid the month before, as on the dashboard
      const prevPaid = new Map((months[idx - 1]?.derived.payingMembers ?? []).map((p) => [p.memberId, p.amount]));

      const lost: ChurnedMember[] = [
        ...d.filteredLostMembers.map((m) => ({ memberId: m.memberId, name: m.name, revenue: m.amount, type: m.type === "hold" ? "On Hold" : "Cancelled" })),
        ...d.manualLost.map((m) => ({ memberId: m.memberId, name: m.name, revenue: prevPaid.get(m.memberId) ?? 0, type: "Marked lost by hand" })),
        ...d.linkedLost.map((l) => ({ memberId: l.memberId, name: l.memberName, revenue: 0, type: `Lost with ${l.paidByName}, who paid for them` })),
      ];
      allChurnedMembers.push(...lost.map((m) => ({ ...m, month, monthName })));

      const excludedIds = new Set(
        overrides.filter((o) => o.year === year && o.month === month && o.overrideType === "exclude_from_lost").map((o) => o.memberId)
      );
      for (const m of d.lostMembers.filter((x) => excludedIds.has(x.memberId))) {
        allExcludedMembers.push({
          memberId: m.memberId,
          name: m.name,
          revenue: m.amount,
          reason: overrides.find(o => o.memberId === m.memberId && o.year === year && o.month === month && o.overrideType === "exclude_from_lost")?.reason || "Data correction",
          month,
          monthName,
        });
      }

      byMonth.push({
        month,
        monthName,
        dataStatus: monthStatusNote(status, month, year),
        count: d.filteredLostCount,
        revenue: round2(d.filteredLostRevenue),
      });
    }

    const hasAnyDraft = selected.some((m) => m.status === "draft");
    const note = gaps.length
      ? `${SNAPSHOT_COUNT_CAVEAT} Missing months (${gaps.join(", ")}) break the running total.`
      : SNAPSHOT_COUNT_CAVEAT;

    // 4. Build response
    const response = {
      status: hasAnyDraft ? "partial" : "finalized",
      year,
      startMonth,
      endMonth,
      isRangeQuery,
      summary: {
        totalLost: byMonth.reduce((sum, m) => sum + m.count, 0),
        lostRevenue: round2(byMonth.reduce((sum, m) => sum + m.revenue, 0)),
        excluded: allExcludedMembers.length,
        byType: {
          cancellations: allChurnedMembers.filter(m => m.type === "Cancelled").length,
          onHold: allChurnedMembers.filter(m => m.type === "On Hold").length,
          markedLostByHand: allChurnedMembers.filter(m => m.type === "Marked lost by hand").length,
          lostWithPayer: allChurnedMembers.filter(m => m.type.startsWith("Lost with")).length,
        },
        byMonth,
      },
      churnedMembers: allChurnedMembers,
      excludedMembers: allExcludedMembers,
      _meta: {
        generatedAt: new Date().toISOString(),
        dataSource: "supabase",
        monthsCovered: selected.length,
        monthsRequested: endMonth - startMonth + 1,
        note: hasAnyDraft ? `Some months are not finalized (see each month's dataStatus). ${note}` : note,
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
