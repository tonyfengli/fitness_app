// Read-only: is Lauro (324187) on the KPI roster, and what do his bookings look like?
import { getKpiRoster } from "~/lib/kpi-roster";
const roster = (await getKpiRoster())!;
console.log(`roster rolled to ${roster.year}-${roster.month}: ${roster.members.length} members; Lauro on it:`, roster.members.some(m => m.memberId === "324187"));
const base = process.env.GYMMASTER_BASE_URL!, key = process.env.GYMMASTER_REPORT_API_KEY!;
const r = await fetch(`${base}/api/v2/report/standard_report`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": key }, body: JSON.stringify({ report_id: 9, start_date: "2026-09-01", end_date: "2026-11-02" }) });
const rows = (((await r.json()).result || []) as Record<string, any>[]).filter(b => String(b["Member ID"]) === "324187");
console.log("Lauro bookings since Sep 1:", rows.length, rows.map(b => `${b["Booking Date"]} ${b["Booking Result"]} (${b["Service"]})`).join("; "));
process.exit(0);
