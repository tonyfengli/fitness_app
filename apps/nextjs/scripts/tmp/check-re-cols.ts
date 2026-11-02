// Read-only: new retention_event columns present?
import { sql } from "@acme/db";
import { db } from "@acme/db/client";
const r = await db.execute(sql`select column_name, data_type from information_schema.columns where table_name='retention_event' and column_name in ('outcome','context','milestone','follow_up_on') order by column_name`);
console.log((r.rows ?? r).map((x: any) => `${x.column_name}:${x.data_type}`).join(", "));
const c = await db.execute(sql`select count(*)::int as n from retention_event`);
console.log("existing rows:", (c.rows ?? c)[0]?.n);
process.exit(0);
