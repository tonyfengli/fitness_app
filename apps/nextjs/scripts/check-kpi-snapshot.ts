import { db } from "@acme/db/client";
import { KpiMonthlySnapshot, KpiMemberOverride } from "@acme/db/schema";
import { desc, eq, or } from "@acme/db";

async function main() {
  // Get latest finalized snapshot
  const snapshots = await db
    .select()
    .from(KpiMonthlySnapshot)
    .where(eq(KpiMonthlySnapshot.status, "finalized"))
    .orderBy(desc(KpiMonthlySnapshot.year), desc(KpiMonthlySnapshot.month))
    .limit(1);
  
  if (snapshots.length === 0) {
    console.log("No finalized snapshot");
    process.exit(0);
  }
  
  const snapshot = snapshots[0];
  console.log("=== KPI SNAPSHOT ===");
  console.log("Month/Year:", snapshot.month + "/" + snapshot.year);
  
  interface PayingMember { memberId: string; name: string; revenue: number; }
  const data = snapshot.data as { payingMembers?: PayingMember[] };
  const payingMembers = data?.payingMembers || [];
  console.log("Paying members count:", payingMembers.length);
  console.log("\nAll paying members:");
  payingMembers.forEach((m: PayingMember) => {
    console.log("  - " + m.name + " (ID: " + m.memberId + ", $" + m.revenue + "/mo)");
  });
  
  // Get overrides
  const overrides = await db
    .select()
    .from(KpiMemberOverride)
    .where(
      or(
        eq(KpiMemberOverride.overrideType, "exclude_from_at_risk"),
        eq(KpiMemberOverride.overrideType, "exclude_from_new")
      )
    );
  
  console.log("\n=== OVERRIDES (" + overrides.length + ") ===");
  overrides.forEach(o => {
    console.log("  - " + o.memberId + ": " + o.overrideType + " (" + o.reason + ")");
  });
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
