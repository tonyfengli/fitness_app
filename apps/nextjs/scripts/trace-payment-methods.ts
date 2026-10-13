/**
 * Trace Payment Methods in GymMaster data
 * Distinguish between Stripe refunds vs Manual adjustments
 * Run: npx tsx scripts/trace-payment-methods.ts
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

async function fetchGymMasterPayments(startDate: string, endDate: string) {
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
      report_id: 103,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  const data = await response.json();
  return data.result || [];
}

async function main() {
  console.log("=".repeat(100));
  console.log("GYMMASTER PAYMENT METHOD ANALYSIS");
  console.log("Distinguishing Stripe Refunds vs Manual Adjustments");
  console.log("=".repeat(100));

  const payments = await fetchGymMasterPayments("2026-08-01", "2026-09-30");

  // Filter for Veronica and Shanta
  const members = [
    { id: "322714", name: "Veronica" },
    { id: "323251", name: "Shanta" },
  ];

  for (const member of members) {
    const memberPayments = payments.filter((p: any) =>
      String(p["Member ID"]) === member.id
    );

    console.log(`\n${"═".repeat(100)}`);
    console.log(`📋 ${member.name} (#${member.id})`);
    console.log("═".repeat(100));

    console.log("\n┌─────────────┬──────────────┬─────────────────────────┬────────────────────────────────────────┬──────────────┐");
    console.log("│ Date        │ Amount       │ Payment Method          │ Payment Details                        │ Type         │");
    console.log("├─────────────┼──────────────┼─────────────────────────┼────────────────────────────────────────┼──────────────┤");

    for (const p of memberPayments) {
      const date = String(p["Payment Date"] || "").padEnd(11);
      const amount = parseFloat(String(p["Payment Amount"]).replace(/[$,]/g, ""));
      const amountStr = (amount >= 0 ? "+" : "") + `$${amount.toFixed(2)}`.padEnd(10);
      const method = String(p["Payment Method"] || "").substring(0, 23).padEnd(23);
      const details = String(p["Payment Details"] || "").substring(0, 38).padEnd(38);

      // Determine type
      let type = "";
      const methodLower = String(p["Payment Method"] || "").toLowerCase();
      const detailsLower = String(p["Payment Details"] || "").toLowerCase();

      if (methodLower.includes("no payment") || methodLower.includes("adjustment")) {
        type = "📝 MANUAL";
      } else if (methodLower.includes("billing") || methodLower.includes("stripe")) {
        if (amount < 0 || detailsLower.includes("refund")) {
          type = "💳 STRIPE REF";
        } else {
          type = "💳 STRIPE CHG";
        }
      } else {
        type = "❓ UNKNOWN";
      }

      console.log(`│ ${date} │ ${amountStr} │ ${method} │ ${details} │ ${type.padEnd(12)} │`);
    }

    console.log("└─────────────┴──────────────┴─────────────────────────┴────────────────────────────────────────┴──────────────┘");

    // Summary
    let stripeCharges = 0;
    let stripeRefunds = 0;
    let manualAdjustments = 0;

    for (const p of memberPayments) {
      const amount = parseFloat(String(p["Payment Amount"]).replace(/[$,]/g, ""));
      const methodLower = String(p["Payment Method"] || "").toLowerCase();

      if (methodLower.includes("no payment") || methodLower.includes("adjustment")) {
        manualAdjustments += amount;
      } else if (methodLower.includes("billing") || methodLower.includes("stripe")) {
        if (amount < 0) {
          stripeRefunds += Math.abs(amount);
        } else {
          stripeCharges += amount;
        }
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Stripe Charges:     +$${stripeCharges.toFixed(2)}`);
    console.log(`   Stripe Refunds:     -$${stripeRefunds.toFixed(2)}`);
    console.log(`   Manual Adjustments: $${manualAdjustments.toFixed(2)}`);
    console.log(`   ─────────────────────────`);
    console.log(`   NET (Stripe only):  $${(stripeCharges - stripeRefunds).toFixed(2)}`);
  }

  // Show all unique payment methods for context
  console.log("\n" + "=".repeat(100));
  console.log("ALL UNIQUE PAYMENT METHODS IN DATASET:");
  console.log("=".repeat(100));

  const methods = new Set<string>();
  for (const p of payments) {
    methods.add(String(p["Payment Method"] || "(empty)"));
  }

  for (const m of [...methods].sort()) {
    const isBilling = m.toLowerCase().includes("billing");
    const isManual = m.toLowerCase().includes("no payment") || m.toLowerCase().includes("adjustment");
    const icon = isManual ? "📝" : isBilling ? "💳" : "❓";
    console.log(`   ${icon} ${m}`);
  }

  console.log("\n");
}

main().catch(console.error);
