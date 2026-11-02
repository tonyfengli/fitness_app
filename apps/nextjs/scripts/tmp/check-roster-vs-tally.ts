// Read-only: does the running-total member list have the same size as the Total Members tally, per month?
import { db } from "@acme/db/client";
import { KpiMonthlySnapshot, KpiMemberOverride, KpiBillingLink } from "@acme/db/schema";
import { asc } from "@acme/db";
const snaps = await db.select().from(KpiMonthlySnapshot).orderBy(asc(KpiMonthlySnapshot.year), asc(KpiMonthlySnapshot.month));
const ov = await db.select().from(KpiMemberOverride);
const links = await db.select().from(KpiBillingLink);
const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
let roster = new Map<string, string>(); let tally = 0;
for (const [i, s] of snaps.entries()) {
  const d = s.data as any; const k = key(s.year, s.month);
  const exNew = new Set(ov.filter(o => o.month === s.month && o.year === s.year && o.overrideType === "exclude_from_new").map(o => o.memberId));
  const exLost = new Set(ov.filter(o => o.month === s.month && o.year === s.year && o.overrideType === "exclude_from_lost").map(o => o.memberId));
  const newM = (d.newMembers || []).filter((m: any) => !exNew.has(m.memberId));
  const lostM = (d.lostMembers || []).filter((m: any) => !exLost.has(m.memberId)); // snapshot lost already includes holds
  const linkedAdded = links.filter(l => key(l.startYear, l.startMonth) === k && (d.payingMembers || []).some((p: any) => p.memberId === l.paidByMemberId));
  const linkedLost = links.filter(l => key(l.startYear, l.startMonth) < k && lostM.some((x: any) => x.memberId === l.paidByMemberId));
  if (i === 0) { roster = new Map((d.payingMembers || []).map((p: any) => [p.memberId, p.name])); tally = (d.payingMembers || []).length; }
  else {
    roster = new Map(roster);
    for (const n of newM) roster.set(n.memberId, n.name);
    for (const l of lostM) roster.delete(l.memberId);
    tally += newM.length - lostM.length;
  }
  for (const l of linkedAdded) roster.set(l.memberId, l.memberName);
  for (const l of linkedLost) roster.delete(l.memberId);
  tally += linkedAdded.length - linkedLost.length;
  const lostNotOnRoster = i ? lostM.filter((l: any) => !roster.has(l.memberId)).length : 0;
  console.log(k, "tally", tally, "| list", roster.size, roster.size === tally ? "" : "<< differs");
}
process.exit(0);
