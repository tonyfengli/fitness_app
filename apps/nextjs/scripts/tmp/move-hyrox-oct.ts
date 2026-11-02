// Move October's "HYROX LITE" (Coach Kyle) into MetCon Advanced; record it in the re-tag backup so --undo restores it
import { readFileSync, writeFileSync } from "fs";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { TrainingSession } from "@acme/db/schema";
const BIZ = "d33b41e2-f700-4a08-9489-cb6e3daa7f20";
const FILE = "scripts/tmp/output/retag-classes-backup-2026-11-02.json";
const rows = await db.select({ id: TrainingSession.id, name: TrainingSession.name, program: TrainingSession.program, createdAt: TrainingSession.createdAt })
  .from(TrainingSession).where(and(eq(TrainingSession.businessId, BIZ), eq(TrainingSession.name, "HYROX LITE")));
if (rows.length !== 1) { console.log("expected exactly one 'HYROX LITE', found", rows.length); process.exit(1); }
const s = rows[0]!;
const plan = JSON.parse(readFileSync(FILE, "utf8")) as any[];
if (!plan.some((p) => p.id === s.id)) {
  plan.push({ category: "metcon_advanced", id: s.id, name: s.name, oldProgram: s.program, created: s.createdAt.toISOString().slice(0, 10) });
  writeFileSync(FILE, JSON.stringify(plan, null, 2));
}
const res = await db.update(TrainingSession).set({ program: "metcon_advanced" as any, updatedAt: new Date() }).where(eq(TrainingSession.id, s.id)).returning({ id: TrainingSession.id });
console.log(`HYROX LITE (was ${s.program}) → metcon_advanced:`, res.length ? "done" : "not changed");
process.exit(0);
