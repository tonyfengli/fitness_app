/**
 * The KPI Overview's month-by-month membership numbers: the running member total,
 * new and lost counts after the founders' adjustments (exclusions, manual losses,
 * billing links), and the members behind each number.
 *
 * Shared by the Overview (ReportingTab, from live GymMaster data) and the agent
 * routes (lib/kpi-derived.ts, from saved snapshots), so the Slack bot reports the
 * same numbers the dashboard shows. The running total depends on the first month
 * passed in; the dashboard always starts at January 2026 (KPI_START_*).
 */

import type { AllOverrides, LostMemberRecord, MemberRecord, MonthData } from "../types";

export const KPI_START_YEAR = 2026;
export const KPI_START_MONTH = 1;

export interface DerivedMonthData extends MonthData {
  derivedTotalMembers: number;
  filteredNewMembers: MemberRecord[];
  filteredLostMembers: LostMemberRecord[];
  filteredNewCount: number;
  filteredLostCount: number;
  filteredNewRevenue: number;
  filteredLostRevenue: number;
  linkedAdded: BillingLink[]; // included (paid-for) members counted as new this month
  linkedLost: BillingLink[]; // included members counted as lost because their payer was lost
  rosterMembers: RosterMember[]; // the people behind derivedTotalMembers
  manualLost: ManualLost[]; // marked lost by hand this month
}

// A member marked lost by hand in a month (kpi_member_override "mark_lost")
export interface ManualLost {
  memberId: string;
  name: string;
  month: number;
  year: number;
}

// A member in the running total for a month
export interface RosterMember {
  memberId: string;
  name: string;
  amount: number | null; // paid this month, null if they didn't pay
  paidBy: string | null; // payer's name for included (paid-for) members
  isNew: boolean;
}

// A member whose membership another member pays for (GymMaster records the payment under the payer)
export interface BillingLink {
  memberId: string;
  memberName: string;
  paidByMemberId: string;
  paidByName: string;
  startMonth: number;
  startYear: number;
}

export const linkMonthKey = (l: BillingLink) => `${l.startYear}-${String(l.startMonth).padStart(2, "0")}`;

// Compute derived data with overrides applied
export function deriveMonths(
  monthsData: MonthData[],
  overrides: AllOverrides,
  billingLinks: BillingLink[],
  manualLost: ManualLost[]
): DerivedMonthData[] {
  if (monthsData.length === 0) return [];

  const result: DerivedMonthData[] = [];
  // The running total as a member list: first month's paying members, then + new − lost each month
  let roster = new Map<string, Omit<RosterMember, "amount" | "isNew">>();
  // Marked lost by hand and not back since: an automatic loss for them later would count them twice
  const manuallyGone = new Set<string>();

  for (let i = 0; i < monthsData.length; i++) {
    const m = monthsData[i]!;
    const monthOverrides = overrides[m.monthKey] || { excludeFromNew: [], excludeFromLost: [] };

    // Filter new members (exclude those in override list)
    const filteredNew = m.newMembers.filter(
      (member) => !monthOverrides.excludeFromNew.includes(member.memberId)
    );

    // Filter lost members (exclude those in override list) - includes on hold
    const allLostWithHold = [
      ...m.lostMembers,
      ...m.onHoldMembers.map((oh) => ({ ...oh, type: "hold" as const })),
    ];
    // Manual losses this month; a returning member (new this month) is back in
    for (const n of filteredNew) manuallyGone.delete(n.memberId);
    const manualHere = manualLost.filter((x) => `${x.year}-${String(x.month).padStart(2, "0")}` === m.monthKey);
    const manualIds = new Set(manualHere.map((x) => x.memberId));
    const filteredLost = allLostWithHold.filter(
      (member) =>
        !monthOverrides.excludeFromLost.includes(member.memberId) &&
        !manuallyGone.has(member.memberId) && // already lost by hand
        !manualIds.has(member.memberId) // lost by hand this month: counted once, as manual
    );

    // Includes (members paid for by someone else) count as new in their start month if the
    // payer paid, and as lost when their payer is lost
    const linkedAdded = billingLinks.filter(
      (l) => linkMonthKey(l) === m.monthKey && m.payingMembers.some((p) => p.memberId === l.paidByMemberId)
    );
    const linkedLost = billingLinks.filter(
      (l) => linkMonthKey(l) < m.monthKey && filteredLost.some((x) => x.memberId === l.paidByMemberId)
    );

    roster = new Map(i === 0 ? [] : roster);
    if (i === 0) {
      for (const p of m.payingMembers) roster.set(p.memberId, { memberId: p.memberId, name: p.name, paidBy: null });
    } else {
      for (const n of filteredNew) roster.set(n.memberId, { memberId: n.memberId, name: n.name, paidBy: null });
      for (const l of filteredLost) roster.delete(l.memberId);
    }
    for (const l of linkedAdded) roster.set(l.memberId, { memberId: l.memberId, name: l.memberName, paidBy: l.paidByName });
    for (const l of linkedLost) roster.delete(l.memberId);
    // Only someone in the total can be lost by hand
    const manualLostHere = manualHere.filter((x) => roster.has(x.memberId));
    for (const x of manualLostHere) {
      roster.delete(x.memberId);
      manuallyGone.add(x.memberId);
    }
    const paidThisMonth = new Map(m.payingMembers.map((p) => [p.memberId, p.amount]));
    const newIds = new Set([...filteredNew.map((n) => n.memberId), ...linkedAdded.map((l) => l.memberId)]);
    const rosterMembers: RosterMember[] = [...roster.values()]
      .map((r) => ({ ...r, amount: paidThisMonth.get(r.memberId) ?? null, isNew: i > 0 && newIds.has(r.memberId) }))
      .sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1) || a.name.localeCompare(b.name));

    const filteredNewCount = filteredNew.length + linkedAdded.length;
    const filteredLostCount = filteredLost.length + linkedLost.length + manualLostHere.length;
    const filteredNewRevenue = filteredNew.reduce((sum, x) => sum + x.amount, 0);
    // A manual loss takes what they paid the month before
    const prevPaid = new Map((monthsData[i - 1]?.payingMembers ?? []).map((p) => [p.memberId, p.amount]));
    const filteredLostRevenue =
      filteredLost.reduce((sum, x) => sum + x.amount, 0) +
      manualLostHere.reduce((sum, x) => sum + (prevPaid.get(x.memberId) ?? 0), 0);

    // Calculate derived total
    let derivedTotal: number;
    if (i === 0) {
      derivedTotal = m.totalMembers + linkedAdded.length - manualLostHere.length;
    } else {
      const prevDerived = result[i - 1]!.derivedTotalMembers;
      derivedTotal = prevDerived + filteredNewCount - filteredLostCount;
    }

    result.push({
      ...m,
      derivedTotalMembers: derivedTotal,
      filteredNewMembers: filteredNew,
      filteredLostMembers: filteredLost,
      filteredNewCount,
      filteredLostCount,
      filteredNewRevenue,
      filteredLostRevenue,
      linkedAdded,
      linkedLost,
      rosterMembers,
      manualLost: manualLostHere,
    });
  }

  return result;
}
