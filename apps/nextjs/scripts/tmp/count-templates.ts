// Read-only: training sessions per program for the business the template picker uses, plus favorites
import { sql } from "@acme/db";
import { db } from "@acme/db/client";
const BIZ = "d33b41e2-f700-4a08-9489-cb6e3daa7f20";
const r = await db.execute(sql`select coalesce(program::text,'(none)') as program, count(*)::int as n, max(created_at)::date as newest,
  sum(case when template_config is not null then 1 else 0 end)::int as with_config from training_session where business_id = ${BIZ} group by 1 order by 2 desc`);
for (const x of (r.rows ?? r) as any[]) console.log(String(x.program).padEnd(12), String(x.n).padStart(4), "sessions | with template config", x.with_config, "| newest", x.newest);
const f = await db.execute(sql`select count(*)::int as n from favorite_sessions where business_id = ${BIZ}`);
console.log("favorites:", (f.rows ?? f)[0]?.n);
process.exit(0);
