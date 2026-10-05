/**
 * Trace new members by month using payment-based logic
 *
 * Logic: New member in Month X if:
 * 1. Net positive payment in Month X
 * 2. AND no payment in Month X-1
 * 3. AND no payment in Month X-2
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, "../.env.local") });

import { fetchKpiReportsAsCsv } from "../src/app/kpi/lib/gymmaster-api";
import { calculateNewMembers, parsePayments } from "../src/app/kpi/lib/calculate-new-members";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

async function traceNewMembersByMonth() {
  const year = 2026;

  console.log("=".repeat(80));
  console.log("NEW MEMBERS BY MONTH (Payment-Based Logic)");
  console.log("=".repeat(80));
  console.log("\nLogic: New member if paid in Month X, but NO payment in X-1 AND X-2\n");

  // We need to start from February since we need 2 prior months of data
  for (let month = 2; month <= 9; month++) {
    console.log("-".repeat(80));
    console.log(`${MONTHS[month - 1]} ${year}`);
    console.log("-".repeat(80));

    try {
      const reports = await fetchKpiReportsAsCsv(year, month);

      const result = calculateNewMembers(
        reports.current.allPaymentsCsv,
        reports.previous.allPaymentsCsv,
        reports.previous2.allPaymentsCsv
      );

      // New Group Members
      console.log(`\nNEW GROUP MEMBERS (${result.groupMemberCount}):`);
      if (result.newGroupMembers.length === 0) {
        console.log("  (none)");
      } else {
        for (const m of result.newGroupMembers) {
          const tag = m.isReactivation ? " [REACTIVATION]" : "";
          console.log(`  - ${m.name}: $${m.amount.toFixed(2)}${tag}`);
        }
        console.log(`  TOTAL: $${result.groupMemberRevenue.toFixed(2)}`);
      }

      // New PT Clients
      console.log(`\nNEW PT CLIENTS (${result.ptClientCount}):`);
      if (result.newPtClients.length === 0) {
        console.log("  (none)");
      } else {
        for (const m of result.newPtClients) {
          const tag = m.isReactivation ? " [REACTIVATION]" : "";
          console.log(`  - ${m.name}: $${m.amount.toFixed(2)}${tag}`);
        }
        console.log(`  TOTAL: $${result.ptClientRevenue.toFixed(2)}`);
      }

      console.log("");
    } catch (error) {
      console.error(`  Error fetching data: ${error}`);
    }
  }

  console.log("=".repeat(80));
  console.log("END OF REPORT");
  console.log("=".repeat(80));
}

traceNewMembersByMonth().catch(console.error);
