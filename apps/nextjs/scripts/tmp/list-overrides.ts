// Read-only: KPI overrides by month
import { db } from "@acme/db/client";
import { KpiMemberOverride } from "@acme/db/schema";
const ov = await db.select().from(KpiMemberOverride);
const by = new Map<string, string[]>();
for (const o of ov) { const k = `${o.year}-${o.month} ${o.overrideType}`; by.set(k, [...(by.get(k) || []), o.memberId]); }
for (const [k, v] of [...by].sort()) console.log(k, v.join(","));
console.log("Kleiser 322787:", ov.filter(o => o.memberId === "322787").map(o => `${o.year}-${o.month} ${o.overrideType} created ${o.createdAt.toISOString().slice(0,16)}`));
process.exit(0);
