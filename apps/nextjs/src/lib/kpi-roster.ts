/**
 * KPI member roster: the list of members behind the KPI overview's "Total Members".
 *
 * The overview's count is a running tally, not a single month's paying list:
 * the first month's paying members, then each later month adds new members and
 * removes lost members (cancellations + holds), skipping the KPI page's
 * exclude_from_new / exclude_from_lost overrides. This rolls the same tally as a
 * member list over finalized snapshots, so Save Calls works off exactly the
 * members the KPI overview counts.
 *
 * Members paid for by someone else (KPI billing links) never show as paying, so
 * they ride along with their payer: on the roster whenever the payer is, from the
 * link's start month.
 */

import { asc, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiBillingLink, KpiMonthlySnapshot, KpiMemberOverride } from "@acme/db/schema";

export interface KpiRosterMember {
  memberId: string;
  name: string;
  revenue: number; // paid in the latest month, else the amount they joined at
  paidBy?: { memberId: string; name: string }; // set when another member pays for them
}

export interface KpiRoster {
  month: number; // latest finalized month the roster is rolled to
  year: number;
  members: KpiRosterMember[];
}

export async function getKpiRoster(): Promise<KpiRoster | null> {
  const [snapshots, overrides, links] = await Promise.all([
    db
      .select()
      .from(KpiMonthlySnapshot)
      .where(eq(KpiMonthlySnapshot.status, "finalized"))
      .orderBy(asc(KpiMonthlySnapshot.year), asc(KpiMonthlySnapshot.month)),
    db.select().from(KpiMemberOverride),
    db.select().from(KpiBillingLink),
  ]);

  if (!snapshots.length) return null;

  const excluded = (month: number, year: number, type: string) =>
    new Set(overrides.filter(o => o.month === month && o.year === year && o.overrideType === type).map(o => o.memberId));

  const roster = new Map<string, KpiRosterMember>();

  const applyLinks = (month: number, year: number) => {
    for (const link of links) {
      const started = year > link.startYear || (year === link.startYear && month >= link.startMonth);
      if (started && roster.has(link.paidByMemberId)) {
        roster.set(link.memberId, {
          memberId: link.memberId,
          name: link.memberName,
          revenue: 0, // their membership is in the payer's revenue
          paidBy: { memberId: link.paidByMemberId, name: link.paidByName },
        });
      } else if (roster.get(link.memberId)?.paidBy) {
        roster.delete(link.memberId);
      }
    }
  };

  snapshots.forEach((snapshot, i) => {
    const data = snapshot.data;
    if (i === 0) {
      for (const m of data.payingMembers || []) {
        roster.set(m.memberId, { memberId: m.memberId, name: m.name, revenue: m.revenue });
      }
      applyLinks(snapshot.month, snapshot.year);
      return;
    }
    const excludeFromNew = excluded(snapshot.month, snapshot.year, "exclude_from_new");
    const excludeFromLost = excluded(snapshot.month, snapshot.year, "exclude_from_lost");
    for (const m of data.newMembers || []) {
      if (!excludeFromNew.has(m.memberId)) roster.set(m.memberId, { memberId: m.memberId, name: m.name, revenue: m.revenue });
    }
    for (const m of data.lostMembers || []) {
      if (!excludeFromLost.has(m.memberId)) roster.delete(m.memberId);
    }
    applyLinks(snapshot.month, snapshot.year);
  });

  // Prefer what each member actually paid in the latest month
  const latest = snapshots[snapshots.length - 1]!;
  for (const m of latest.data.payingMembers || []) {
    const member = roster.get(m.memberId);
    if (member) member.revenue = m.revenue;
  }

  return { month: latest.month, year: latest.year, members: [...roster.values()] };
}
