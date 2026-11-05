/**
 * One-time: bring every archived old-account row to the new account's format
 * (src/lib/gymmaster-standard.ts): new member numbers where the person moved over,
 * "First Last" names, and the member's plan name on each membership payment (from that
 * month's members report, which is how the Overview split Open Gym from Classes).
 *
 * Rows already converted (they carry _oldMemberId) are skipped, so it can be re-run after
 * a later archive pass. Dry run by default; write with --apply.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/convert-archive-to-standard.ts [--apply]
 */

import { eq, ne, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { GymMasterArchivePull, GymMasterArchiveRow, GymMasterMemberMatch } from "@acme/db/schema";

import { parseGymMasterDate } from "~/lib/gymmaster-report";
import { isStandardized, standardizeOldRow } from "~/lib/gymmaster-standard";
import type { ReportRow } from "~/lib/gymmaster-standard";

const APPLY = process.argv.includes("--apply");
const HISTORY_START = "2025-01-01";

const text = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
const monthStart = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

async function main() {
  const matches = await db.select().from(GymMasterMemberMatch);
  const newIdFor = new Map(matches.map((m) => [m.oldMemberId, m.newMemberId]));

  // Plan per member per month, from the monthly members-report pulls
  const memberRows = await db
    .select({ pullStart: GymMasterArchivePull.startDate, data: GymMasterArchiveRow.data })
    .from(GymMasterArchiveRow)
    .innerJoin(GymMasterArchivePull, eq(GymMasterArchiveRow.pullId, GymMasterArchivePull.id))
    .where(sql`${GymMasterArchiveRow.reportId} = 1 and ${GymMasterArchivePull.startDate} <> ${HISTORY_START}`);
  const planByMonth = new Map<string, string>();
  for (const r of memberRows) {
    const id = text(r.data._oldMemberId) || text(r.data["Member ID"]);
    const plan = r.data["Membership Type Name"];
    if (id && typeof plan === "string") planByMonth.set(`${r.pullStart}|${id}`, plan);
  }
  const planFor = (oldId: string, paymentDate: unknown) => {
    const d = parseGymMasterDate(paymentDate);
    return d ? planByMonth.get(`${monthStart(d)}|${oldId}`) : undefined;
  };

  const rows = await db.select({ id: GymMasterArchiveRow.id, reportId: GymMasterArchiveRow.reportId, data: GymMasterArchiveRow.data }).from(GymMasterArchiveRow);
  const updates: { id: string; member_id: string | null; data: ReportRow }[] = [];
  const counts = { already: 0, renumbered: 0, keptOld: 0, planFilled: 0, planMissing: 0 };
  for (const r of rows) {
    if (isStandardized(r.data)) {
      counts.already++;
      continue;
    }
    const data = standardizeOldRow(r.reportId, r.data, { newIdFor: (id) => newIdFor.get(id), planFor });
    const oldId = text(data._oldMemberId);
    if (oldId) counts[newIdFor.has(oldId) ? "renumbered" : "keptOld"]++;
    if (r.reportId === 103 && "Membership-Type Name" in data) counts[data["Membership-Type Name"] ? "planFilled" : "planMissing"]++;
    updates.push({ id: r.id, member_id: text(data["Member ID"]) || null, data });
  }
  console.log(`${rows.length} rows: ${counts.already} already converted, ${updates.length} to convert`);
  console.log(`  members: ${counts.renumbered} rows renumbered, ${counts.keptOld} keep the old number (former members)`);
  console.log(`  membership payments: plan filled on ${counts.planFilled}, no plan that month on ${counts.planMissing}`);

  if (!APPLY) return console.log("Dry run: nothing written. Re-run with --apply.");
  for (let i = 0; i < updates.length; i += 500) {
    const chunk = JSON.stringify(updates.slice(i, i + 500));
    await db.execute(sql`
      update gymmaster_archive_row as x
      set data = v.data, member_id = v.member_id
      from jsonb_to_recordset(${chunk}::jsonb) as v(id uuid, member_id text, data jsonb)
      where x.id = v.id`);
  }
  const check = await db.select({ n: sql<number>`count(*)` }).from(GymMasterArchiveRow).where(ne(sql`${GymMasterArchiveRow.data} ? '_oldMemberId'`, true));
  console.log(`Converted ${updates.length} rows; ${check[0]?.n ?? "?"} rows still unconverted`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
