// Read-only: live definition of kpi_billing_link, to compare with what drizzle-kit push expects
import { sql } from "@acme/db";
import { db } from "@acme/db/client";
const cols = await db.execute(sql`select column_name, data_type, character_maximum_length, is_nullable, column_default from information_schema.columns where table_name = 'kpi_billing_link' order by ordinal_position`);
console.log(cols.rows ?? cols);
const cons = await db.execute(sql`select conname, contype from pg_constraint where conrelid = 'kpi_billing_link'::regclass`);
console.log(cons.rows ?? cons);
process.exit(0);
