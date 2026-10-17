/**
 * Deep dive into GymMaster payment data structure
 * Run: npx tsx scripts/deep-dive-payment-structure.ts
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

async function deepDive() {
  console.log("Fetching September 2026 payments...\n");
  const payments = await fetchGymMasterPayments("2026-09-01", "2026-09-30");

  // 1. Show all available fields from a sample payment
  console.log("=".repeat(80));
  console.log("1. ALL AVAILABLE FIELDS (from first payment)");
  console.log("=".repeat(80));
  if (payments.length > 0) {
    const sample = payments[0];
    const fields = Object.keys(sample!);
    console.log(`Total fields: ${fields.length}`);
    console.log("\nFields and sample values:");
    for (const field of fields) {
      console.log(`  "${field}": ${JSON.stringify(sample![field])}`);
    }
  }

  // 2. Unique Payment Methods
  console.log("\n" + "=".repeat(80));
  console.log("2. UNIQUE PAYMENT METHODS");
  console.log("=".repeat(80));
  const paymentMethods = new Map<string, { count: number; totalPositive: number; totalNegative: number }>();
  for (const p of payments) {
    const method = String(p["Payment Method"] || "Unknown");
    const amount = parseAmount(p["Payment Amount"]);
    if (!paymentMethods.has(method)) {
      paymentMethods.set(method, { count: 0, totalPositive: 0, totalNegative: 0 });
    }
    const stats = paymentMethods.get(method)!;
    stats.count++;
    if (amount >= 0) stats.totalPositive += amount;
    else stats.totalNegative += Math.abs(amount);
  }
  for (const [method, stats] of paymentMethods) {
    console.log(`\n"${method}":`);
    console.log(`  Count: ${stats.count}`);
    console.log(`  Total Charges: $${stats.totalPositive.toFixed(2)}`);
    console.log(`  Total Refunds: $${stats.totalNegative.toFixed(2)}`);
  }

  // 3. Unique Payment Details
  console.log("\n" + "=".repeat(80));
  console.log("3. UNIQUE PAYMENT DETAILS");
  console.log("=".repeat(80));
  const paymentDetails = new Map<string, number>();
  for (const p of payments) {
    const details = String(p["Payment Details"] || "Unknown");
    paymentDetails.set(details, (paymentDetails.get(details) || 0) + 1);
  }
  for (const [details, count] of Array.from(paymentDetails.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  "${details}": ${count}`);
  }

  // 4. Sample refunds with all fields
  console.log("\n" + "=".repeat(80));
  console.log("4. SAMPLE REFUNDS (negative amounts) - ALL FIELDS");
  console.log("=".repeat(80));
  const refunds = payments.filter(p => parseAmount(p["Payment Amount"]) < 0);
  console.log(`Total refunds in September: ${refunds.length}\n`);

  // Show first 3 refunds with all fields
  for (let i = 0; i < Math.min(3, refunds.length); i++) {
    const refund = refunds[i]!;
    console.log(`--- Refund ${i + 1} ---`);
    for (const [key, value] of Object.entries(refund)) {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    }
    console.log("");
  }

  // 5. Compare Billing vs No Payment / Adjustment refunds
  console.log("\n" + "=".repeat(80));
  console.log("5. REFUND COMPARISON BY PAYMENT METHOD");
  console.log("=".repeat(80));

  const billingRefunds = refunds.filter(r => String(r["Payment Method"]).toLowerCase().includes("billing"));
  const adjustmentRefunds = refunds.filter(r => {
    const method = String(r["Payment Method"]).toLowerCase();
    return method.includes("no payment") || method.includes("adjustment");
  });
  const otherRefunds = refunds.filter(r => {
    const method = String(r["Payment Method"]).toLowerCase();
    return !method.includes("billing") && !method.includes("no payment") && !method.includes("adjustment");
  });

  console.log(`\nBilling refunds: ${billingRefunds.length}`);
  for (const r of billingRefunds.slice(0, 5)) {
    console.log(`  ${r["Name"]} | $${Math.abs(parseAmount(r["Payment Amount"])).toFixed(2)} | ${r["Payment Details"]} | ${r["Payment Note"]?.substring(0, 50) || ""}`);
  }

  console.log(`\nNo Payment / Adjustment refunds: ${adjustmentRefunds.length}`);
  for (const r of adjustmentRefunds.slice(0, 5)) {
    console.log(`  ${r["Name"]} | $${Math.abs(parseAmount(r["Payment Amount"])).toFixed(2)} | ${r["Payment Details"]} | ${r["Payment Note"]?.substring(0, 50) || ""}`);
  }

  console.log(`\nOther payment method refunds: ${otherRefunds.length}`);
  for (const r of otherRefunds.slice(0, 5)) {
    console.log(`  ${r["Payment Method"]} | ${r["Name"]} | $${Math.abs(parseAmount(r["Payment Amount"])).toFixed(2)}`);
  }

  // 6. Look at Shanta and Elisabeth specifically
  console.log("\n" + "=".repeat(80));
  console.log("6. SPECIFIC MEMBERS: Shanta & Elisabeth (September)");
  console.log("=".repeat(80));

  const targetMembers = ["atkins", "martinez"];
  for (const target of targetMembers) {
    const memberPayments = payments.filter(p =>
      String(p["Name"] || "").toLowerCase().includes(target)
    );
    console.log(`\n--- ${target.toUpperCase()} ---`);
    for (const p of memberPayments) {
      const amount = parseAmount(p["Payment Amount"]);
      const sign = amount >= 0 ? "+" : "";
      console.log(`  ${p["Payment Date"]} | ${sign}$${amount.toFixed(2)} | Method: "${p["Payment Method"]}" | Details: "${p["Payment Details"]}" | Note: "${(p["Payment Note"] || "").substring(0, 40)}"`);
    }
  }
}

deepDive().catch(console.error);
