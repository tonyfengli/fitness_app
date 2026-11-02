// Re-tag the planned sessions into the class categories. Only training_session.program changes.
// Backup (id + old program) is the plan file itself: scripts/tmp/output/retag-classes-backup-2026-11-02.json
// Undo: run with "--undo" to restore each session's old program.
import { readFileSync } from "fs";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { TrainingSession } from "@acme/db/schema";
const BIZ = "d33b41e2-f700-4a08-9489-cb6e3daa7f20";
const plan = JSON.parse(readFileSync("scripts/tmp/output/retag-classes-backup-2026-11-02.json", "utf8")) as { id: string; name: string; category: string; oldProgram: string }[];
const undo = process.argv.includes("--undo");
let changed = 0;
for (const p of plan) {
  const program = (undo ? p.oldProgram : p.category) as any;
  const res = await db.update(TrainingSession).set({ program, updatedAt: new Date() }).where(and(eq(TrainingSession.id, p.id), eq(TrainingSession.businessId, BIZ))).returning({ id: TrainingSession.id });
  changed += res.length;
}
console.log(`${undo ? "restored" : "re-tagged"} ${changed} of ${plan.length} sessions`);
process.exit(0);
