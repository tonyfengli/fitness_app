// Read-only: what class data the bookings report holds (Aug 1 → today)
const base = process.env.GYMMASTER_BASE_URL!, key = process.env.GYMMASTER_REPORT_API_KEY!;
const r = await fetch(`${base}/api/v2/report/standard_report`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": key }, body: JSON.stringify({ report_id: 9, start_date: "2026-08-01", end_date: "2026-11-02" }) });
const rows = ((await r.json()).result || []) as Record<string, any>[];
const VALID = ["Booking", "Showed", "Showed late"];
console.log("rows", rows.length, "| sample:", JSON.stringify(Object.fromEntries(Object.entries(rows[0] ?? {}).filter(([k]) => !/Name$|Signature/.test(k)))));
const by = new Map<string, { att: number; ns: number; canc: number; sessions: Set<string>; members: Set<string> }>();
for (const b of rows) {
  const cls = `${b["Service"]} | ${b["Class Name"] ?? "-"}`;
  const e = by.get(cls) || { att: 0, ns: 0, canc: 0, sessions: new Set(), members: new Set() };
  const res = b["Booking Result"];
  if (VALID.includes(res)) { e.att++; e.members.add(String(b["Member ID"])); e.sessions.add(`${b["Booking Date"]} ${b["Booking Start Time"]}`); }
  else if (res === "No show") e.ns++; else e.canc++;
  by.set(cls, e);
}
console.log("\nservice | class                         attended  sessions  avg/session  unique members  no-shows  cancels");
for (const [k, e] of [...by].sort((a, b) => b[1].att - a[1].att)) console.log(k.padEnd(45), String(e.att).padStart(5), String(e.sessions.size).padStart(9), (e.att / Math.max(1, e.sessions.size)).toFixed(1).padStart(11), String(e.members.size).padStart(14), String(e.ns).padStart(9), String(e.canc).padStart(8));
const slots = new Map<string, number>();
for (const b of rows) if (VALID.includes(b["Booking Result"]) && b["Class Name"]) { const d = new Date(b["Booking Date"]); const k = `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]} ${b["Booking Start Time"]}`; slots.set(k, (slots.get(k) || 0) + 1); }
console.log("\ntop day/time slots:", [...slots].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}:${v}`).join("  "));
console.log("resources:", [...new Set(rows.map(b => b["Resource Name"]))].slice(0, 10).join(" | "));
