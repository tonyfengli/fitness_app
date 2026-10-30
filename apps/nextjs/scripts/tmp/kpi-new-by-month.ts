// Read-only: KPI new members per finalized month (names only), plus exclude_from_new overrides
import { db } from "@acme/db/client";
import { KpiMonthlySnapshot, KpiMemberOverride } from "@acme/db/schema";
import { asc } from "@acme/db";
const snaps = await db.select().from(KpiMonthlySnapshot).orderBy(asc(KpiMonthlySnapshot.year), asc(KpiMonthlySnapshot.month));
const ov = await db.select().from(KpiMemberOverride);
for (const s of snaps.filter(s => s.month >= 6)) {
  const ex = new Set(ov.filter(o => o.month === s.month && o.year === s.year && o.overrideType === "exclude_from_new").map(o => o.memberId));
  console.log(`${s.year}-${s.month}:`, ((s.data as any).newMembers || []).map((m: any) => `${m.name}${ex.has(m.memberId) ? " [excluded]" : ""}`).join("; "));
}
process.exit(0);
