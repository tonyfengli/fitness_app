// Creates the kpi_billing_link table (additive; matches KpiBillingLink in packages/db/src/schema.ts)
import { sql } from "@acme/db";
import { db } from "@acme/db/client";
await db.execute(sql`
  CREATE TABLE IF NOT EXISTS kpi_billing_link (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    member_id varchar(50) NOT NULL UNIQUE,
    member_name text NOT NULL,
    paid_by_member_id varchar(50) NOT NULL,
    paid_by_name text NOT NULL,
    start_month integer NOT NULL,
    start_year integer NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL
  )
`);
console.log("kpi_billing_link ready");
process.exit(0);
