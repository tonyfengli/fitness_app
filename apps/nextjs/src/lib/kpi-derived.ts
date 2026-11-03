/**
 * The KPI Overview's membership numbers, computed on the server from saved snapshots.
 *
 * Rebuilds the Overview's inputs (each month's snapshot plus the founders' exclusions,
 * manual losses and billing links) and runs the same deriveMonths() the Overview uses,
 * starting at January 2026 like the dashboard. Agent routes read this so the Slack bot
 * reports what the dashboard shows. Snapshots hold what the Overview saved; a month the
 * Overview hasn't saved since its last change can differ until it's saved again.
 */

import { and, asc, eq, gte, or, gt } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiBillingLink, KpiMemberOverride, KpiMonthlySnapshot } from "@acme/db/schema";

import {
  deriveMonths,
  KPI_START_MONTH,
  KPI_START_YEAR,
  type BillingLink,
  type DerivedMonthData,
  type ManualLost,
} from "~/app/kpi/lib/derive-months";
import type { AllOverrides, MonthData } from "~/app/kpi/types";

export interface DerivedKpiMonth {
  month: number; // 1-12
  year: number;
  status: "draft" | "finalized";
  finalizedAt: Date | null;
  derived: DerivedMonthData;
  prevDerivedTotal: number | null; // the month before's running total, null for the first month
}

export interface DerivedKpi {
  months: DerivedKpiMonth[];
  gaps: string[]; // "2026-05" etc.: months with no snapshot, which break the running total
  overrides: (typeof KpiMemberOverride.$inferSelect)[]; // raw rows, for exclusion reasons
}

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export async function getDerivedKpi(): Promise<DerivedKpi> {
  const [snapshots, overrides, links] = await Promise.all([
    db
      .select()
      .from(KpiMonthlySnapshot)
      .where(
        or(
          gt(KpiMonthlySnapshot.year, KPI_START_YEAR),
          and(eq(KpiMonthlySnapshot.year, KPI_START_YEAR), gte(KpiMonthlySnapshot.month, KPI_START_MONTH))
        )
      )
      .orderBy(asc(KpiMonthlySnapshot.year), asc(KpiMonthlySnapshot.month)),
    db.select().from(KpiMemberOverride),
    db.select().from(KpiBillingLink),
  ]);

  // The Overview's inputs, as it builds them from the database
  const allOverrides: AllOverrides = {};
  const manualLost: ManualLost[] = [];
  for (const o of overrides) {
    const key = monthKey(o.year, o.month);
    allOverrides[key] ??= { excludeFromNew: [], excludeFromLost: [] };
    if (o.overrideType === "exclude_from_new") allOverrides[key].excludeFromNew.push(o.memberId);
    if (o.overrideType === "exclude_from_lost") allOverrides[key].excludeFromLost.push(o.memberId);
    if (o.overrideType === "mark_lost") {
      manualLost.push({ memberId: o.memberId, name: o.reason || `Member ${o.memberId}`, month: o.month, year: o.year });
    }
  }
  const billingLinks: BillingLink[] = links.map((l) => ({
    memberId: l.memberId,
    memberName: l.memberName,
    paidByMemberId: l.paidByMemberId,
    paidByName: l.paidByName,
    startMonth: l.startMonth,
    startYear: l.startYear,
  }));

  // Snapshot → the Overview's MonthData. The snapshot's lostMembers already holds the
  // on-hold members (saved as type "hold"), so onHoldMembers stays empty to avoid counting them twice.
  const toAmount = (m: { memberId: string; name: string; revenue: number }) => ({ memberId: m.memberId, name: m.name, amount: m.revenue });
  const monthsData: MonthData[] = snapshots.map((s) => {
    const d = s.data;
    return {
      month: d.month,
      year: s.year,
      monthKey: monthKey(s.year, s.month),
      ptRevenue: d.ptRevenue,
      smallGroupRevenue: d.smallGroupRevenue,
      openGymRevenue: d.openGymRevenue,
      totalRevenue: d.totalRevenue,
      totalMembers: d.totalMembers,
      arm: d.arm,
      groupRevenue: d.smallGroupRevenue + d.openGymRevenue,
      groupMembers: d.groupMembers,
      armGroups: d.armGroups,
      newMembers: (d.newMembers ?? []).map(toAmount),
      newMembersCount: d.newMembersCount,
      newMembersRevenue: d.newMembersRevenue,
      newGroupMembersCount: 0,
      newGroupMembersRevenue: 0,
      newPtClientsCount: 0,
      newPtClientsRevenue: 0,
      lostMembers: (d.lostMembers ?? []).map((m) => ({ ...toAmount(m), type: m.type })),
      lostMembersCount: d.lostMembersCount,
      lostMembersRevenue: d.lostMembersRevenue,
      lostGroupCount: 0,
      lostGroupRevenue: 0,
      lostPtCount: 0,
      lostPtRevenue: 0,
      onHoldMembers: [],
      onHoldCount: d.onHoldCount,
      onHoldRevenue: d.onHoldRevenue,
      payingMembers: (d.payingMembers ?? []).map(toAmount),
    };
  });

  const gaps: string[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]!;
    const next = prev.month === 12 ? { year: prev.year + 1, month: 1 } : { year: prev.year, month: prev.month + 1 };
    const cur = snapshots[i]!;
    if (cur.year !== next.year || cur.month !== next.month) gaps.push(monthKey(next.year, next.month));
  }

  const derived = deriveMonths(monthsData, allOverrides, billingLinks, manualLost);
  return {
    gaps,
    overrides,
    months: snapshots.map((s, i) => ({
      month: s.month,
      year: s.year,
      status: s.status,
      finalizedAt: s.finalizedAt,
      derived: derived[i]!,
      prevDerivedTotal: i > 0 ? derived[i - 1]!.derivedTotalMembers : null,
    })),
  };
}
