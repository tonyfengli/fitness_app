// Move the re-tagged HYROX session(s) from MetCon to MetCon Advanced (plan file updated; --undo still restores the old program)
import { readFileSync } from "fs";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { TrainingSession } from "@acme/db/schema";
const plan = JSON.parse(readFileSync("scripts/tmp/output/retag-classes-backup-2026-11-02.json", "utf8")) as any[];
for (const p of plan.filter((x) => x.category === "metcon_advanced")) {
  const res = await db.update(TrainingSession).set({ program: "metcon_advanced" as any, updatedAt: new Date() })
    .where(and(eq(TrainingSession.id, p.id), eq(TrainingSession.program, "metcon" as any))).returning({ id: TrainingSession.id });
  console.log(p.name, "→ metcon_advanced:", res.length ? "done" : "not changed");
}
process.exit(0);
