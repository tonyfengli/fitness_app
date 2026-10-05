/**
 * Trace Jennifer Nolan across all months
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../.env.local") });

import { fetchKpiReports } from "../src/app/kpi/lib/gymmaster-api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

async function traceJennifer() {
  console.log("=".repeat(80));
  console.log("TRACING: Jennifer Nolan");
  console.log("=".repeat(80));

  for (let month = 1; month <= 9; month++) {
    const reports = await fetchKpiReports(2026, month);

    // Check payments
    const payments = reports.current.allPayments.filter(p =>
      String(p["Name"] || "").toLowerCase().includes("nolan") ||
      String(p["Name"] || "").toLowerCase().includes("jennifer")
    );

    // Check current members
    const inCurrentMembers = reports.current.currentMembers.filter(m =>
      String(m["Member Name"] || "").toLowerCase().includes("nolan") ||
      String(m["Member Name"] || "").toLowerCase().includes("jennifer")
    );

    // Check cancellations
    const inCancellations = reports.current.cancellations.filter(c =>
      String(c["Member Name"] || "").toLowerCase().includes("nolan") ||
      String(c["Member Name"] || "").toLowerCase().includes("jennifer")
    );

    // Check members on hold
    const onHold = reports.current.membersOnHold.filter(h =>
      String(h["Member Name"] || "").toLowerCase().includes("nolan") ||
      String(h["Member Name"] || "").toLowerCase().includes("jennifer")
    );

    console.log(`\n${MONTHS[month - 1]} 2026:`);

    // Payments
    if (payments.length > 0) {
      for (const p of payments) {
        console.log(`  PAYMENT: $${p["Payment Amount"]} on ${p["Payment Date"]} - ${p["Payment Details"]}`);
      }
    } else {
      console.log(`  PAYMENT: (none)`);
    }

    // Current Members
    if (inCurrentMembers.length > 0) {
      for (const m of inCurrentMembers) {
        console.log(`  CURRENT MEMBER: ${m["Member Name"]} - ${m["Membership Type Name"]} ($${m["Membership Fee"]})`);
      }
    } else {
      console.log(`  CURRENT MEMBER: (not in list)`);
    }

    // Cancellations
    if (inCancellations.length > 0) {
      for (const c of inCancellations) {
        console.log(`  CANCELLATION: ${c["Cancel Reason"]} on ${c["Membership Cancellation Date"]} - ${c["Membership Type Name"]}`);
      }
    }

    // On Hold
    if (onHold.length > 0) {
      for (const h of onHold) {
        console.log(`  ON HOLD: ${h["Date Hold Starts"]} to ${h["Date Hold Ends"]}`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
}

traceJennifer().catch(console.error);
