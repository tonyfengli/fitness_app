// Read-only. Builds one JSON row per candidate from the OLD GymMaster for the migration board.
import { readFileSync, writeFileSync, mkdirSync } from "fs";
const OUT = "scripts/tmp/output/board-rows";
mkdirSync(OUT, { recursive: true });
const base = process.env.GYMMASTER_BASE_URL!, rkey = process.env.GYMMASTER_REPORT_API_KEY!, skey = process.env.GYMMASTER_STAFF_API_KEY!;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function rep(id: number, s: string, e: string): Promise<Record<string, any>[]> {
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`${base}/api/v2/report/standard_report`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": rkey }, body: JSON.stringify({ report_id: id, start_date: s, end_date: e }) });
    if (r.status === 429) { await sleep(4000 * 2 ** a); continue; }
    const j = await r.json(); if (j.error) throw new Error(`report ${id}: ${JSON.stringify(j.error)}`); await sleep(2500); return j.result || [];
  }
  throw new Error(`report ${id} rate limited`);
}
async function v3(path: string): Promise<any> {
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`${base}/api/v3${path}`, { headers: { Accept: "application/json", "X-GM-API-KEY": skey } });
    if (r.status === 429) { await sleep(3000 * 2 ** a); continue; }
    if (!r.ok) return null;
    await sleep(250); return r.json();
  }
  return null;
}
const money = (v: any) => parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0;
const $ = (n: number) => `$${n.toFixed(2)}`;
const iso = (s: string) => { const d = new Date(s); return isNaN(+d) ? s : d.toISOString().slice(0, 10); };
const short = (s?: string | null) => { if (!s) return ""; const d = new Date(s.length === 10 ? s + "T12:00:00" : s); return isNaN(+d) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

// Candidate list from earlier CSV
const csv = readFileSync("scripts/tmp/output/active-candidates.csv", "utf8").trim().split("\n");
const head = csv[0]!.split(",");
const parse = (line: string) => { const out: string[] = []; let cur = "", q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
const cands = csv.slice(1).map(l => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));

const today = new Date().toISOString().slice(0, 10);
const types = new Map<number, string>(((await v3("/membershiptype/")) || []).map((t: any) => [t.id, t.name]));
const owe = await rep(13, "2026-10-01", today);
const prov = await rep(127, "2026-10-01", today);
const bill = await rep(130, "2026-09-01", "2026-12-31");
const pays = await rep(103, "2026-08-01", today);

const byId = <T extends Record<string, any>>(rows: T[], k = "Member ID") => { const m = new Map<string, T[]>(); for (const r of rows) { const id = String(r[k] ?? ""); if (!m.has(id)) m.set(id, []); m.get(id)!.push(r); } return m; };
const oweM = byId(owe), provM = byId(prov), billM = byId(bill), payM = byId(pays);

for (const c of cands) {
  const id = c.member_id!;
  const ms: any[] = (await v3(`/member/${id}/membership`)) || [];
  const holds: any[] = (await v3(`/member/${id}/hold`)) || [];
  const active = ms.filter(m => !m.history);
  const tName = (m: any) => m.membershiptypename || types.get(m.membershiptypeid) || `Type ${m.membershiptypeid}`;

  const p = payM.get(id) || [];
  const gymPt = p.filter(r => /Gym Memberships|Personal Training/.test(String(r["Payment Details"])));
  const charges = gymPt.filter(r => money(r["Payment Amount"]) !== 0).map(r => ({ date: iso(String(r["Payment Date"])), amt: money(r["Payment Amount"]) })).sort((a, b) => a.date.localeCompare(b.date));
  const byMonth = (mm: string) => charges.filter(x => x.date.slice(5, 7) === mm);
  const fmtCh = (xs: { date: string; amt: number }[]) => xs.map(x => `${short(x.date)} ${x.amt < 0 ? "−" : ""}${$(Math.abs(x.amt))}`).join(", ");
  const otherPaid = p.filter(r => !/Gym Memberships|Personal Training/.test(String(r["Payment Details"]))).reduce((s, r) => s + money(r["Payment Amount"]), 0);

  const b = (billM.get(id) || []).map(r => ({ date: iso(String(r["Billing Date"])), failed: String(r["Failed"]) === "true" || String(r["Billing Status"]).toUpperCase() !== "SUCCESS", status: String(r["Billing Status"]), reason: String(r["Fail Reason"] || ""), amt: money(r["Amount"]) }));
  const failed = b.filter(x => x.failed);
  const o = (oweM.get(id) || [])[0];
  const pv = (provM.get(id) || [])[0];
  const activeHold = holds.find((h: any) => { const s = h.startdate || h.start_date, e = h.enddate || h.end_date; return s && s <= today && (!e || e >= today); });
  const upcomingHold = holds.find((h: any) => (h.startdate || h.start_date) > today);

  const nexts = active.map(m => m.nextpayment).filter(Boolean).sort();
  const row = {
    oldId: id,
    name: c.name,
    group: c.match === "strong" ? "Active" : "Review",
    groupWhy: c.match === "strong" ? "Current membership and paid Sep/Oct" : (c.flags === "A:current" ? "Current membership, no Sep/Oct payment" : "Paid Sep/Oct, no current membership"),
    status: "not_checked",
    plan: active.map(tName).join(" + ") || c.current_membership || "",
    planCount: active.length,
    price: active.map(m => m.pricedesc).filter(Boolean).join(" + "),
    feeCharged: pv ? String(pv["Membership Fee"] || "") : "",
    frequency: active.map(m => m.paymentfreq).filter(Boolean).join(" + "),
    startDate: active.map(m => m.startdate).filter(Boolean).sort()[0] || "",
    endDate: active.map(m => m.enddate).filter(Boolean).sort().join(", "),
    cancelled: active.some(m => m.cancelled) ? (active.find(m => m.cancelled)?.termination_date || "yes") : "",
    nextCharge: nexts[0] || "",
    lastCharge: charges.length ? charges[charges.length - 1]!.date : "",
    lastChargeAmt: charges.length ? $(charges[charges.length - 1]!.amt) : "",
    chargesAug: fmtCh(byMonth("08")),
    chargesSep: fmtCh(byMonth("09")),
    chargesOct: fmtCh(byMonth("10")),
    otherPaidAugOct: otherPaid ? $(otherPaid) : "",
    failedCount: failed.length,
    failedDetail: failed.map(x => `${short(x.date)} ${$(x.amt)}${x.reason ? " (" + x.reason + ")" : ""}`).join("; "),
    owed: o ? String(o["Owe End"] || "") : "$0.00",
    provider: pv ? String(pv["Member Billing Provider"] || "") : "",
    hold: activeHold ? `On hold ${short(activeHold.startdate || activeHold.start_date)}–${short(activeHold.enddate || activeHold.end_date)}` : (upcomingHold ? `Hold from ${short(upcomingHold.startdate || upcomingHold.start_date)}` : ""),
    inSepKpi: c.in_sep_kpi === "yes",
    newId: "", newPlan: "", newPrice: "", newNextCharge: "", fix: "",
    source: `Old GymMaster, pulled ${today}`,
  };
  writeFileSync(`${OUT}/${id}.json`, JSON.stringify(row, null, 1));
  console.log(`${id}\t${row.name}\t${row.plan} [${row.planCount}]\t${row.price}\tfee=${row.feeCharged}\tnext=${row.nextCharge}\towed=${row.owed}\tfailed=${row.failedCount}\t${row.provider}\t${row.hold}${row.cancelled ? "\tCANCELLED " + row.cancelled : ""}`);
}
// sample hold shape for verification
const anyHolds = await v3(`/member/${cands[0]!.member_id}/hold`);
console.log("\nhold sample keys:", JSON.stringify(anyHolds)?.slice(0, 200));
