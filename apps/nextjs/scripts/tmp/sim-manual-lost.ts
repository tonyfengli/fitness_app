// Read-only simulation of the Membership Overview rules with a hypothetical manual loss (no writes)
import { db } from "@acme/db/client";
import { KpiMonthlySnapshot, KpiMemberOverride, KpiBillingLink } from "@acme/db/schema";
import { asc } from "@acme/db";
const snaps = await db.select().from(KpiMonthlySnapshot).orderBy(asc(KpiMonthlySnapshot.year), asc(KpiMonthlySnapshot.month));
const ov = await db.select().from(KpiMemberOverride);
const links = await db.select().from(KpiBillingLink);
const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
function run(manual: { memberId: string; month: number; year: number }[]) {
  let roster = new Map<string, string>(); let tally = 0; const gone = new Set<string>(); const out: string[] = [];
  for (const [i, s] of snaps.entries()) {
    const d = s.data as any; const k = key(s.year, s.month);
    const exNew = new Set(ov.filter(o => o.month === s.month && o.year === s.year && o.overrideType === "exclude_from_new").map(o => o.memberId));
    const exLost = new Set(ov.filter(o => o.month === s.month && o.year === s.year && o.overrideType === "exclude_from_lost").map(o => o.memberId));
    const newM = (d.newMembers || []).filter((m: any) => !exNew.has(m.memberId));
    for (const n of newM) gone.delete(n.memberId);
    const manualHere = manual.filter(x => key(x.year, x.month) === k); const manualIds = new Set(manualHere.map(x => x.memberId));
    const lostM = (d.lostMembers || []).filter((m: any) => !exLost.has(m.memberId) && !gone.has(m.memberId) && !manualIds.has(m.memberId));
    const linkedAdded = links.filter(l => key(l.startYear, l.startMonth) === k && (d.payingMembers || []).some((p: any) => p.memberId === l.paidByMemberId));
    const linkedLost = links.filter(l => key(l.startYear, l.startMonth) < k && lostM.some((x: any) => x.memberId === l.paidByMemberId));
    if (i === 0) roster = new Map((d.payingMembers || []).map((p: any) => [p.memberId, p.name]));
    else { roster = new Map(roster); for (const n of newM) roster.set(n.memberId, n.name); for (const l of lostM) roster.delete(l.memberId); }
    for (const l of linkedAdded) roster.set(l.memberId, l.memberName); for (const l of linkedLost) roster.delete(l.memberId);
    const manualLost = manualHere.filter(x => roster.has(x.memberId)); for (const x of manualLost) { roster.delete(x.memberId); gone.add(x.memberId); }
    const newCount = newM.length + linkedAdded.length, lostCount = lostM.length + linkedLost.length + manualLost.length;
    tally = i === 0 ? (d.payingMembers || []).length + linkedAdded.length - manualLost.length : tally + newCount - lostCount;
    out.push(`${k.slice(5)}:${tally}${roster.size === tally ? "" : `≠${roster.size}`}${manualLost.length ? `(−${manualLost.length} manual)` : ""}`);
  }
  return out.join("  ");
}
const balvas = "322744"; // auto-lost in Sep 2026
console.log("today         ", run([]));
console.log("Balvas lost Aug", run([{ memberId: balvas, month: 8, year: 2026 }]));
process.exit(0);
