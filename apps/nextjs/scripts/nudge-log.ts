/**
 * The nudge decision log for one founder, for the monthly review (lib/team/nudge.ts).
 *
 *   npx tsx --env-file=.env.local scripts/nudge-log.ts <name> [days]      the log, newest first
 *   npx tsx --env-file=.env.local scripts/nudge-log.ts <name> --dry       what the rules would choose
 *                                                                        right now; writes nothing
 */

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamProfile, user } from "@acme/db/schema";

import { getGymBusinessId } from "../src/lib/business";
import { decide, nudgeLog } from "../src/lib/team/nudge";

const name = (process.argv[2] ?? "").toLowerCase();
if (!name) throw new Error("Usage: nudge-log.ts <name> [days | --dry]");
const businessId = await getGymBusinessId();
const people = await db.select({ id: user.id, name: user.name, aliases: TeamProfile.aliases }).from(TeamProfile).innerJoin(user, eq(user.id, TeamProfile.userId)).where(and(eq(TeamProfile.businessId, businessId), eq(TeamProfile.active, true)));
const hits = people.filter((r) => r.name.toLowerCase() === name || r.name.split(" ")[0]?.toLowerCase() === name || r.aliases.some((a) => a.toLowerCase() === name));
const who = hits[0];
if (hits.length !== 1 || !who) throw new Error(`"${name}" matches ${hits.length} founders`);

if (process.argv.includes("--dry")) {
  const plan = await decide(who.id, new Date(), true);
  console.log(`Right now the rules would: ${plan.decision.toUpperCase()} (${plan.rule}) — ${plan.detail}`);
  console.log(`Budget this week: ${plan.budget.used}/${plan.budget.limit}`);
  if (plan.task) console.log(`Task: "${plan.task.title}" due ${plan.task.dueOn} (${plan.task.angle})`);
  if (plan.undated) console.log(`Triage over ${plan.undated.length} undated task(s)`);
  process.exit(0);
}

const days = Number(process.argv[3]) || 35;
const log = await nudgeLog(who.id, days);
const sent = log.filter((r) => r.outcome);
const count = (v: string) => sent.filter((r) => r.outcome?.verdict === v).length;
console.log(`${who.name.split(" ")[0]}, last ${days} days: ${log.length} runs, ${sent.length} sent, ${log.length - sent.length} held`);
console.log(`Sent: ${count("acted")} acted · ${count("answered, nothing changed")} answered only · ${count("ignored")} ignored · ${count("waiting")} waiting\n`);
for (const r of log) {
  console.log(`${r.date}  ${r.decision.toUpperCase()}  ${r.rule}  (budget ${r.budget})  ${r.detail}`);
  if (r.message) console.log(`    said: ${r.message.replace(/\s+/g, " ")}`);
  if (r.outcome) console.log(`    then: ${r.outcome.verdict}${r.outcome.replied ? ` · answered after ${r.outcome.repliedAfterHours}h` : ""}${r.outcome.taskChanges.length ? ` · ${r.outcome.taskChanges.join(", ")}` : ""}${r.outcome.datesSet ? ` · ${r.outcome.datesSet} date(s) set` : ""}${r.outcome.doneByDue === null ? "" : r.outcome.doneByDue ? " · done by its date" : " · not done by its date"}`);
  for (const c of r.considered) console.log(`      - ${c.title}${c.due ? ` (${c.due})` : ""}: ${c.verdict}`);
}
process.exit(0);
