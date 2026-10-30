// Read-only on GymMaster. Recompute Aug–Oct charge history per client: all payment categories,
// excluding refunded charges and their refund entries, same-day payments combined.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
const base = process.env.GYMMASTER_BASE_URL!, key = process.env.GYMMASTER_REPORT_API_KEY!;
const dir = "scripts/tmp/output/board-rows", upd = "scripts/tmp/output/charge-updates";
mkdirSync(upd, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const r = await fetch(`${base}/api/v2/report/standard_report`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": key }, body: JSON.stringify({ report_id: 103, start_date: "2026-08-01", end_date: today }) });
const pays: any[] = (await r.json()).result || [];
const money = (v: any) => parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0;
const iso = (s: string) => new Date(s).toISOString().slice(0, 10);
const short = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
let changed = 0;
for (const f of readdirSync(dir)) {
  const row = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  const mine = pays.filter(p => String(p["Member ID"]) === row.oldId)
    .filter(p => !/^Refunded$|Payment Refund/i.test(String(p["Payment Details"]).trim()))
    .filter(p => money(p["Payment Amount"]) !== 0);
  const byDay = new Map<string, number>();
  for (const p of mine) { const d = iso(String(p["Payment Date"])); byDay.set(d, (byDay.get(d) || 0) + money(p["Payment Amount"])); }
  const days = [...byDay.entries()].sort();
  const fmt = (mm: string) => days.filter(([d]) => d.slice(5, 7) === mm).map(([d, a]) => `${short(d)} ${a < 0 ? "−" : ""}$${Math.abs(a).toFixed(2)}`).join(", ");
  const next = { chargesAug: fmt("08"), chargesSep: fmt("09"), chargesOct: fmt("10") };
  const diffs = (Object.keys(next) as (keyof typeof next)[]).filter(k => (row[k] || "") !== next[k]);
  if (diffs.length) {
    changed++;
    console.log(`${row.name} (${row.oldId})`); for (const k of diffs) console.log(`   ${k.slice(7)}: "${row[k] || "—"}"  →  "${next[k] || "—"}"`);
    writeFileSync(`${upd}/${f}`, JSON.stringify(next));
    Object.assign(row, next); writeFileSync(`${dir}/${f}`, JSON.stringify(row, null, 1));
  }
}
console.log(`\n${changed} clients changed`);
