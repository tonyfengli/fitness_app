// Read-only: pick one session per "month" (same name ignoring "(Copy)", new group after a 45+ day gap) per new class category
import { sql } from "@acme/db";
import { db } from "@acme/db/client";
import { writeFileSync } from "fs";
const BIZ = "d33b41e2-f700-4a08-9489-cb6e3daa7f20";
const r = await db.execute(sql`select id, name, coalesce(program,'unassigned') as program, created_at from training_session where business_id = ${BIZ} order by created_at`);
const rows = (r.rows ?? r) as any[];
const category = (n: string): string | null => {
  const s = n.toLowerCase();
  if (/upper/.test(s) && /strength/.test(s)) return "strength_upper";
  if ((/lower/.test(s) || /legs/.test(s)) && /strength/.test(s)) return "strength_lower";
  if (/strength class - full body/.test(s)) return "strength_full";
  if (/^metcon( nov)?$/.test(s.trim()) || /^hyrox lite nov$/.test(s.trim())) return "metcon";
  return null;
};
const norm = (n: string) => n.replace(/\s*\(copy\)/gi, "").replace(/\s+/g, " ").trim().toLowerCase();
const groups = new Map<string, any[][]>();
for (const x of rows) {
  const cat = category(String(x.name)); if (!cat) continue;
  const key = `${cat}|${norm(String(x.name))}`;
  const runs = groups.get(key) ?? []; const last = runs[runs.length - 1];
  const prev = last?.[last.length - 1];
  if (!last || (new Date(x.created_at).getTime() - new Date(prev.created_at).getTime()) / 864e5 > 45) runs.push([x]); else last.push(x);
  groups.set(key, runs);
}
const picks: any[] = [];
for (const [key, runs] of groups) for (const run of runs) {
  const chosen = run[run.length - 1]; // most recent copy
  picks.push({ category: key.split("|")[0], id: chosen.id, name: chosen.name, oldProgram: chosen.program, created: new Date(chosen.created_at).toISOString().slice(0, 10), from: new Date(run[0].created_at).toISOString().slice(0, 10), count: run.length });
}
picks.sort((a, b) => a.category.localeCompare(b.category) || a.created.localeCompare(b.created));
let cat = "";
for (const p of picks) {
  if (p.category !== cat) { cat = p.category; console.log(`\n=== ${cat}`); }
  console.log(`  ${p.created}  ${p.oldProgram.padEnd(11)} ${p.name}   (latest of ${p.count}, since ${p.from})`);
}
writeFileSync(process.argv[2]!, JSON.stringify(picks, null, 2));
console.log(`\n${picks.length} sessions to re-tag`);
process.exit(0);
