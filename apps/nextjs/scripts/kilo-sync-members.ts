/**
 * Sync fitness_app's current members into Kilo (Gym Lead Machine). Logic and rules in
 * ~/lib/kilo-members.ts (also run nightly by /api/cron/kilo-retention when
 * KILO_MEMBER_SYNC_ENABLED=true). Dry run by default; --apply writes.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/kilo-sync-members.ts [--apply]
 */

import { syncKiloMembers } from "~/lib/kilo-members";

const APPLY = process.argv.includes("--apply");

async function main() {
  const r = await syncKiloMembers({ apply: APPLY });
  const by = (kind: string) => r.actions.filter((a) => a.kind === kind).map((a) => `${a.name} (#${a.memberId})`);
  const n = (src: string) => r.members.filter((m) => m.source === src).length;
  console.log(`Current members: ${r.members.length} (${n("roster")} on the roster, ${n("new")} new since the last finalized month${n("test") ? `, ${n("test")} test` : ""})`);
  console.log(`Already in sync: ${r.inSync}`);
  console.log(`Create in Kilo: ${by("create").length}\n  ${by("create").join("\n  ")}`);
  console.log(`Add tag: ${by("tag").length}\n  ${by("tag").join("\n  ")}`);
  console.log(`Set member number: ${by("setId").length}`);
  console.log(`Remove tag (no longer current): ${by("untag").length}\n  ${by("untag").join("\n  ")}`);
  console.log(`Skipped, no phone in GymMaster: ${r.noPhone.length}\n  ${r.noPhone.join("\n  ")}`);
  console.log(`Tagged by hand, not a current member (left alone): ${r.taggedByHand.length}`);
  if (!APPLY && r.actions.length) console.log("\nDry run: nothing written. Re-run with --apply.");
  else if (APPLY) console.log(`\nApplied ${r.actions.length} changes.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
