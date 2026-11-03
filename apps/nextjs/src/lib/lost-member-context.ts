/**
 * What was going on with each lost member, for churn investigations (walkthrough D3):
 * plan and fee, when they joined and ended, their last class before leaving (bookings,
 * the Retention attendance rule), any charges or refunds from the month they left onward,
 * and whether they came back. Three GymMaster calls cover every member in the period.
 */

import { KPI_START_MONTH, KPI_START_YEAR } from "~/app/kpi/lib/derive-months";
import type { DerivedKpiMonth } from "~/lib/kpi-derived";
import { DATA_START, VALID_ATTENDANCE } from "~/lib/class-attendance";
import { fetchGymMasterReport, gymMasterAmount, GYMMASTER_REPORTS, parseGymMasterDate } from "~/lib/gymmaster-report";

export interface LostMemberContext {
  plan: string | null;
  fee: string | null; // "$120.00 Monthly by Billing"
  joined: string | null;
  ended: string | null;
  tenureDays: number | null; // joined → end of the month they were lost
  lastClass: string | null; // last attended class before the end of the month they were lost
  daysSinceLastClass: number | null; // at the start of the month they were lost (0 if they came that month)
  attendanceNote: string | null; // set when the dates fall before reliable booking data
  paymentsFromLossMonth: { date: string; amount: number }[]; // charges and refunds (negative) from that month on
  returned: string | null; // first later month they paid again, "2026-10"
}

const DAY = 864e5;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

export async function getLostMemberContext(
  lost: { memberId: string; month: number; year: number }[],
  months: DerivedKpiMonth[]
): Promise<Map<string, LostMemberContext>> {
  const result = new Map<string, LostMemberContext>();
  if (!lost.length) return result;

  const start = iso(new Date(Date.UTC(KPI_START_YEAR, KPI_START_MONTH - 1, 1)));
  const today = iso(new Date());
  const [members, payments, bookings] = await Promise.all([
    fetchGymMasterReport(GYMMASTER_REPORTS.MEMBERS, start, today),
    fetchGymMasterReport(GYMMASTER_REPORTS.PAYMENTS, start, today),
    fetchGymMasterReport(GYMMASTER_REPORTS.BOOKINGS, start, today),
  ]);

  for (const l of lost) {
    const lossStart = new Date(Date.UTC(l.year, l.month - 1, 1));
    const lossEnd = new Date(Date.UTC(l.year, l.month, 1) - 1);

    // The membership that had started by the end of the loss month (latest such, if several)
    const row = members
      .filter((m) => String(m["Member ID"]) === l.memberId)
      .map((m) => ({ m, started: parseGymMasterDate(m["Membership Start Date"]) }))
      .filter((x) => !x.started || x.started <= lossEnd)
      .sort((a, b) => (b.started?.getTime() ?? 0) - (a.started?.getTime() ?? 0))[0]?.m;

    const joined = parseGymMasterDate(row?.["Membership Start Date"]);
    // Not GymMaster's "Last Visit Date": it tracks door check-ins and is often blank or stale
    const lastClass = bookings
      .filter((b) => String(b["Member ID"]) === l.memberId && VALID_ATTENDANCE.includes(String(b["Booking Result"] ?? "")))
      .map((b) => parseGymMasterDate(b["Booking Date"]))
      .filter((d): d is Date => !!d && d <= lossEnd)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const reliableFrom = new Date(`${DATA_START}T00:00:00Z`);
    const fee = row?.["Membership Fee"] ? `${String(row["Membership Fee"])} ${String(row["Price Description"] ?? "")}`.trim() : null;

    const paymentsFromLossMonth = payments
      .filter((p) => String(p["Member ID"]) === l.memberId)
      .map((p) => ({ date: parseGymMasterDate(p["Payment Date"]), amount: gymMasterAmount(p["Payment Amount"]) }))
      .filter((p): p is { date: Date; amount: number } => !!p.date && p.date >= lossStart)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((p) => ({ date: iso(p.date), amount: p.amount }));

    const later = months.filter((m) => m.year > l.year || (m.year === l.year && m.month > l.month));
    const back = later.find((m) => m.derived.payingMembers.some((p) => p.memberId === l.memberId));

    result.set(`${l.memberId}:${monthKey(l.year, l.month)}`, {
      plan: row ? String(row["Membership Type Name"] ?? "") || null : null,
      fee,
      joined: joined ? iso(joined) : null,
      ended: parseGymMasterDate(row?.["Membership End Date"]) ? iso(parseGymMasterDate(row?.["Membership End Date"])!) : null,
      tenureDays: joined ? Math.round((lossEnd.getTime() - joined.getTime()) / DAY) : null,
      lastClass: lastClass ? iso(lastClass) : null,
      daysSinceLastClass: lastClass ? Math.max(0, Math.round((lossStart.getTime() - lastClass.getTime()) / DAY)) : null,
      attendanceNote:
        lossStart < reliableFrom ? `Booking data before ${DATA_START} is unreliable; treat last class as approximate.` : null,
      paymentsFromLossMonth,
      returned: back ? monthKey(back.year, back.month) : null,
    });
  }
  return result;
}
