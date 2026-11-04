/**
 * Members API for OpenClaw
 * GET /api/agent/members
 *
 * Who the current members are: the KPI Overview's member total as a list, rolled
 * through the latest finalized month (getKpiRoster, the same list the payments,
 * at-risk and milestones tools use). Each member says why they count:
 * - paid: paid a membership or PT in the latest finalized month
 * - paid_by_other: their membership is paid by another member (billing link)
 * - kept_by_founders: no payment that month, but the founders excluded them from lost
 *   (a prepaid package, or a missed or failed charge they expect to recover)
 * - not_charged: no payment that month, still on GymMaster's current-members list, so
 *   never counted as lost; usually a missed or failed charge (the payments tool says which)
 * Plan names are read live from GymMaster (report 1); everything else is from saved snapshots.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { getKpiRoster } from "~/lib/kpi-roster";
import { getDerivedKpi } from "~/lib/kpi-derived";
import { fetchGymMasterReport, GYMMASTER_REPORTS } from "~/lib/gymmaster-report";
import { METRICS } from "~/app/kpi/lib/metric-definitions";

export const dynamic = "force-dynamic";

type Kind = "paid" | "paid_by_other" | "kept_by_founders" | "not_charged";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (year: number, month: number) => `${MONTHS[month - 1]} ${year}`;

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  try {
    const [roster, kpi] = await Promise.all([getKpiRoster(), getDerivedKpi()]);
    if (!roster) {
      return NextResponse.json({ status: "no_data", message: "No finalized KPI month yet.", members: [] });
    }

    const upTo = kpi.months.filter(m => m.year < roster.year || (m.year === roster.year && m.month <= roster.month));
    const latest = upTo.find(m => m.year === roster.year && m.month === roster.month);
    const paidLatest = new Map((latest?.derived.payingMembers ?? []).map(p => [p.memberId, p.amount]));
    const keptLatest = new Map(
      kpi.overrides
        .filter(o => o.year === roster.year && o.month === roster.month && o.overrideType === "exclude_from_lost")
        .map(o => [o.memberId, o.reason ?? null])
    );

    // Plan names (live). The list itself doesn't depend on this, so a GymMaster outage only drops plans.
    // Report 1 gives one row per member, for the plan they had at the start of the range:
    // read from the latest month first, then the whole year for anyone not found (e.g. the prepaid client).
    const plans = new Map<string, string>();
    try {
      const today = new Date().toISOString().slice(0, 10);
      const recentStart = `${roster.year}-${String(roster.month).padStart(2, "0")}-01`;
      const [recent, year] = await Promise.all([
        fetchGymMasterReport(GYMMASTER_REPORTS.MEMBERS, recentStart, today),
        fetchGymMasterReport(GYMMASTER_REPORTS.MEMBERS, `${roster.year}-01-01`, today),
      ]);
      for (const r of [...year, ...recent]) {
        const plan = r["Membership Type Name"];
        if (typeof plan === "string" && plan) plans.set(String(r["Member ID"]), plan);
      }
    } catch (err) {
      console.error("[API /agent/members] plan lookup failed:", err);
    }

    const members = roster.members.map(m => {
      // When they entered the running total: January's paying list, or the last month they counted as new
      let countedFrom: string | null = null;
      let lastPaid: { month: string; amount: number } | null = null;
      for (const mo of upTo) {
        const first = mo === kpi.months[0];
        if (first ? mo.derived.payingMembers.some(p => p.memberId === m.memberId) : mo.derived.filteredNewMembers.some(p => p.memberId === m.memberId)) {
          countedFrom = first ? `${monthName(mo.year, mo.month)} (start of the tally)` : `${monthName(mo.year, mo.month)} (new member)`;
        }
        const paid = mo.derived.payingMembers.find(p => p.memberId === m.memberId);
        if (paid) lastPaid = { month: monthName(mo.year, mo.month), amount: paid.amount };
      }

      let kind: Kind;
      let why: string;
      if (m.paidBy) {
        kind = "paid_by_other";
        why = `Membership paid by ${m.paidBy.name} (#${m.paidBy.memberId}); counts while they do`;
        countedFrom ??= "billing link";
      } else if (paidLatest.has(m.memberId)) {
        kind = "paid";
        why = "Paid this month";
      } else if (keptLatest.has(m.memberId)) {
        kind = "kept_by_founders";
        const reason = keptLatest.get(m.memberId);
        why = `No payment this month; the founders excluded them from lost${reason ? ` (${reason})` : ""}. A prepaid package or a charge expected to recover: check the payments tool for billing problems`;
      } else {
        kind = "not_charged";
        why = "No payment this month but still on GymMaster's current-members list, so not counted as lost. Usually a missed or failed charge: check the payments tool";
      }

      return {
        memberId: m.memberId,
        name: m.name,
        kind,
        why,
        paidThisMonth: paidLatest.get(m.memberId) ?? null,
        lastPaid,
        countedFrom,
        plan: plans.get(m.memberId) ?? null,
      };
    });

    const count = (k: Kind) => members.filter(m => m.kind === k).length;
    return NextResponse.json({
      definition: METRICS.members.definition,
      month: roster.month,
      year: roster.year,
      monthName: monthName(roster.year, roster.month),
      finalized: latest?.status === "finalized",
      total: members.length,
      counts: {
        paid: count("paid"),
        paidByOther: count("paid_by_other"),
        keptByFounders: count("kept_by_founders"),
        notCharged: count("not_charged"),
      },
      members: members.sort((a, b) => a.name.localeCompare(b.name)),
      _meta: { generatedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error("[API /agent/members] Error:", error);
    return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
  }
}
