/**
 * Refresh the Anaheim Migration Board (artifact 8RGvJbqnJH3CpZbaP8BUUW) from both GymMaster
 * accounts. Read-only against GymMaster; writes nothing to the board itself: it stages one
 * JSON file per changed row under BOARD_DIR/writes/ (fields to merge) and prints a summary.
 * The board rows (data only) are read from BOARD_DIR/clients/<oldId>.json, saved from the
 * artifact database first.
 *
 *   BOARD_DIR=<dir> npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/tmp/refresh-board.ts
 *
 * Per row: old account owing (report 13), old payments Aug–today (103), old billing outcomes
 * Nov (130: NOTSENT = autopay off, not real debt); new account (Anaheim, company 5) live
 * memberships (plan, price, next charge), owing (13), payments (103), billing failures (130);
 * bucket from the plan map (plan-categories.ts). Members without a new number are looked up
 * in gymmaster_member_match. Fields rebuilt: ledger (Aug–Nov, each charge tagged old/new),
 * ledgerAsOf, oldOwed, owed, oldAfterSwitch, oldOwedReal, newId, newPlan, newPrice,
 * newNextCharge, newOwed, bucket, failedCount, failedDetail, fix (generated lines only).
 * Everything else (status, card, old plan, hand-written fix text) is left alone.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { db } from "@acme/db/client";
import { GymMasterMemberMatch } from "@acme/db/schema";

import { classifyPlan } from "../../src/app/kpi/lib/plan-categories";

const BOARD_DIR = process.env.BOARD_DIR!;
if (!BOARD_DIR) throw new Error("BOARD_DIR is required");
const OUT = join(BOARD_DIR, "writes");
mkdirSync(OUT, { recursive: true });

const OLD = { base: process.env.GYMMASTER_BASE_URL!.replace(/\/+$/, ""), report: process.env.GYMMASTER_REPORT_API_KEY!, staff: process.env.GYMMASTER_STAFF_API_KEY! };
const NEW = { base: process.env.GYMMASTER_NEW_BASE_URL!.replace(/\/+$/, ""), staff: process.env.GYMMASTER_NEW_STAFF_API_KEY! };
const ANAHEIM = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const money = (v: unknown) => parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0;
const $ = (n: number) => `$${n.toFixed(2)}`;
const iso = (s: string) => { const d = new Date(s); return isNaN(+d) ? s : d.toISOString().slice(0, 10); };
const short = (s: string) => { const d = new Date(s.length === 10 ? s + "T12:00:00" : s); return isNaN(+d) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }); // YYYY-MM-DD
const tomorrow = new Date(Date.parse(today + "T12:00:00Z") + 864e5).toISOString().slice(0, 10); // end dates are inclusive; tomorrow makes sure of today

type Row = Record<string, any>;

async function report(acct: "old" | "new", id: number, start: string, end: string): Promise<Row[]> {
  const a = acct === "old" ? { base: OLD.base, key: OLD.report, extra: {} } : { base: NEW.base, key: NEW.staff, extra: { company_id: ANAHEIM } };
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(`${a.base}/api/v2/report/standard_report`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": a.key },
      body: JSON.stringify({ report_id: id, start_date: start, end_date: end, ...a.extra }),
    });
    if (r.status === 429) { await sleep(4000 * 2 ** attempt); continue; }
    const j = (await r.json()) as { result?: Row[]; error?: unknown };
    if (j.error) throw new Error(`${acct} report ${id}: ${JSON.stringify(j.error)}`);
    await sleep(2500);
    return j.result ?? [];
  }
  throw new Error(`${acct} report ${id}: rate limited`);
}

async function v3New<T>(path: string): Promise<T | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(`${NEW.base}/api/v3${path}`, { headers: { Accept: "application/json", "X-GM-API-KEY": NEW.staff } });
    if (r.status === 429) { await sleep(3000 * 2 ** attempt); continue; }
    await sleep(300);
    if (!r.ok) return null;
    return (await r.json()) as T;
  }
  return null;
}

const byMember = (rows: Row[]) => { const m = new Map<string, Row[]>(); for (const r of rows) { const id = String(r["Member ID"] ?? ""); if (!m.has(id)) m.set(id, []); m.get(id)!.push(r); } return m; };

/** A report pulled one calendar month at a time: a multi-month pull of 103/130 came back short */
async function monthly(acct: "old" | "new", id: number, firstMonth: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let m = firstMonth; m <= today.slice(0, 7); ) {
    const [y, mo] = m.split("-").map(Number) as [number, number];
    const start = `${m}-01`;
    const endOfMonth = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
    const end = endOfMonth < tomorrow ? endOfMonth : tomorrow;
    out.push(...(await report(acct, id, start, end)));
    m = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
  }
  return out;
}

