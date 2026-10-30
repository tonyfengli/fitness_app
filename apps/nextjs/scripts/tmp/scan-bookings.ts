// Read-only: booking results by month (old GymMaster report 9) and lifetime attended counts for KPI-roster members
import { getKpiRoster } from "~/lib/kpi-roster";
const base = process.env.GYMMASTER_BASE_URL!, key = process.env.GYMMASTER_REPORT_API_KEY!;
async function rep(s: string, e: string) {
  const r = await fetch(`${base}/api/v2/report/standard_report`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": key }, body: JSON.stringify({ report_id: 9, start_date: s, end_date: e }) });
  return ((await r.json()).result || []) as Record<string, any>[];
}
const VALID = ["Booking", "Showed", "Showed late"];
const all: Record<string, any>[] = [];
for (const [s, e] of [["2025-01-01", "2025-12-31"], ["2026-01-01", "2026-04-30"], ["2026-05-01", "2026-07-31"], ["2026-08-01", "2026-10-30"]]) {
  const rows = await rep(s, e);
  console.log(`${s}..${e}: ${rows.length} rows`);
  all.push(...rows);
  await new Promise(r => setTimeout(r, 2500));
}
console.log("columns:", Object.keys(all[0] ?? {}).filter(k => !k.startsWith("sorted_")).join(" | "));
const byMonth = new Map<string, Map<string, number>>();
for (const b of all) {
  const d = new Date(b["Booking Date"]); if (isNaN(d.getTime())) continue;
  const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const res = String(b["Booking Result"] ?? "(blank)");
  if (!byMonth.has(m)) byMonth.set(m, new Map());
  byMonth.get(m)!.set(res, (byMonth.get(m)!.get(res) || 0) + 1);
}
const results = [...new Set(all.map(b => String(b["Booking Result"] ?? "(blank)")))];
console.log("\nmonth   ", results.join(" | "));
for (const [m, c] of [...byMonth].sort()) console.log(m, results.map(r => c.get(r) || 0).join(" | "));
console.log("\nservice values:", [...new Set(all.map(b => b["Service"]))].slice(0, 15).join(" | "));
// future-dated 'Booking' rows and past unmarked 'Booking' rows
const today = new Date("2026-10-30");
console.log("past rows still 'Booking' (unmarked):", all.filter(b => b["Booking Result"] === "Booking" && new Date(b["Booking Date"]) < today).length);
// lifetime attended per roster member
const roster = (await getKpiRoster())!;
const counts = new Map<string, number>(); const first = new Map<string, string>();
for (const b of all) {
  if (!VALID.includes(b["Booking Result"])) continue;
  const id = String(b["Member ID"]); counts.set(id, (counts.get(id) || 0) + 1);
  const d = new Date(b["Booking Date"]).toISOString().slice(0, 10); if (!first.has(id) || d < first.get(id)!) first.set(id, d);
}
console.log("\nroster members by attended count (all data):");
for (const m of roster.members.map(m => ({ ...m, n: counts.get(m.memberId) || 0 })).sort((a, b) => b.n - a.n)) console.log(String(m.n).padStart(4), m.name, "| first", first.get(m.memberId) || "-");
