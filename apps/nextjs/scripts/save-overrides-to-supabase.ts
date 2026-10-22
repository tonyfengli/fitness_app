/**
 * One-time script to save localStorage overrides to Supabase
 * Run with: pnpm tsx apps/nextjs/scripts/save-overrides-to-supabase.ts
 */

import { db } from "@acme/db/client";
import { KpiMemberOverride } from "@acme/db/schema";
import { eq, and } from "@acme/db";

const overrides = {
  "2026-01": { excludeFromNew: [], excludeFromLost: ["322721"] },
  "2026-02": { excludeFromNew: ["322814", "323132", "323030"], excludeFromLost: [] },
  "2026-03": { excludeFromNew: [], excludeFromLost: ["322814", "323132", "323030", "323067"] },
  "2026-04": { excludeFromNew: ["323067"], excludeFromLost: ["322768"] },
  "2026-05": { excludeFromNew: ["322768", "322850"], excludeFromLost: [] },
  "2026-06": { excludeFromNew: [], excludeFromLost: [] },
  "2026-07": { excludeFromNew: ["322752"], excludeFromLost: ["322850"] },
  "2026-08": { excludeFromNew: [], excludeFromLost: ["322752"] },
  "2026-09": { excludeFromNew: ["324124", "322787"], excludeFromLost: [] },
};

async function saveOverrides() {
  console.log("Saving overrides to Supabase...\n");

  let totalInserted = 0;

  for (const [monthKey, data] of Object.entries(overrides)) {
    const [yearStr, monthStr] = monthKey.split("-");
    const year = parseInt(yearStr!, 10);
    const month = parseInt(monthStr!, 10);

    // Delete existing overrides for this month (to avoid duplicates)
    const deleted = await db
      .delete(KpiMemberOverride)
      .where(
        and(
          eq(KpiMemberOverride.month, month),
          eq(KpiMemberOverride.year, year)
        )
      )
      .returning();

    if (deleted.length > 0) {
      console.log(`  Cleared ${deleted.length} existing overrides for ${monthKey}`);
    }

    const records: Array<{
      month: number;
      year: number;
      memberId: string;
      overrideType: "exclude_from_new" | "exclude_from_lost";
      reason: string;
    }> = [];

    // Add exclude_from_new records
    for (const memberId of data.excludeFromNew) {
      records.push({
        month,
        year,
        memberId,
        overrideType: "exclude_from_new",
        reason: "Migrated from localStorage",
      });
    }

    // Add exclude_from_lost records
    for (const memberId of data.excludeFromLost) {
      records.push({
        month,
        year,
        memberId,
        overrideType: "exclude_from_lost",
        reason: "Migrated from localStorage",
      });
    }

    if (records.length > 0) {
      await db.insert(KpiMemberOverride).values(records);
      console.log(`  ${monthKey}: Inserted ${records.length} overrides`);
      totalInserted += records.length;
    } else {
      console.log(`  ${monthKey}: No overrides to insert`);
    }
  }

  console.log(`\nDone! Total overrides saved: ${totalInserted}`);

  // Verify by reading back
  console.log("\nVerifying saved data...");
  const allOverrides = await db.select().from(KpiMemberOverride);
  console.log(`Found ${allOverrides.length} overrides in database:\n`);

  // Group by month for display
  const byMonth = new Map<string, typeof allOverrides>();
  for (const o of allOverrides) {
    const key = `${o.year}-${String(o.month).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(o);
  }

  for (const [key, records] of [...byMonth.entries()].sort()) {
    const newCount = records.filter(r => r.overrideType === "exclude_from_new").length;
    const lostCount = records.filter(r => r.overrideType === "exclude_from_lost").length;
    console.log(`  ${key}: ${newCount} exclude_from_new, ${lostCount} exclude_from_lost`);
  }

  process.exit(0);
}

saveOverrides().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
