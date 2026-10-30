// Read-only dry run: who's "new since the last finalized KPI snapshot" under two definitions
import { getKpiRoster } from "~/lib/kpi-roster";
const base = process.env.GYMMASTER_BASE_URL!, key = process.env.GYMMASTER_REPORT_API_KEY!;
async function rep(id: number, s: string, e: string) {
  const r = await fetch(`${base}/api/v2/report/standard_report`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": key }, body: JSON.stringify({ report_id: id, start_date: s, end_date: e }) });
  return ((await r.json()).result || []) as Record<string, any>[];
}
const roster = (await getKpiRoster())!;
const onRoster = new Set(roster.members.map(m => m.memberId));
const cutoff = new Date(roster.year, roster.month, 1); // first day after the snapshot month
const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = iso(new Date());
console.log(`roster through ${roster.year}-${roster.month}: ${onRoster.size} members; cutoff ${iso(cutoff)}`);
const current = await rep(1, iso(cutoff), today);
await new Promise(r => setTimeout(r, 2000));
const pays = await rep(103, iso(cutoff), today);
await new Promise(r => setTimeout(r, 2000));
const prev = await rep(103, iso(new Date(roster.year, roster.month - 1, 1)), iso(new Date(roster.year, roster.month, 0)));
const paidPrev = new Set(prev.filter(p => !/Refund/i.test(p["Payment Details"]) && Number(String(p["Payment Amount"]).replace(/[$,]/g, "")) > 0).map(p => String(p["Member ID"])));
const name = (r: Record<string, any>) => r["Member Name"] || r["Name"] || "";
// A: current members whose membership started after the snapshot and who aren't on the KPI roster
const A = current.filter(r => new Date(r["Membership Start Date"]) >= cutoff && !onRoster.has(String(r["Member ID"])));
console.log("\nA) current members started since cutoff, not on roster:", A.length);
for (const r of A) console.log("  ", r["Member ID"], name(r), "| start", r["Membership Start Date"], "|", r["Membership Type Name"]);
const B = current.filter(r => new Date(r["Membership Start Date"]) >= cutoff && onRoster.has(String(r["Member ID"])));
console.log("\n   (started since cutoff but already on roster = plan change):", B.map(r => name(r)).join("; "));
// C: KPI-style: paid since cutoff, not on roster, didn't pay in the snapshot month
const paidSince = new Map<string, { name: string; amt: number; cats: Set<string> }>();
for (const p of pays) {
  const amt = Number(String(p["Payment Amount"]).replace(/[$,]/g, ""));
  if (/Refund/i.test(p["Payment Details"]) || !(amt > 0)) continue;
  const id = String(p["Member ID"]);
  const e = paidSince.get(id) || { name: p["Name"] || p["Member Name"] || "", amt: 0, cats: new Set() };
  e.amt += amt; e.cats.add(String(p["Payment Details"]).replace("Membership Category: ", "")); paidSince.set(id, e);
}
const C = [...paidSince].filter(([id]) => !onRoster.has(id) && !paidPrev.has(id));
console.log("\nC) paid since cutoff, not on roster, didn't pay in snapshot month:", C.length);
const currentIds = new Set(current.map(r => String(r["Member ID"])));
for (const [id, e] of C) console.log("  ", id, e.name, "| $" + e.amt.toFixed(2), "|", [...e.cats].join(", "), currentIds.has(id) ? "" : "| NOT a current member");
const D = [...paidSince].filter(([id]) => !onRoster.has(id) && paidPrev.has(id));
console.log("\n   (paid since cutoff, not on roster, but also paid in snapshot month):", D.map(([, e]) => e.name).join("; "));
process.exit(0);
