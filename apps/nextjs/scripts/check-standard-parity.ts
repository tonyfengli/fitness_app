/**
 * Parity after the move to the new account's format: for every finalized month, recompute
 * the Overview's revenue split (PT / Open Gym / Classes / total), paying members and class
 * members from the archive with the plan map, and compare with the saved snapshot. Also
 * checks the paying-member list is the same people (snapshot IDs mapped through the match
 * table until the snapshots themselves are converted). Exits 1 on any mismatch.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/check-standard-parity.ts
 */

import { asc, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { GymMasterMemberMatch, KpiMonthlySnapshot } from "@acme/db/schema";

import { paymentKind } from "~/app/kpi/lib/plan-categories";
import { fetchGymMasterReport, gymMasterAmount } from "~/lib/gymmaster-report";

const cents = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const matches = await db.select().from(GymMasterMemberMatch);
  const toNew = new Map(matches.map((m) => [m.oldMemberId, m.newMemberId]));
  const snapshots = await db
    .select()
    .from(KpiMonthlySnapshot)
    .where(eq(KpiMonthlySnapshot.status, "finalized"))
    .orderBy(asc(KpiMonthlySnapshot.year), asc(KpiMonthlySnapshot.month));

  let failures = 0;
  for (const s of snapshots) {
    const mm = String(s.month).padStart(2, "0");
    const last = new Date(s.year, s.month, 0).getDate();
    const payments = await fetchGymMasterReport(103, `${s.year}-${mm}-01`, `${s.year}-${mm}-${last}`);

    let pt = 0, openGym = 0, classes = 0, total = 0;
    const perMember = new Map<string, { total: number; classes: number }>();
    const unmapped: string[] = [];
    for (const row of payments) {
      const amount = gymMasterAmount(row["Payment Amount"]);
      const id = typeof row["Member ID"] === "number" || typeof row["Member ID"] === "string" ? String(row["Member ID"]) : "";
      total += amount;
      const m = perMember.get(id) ?? { total: 0, classes: 0 };
      m.total += amount;
      const kind = paymentKind(row);
      if (kind.kind === "membership") {
        if (kind.bucket === "pt") pt += amount;
        else if (kind.bucket === "open_gym") openGym += amount;
        else if (kind.bucket === "group") {
          classes += amount;
          m.classes += amount;
        }
      } else if (kind.kind === "unmapped") unmapped.push(`${kind.category} / ${kind.plan}`);
      perMember.set(id, m);
    }
    const paying = new Set([...perMember].filter(([id, m]) => id && m.total > 0).map(([id]) => id));
    const classMembers = [...perMember].filter(([id, m]) => id && m.classes > 0).length;

    const d = s.data;
    const expectedPaying = new Set(d.payingMembers.map((m) => toNew.get(m.memberId) ?? m.memberId));
    const checks: [string, unknown, unknown][] = [
      ["PT", cents(pt), cents(d.ptRevenue)],
      ["Open Gym", cents(openGym), cents(d.openGymRevenue)],
      ["Classes", cents(classes), cents(d.smallGroupRevenue)],
      ["Total", cents(total), cents(d.totalRevenue)],
      ["Paying members", paying.size, d.totalMembers],
      ["Class members", classMembers, typeof d.classMembers === "number" ? d.classMembers : classMembers],
      ["Same paying people", [...paying].sort().join(","), [...expectedPaying].sort().join(",")],
    ];
    const bad = checks.filter(([, a, b]) => a !== b);
    if (unmapped.length) bad.push(["Unmapped payments", unmapped.join("; "), "none"]);
    failures += bad.length;
    console.log(`${s.year}-${mm}: ${bad.length ? "MISMATCH" : "ok"}  PT ${cents(pt)} | Open Gym ${cents(openGym)} | Classes ${cents(classes)} | total ${cents(total)} | paying ${paying.size} | class members ${classMembers}`);
    for (const [label, got, want] of bad) console.log(`    ${label}: got ${String(got)} | snapshot ${String(want)}`);
  }
  console.log(failures ? `\n${failures} mismatches` : "\nAll finalized months match.");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
