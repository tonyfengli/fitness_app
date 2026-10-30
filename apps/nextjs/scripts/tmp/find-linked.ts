// Read-only: where do Sam / Layla (and their payers) show up in snapshots, roster, and GymMaster current members
import { db } from "@acme/db/client";
import { KpiMonthlySnapshot, KpiMemberOverride } from "@acme/db/schema";
import { asc } from "@acme/db";
import { getKpiRoster } from "~/lib/kpi-roster";
const re = /\b(sam|samuel|layla)\b|erdtsieck|oviedo/i;
const snaps = await db.select().from(KpiMonthlySnapshot).orderBy(asc(KpiMonthlySnapshot.year), asc(KpiMonthlySnapshot.month));
for (const s of snaps) {
  const d = s.data as any;
  for (const k of ["payingMembers", "newMembers", "lostMembers", "onHoldMembers"]) {
    for (const m of d[k] || []) if (re.test(m.name)) console.log(`snapshot ${s.year}-${s.month} ${k}: ${m.memberId} ${m.name} ${m.revenue ?? m.amount}`);
  }
}
const ov = await db.select().from(KpiMemberOverride);
console.log("overrides for them:", ov.filter(o => re.test(String((o as any).memberName ?? ""))).length);
const roster = await getKpiRoster();
console.log("roster:", roster?.members.filter(m => re.test(m.name)).map(m => `${m.memberId} ${m.name}`));
const base = process.env.GYMMASTER_BASE_URL!, key = process.env.GYMMASTER_REPORT_API_KEY!;
const r = await fetch(`${base}/api/v2/report/standard_report`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": key }, body: JSON.stringify({ report_id: 1, start_date: "2026-10-01", end_date: "2026-10-30" }) });
const rows = ((await r.json()).result || []) as Record<string, any>[];
const nameKey = Object.keys(rows[0] ?? {}).filter(k => /name/i.test(k));
for (const x of rows) {
  const n = nameKey.map(k => x[k]).join(" ");
  if (re.test(n)) console.log("current members:", x["Member ID"], nameKey.filter(k => !/Type/.test(k)).map(k => x[k]).join(" "), "|", x["Membership Type Name"], "|", x["Membership Fee"], "|", x["Price Description"], "| last visit", x["Last Visit Date"]);
}
process.exit(0);
