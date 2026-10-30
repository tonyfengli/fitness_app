// Read-only: list KPI snapshots and their status
import { db } from "@acme/db/client";
import { KpiMonthlySnapshot } from "@acme/db/schema";
import { asc } from "@acme/db";
const s = await db.select().from(KpiMonthlySnapshot).orderBy(asc(KpiMonthlySnapshot.year), asc(KpiMonthlySnapshot.month));
for (const r of s) {
  const d = r.data as any;
  console.log(r.year, r.month, r.status, "finalized:", r.finalizedAt ? new Date(r.finalizedAt).toISOString().slice(0, 10) : "-", "updated:", r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : "-", "| total", d.totalMembers, "paying", d.payingMembers?.length, "new", d.newMembers?.length, "lost", d.lostMembers?.length);
}
process.exit(0);
