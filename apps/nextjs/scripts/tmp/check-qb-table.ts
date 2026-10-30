// Read-only: does pnl_monthly_snapshot exist, and how many rows
import { sql } from "@acme/db";
import { db } from "@acme/db/client";
const r = await db.execute(sql`select to_regclass('public.pnl_monthly_snapshot') as t`);
const t = (r.rows ?? r)[0]?.t;
console.log("pnl_monthly_snapshot exists:", !!t);
if (t) { const c = await db.execute(sql`select count(*)::int as n from pnl_monthly_snapshot`); console.log("rows:", (c.rows ?? c)[0]?.n); }
process.exit(0);
