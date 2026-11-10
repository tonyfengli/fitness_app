/**
 * Print a task's timeline from the terminal.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/tmp/trace-task.ts <uuid | source:sourceRef>
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/tmp/trace-task.ts --open   (every open task)
 */

import { and, eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamTask } from "@acme/db/schema";

import { getGymBusinessId } from "../../src/lib/business";
import { formatTrace, resolveTaskId, traceTask } from "../../src/lib/team/trace";

const [arg] = process.argv.slice(2);
if (!arg) throw new Error("usage: trace-task.ts <uuid | source:sourceRef> | --open");

const ids: string[] = [];
if (arg === "--open") {
  const businessId = await getGymBusinessId();
  const rows = await db.select({ id: TeamTask.id }).from(TeamTask).where(and(eq(TeamTask.businessId, businessId), inArray(TeamTask.status, ["open", "in_progress", "blocked"])));
  ids.push(...rows.map((r) => r.id));
} else {
  const id = await resolveTaskId(arg);
  if (!id) throw new Error(`no task for ${arg}`);
  ids.push(id);
}
for (const id of ids) {
  const tr = await traceTask(id);
  if (tr) console.log(formatTrace(tr), "\n");
}
process.exit(0);
