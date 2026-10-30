// Read-only: does quickbooks_connection exist, and how many rows
import { sql } from "@acme/db";
import { db } from "@acme/db/client";
const r = await db.execute(sql`select to_regclass('public.quickbooks_connection') as t`);
const t = (r.rows ?? r)[0]?.t;
console.log("quickbooks_connection exists:", !!t);
if (t) { const c = await db.execute(sql`select count(*)::int as n from quickbooks_connection`); console.log("rows:", (c.rows ?? c)[0]?.n); }
process.exit(0);