// --- Board rows ---------------------------------------------------------------
const clients: { id: string; data: Row }[] = readdirSync(join(BOARD_DIR, "clients")).filter((f) => f.endsWith(".json")).map((f) => ({ id: f.replace(/\.json$/, ""), data: JSON.parse(readFileSync(join(BOARD_DIR, "clients", f), "utf8")) }));
console.log(`${clients.length} board rows`);

// --- Old ↔ new numbers: the board first, then the saved match -----------------
const matches = await db.select().from(GymMasterMemberMatch);
const oldToNew = new Map(matches.map((m) => [m.oldMemberId, m.newMemberId]));
const newIdFor = (c: { id: string; data: Row }) => String(c.data.newId || oldToNew.get(c.id) || "");

// --- Pulls ---------------------------------------------------------------------
console.log("pulling old account…");
const oldOwing = byMember(await report("old", 13, "2026-10-01", tomorrow));
const oldPays = byMember(await monthly("old", 103, "2026-08"));
const oldBill = byMember(await monthly("old", 130, "2026-09"));
console.log("pulling new account…");
const typesRaw = (await v3New<Row[] | { result: Row[] }>("/membershiptype/")) ?? [];
const types = new Map<string, { name: string; category: string }>((Array.isArray(typesRaw) ? typesRaw : typesRaw.result).map((t) => [String(t.id), { name: String(t.name ?? ""), category: String(t.Category ?? t.category ?? "") }]));
const newOwing = byMember(await report("new", 13, "2026-10-01", tomorrow));
const newPays = byMember([...(await report("new", 103, "2026-10-31", "2026-10-31")), ...(await monthly("new", 103, "2026-11"))]);
const newBill = byMember(await monthly("new", 130, "2026-11"));
console.log(`old account: ${oldPays.size} members with payments, ${oldBill.size} with billing rows, ${oldOwing.size} owing`);
console.log(`new account: ${types.size} plans, ${newPays.size} members with payments, ${newBill.size} with billing rows, ${newOwing.size} owing`);

const MEMBERSHIP_OLD = /Gym Memberships|Personal Training/;
const MEMBERSHIP_NEW = /^Membership Category:/;
const MONTHS: Record<string, string> = { "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec" };
const BUCKET_LABEL: Record<string, string> = { group: "Group", open_gym: "Open Gym", pt: "PT" };
const GENERATED_FIX = new Set(["In the new GymMaster, no membership plan yet", "Not found in the new GymMaster yet"]);

const summary: string[] = [];
let staged = 0;

