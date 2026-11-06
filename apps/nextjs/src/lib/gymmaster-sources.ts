/**
 * Where GymMaster report rows come from across the Nov 2026 account move (used by
 * fetchGymMasterReport, the one entry point). Every row is in the new account's format
 * (see gymmaster-standard.ts). By date:
 *   - through Oct 31: the archive of the old account, converted once
 *   - November: the old account (live until it closes, then the archive) + the new account
 *   - December on: the new account only, passed through
 * New-account rows are kept to Anaheim (company 5). Old-account rows read live (November
 * only) are converted on the way in. Every row carries `_account`; rows with a
 * "Membership Start Date" also carry `_memberSince` (see getOldAccountStarts).
 */

import { and, eq, gte, lte, ne } from "@acme/db";
import { db } from "@acme/db/client";
import { GymMasterArchivePull, GymMasterArchiveRow, GymMasterMemberMatch } from "@acme/db/schema";

import { standardizeNewRow, standardizeOldRow } from "./gymmaster-standard";
import type { GymMasterRow } from "./gymmaster-report";

export const ARCHIVE_THROUGH = "2026-10-31";
export const SWITCH_MONTH = { start: "2026-11-01", end: "2026-11-30" };
const NEW_ACCOUNT_OPENED = "2026-10-01"; // Anaheim's first records in the new account
/** Set GYMMASTER_OLD_ACCOUNT_CLOSED=true once the old account is closed and November is archived */
const OLD_ACCOUNT_CLOSED = process.env.GYMMASTER_OLD_ACCOUNT_CLOSED === "true";

const HISTORY_START = "2025-01-01"; // the archive's whole-history pulls; ranges are read from monthly pulls
export const ANAHEIM = "5";

/** Reports whose rows are dated, so a range is a filter on the archive */
const DATED: Record<number, true> = { 9: true, 103: true, 130: true, 311: true, 327: true };
/** One row per member, as of the range: keep the most recent row for each member */
const PER_MEMBER: Record<number, true> = { 1: true, 13: true, 104: true };
const ARCHIVED = new Set([1, 9, 13, 103, 104, 116, 130, 311, 314, 327]);

export type Account = "old" | "new";

const maxDate = (a: string, b: string) => (a > b ? a : b);
const minDate = (a: string, b: string) => (a < b ? a : b);
/** A cell as text (report cells are strings, numbers or null) */
const cell = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

// ---------------------------------------------------------------------------
// Old account

/** A report straight from the old account, in the old account's format (archiving only) */
export async function fetchOldAccountReport(reportId: number, startDate: string, endDate: string): Promise<GymMasterRow[]> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing GymMaster configuration");

  const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": apiKey },
    body: JSON.stringify({ report_id: reportId, start_date: startDate, end_date: endDate }),
  });
  if (!response.ok) throw new Error(`GymMaster API error: ${response.status}`);
  const data = (await response.json()) as { result?: GymMasterRow[] };
  return data.result ?? [];
}

/** Old-account rows read live (November), brought to the standard on the way in */
async function readOldAccountLive(reportId: number, startDate: string, endDate: string): Promise<GymMasterRow[]> {
  const [rows, matches] = await Promise.all([fetchOldAccountReport(reportId, startDate, endDate), getMatches()]);
  // The member's plan this month, for the payment rows (how Open Gym is told from Classes)
  const plans = new Map<string, string>();
  if (reportId === 103) {
    for (const m of await fetchOldAccountReport(1, startDate, endDate)) {
      if (m["Member ID"] != null && typeof m["Membership Type Name"] === "string") plans.set(cell(m["Member ID"]), m["Membership Type Name"]);
    }
  }
  return rows.map((r) => standardizeOldRow(reportId, r, { newIdFor: (id) => matches.oldToNew.get(id), planFor: (id) => plans.get(id) }));
}

