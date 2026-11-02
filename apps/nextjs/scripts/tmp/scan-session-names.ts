// Read-only: training session names by program, grouped by what the name suggests
import { sql } from "@acme/db";
import { db } from "@acme/db/client";
const BIZ = "d33b41e2-f700-4a08-9489-cb6e3daa7f20";
const r = await db.execute(sql`select id, name, coalesce(program,'unassigned') as program, created_at::date as created from training_session where business_id = ${BIZ} order by created_at desc`);
const rows = (r.rows ?? r) as any[];
const guess = (n: string) => {
  const s = n.toLowerCase();
  if (/upper/.test(s)) return "strength_upper";
  if (/lower/.test(s)) return "strength_lower";
  if (/full/.test(s)) return "strength_full";
  if (/metcon.*adv|adv.*metcon/.test(s)) return "metcon_advanced";
  if (/metcon|hyrox|conditioning|circuit/.test(s)) return "metcon";
  if (/strength/.test(s)) return "strength (no upper/lower/full)";
  return "-";
};
const byGuess = new Map<string, any[]>();
for (const x of rows) { const g = guess(String(x.name)); if (!byGuess.has(g)) byGuess.set(g, []); byGuess.get(g)!.push(x); }
for (const [g, list] of [...byGuess].sort((a, b) => (a[0] === "-" ? 1 : b[0] === "-" ? -1 : a[0].localeCompare(b[0])))) {
  console.log(`\n=== ${g}: ${list.length} sessions`);
  const byProg = new Map<string, number>(); for (const x of list) byProg.set(x.program, (byProg.get(x.program) || 0) + 1);
  console.log("   by current program:", [...byProg].map(([p, n]) => `${p} ${n}`).join(", "));
  if (g !== "-") for (const x of list.slice(0, 40)) console.log(`   ${x.created}  ${String(x.program).padEnd(11)} ${x.name}`);
  else { const names = new Map<string, number>(); for (const x of list) { const k = String(x.name).replace(/\s*\(Copy\)/gi, "").trim(); names.set(k, (names.get(k) || 0) + 1); } console.log("   names:", [...names].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => `${k} ×${n}`).join(" | ")); }
}
process.exit(0);