for (const c of clients) {
  const d = c.data;
  const newId = newIdFor(c);
  const next: Row = {};

  // Ledger: old-account membership charges Aug → today, new-account membership charges (Nov on)
  const ledger: Record<string, { day: number; amt: number; src: "old" | "new" }[]> = { Aug: [], Sep: [], Oct: [], Nov: [] };
  for (const r of oldPays.get(c.id) ?? []) {
    if (!MEMBERSHIP_OLD.test(String(r["Payment Details"]))) continue;
    const amt = money(r["Payment Amount"]); if (!amt) continue;
    const date = iso(String(r["Payment Date"])); const m = MONTHS[date.slice(5, 7)]; if (!m) continue;
    (ledger[m] ??= []).push({ day: Number(date.slice(8, 10)), amt, src: "old" });
  }
  if (newId && d.group === "Active") for (const r of newPays.get(newId) ?? []) {
    if (!MEMBERSHIP_NEW.test(String(r["Payment Details"]))) continue;
    const amt = money(r["Payment Amount"]); if (!amt) continue;
    const date = iso(String(r["Payment Date"])); const m = MONTHS[date.slice(5, 7)]; if (!m) continue;
    (ledger[m] ??= []).push({ day: Number(date.slice(8, 10)), amt, src: "new" });
  }
  for (const m of Object.keys(ledger)) ledger[m]!.sort((a, b) => a.day - b.day);
  next.ledger = ledger;
  next.ledgerAsOf = today;

  // Old balance; charges the old account tried after autopay was turned off are not real debt
  const oldOwed = $(money(oldOwing.get(c.id)?.[0]?.["Owe End"]));
  const notSent = (oldBill.get(c.id) ?? []).filter((r) => String(r["Billing Status"]).toUpperCase() === "NOTSENT" && iso(String(r["Billing Date"])) >= "2026-11-01").reduce((s, r) => s + money(r["Amount"]), 0);
  next.oldOwed = oldOwed;
  next.owed = oldOwed;
  if (notSent > 0) { next.oldAfterSwitch = $(notSent); next.oldOwedReal = $(Math.max(money(oldOwed) - notSent, 0)); }
  else { next.oldAfterSwitch = ""; next.oldOwedReal = oldOwed; }

  // New account: live plan, price, next charge, balance, bucket (current members only; the
  // Inactive rows are not migrating and keep their new-side fields as they are)
  if (newId && d.group === "Active") {
    next.newId = newId;
    const ms = (await v3New<Row[]>(`/member/${newId}/membership`)) ?? [];
    const live = ms.filter((m) => String(m.history) !== "True" && String(m.history) !== "true");
    const named = live.map((m) => ({ ...m, _t: types.get(String(m.membershiptypeid)) }));
    next.newPlan = named.map((m) => m._t?.name || m.membershiptypename || `Type ${m.membershiptypeid}`).join(" + ");
    next.newPrice = named.map((m) => String(m.pricedesc ?? "")).filter(Boolean).join(" + ");
    next.newNextCharge = named.map((m) => String(m.nextpayment ?? "")).filter((s) => s && s !== "None").sort()[0] ?? "";
    next.newOwed = $(money(newOwing.get(newId)?.[0]?.["Owe End"]));
    if (named.length) {
      const labels = named.map((m) => { const cls = classifyPlan(m._t?.name ?? "", m._t?.category); return !cls ? `Unmapped: ${m._t?.category || "?"}` : cls.member ? BUCKET_LABEL[cls.bucket] ?? cls.bucket : "Not a member"; });
      next.bucket = [...new Set(labels)].join(" + ");
    } else next.bucket = "";
  }

  // Failed charges since the switch (Nov 1 on), both accounts, added to what the board already
  // recorded for earlier months: the old account's billing report no longer returns some of the
  // September failures it showed on Oct 29, so earlier entries are kept, not recomputed.
  // NOTSENT (autopay off) is not a failure.
  const fails = [
    ...(oldBill.get(c.id) ?? []).map((r) => ({ ...r, _src: "old" })),
    ...(newId && d.group === "Active" ? (newBill.get(newId) ?? []).map((r) => ({ ...r, _src: "new" })) : []),
  ].filter((r) => { const s = String(r["Billing Status"]).toUpperCase(); return iso(String(r["Billing Date"])) >= "2026-11-01" && s !== "NOTSENT" && (/REFUSED|FAILED|DECLINED/.test(s) || String(r["Failed"]).toLowerCase() === "true"); }).map((r) => ({ date: iso(String(r["Billing Date"])), amt: money(r["Amount"]), reason: String(r["Fail Reason"] || ""), src: r._src })).sort((a, b) => a.date.localeCompare(b.date));
  const earlier = String(d.failedDetail ?? "").split("; ").filter((s) => s && !/\((old|new)[,)]/.test(s)); // pre-switch entries, as recorded before
  const sinceSwitch = fails.map((f) => `${short(f.date)} ${$(f.amt)} (${f.src}${f.reason ? ", " + f.reason : ""})`);
  next.failedCount = earlier.length + sinceSwitch.length;
  next.failedDetail = [...earlier, ...sinceSwitch].join("; ");

  // Generated "what to fix" lines only; hand-written text stays
  if (d.group === "Active") {
    const gen = !newId ? "Not found in the new GymMaster yet" : !next.newPlan ? "In the new GymMaster, no membership plan yet" : "";
    if (gen) next.fix = gen; else if (GENERATED_FIX.has(String(d.fix ?? ""))) next.fix = "";
  }

  // Only what changed (compared with sorted keys, so key order never counts as a change)
  const canon = (v: unknown): string => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
  const changed: Row = {};
  for (const [k, v] of Object.entries(next)) if (canon(v) !== canon(d[k] ?? (typeof v === "string" ? "" : undefined))) changed[k] = v;
  if (Object.keys(changed).length === 1 && "ledgerAsOf" in changed) continue; // nothing real changed
  if (Object.keys(changed).length) {
    staged++;
    writeFileSync(join(OUT, `${c.id}.json`), JSON.stringify(changed, null, 1));
    const bits = Object.keys(changed).filter((k) => k !== "ledgerAsOf");
    summary.push(`${c.id} ${d.name} [${d.group}]: ${bits.join(", ")}${changed.newPlan !== undefined ? ` · plan → ${changed.newPlan || "(none)"}` : ""}${changed.newOwed !== undefined ? ` · new owes ${changed.newOwed}` : ""}${changed.oldOwed !== undefined ? ` · old owes ${changed.oldOwed}` : ""}`);
  }
}

writeFileSync(join(BOARD_DIR, "refresh-summary.txt"), summary.join("\n") + "\n");
console.log(`\n${staged} rows changed; staged under ${OUT}\n`);
console.log(summary.join("\n"));
