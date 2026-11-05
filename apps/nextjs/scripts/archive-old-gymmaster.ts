/**
 * Archive the old GymMaster account into gymmaster_archive_* (Nov 2026 move to a new account).
 *
 * Reads only. For each report: one pull per calendar month (1st to last day; GymMaster's
 * end date is inclusive, so months never overlap) and one whole-history pull. Then the staff
 * API profile and membership of every member seen in any report. Re-running replaces a pull
 * with the same report and start date, so pass 2 (after the last old-account classes)
 * overwrites the partial month and the whole-history pull.
 *
 * Run from apps/nextjs:
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/archive-old-gymmaster.ts --pass 1 [--end 2026-11-08] [--skip-members]
 */

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { GymMasterArchiveMember, GymMasterArchivePull, GymMasterArchiveRow } from "@acme/db/schema";

import { gymMasterAmount, parseGymMasterDate } from "~/lib/gymmaster-report";
import { fetchOldAccountReport } from "~/lib/gymmaster-sources";

const ACCOUNT = "old";
const HISTORY_START = "2025-01-01"; // whole-history pulls start here; the account's first rows are Dec 2025
const FIRST_MONTH = "2025-12-01";

// Report -> the column that dates a row and the one that holds its amount (when it has them)
const REPORTS: Record<number, { name: string; date?: string; amount?: string }> = {
  1: { name: "members" },
  9: { name: "bookings", date: "Booking Date" },
  13: { name: "owing", amount: "Owe End" },
  103: { name: "payments", date: "Payment Date", amount: "Payment Amount" },
  104: { name: "birthdays" },
  116: { name: "new members", date: "Membership Start Date" },
  130: { name: "billing outcomes", date: "Billing Date", amount: "Amount" },
  311: { name: "failed billing", date: "Billing Date", amount: "Amount" },
  314: { name: "on hold", date: "Date Hold Starts" },
  327: { name: "cancellations", date: "Membership Cancellation Date" },
};

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const PASS = Number(arg("pass"));
const END = arg("end") ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const SKIP_MEMBERS = process.argv.includes("--skip-members");

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Calendar months from FIRST_MONTH to END, the last one cut at END */
function months(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const d = new Date(`${FIRST_MONTH}T00:00:00Z`);
  while (ymd(d) <= END) {
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    out.push([ymd(d), ymd(last) < END ? ymd(last) : END]);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

async function savePull(reportId: number, start: string, end: string, rows: Record<string, unknown>[]) {
  const spec = REPORTS[reportId]!;
  await db.transaction(async (tx) => {
    await tx
      .delete(GymMasterArchivePull)
      .where(
        and(
          eq(GymMasterArchivePull.account, ACCOUNT),
          eq(GymMasterArchivePull.reportId, reportId),
          eq(GymMasterArchivePull.startDate, start),
        ),
      );
    const [pull] = await tx
      .insert(GymMasterArchivePull)
      .values({ account: ACCOUNT, reportId, startDate: start, endDate: end, pass: PASS, rowCount: rows.length })
      .returning({ id: GymMasterArchivePull.id });
    for (let i = 0; i < rows.length; i += 500) {
      await tx.insert(GymMasterArchiveRow).values(
        rows.slice(i, i + 500).map((row) => {
          const date = spec.date ? parseGymMasterDate(row[spec.date]) : null;
          return {
            pullId: pull!.id,
            reportId,
            memberId: row["Member ID"] != null ? String(row["Member ID"]) : null,
            rowDate: date ? date.toLocaleDateString("en-CA") : null,
            amount: spec.amount ? gymMasterAmount(row[spec.amount]).toFixed(2) : null,
            data: row,
          };
        }),
      );
    }
  });
}

async function staffApi<T>(path: string): Promise<T | null> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_STAFF_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing GymMaster staff API configuration");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseUrl}/api/v3${path}`, { headers: { Accept: "application/json", "X-GM-API-KEY": apiKey } });
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!response.ok) return null;
    return (await response.json()) as T;
  }
  return null;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const dateOnly = (v: unknown) => {
  const d = parseGymMasterDate(v);
  return d ? d.toLocaleDateString("en-CA") : null;
};

async function main() {
  if (!PASS) throw new Error("--pass 1 or --pass 2 is required");
  console.log(`Archiving the old account through ${END} (pass ${PASS})`);
  const memberIds = new Set<string>();

  for (const reportId of Object.keys(REPORTS).map(Number)) {
    const counts: string[] = [];
    for (const [start, end] of [...months(), [HISTORY_START, END] as [string, string]]) {
      const rows = await fetchOldAccountReport(reportId, start, end);
      await savePull(reportId, start, end, rows);
      for (const row of rows) if (row["Member ID"] != null) memberIds.add(String(row["Member ID"]));
      counts.push(`${start === HISTORY_START ? "all" : start.slice(0, 7)} ${rows.length}`);
    }
    console.log(`${reportId} ${REPORTS[reportId]!.name}: ${counts.join(", ")}`);
  }

  if (SKIP_MEMBERS) return;
  console.log(`Profiles for ${memberIds.size} members`);
  let missing = 0;
  for (const memberId of memberIds) {
    const raw = await staffApi<Record<string, unknown> | Record<string, unknown>[]>(`/member/${memberId}`);
    const profile = Array.isArray(raw) ? raw[0] : raw;
    const membership = await staffApi<unknown>(`/member/${memberId}/membership`);
    if (!profile) missing++;
    const values = {
      account: ACCOUNT,
      memberId,
      name: profile ? [text(profile.firstname), text(profile.surname)].filter(Boolean).join(" ") || null : null,
      email: text(profile?.email),
      phone: text(profile?.phonecell) ?? text(profile?.phonehome) ?? text(profile?.phonework),
      birthday: dateOnly(profile?.dob),
      joinedOn: dateOnly(profile?.joindate),
      profile: profile ?? null,
      membership,
      pass: PASS,
      pulledAt: new Date(),
    };
    await db
      .insert(GymMasterArchiveMember)
      .values(values)
      .onConflictDoUpdate({ target: [GymMasterArchiveMember.account, GymMasterArchiveMember.memberId], set: values });
  }
  console.log(`Profiles saved; ${missing} not found in the staff API`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
