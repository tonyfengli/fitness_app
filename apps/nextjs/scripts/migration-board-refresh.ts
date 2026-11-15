/**
 * Refresh the BALANCES on the Anaheim Migration Board (claude.ai artifact, collection "clients").
 * Tony, Nov 14 2026: "refresh" means the balance only. Every other column (next charge, plans,
 * ledger, status, what to fix, the "after switch" amounts) is his to track and is never written.
 * Read-only on both GymMaster accounts; writes one JSON file per client whose balance changed,
 * holding only newOwed / oldOwed, applied with the ArtifactData tool pinned to each row's version.
 * The status analysis below is printed as counts for information only; it is not written.
 *
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/migration-board-refresh.ts <board-dir> <out-dir>
 *
 * <board-dir> holds the board's current rows (ArtifactData "list" with out_dir: <board-dir>/clients/<id>.json)
 * and versions.json ({ id: version }, from that listing).
 * Prints counts only, never names.
 *
 * Per client:
 *   - new account: plan, bucket (plan map), price, first/next charge, balance (report 13);
 *   - old account: live plans and the next charge still scheduled there (autopay on), balance;
 *   - ledger Aug → this month, each charge tagged with its account (old/new);
 *   - status, from what was actually charged (Nov 14: the old account still shows a "next
 *     payment" on memberships that were never closed even when autopay is off, so a scheduled
 *     date is not evidence; a charge is):
 *       billed_ok   completed plan in the new account and charged there this month
 *       clear       completed plan in the new account, first charge still ahead
 *       fix_needed  charged in the old account this month after moving, sign-up not completed
 *                   in the new account, no plan there at all, or a balance owed
 *     The reason goes in "fix"; "Later:" notes are for closing the old account (an old
 *     membership never closed) and don't change the status.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { classifyPlan } from "~/app/kpi/lib/plan-categories";
import { fetchOldAccountReport, getMatches, newAccountApi, readGymMasterRows } from "~/lib/gymmaster-sources";
import { getMemberMemberships, type Membership } from "~/lib/gymmaster-member";

const [boardDir, outDir] = process.argv.slice(2);
if (!boardDir || !outDir) {
  console.error("Usage: migration-board-refresh.ts <board-dir> <out-dir>");
  process.exit(1);
}

// <board-dir>/clients/<id>.json holds a row's fields; <board-dir>/versions.json maps id → version (from the listing)
type Doc = { id: string; version: number; data: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const versions = JSON.parse(readFileSync(join(boardDir, "versions.json"), "utf8")) as Record<string, number>;
const rows: Doc[] = readdirSync(join(boardDir, "clients"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => {
    const id = f.replace(/\.json$/, "");
    return { id, version: versions[id] ?? 0, data: JSON.parse(readFileSync(join(boardDir, "clients", f), "utf8")) as Doc["data"] };
  });

const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const money = (n: number) => `$${n.toFixed(2)}`;
const num = (v: unknown) => parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BUCKET_LABEL = { group: "Group", open_gym: "Open Gym", pt: "PT", other: "Not a member" } as const;

/** The old account's memberships for an old member number (staff API) */
async function oldMemberships(oldId: string): Promise<Membership[]> {
  const base = process.env.GYMMASTER_BASE_URL?.replace(/\/+$/, "");
  const key = process.env.GYMMASTER_STAFF_API_KEY;
  if (!base || !key) throw new Error("Missing old GymMaster staff API configuration");
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${base}/api/v3/member/${oldId}/membership`, { headers: { Accept: "application/json", "X-GM-API-KEY": key } });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Old GymMaster API ${res.status}`);
    const data = (await res.json()) as Membership[] | { result?: Membership[] };
    return Array.isArray(data) ? data : (data.result ?? []);
  }
  throw new Error("Old GymMaster API: rate limited");
}

const open = (ms: Membership[]) => ms.filter((m) => !m.history && !(m.cancelled as boolean | undefined));
const live = (ms: Membership[]) => open(ms).filter((m) => m.completed !== false);

// Shared lookups
const [matches, types, payments, owing, oldOwing] = await Promise.all([
  getMatches(),
  newAccountApi<Record<string, unknown>[]>("/api/v3/membershiptype/").catch(() => [] as Record<string, unknown>[]),
  readGymMasterRows(103, "2026-08-01", today), // both accounts; old rows already on new numbers
  readGymMasterRows(13, "2026-11-01", today),
  fetchOldAccountReport(13, "2026-11-01", today), // old account on old numbers
]);
const categoryKey = Object.keys(types[0] ?? {}).find((k) => /categ/i.test(k));
const typeById = new Map(types.map((t) => [Number(t.id), { name: String(t.name ?? ""), category: categoryKey ? String(t[categoryKey] ?? "") : "" }]));

const byMember = <T extends Record<string, unknown>>(list: T[]) => {
  const m = new Map<string, T[]>();
  for (const r of list) {
    const id = String(r["Member ID"] ?? "");
    m.set(id, [...(m.get(id) ?? []), r]);
  }
  return m;
};
const paymentsById = byMember(payments);
const owingById = byMember(owing);
const oldOwingById = byMember(oldOwing);

mkdirSync(outDir, { recursive: true });
const tally: Record<string, number> = {};
let doubleRisk = 0;

