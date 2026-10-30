import { db } from "@acme/db/client";
import { KpiMonthlySnapshot, KpiMemberOverride } from "@acme/db/schema";
import { asc } from "@acme/db";

async function main() {
  const snaps = await db.select().from(KpiMonthlySnapshot).orderBy(asc(KpiMonthlySnapshot.year), asc(KpiMonthlySnapshot.month));
  for (const s of snaps) {
    const d = s.data as any;
    console.log(`${s.year}-${String(s.month).padStart(2,"0")} status=${s.status} updated=${s.updatedAt?.toISOString?.() ?? s.updatedAt} totalMembers=${d.totalMembers} paying=${d.payingMembers?.length} new=${d.newMembers?.length} lost=${d.lostMembers?.length} onHold=${d.onHoldMembers?.length}`);
  }
  const ov = await db.select().from(KpiMemberOverride).orderBy(asc(KpiMemberOverride.year), asc(KpiMemberOverride.month));
  console.log(`\noverrides: ${ov.length}`);
  for (const o of ov) console.log(`  ${o.year}-${o.month} ${o.overrideType} ${o.memberId} ${o.reason ?? ""}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
