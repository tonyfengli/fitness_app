// Read-only: current program of each planned session vs its old/new value
import { readFileSync } from "fs";
import { inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { TrainingSession } from "@acme/db/schema";
const plan = JSON.parse(readFileSync("scripts/tmp/output/retag-classes-backup-2026-11-02.json", "utf8")) as any[];
const rows = await db.select({ id: TrainingSession.id, program: TrainingSession.program }).from(TrainingSession).where(inArray(TrainingSession.id, plan.map(p => p.id)));
const now = new Map(rows.map(r => [r.id, r.program]));
console.log("still old:", plan.filter(p => now.get(p.id) === p.oldProgram).length, "| already new:", plan.filter(p => now.get(p.id) === p.category).length, "| found:", rows.length);
process.exit(0);
