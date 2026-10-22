import { db } from "@acme/db/client";
import { KpiMonthlySnapshot } from "@acme/db/schema";

async function check() {
  const snapshots = await db
    .select({
      id: KpiMonthlySnapshot.id,
      month: KpiMonthlySnapshot.month,
      year: KpiMonthlySnapshot.year,
      status: KpiMonthlySnapshot.status,
      finalizedAt: KpiMonthlySnapshot.finalizedAt,
      updatedAt: KpiMonthlySnapshot.updatedAt,
    })
    .from(KpiMonthlySnapshot)
    .orderBy(KpiMonthlySnapshot.month);

  console.log("Snapshots in database:\n");
  for (const s of snapshots) {
    console.log(
      `  ${s.year}-${String(s.month).padStart(2, "0")}: ${s.status}${
        s.finalizedAt ? ` (finalized: ${s.finalizedAt})` : ""
      }`
    );
  }
  console.log(`\nTotal: ${snapshots.length} snapshots`);
  process.exit(0);
}

check().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
