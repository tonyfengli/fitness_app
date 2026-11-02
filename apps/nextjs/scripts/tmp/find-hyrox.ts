// Read-only: anything that looks like HYROX / advanced / MetCon since Aug
import { sql } from "@acme/db";
import { db } from "@acme/db/client";
const r = await db.execute(sql`select name, coalesce(program,'unassigned') as program, (created_at at time zone 'America/Los_Angeles')::date as created, scheduled_at::date as scheduled
  from training_session where business_id = 'd33b41e2-f700-4a08-9489-cb6e3daa7f20' and created_at >= '2026-08-01'
  and (name ilike '%hyrox%' or name ilike '%advanc%' or name ilike '%metcon%' or name ilike '%met con%' or name ilike '%conditioning%') order by created_at`);
for (const x of (r.rows ?? r) as any[]) console.log(String(x.created).slice(0,10), "| scheduled", String(x.scheduled).slice(0,10), "|", String(x.program).padEnd(15), x.name);
process.exit(0);
