// Read-only: pulls old GymMaster reports + Sep snapshot, writes candidate active-member CSV.
import { writeFileSync } from "fs";
import { db } from "@acme/db/client";
import { KpiMonthlySnapshot } from "@acme/db/schema";
import { and, eq } from "@acme/db";

const OUT = process.argv[2]!;
const base = process.env.GYMMASTER_BASE_URL!, key = process.env.GYMMASTER_REPORT_API_KEY!;

async function report(id: number, start: string, end: string): Promise<Record<string, any>[]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`${base}/api/v2/report/standard_report`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": key },
      body: JSON.stringify({ report_id: id, start_date: start, end_date: end }),
    });
    if (r.status === 429) { await new Promise(res => setTimeout(res, 4000 * 2 ** attempt)); continue; }
    if (!r.ok) throw new Error(`report ${id}: ${r.status} ${await r.text()}`);
    const j = await r.json();
    if (j.error) throw new Error(`report ${id}: ${JSON.stringify(j.error)}`);
    return j.result || [];
  }
  throw new Error(`report ${id}: rate limited`);
}
const pause = () => new Promise(r => setTimeout(r, 3000));
const amt = (v: any) => parseFloat(String(v ?? "0").replace(/[^0-9.-]/g, "")) || 0;

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const current = await report(1, today, today); await pause();
  const onHold = await report(314, today, today); await pause();
  const paySep = await report(103, "2026-09-01", "2026-09-30"); await pause();
  const payOct = await report(103, "2026-10-01", today);

  console.log("current cols:", Object.keys(current[0] ?? {}).filter(k => !k.startsWith("sorted_")).join(" | "));
  console.log("onhold cols:", Object.keys(onHold[0] ?? {}).filter(k => !k.startsWith("sorted_")).join(" | "));
  console.log(`rows: current=${current.length} onHold=${onHold.length} paySep=${paySep.length} payOct=${payOct.length}`);

  type Row = { id: string; name: string; current: string[]; hold: boolean; holdDates: string; sepGymPt: number; octGymPt: number; octOther: number; inSepKpi: boolean; email: string; phone: string };
  const rows = new Map<string, Row>();
  const get = (id: string, name: string) => {
    if (!rows.has(id)) rows.set(id, { id, name, current: [], hold: false, holdDates: "", sepGymPt: 0, octGymPt: 0, octOther: 0, inSepKpi: false, email: "", phone: "" });
    const r = rows.get(id)!; if (!r.name && name) r.name = name; return r;
  };
  for (const c of current) {
    const r = get(String(c["Member ID"] ?? ""), c["Member Name"] ?? c["Name"] ?? "");
    r.current.push(String(c["Membership Type Name"] ?? c["Membership Type"] ?? "?"));
    r.email ||= c["Email"] ?? c["Member Email"] ?? ""; r.phone ||= c["Cell Phone"] ?? c["Mobile"] ?? c["Phone"] ?? "";
  }
  for (const h of onHold) {
    const r = get(String(h["Member ID"] ?? ""), h["Member Name"] ?? h["Name"] ?? "");
    r.hold = true; r.holdDates = `${h["Date Hold Starts"] ?? ""} → ${h["Date Hold Ends"] ?? ""}`;
  }
  const isGymPt = (d: string) => d.includes("Gym Memberships") || d.includes("Personal Training");
  for (const p of paySep) if (isGymPt(String(p["Payment Details"] ?? ""))) get(String(p["Member ID"] ?? ""), p["Name"] ?? "").sepGymPt += amt(p["Payment Amount"]);
  for (const p of payOct) {
    const r = get(String(p["Member ID"] ?? ""), p["Name"] ?? "");
    if (isGymPt(String(p["Payment Details"] ?? ""))) r.octGymPt += amt(p["Payment Amount"]); else r.octOther += amt(p["Payment Amount"]);
  }
  const sep = await db.select().from(KpiMonthlySnapshot).where(and(eq(KpiMonthlySnapshot.month, 9), eq(KpiMonthlySnapshot.year, 2026))).limit(1);
  for (const m of (sep[0]?.data as any)?.payingMembers ?? []) get(m.memberId, m.name).inSepKpi = true;

  rows.delete("");
  const list = [...rows.values()].map(r => {
    const flags = [r.current.length && "A:current", r.sepGymPt > 0 || r.octGymPt > 0 ? "B:paid" : "", r.hold && "C:hold"].filter(Boolean);
    const strength = flags.length >= 2 ? "strong" : flags.length === 1 ? "review" : "other-only";
    return { ...r, flags: flags.join("+"), strength };
  }).filter(r => r.strength !== "other-only" || r.inSepKpi)
    .sort((a, b) => (a.strength === b.strength ? a.name.localeCompare(b.name) : a.strength === "strong" ? -1 : 1));

  const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const header = ["member_id", "name", "match", "flags", "current_membership", "on_hold", "hold_dates", "sep_gym_pt_paid", "oct_gym_pt_paid", "oct_other_paid", "in_sep_kpi", "email", "phone", "decision", "notes"];
  const lines = [header.join(","), ...list.map(r => [r.id, r.name, r.strength, r.flags, r.current.join(" / "), r.hold ? "yes" : "", r.holdDates, r.sepGymPt.toFixed(2), r.octGymPt.toFixed(2), r.octOther.toFixed(2), r.inSepKpi ? "yes" : "", r.email, r.phone, "", ""].map(esc).join(","))];
  writeFileSync(OUT, lines.join("\n"));
  console.log(`\nwrote ${list.length} rows → ${OUT}`);
  for (const r of list) console.log(`${r.strength.padEnd(10)} ${r.flags.padEnd(22)} ${r.id}\t${r.name}\t${r.current.join(" / ")}\tsep=${r.sepGymPt.toFixed(0)} oct=${r.octGymPt.toFixed(0)}${r.octOther ? ` octOther=${r.octOther.toFixed(0)}` : ""}${r.inSepKpi ? "\tsepKPI" : ""}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
