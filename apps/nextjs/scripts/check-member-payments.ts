/**
 * Check payment history for specific members
 * Run: npx tsx scripts/check-member-payments.ts
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function fetchGymMasterPayments(startDate: string, endDate: string): Promise<Record<string, any>[]> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-GM-API-KEY": apiKey!,
    },
    body: JSON.stringify({
      report_id: 103, // ALL_PAYMENTS
      start_date: startDate,
      end_date: endDate,
    }),
  });

  const data = await response.json();
  return data.result || [];
}

function parseAmount(value: any): number {
  return parseFloat(String(value || "0").replace(/[$,]/g, ""));
}

async function check() {
  const membersToCheck = ["atkins, shanta", "martinez, elisabeth"];

  console.log("Fetching all payments for 2026...\n");
  const payments = await fetchGymMasterPayments("2026-01-01", "2026-12-31");

  for (const memberName of membersToCheck) {
    console.log(`${"=".repeat(80)}`);
    console.log(`MEMBER: ${memberName.toUpperCase()}`);
    console.log(`${"=".repeat(80)}\n`);

    const memberPayments = payments.filter(p =>
      String(p["Name"] || "").toLowerCase().includes(memberName.split(",")[0]!)
    );

    if (memberPayments.length === 0) {
      console.log("No payments found.\n");
      continue;
    }

    // Sort by date
    memberPayments.sort((a, b) =>
      new Date(a["Payment Date"]).getTime() - new Date(b["Payment Date"]).getTime()
    );

    console.log("All payments:");
    console.log("-".repeat(100));
    console.log(`${"Date".padEnd(12)} | ${"Amount".padStart(10)} | ${"Method".padEnd(25)} | ${"Details".padEnd(30)} | Note`);
    console.log("-".repeat(100));

    for (const p of memberPayments) {
      const date = String(p["Payment Date"] || "").substring(0, 10);
      const amount = parseAmount(p["Payment Amount"]);
      const method = String(p["Payment Method"] || "Unknown").substring(0, 25);
      const details = String(p["Payment Details"] || "").substring(0, 30);
      const note = String(p["Payment Note"] || "").substring(0, 40);

      console.log(`${date.padEnd(12)} | $${amount.toFixed(2).padStart(9)} | ${method.padEnd(25)} | ${details.padEnd(30)} | ${note}`);
    }

    // Summary of payment methods
    const methodCounts: Record<string, { count: number; total: number }> = {};
    for (const p of memberPayments) {
      const method = String(p["Payment Method"] || "Unknown");
      const amount = parseAmount(p["Payment Amount"]);
      if (!methodCounts[method]) methodCounts[method] = { count: 0, total: 0 };
      methodCounts[method].count++;
      methodCounts[method].total += amount;
    }

    console.log("\nPayment method summary:");
    for (const [method, stats] of Object.entries(methodCounts)) {
      console.log(`  - ${method}: ${stats.count} payments, $${stats.total.toFixed(2)}`);
    }
    console.log("\n");
  }
}

check().catch(console.error);
