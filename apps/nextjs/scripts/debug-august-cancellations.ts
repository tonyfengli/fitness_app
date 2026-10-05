/**
 * Debug August cancellations by reason
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../.env.local") });

import { fetchKpiReports } from "../src/app/kpi/lib/gymmaster-api";

async function check() {
  const reports = await fetchKpiReports(2026, 8);

  console.log("AUGUST 2026 CANCELLATIONS:");
  console.log("Total records:", reports.current.cancellations.length);

  // Group by Cancel Reason
  const byReason: Record<string, any[]> = {};
  for (const c of reports.current.cancellations) {
    const reason = String(c["Cancel Reason"] || "Unknown");
    if (!byReason[reason]) byReason[reason] = [];
    byReason[reason].push(c);
  }

  for (const [reason, records] of Object.entries(byReason)) {
    console.log(`\n${reason} (${records.length}):`);
    for (const r of records) {
      console.log(`  - ${r["Member Name"]}: ${r["Membership Type Name"]}`);
    }
  }

  // Check if any are NOT in current members
  const currentMemberIds = new Set(reports.current.currentMembers.map(m => String(m["Member ID"])));

  console.log("\n\nMembers in cancellations but NOT in current members:");
  let notInCurrent = 0;
  for (const c of reports.current.cancellations) {
    const memberId = String(c["Member ID"]);
    if (!currentMemberIds.has(memberId)) {
      console.log(`  - ${c["Member Name"]} (${c["Cancel Reason"]})`);
      notInCurrent++;
    }
  }
  if (notInCurrent === 0) {
    console.log("  (all cancelled members are still in current members list)");
  }
}

check().catch(console.error);
