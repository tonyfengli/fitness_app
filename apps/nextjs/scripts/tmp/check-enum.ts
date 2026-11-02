// Read-only: values of the retention_event_type enum in the database
import { sql } from "@acme/db";
import { db } from "@acme/db/client";
const r = await db.execute(sql`select unnest(enum_range(null::retention_event_type))::text as v`);
console.log((r.rows ?? r).map((x: any) => x.v).join(", "));
process.exit(0);