/** Old-account rows for a range, from the archive's monthly pulls (already converted) */
async function readArchive(reportId: number, startDate: string, endDate: string): Promise<GymMasterRow[]> {
  if (!ARCHIVED.has(reportId)) return readOldAccountLive(reportId, startDate, endDate);

  const pulls = await db
    .select()
    .from(GymMasterArchivePull)
    .where(
      and(
        eq(GymMasterArchivePull.account, "old"),
        eq(GymMasterArchivePull.reportId, reportId),
        ne(GymMasterArchivePull.startDate, HISTORY_START),
        lte(GymMasterArchivePull.startDate, endDate),
        gte(GymMasterArchivePull.endDate, startDate),
      ),
    );
  // A pull for exactly this range is GymMaster's own answer; use it when there is one
  const exact = pulls.filter((p) => p.startDate === startDate && p.endDate === endDate);
  const use = exact.length ? exact : pulls;
  if (!use.length) return [];

  const rows = await db
    .select({ pullStart: GymMasterArchivePull.startDate, rowDate: GymMasterArchiveRow.rowDate, data: GymMasterArchiveRow.data })
    .from(GymMasterArchiveRow)
    .innerJoin(GymMasterArchivePull, eq(GymMasterArchiveRow.pullId, GymMasterArchivePull.id))
    .where(
      and(
        eq(GymMasterArchiveRow.reportId, reportId),
        eq(GymMasterArchivePull.account, "old"),
        ne(GymMasterArchivePull.startDate, HISTORY_START),
        lte(GymMasterArchivePull.startDate, endDate),
        gte(GymMasterArchivePull.endDate, startDate),
      ),
    );
  const ids = new Set(use.map((p) => p.startDate));
  const inPulls = rows.filter((r) => ids.has(r.pullStart));

  if (DATED[reportId]) {
    return inPulls.filter((r) => !r.rowDate || (r.rowDate >= startDate && r.rowDate <= endDate)).map((r) => r.data);
  }
  if (PER_MEMBER[reportId]) {
    const latest = new Map<string, { start: string; data: GymMasterRow }>();
    for (const r of inPulls) {
      const key = cell(r.data["Member ID"]) || JSON.stringify(r.data);
      const seen = latest.get(key);
      if (!seen || r.pullStart > seen.start) latest.set(key, { start: r.pullStart, data: r.data });
    }
    return [...latest.values()].map((v) => v.data);
  }
  // Other range reports (new members, holds): the same row from two months counts once
  const unique = new Map<string, GymMasterRow>();
  for (const r of inPulls) unique.set(JSON.stringify(r.data), r.data);
  return [...unique.values()];
}

// ---------------------------------------------------------------------------
// New account (Anaheim)

const CACHE_MS = 10 * 60 * 1000;
let anaheimCache: { at: number; ids: Set<string> } | null = null;
let matchCache: { at: number; oldToNew: Map<string, string>; newToOld: Map<string, string> } | null = null;

export function newAccountConfig() {
  const baseUrl = process.env.GYMMASTER_NEW_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.GYMMASTER_NEW_STAFF_API_KEY;
  return baseUrl && apiKey ? { baseUrl, apiKey } : null;
}

/** A call to the new account's API (staff API v3 and reports), with retries on rate limits */
export async function newAccountApi<T>(path: string, init?: RequestInit): Promise<T> {
  const config = newAccountConfig();
  if (!config) throw new Error("Missing new GymMaster configuration");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": config.apiKey },
    });
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!response.ok) throw new Error(`New GymMaster API error: ${response.status}`);
    return (await response.json()) as T;
  }
  throw new Error("New GymMaster API: rate limited");
}

/** Member numbers of Anaheim's records in the new account (the account is shared with Costa Mesa) */
export async function getAnaheimMemberIds(): Promise<Set<string>> {
  if (anaheimCache && Date.now() - anaheimCache.at < CACHE_MS) return anaheimCache.ids;
  const ids = new Set<string>();
  for (let page = 1; page < 50; page++) {
    const raw = await newAccountApi<unknown>(`/api/v3/member?companyid=${ANAHEIM}&page=${page}`);
    const list = (Array.isArray(raw) ? raw : ((raw as { result?: unknown[] }).result ?? [])) as Record<string, unknown>[];
    const before = ids.size;
    for (const m of list) if (String(m.companyid) === ANAHEIM) ids.add(String(m.id));
    if (ids.size === before) break;
  }
  anaheimCache = { at: Date.now(), ids };
  return ids;
}

/** Old <-> new member numbers (gymmaster_member_match) */
export async function getMatches() {
  if (matchCache && Date.now() - matchCache.at < CACHE_MS) return matchCache;
  const matches = await db.select().from(GymMasterMemberMatch);
  matchCache = {
    at: Date.now(),
    oldToNew: new Map(matches.map((m) => [m.oldMemberId, m.newMemberId])),
    newToOld: new Map(matches.map((m) => [m.newMemberId, m.oldMemberId])),
  };
  return matchCache;
}

