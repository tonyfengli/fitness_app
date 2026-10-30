import { db } from "@acme/db/client";
import { KpiMonthlySnapshot, KpiMemberOverride } from "@acme/db/schema";
import { asc } from "@acme/db";

async function main() {
  const snaps = await db.select().from(KpiMonthlySnapshot).orderBy(asc(KpiMonthlySnapshot.year), asc(KpiMonthlySnapshot.month));
  const ov = await db.select().from(KpiMemberOverride);
  let total = 0;
  for (const [i, s] of snaps.entries()) {
    const d = s.data as any;
    const exNew = ov.filter(o => o.month === s.month && o.year === s.year && o.overrideType === "exclude_from_new").map(o => o.memberId);
    const exLost = ov.filter(o => o.month === s.month && o.year === s.year && o.overrideType === "exclude_from_lost").map(o => o.memberId);
    const n = d.newMembers.filter((m: any) => !exNew.includes(m.memberId)).length;
    const l = d.lostMembers.filter((m: any) => !exLost.includes(m.memberId)).length;
    total = i === 0 ? d.totalMembers : total + n - l;
    console.log(`${s.year}-${s.month}: +${n} -${l} => chart ${total} (raw paying ${d.payingMembers.length})`);
  }
  const sep = snaps.find(s => s.month === 9)!.data as any;
  const exNewSep = ov.filter(o => o.month === 9 && o.overrideType === "exclude_from_new").map(o => o.memberId);
  console.log("\nSEP PAYING:");
  for (const m of sep.payingMembers) console.log(`  ${m.memberId}\t$${m.revenue}\t${m.name}${sep.newMembers.some((x: any) => x.memberId === m.memberId) ? "\t[new" + (exNewSep.includes(m.memberId) ? ", excluded]" : "]") : ""}`);
  console.log("SEP LOST:");
  for (const m of sep.lostMembers) console.log(`  ${m.memberId}\t$${m.revenue}\t${m.name}\t${m.type}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
