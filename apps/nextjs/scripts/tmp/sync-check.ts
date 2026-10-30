// Read-only: compare save-calls member basis (latest finalized snapshot's payingMembers) with KPI overview logic.
import { db } from "@acme/db/client";
import { KpiMonthlySnapshot, KpiMemberOverride } from "@acme/db/schema";
import { asc } from "@acme/db";
const snaps = await db.select().from(KpiMonthlySnapshot).orderBy(asc(KpiMonthlySnapshot.year), asc(KpiMonthlySnapshot.month));
const ov = await db.select().from(KpiMemberOverride);
console.log("snapshots:", snaps.map(s => `${s.year}-${s.month} ${s.status}`).join(", "));
console.log("override types:", [...new Set(ov.map(o => o.overrideType))], "count", ov.length);
// Roll a member LIST the same way the chart rolls the count
let roster = new Map<string, string>();
for (const [i, s] of snaps.entries()) {
  const d = s.data as any;
  const exNew = new Set(ov.filter(o => o.month === s.month && o.year === s.year && o.overrideType === "exclude_from_new").map(o => o.memberId));
  const exLost = new Set(ov.filter(o => o.month === s.month && o.year === s.year && o.overrideType === "exclude_from_lost").map(o => o.memberId));
  if (i === 0) roster = new Map(d.payingMembers.map((m: any) => [m.memberId, m.name]));
  else {
    for (const m of d.newMembers) if (!exNew.has(m.memberId)) roster.set(m.memberId, m.name);
    for (const m of d.lostMembers) if (!exLost.has(m.memberId)) roster.delete(m.memberId);
  }
  const paying = new Set(d.payingMembers.map((m: any) => m.memberId));
  const onlyRoster = [...roster.keys()].filter(id => !paying.has(id));
  const onlyPaying = [...paying].filter(id => !roster.has(id as string));
  console.log(`${s.year}-${s.month} [${s.status}] roster ${roster.size} | paying ${paying.size} | in roster not paying ${onlyRoster.length} | paying not in roster ${onlyPaying.length}`);
  if (s.month >= 8) {
    console.log("   roster-only:", onlyRoster.map(id => `${id} ${roster.get(id)}`).join("; "));
    console.log("   paying-only:", onlyPaying.map(id => `${id} ${(d.payingMembers.find((m: any) => m.memberId === id) || {}).name}`).join("; "));
    const exAR = ov.filter(o => o.month === s.month && o.year === s.year && o.overrideType === "exclude_from_at_risk").map(o => o.memberId);
    console.log("   exclude_from_new:", [...exNew].join(","), "| exclude_from_lost:", [...exLost].join(","), "| exclude_from_at_risk:", exAR.join(","));
  }
}
process.exit(0);
