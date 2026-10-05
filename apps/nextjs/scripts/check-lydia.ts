/**
 * Check Lydia Soliman's payment details to understand categorization
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, "../.env.local") });

import { fetchKpiReports } from "../src/app/kpi/lib/gymmaster-api";

async function checkLydia() {
  const reports = await fetchKpiReports(2026, 9);

  // Find Lydia in current payments
  const lydiaPayments = reports.current.allPayments.filter(p =>
    String(p["Name"] || "").toLowerCase().includes("soliman") ||
    String(p["Name"] || "").toLowerCase().includes("lydia")
  );

  console.log("=".repeat(60));
  console.log("Lydia Soliman - September 2026 Payments");
  console.log("=".repeat(60));

  if (lydiaPayments.length === 0) {
    console.log("No payments found for Lydia Soliman");
  } else {
    for (const payment of lydiaPayments) {
      console.log("\nPayment Record:");
      console.log(`  Name: ${payment["Name"]}`);
      console.log(`  Member ID: ${payment["Member ID"]}`);
      console.log(`  Amount: ${payment["Payment Amount"]}`);
      console.log(`  Date: ${payment["Payment Date"]}`);
      console.log(`  Payment Details: ${payment["Payment Details"]}`);
      console.log(`  Full record:`, JSON.stringify(payment, null, 2));
    }
  }
}

checkLydia().catch(console.error);
