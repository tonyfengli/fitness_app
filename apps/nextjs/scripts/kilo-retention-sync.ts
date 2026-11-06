/**
 * Keep the Kilo "Member Retention" board in step with the at-risk list. Logic and rules in
 * ~/lib/kilo-retention.ts. Dry run by default; --apply writes to Kilo and retention_event.
 *   KILO_RETENTION_TEST_MEMBERS=32595 npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/kilo-retention-sync.ts [--apply] [--force 32595:20]
 * --force ID:DAYS treats that member as on the roster, gone DAYS days; --force ID:real uses their real
 * GymMaster bookings (testing on a founder's own record).
 */

import { syncRetentionBoard } from "~/lib/kilo-retention";

const APPLY = process.argv.includes("--apply");
const force = new Map<string, number | "real">();
process.argv.forEach((a, i) => {
  if (a === "--force") {
    const [id, days] = (process.argv[i + 1] ?? "").split(":");
    if (id && days) force.set(id, days === "real" ? "real" : Number(days));
  }
});

async function main() {
  const r = await syncRetentionBoard({ apply: APPLY, force });
  console.log(r.testMembers ? `TEST MODE: only ${[...r.testMembers].join(", ")} can change` : "All members");
  if (force.size) console.log(`Forced: ${[...force].map(([id, d]) => `${id} ${d === "real" ? "with real bookings" : `as ${d}d gone`}`).join(", ")}`);
  for (const w of r.warnings) console.log(`! ${w}`);
  console.log(`\n${APPLY ? "Applied" : "Would apply"} ${r.actions.length}:`);
  for (const a of r.actions) console.log(`  ${a.kind.padEnd(9)} ${a.name} (#${a.memberId}): ${a.detail}`);
  console.log(`Unchanged ${r.unchanged.length}:`);
  for (const u of r.unchanged) console.log(`  ${u}`);
  console.log(`Skipped ${r.skipped.length}:`);
  for (const s of r.skipped) console.log(`  ${s}`);
  if (!APPLY && r.actions.length) console.log("\nDry run: nothing written. Re-run with --apply.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
