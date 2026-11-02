// Remove the TEST-SAVECALLS rows created by the end-to-end check
import { sql } from "@acme/db";
import { db } from "@acme/db/client";
const r = await db.execute(sql`delete from retention_event where member_id = 'TEST-SAVECALLS'`);
console.log("deleted test rows:", r.rowCount);
const c = await db.execute(sql`select count(*)::int as n from retention_event`);
console.log("rows left:", (c.rows ?? c)[0]?.n);
process.exit(0);
