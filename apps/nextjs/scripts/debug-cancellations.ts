/**
 * Debug cancellations data from API
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../.env.local") });

import { fetchKpiReports } from "../src/app/kpi/lib/gymmaster-api";

async function debugCancellations() {
  // Check September as an example
  const reports = await fetchKpiReports(2026, 9);

  console.log("=".repeat(80));
  console.log("RAW CANCELLATIONS DATA - September 2026");
  console.log("=".repeat(80));
  console.log(`\nTotal cancellation records: ${reports.current.cancellations.length}`);

  if (reports.current.cancellations.length === 0) {
    console.log("\n*** NO CANCELLATIONS RETURNED FROM API ***");
  } else {
    console.log("\nFirst record keys:", Object.keys(reports.current.cancellations[0] || {}));

    console.log("\nAll cancellation records:");
    for (const record of reports.current.cancellations) {
      console.log("-".repeat(40));
      console.log(JSON.stringify(record, null, 2));
    }
  }

  // Also check current members count
  console.log("\n" + "=".repeat(80));
  console.log("CURRENT MEMBERS - September 2026");
  console.log("=".repeat(80));
  console.log(`Total current members: ${reports.current.currentMembers.length}`);

  // Show a sample
  if (reports.current.currentMembers.length > 0) {
    console.log("\nFirst record keys:", Object.keys(reports.current.currentMembers[0] || {}));
    console.log("\nFirst 3 records:");
    for (const record of reports.current.currentMembers.slice(0, 3)) {
      console.log(JSON.stringify(record, null, 2));
    }
  }
}

debugCancellations().catch(console.error);
