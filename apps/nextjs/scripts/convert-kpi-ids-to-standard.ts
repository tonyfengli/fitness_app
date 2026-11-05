/**
 * Cutover, one-time: move the KPI data the dashboard saved under old-account member
 * numbers to the new account's numbers and "First Last" names: the member lists inside
 * every monthly snapshot (paying / new / lost / on hold), the founders' overrides, and the
 * billing links. Former members with no new number keep the old one. Run together with
 * the deploy that reads the new format; the routes join these tables by member number.
 *
 * Writes a JSON copy of the three tables to --out <dir> before changing anything.
 * Dry run by default; write with --apply.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/convert-kpi-ids-to-standard.ts --out /path/to/dir [--apply]
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { GymMasterMemberMatch, KpiBillingLink, KpiMemberOverride, KpiMonthlySnapshot } from "@acme/db/schema";

import { firstLast } from "~/lib/gymmaster-standard";

const APPLY = process.argv.includes("--apply");
const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? process.argv[outArg + 1] : undefined;

const LISTS = ["payingMembers", "newMembers", "lostMembers", "onHoldMembers"] as const;

async function main() {
  if (!OUT) throw new Error("--out <dir> is required (where the pre-conversion copy goes)");
  const matches = await db.select().from(GymMasterMemberMatch);
  const toNew = new Map(matches.map((m) => [m.oldMemberId, m.newMemberId]));
  const renumber = (id: string) => toNew.get(id) ?? id;

  const [snapshots, overrides, links] = await Promise.all([
    db.select().from(KpiMonthlySnapshot),
    db.select().from(KpiMemberOverride),
    db.select().from(KpiBillingLink),
  ]);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "kpi_monthly_snapshot.json"), JSON.stringify(snapshots));
  writeFileSync(join(OUT, "kpi_member_override.json"), JSON.stringify(overrides));
  writeFileSync(join(OUT, "kpi_billing_link.json"), JSON.stringify(links));
  console.log(`Copies written to ${OUT}`);

  let listRows = 0, renumbered = 0, keptOld = 0;
  const snapshotUpdates = snapshots.map((s) => {
    const data = { ...s.data };
    for (const key of LISTS) {
      const list = data[key] as { memberId: string; name: string }[] | undefined;
      if (!list) continue;
      data[key] = list.map((m) => {
        listRows++;
        if (toNew.has(m.memberId)) renumbered++;
        else keptOld++;
        return { ...m, memberId: renumber(m.memberId), name: firstLast(m.name) };
      }) as never;
    }
    return { id: s.id, data };
  });
  const overrideUpdates = overrides.filter((o) => toNew.has(o.memberId)).map((o) => ({ id: o.id, memberId: renumber(o.memberId) }));
  const linkUpdates = links.map((l) => ({
    id: l.id,
    memberId: renumber(l.memberId),
    memberName: firstLast(l.memberName),
    paidByMemberId: renumber(l.paidByMemberId),
    paidByName: firstLast(l.paidByName),
  }));

  console.log(`Snapshots: ${snapshots.length}; list entries ${listRows}: ${renumbered} renumbered, ${keptOld} keep the old number`);
  console.log(`Overrides: ${overrideUpdates.length} of ${overrides.length} renumbered (the rest are former members)`);
  console.log(`Billing links: ${linkUpdates.map((l) => `${l.memberId} paid by ${l.paidByMemberId}`).join("; ")}`);
  if (!APPLY) return console.log("Dry run: nothing written. Re-run with --apply.");

  await db.transaction(async (tx) => {
    // updatedAt is set by hand: its $onUpdateFn returns SQL, which the timestamp column can't map
    for (const u of snapshotUpdates) await tx.update(KpiMonthlySnapshot).set({ data: u.data, updatedAt: new Date() }).where(eq(KpiMonthlySnapshot.id, u.id));
    for (const u of overrideUpdates) await tx.update(KpiMemberOverride).set({ memberId: u.memberId }).where(eq(KpiMemberOverride.id, u.id));
    for (const u of linkUpdates)
      await tx
        .update(KpiBillingLink)
        .set({ memberId: u.memberId, memberName: u.memberName, paidByMemberId: u.paidByMemberId, paidByName: u.paidByName })
        .where(eq(KpiBillingLink.id, u.id));
  });
  console.log("Converted.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
