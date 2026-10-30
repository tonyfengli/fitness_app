// Read-only: existing constraints on kpi_member_override and any duplicate (member, month, year, type) rows
import { sql } from "@acme/db";
import { db } from "@acme/db/client";
const cons = await db.execute(sql`select conname, contype, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'kpi_member_override'::regclass`);
console.log(cons.rows ?? cons);
const dups = await db.execute(sql`select member_id, month, year, override_type, count(*) from kpi_member_override group by 1,2,3,4 having count(*) > 1`);
console.log("duplicates:", (dups.rows ?? dups).length);
process.exit(0);