async function readNewAccount(reportId: number, startDate: string, endDate: string): Promise<GymMasterRow[]> {
  if (!newAccountConfig()) {
    console.warn("New GymMaster account not configured: November and later rows are old-account only");
    return [];
  }
  const [anaheim, data] = await Promise.all([
    getAnaheimMemberIds(),
    newAccountApi<{ result?: GymMasterRow[] }>("/api/v2/report/standard_report", {
      method: "POST",
      body: JSON.stringify({ report_id: reportId, start_date: startDate, end_date: endDate, company_id: Number(ANAHEIM) }),
    }),
  ]);
  return (data.result ?? []).filter((r) => anaheim.has(cell(r["Member ID"]))).map((r) => standardizeNewRow(reportId, r));
}

// ---------------------------------------------------------------------------
// The rule

export async function readGymMasterRows(reportId: number, startDate: string, endDate: string): Promise<GymMasterRow[]> {
  const parts: Promise<GymMasterRow[]>[] = [];

  if (startDate <= ARCHIVE_THROUGH) {
    parts.push(readArchive(reportId, startDate, minDate(endDate, ARCHIVE_THROUGH)));
  }
  if (endDate >= SWITCH_MONTH.start && startDate <= SWITCH_MONTH.end) {
    const s = maxDate(startDate, SWITCH_MONTH.start);
    const e = minDate(endDate, SWITCH_MONTH.end);
    parts.push(OLD_ACCOUNT_CLOSED ? readArchive(reportId, s, e) : readOldAccountLive(reportId, s, e));
  }
  if (endDate >= SWITCH_MONTH.start) {
    parts.push(readNewAccount(reportId, maxDate(startDate, SWITCH_MONTH.start), endDate));
  }
  // New-account membership payments before Nov 1 (the first charges; October is finalized
  // from the old account) count on Nov 1, decided with Tony 2026-11-05. Product sales
  // before then were staff testing the new account and are left out.
  if (reportId === 103 && startDate <= SWITCH_MONTH.start && endDate >= SWITCH_MONTH.start) {
    parts.push(
      readNewAccount(reportId, NEW_ACCOUNT_OPENED, ARCHIVE_THROUGH).then((rows) =>
        rows
          .filter((r) => cell(r["Payment Details"]).startsWith("Membership Category:"))
          .map((r) => ({ ...r, "Payment Date": "Nov 1 2026", _paidOn: r["Payment Date"] })),
      ),
    );
  }

  const rows = await withMemberSince((await Promise.all(parts)).flat());
  if (!PER_MEMBER[reportId]) return rows;

  // One row per member: the new account's row wins over the old account's
  const byMember = new Map<string, GymMasterRow>();
  for (const r of rows) {
    const key = cell(r["Member ID"]) || JSON.stringify(r);
    const seen = byMember.get(key);
    if (!seen || seen._account === "old") byMember.set(key, r);
  }
  return [...byMember.values()];
}

// ---------------------------------------------------------------------------
// Member since

let startsCache: { at: number; byMember: Map<string, string> } | null = null;

/**
 * Each member's first start date in the old account: the earliest "Membership Start Date"
 * in the archive, by member number (converted, so moved members are under their new
 * number). The new account has no join date: its start dates are when members were
 * re-entered (late Oct 2026). For anyone who was in the old account, the old account's
 * date wins (decided with Tony 2026-11-06).
 */
async function getOldAccountStarts(): Promise<Map<string, string>> {
  if (startsCache && Date.now() - startsCache.at < CACHE_MS) return startsCache.byMember;
  const rows = await db
    .select({ data: GymMasterArchiveRow.data })
    .from(GymMasterArchiveRow)
    .innerJoin(GymMasterArchivePull, eq(GymMasterArchiveRow.pullId, GymMasterArchivePull.id))
    .where(and(eq(GymMasterArchiveRow.reportId, 1), eq(GymMasterArchivePull.account, "old")));
  const byMember = new Map<string, string>();
  for (const { data } of rows) {
    const id = cell(data["Member ID"]);
    const start = cell(data["Membership Start Date"]);
    if (!id || isNaN(Date.parse(start))) continue;
    const seen = byMember.get(id);
    if (!seen || Date.parse(start) < Date.parse(seen)) byMember.set(id, start);
  }
  startsCache = { at: Date.now(), byMember };
  return byMember;
}

/**
 * `_memberSince`: the day the member first joined. "Membership Start Date" stays the start
 * of the plan on that row (billing and lost-member context need it).
 */
async function withMemberSince(rows: GymMasterRow[]): Promise<GymMasterRow[]> {
  if (!rows.some((r) => "Membership Start Date" in r)) return rows;
  const starts = await getOldAccountStarts();
  return rows.map((r) =>
    "Membership Start Date" in r
      ? { ...r, _memberSince: starts.get(cell(r["Member ID"])) ?? (cell(r["Membership Start Date"]) || null) }
      : r,
  );
}
