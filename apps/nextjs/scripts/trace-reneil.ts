/**
 * Trace Reneil Lovo across all months
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

async function traceReneil() {
  console.log("=".repeat(80));
  console.log("TRACING: Reneil Lovo");
  console.log("=".repeat(80));

  for (let month = 1; month <= 9; month++) {
    const reports = await fetchKpiReports(2026, month);

    const payments = reports.current.allPayments.filter(p =>
      String(p["Name"] || "").toLowerCase().includes("lovo") ||
      String(p["Name"] || "").toLowerCase().includes("reneil")
    );

    const inCurrentMembers = reports.current.currentMembers.filter(m =>
      String(m["Member Name"] || "").toLowerCase().includes("lovo") ||
      String(m["Member Name"] || "").toLowerCase().includes("reneil")
    );

    const onHold = reports.current.membersOnHold.filter(h =>
      String(h["Member Name"] || "").toLowerCase().includes("lovo") ||
      String(h["Member Name"] || "").toLowerCase().includes("reneil")
    );

    console.log(`\n${MONTHS[month - 1]} 2026:`);

    if (payments.length > 0) {
      let total = 0;
      for (const p of payments) {
        const amt = parseFloat(String(p["Payment Amount"]).replace(/[$,]/g, "")) || 0;
        total += amt;
        console.log(`  PAYMENT: ${p["Payment Amount"]} - ${p["Payment Details"]}`);
      }
      console.log(`  NET TOTAL: $${total.toFixed(2)}`);
    } else {
      console.log(`  PAYMENT: (none)`);
    }

    if (inCurrentMembers.length > 0) {
      for (const m of inCurrentMembers) {
        console.log(`  CURRENT MEMBER: ${m["Membership Type Name"]} ($${m["Membership Fee"]})`);
      }
    } else {
      console.log(`  CURRENT MEMBER: (not in list)`);
    }

    if (onHold.length > 0) {
      for (const h of onHold) {
        console.log(`  ON HOLD: ${h["Date Hold Starts"]} to ${h["Date Hold Ends"]}`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
}

traceReneil().catch(console.error);