for (const row of rows) {
  const c = row.data;
  if (c.group === "Inactive") continue;
  const oldId = String(c.oldId ?? row.id);
  const newId = matches.oldToNew.get(oldId) ?? (c.newId ? String(c.newId) : null);

  // New account
  const newAll = newId ? await getMemberMemberships(newId) : [];
  const newLive = live(newAll);
  const newIncomplete = open(newAll).filter((m) => m.completed === false);
  const plans = newLive.map((m) => {
    const t = typeById.get(Number(m.membershiptypeid));
    const name = m.membershiptypename || t?.name || `Type ${m.membershiptypeid}`;
    const cls = classifyPlan(name, t?.category);
    return { name, bucket: cls ? BUCKET_LABEL[cls.bucket] : null };
  });
  const newNext = newLive.map((m) => m.nextpayment).filter((s): s is string => !!s).sort()[0] ?? "";
  const newOwedRow = (newId ? owingById.get(newId) ?? [] : []).find((r) => r._account === "new");
  const newOwed = newOwedRow ? num(newOwedRow["Owe End"]) : 0;

  // Old account
  const oldLive = live(await oldMemberships(oldId).catch(() => []));
  const oldNext = oldLive.map((m) => m.nextpayment).filter((s): s is string => !!s && s >= today).sort()[0] ?? "";
  const oldOwedRow = (oldOwingById.get(oldId) ?? [])[0];
  const oldOwed = oldOwedRow ? num(oldOwedRow["Owe End"]) : 0;

  // Ledger: Aug → now, charges by month with the account they came from
  const ledger: Record<string, { day: number; amt: number; src: "old" | "new" }[]> = {};
  for (const p of newId ? paymentsById.get(newId) ?? [] : []) {
    const when = new Date(String(p._paidOn ?? p["Payment Date"] ?? ""));
    const amt = num(p["Payment Amount"]);
    if (isNaN(when.getTime()) || !amt) continue;
    const m = MONTHS[when.getMonth()]!;
    (ledger[m] ??= []).push({ day: when.getDate(), amt, src: p._account === "new" ? "new" : "old" });
  }
  for (const list of Object.values(ledger)) list.sort((a, b) => a.day - b.day);
  const thisMonth = MONTHS[new Date(`${today}T12:00:00`).getMonth()]!;
  const paidNewThisMonth = (ledger[thisMonth] ?? []).some((e) => e.src === "new" && e.amt > 0);
  const paidOldThisMonth = (ledger[thisMonth] ?? []).some((e) => e.src === "old" && e.amt > 0);
  // An old-account charge only matters once the new plan has started (a charge on Nov 2 for a plan moved on Nov 5 is normal)
  const newStart = newLive.map((m) => m.startdate).filter((x): x is string => !!x).sort()[0] ?? "";
  const monthPrefix = today.slice(0, 7);
  const paidOldAfterMove = (ledger[thisMonth] ?? []).some((e) => e.src === "old" && e.amt > 0 && (!newStart || `${monthPrefix}-${String(e.day).padStart(2, "0")}` >= newStart));

  // Status: from what was charged, not what's scheduled
  const fixes: string[] = [];
  let status: string;
  if (newLive.length) {
    if (paidOldAfterMove && paidNewThisMonth) fixes.push(`Charged in both accounts in ${thisMonth} after the new plan started (${newStart}): check for a double charge and refund one`);
    else if (paidOldAfterMove) fixes.push(`Charged in the old account in ${thisMonth} after the new plan started (${newStart}): turn off the old autopay`);
    status = fixes.length ? "fix_needed" : paidNewThisMonth ? "billed_ok" : "clear";
  } else if (newIncomplete.length) {
    status = "fix_needed";
    fixes.push(`Sign-up started in the new GymMaster but not completed${paidOldThisMonth ? `; still paying in the old account in ${thisMonth}` : ""}`);
  } else {
    status = "fix_needed";
    fixes.push(`No plan in the new GymMaster yet${paidOldThisMonth ? `; still paying in the old account in ${thisMonth}` : oldLive.length ? "; old membership open but nothing charged this month" : ""}`);
  }
  if (plans.some((p) => !p.bucket)) fixes.push("New plan not in the plan map");
  if (newOwed > 0) fixes.push(`Owes ${money(newOwed)} in the new account`);
  if (oldOwed > 0) fixes.push(`Owes ${money(oldOwed)} in the old account`);
  if ((newOwed > 0 || plans.some((p) => !p.bucket)) && status !== "fix_needed") status = "fix_needed";
  if (newLive.length && oldNext && !paidOldAfterMove) fixes.push(`Later: the old membership is still open (shows a next charge ${oldNext}; nothing charged this month). Close it before the old account closes`);
  if (paidOldAfterMove && paidNewThisMonth) doubleRisk++;

  tally[status] = (tally[status] ?? 0) + 1;
  // Only the balances are written, and only when they changed
  const update: Record<string, string> = {};
  if (money(newOwed) !== c.newOwed && newId) update.newOwed = money(newOwed);
  if (money(oldOwed) !== c.oldOwed) update.oldOwed = money(oldOwed);
  void fixes; // the status analysis is information only (counts below), never written to the board
  if (!Object.keys(update).length) continue;
  writeFileSync(join(outDir, `${row.id}.json`), JSON.stringify({ id: row.id, version: row.version, update }, null, 2));
}

console.log(`Refreshed ${Object.values(tally).reduce((a, b) => a + b, 0)} current clients as of ${today}:`, JSON.stringify(tally));
console.log(`Charged in both accounts this month: ${doubleRisk}`);
console.log(`Membership type category field: ${categoryKey ?? "not found (buckets may show Unmapped)"}`);
process.exit(0);
