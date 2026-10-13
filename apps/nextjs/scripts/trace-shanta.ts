/**
 * Trace Shanta's refunds
 * Cross-reference GymMaster payments with Stripe refunds
 * Run: npx tsx scripts/trace-shanta.ts
 */

import Stripe from "stripe";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

async function fetchGymMasterPayments(searchName: string, startDate: string, endDate: string) {
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
  const allPayments = data.result || [];
  return allPayments.filter((p: any) =>
    String(p["Name"] || "").toLowerCase().includes(searchName.toLowerCase())
  );
}

async function fetchStripeRefunds(searchName: string, startDate: string, endDate: string) {
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  const refunds: any[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await stripe.refunds.list({
      created: { gte: startTs, lte: endTs },
      limit: 100,
      expand: ["data.charge"],
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const refund of response.data) {
      const charge = refund.charge as Stripe.Charge;
      const billingName = charge?.billing_details?.name || "";
      if (billingName.toLowerCase().includes(searchName.toLowerCase())) {
        refunds.push({
          date: new Date(refund.created * 1000).toISOString().split("T")[0],
          amount: refund.amount / 100,
          refundId: refund.id,
          billingName,
          status: refund.status,
        });
      }
    }

    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }
  return refunds;
}

async function main() {
  console.log("=".repeat(80));
  console.log("TRACING SHANTA - REFUND INVESTIGATION");
  console.log("=".repeat(80));

  const gmPayments = await fetchGymMasterPayments("shanta", "2026-01-01", "2026-10-31");

  console.log(`\n📋 GYMMASTER PAYMENTS (${gmPayments.length} records):`);
  console.log("─".repeat(80));

  for (const p of gmPayments) {
    const amount = parseFloat(String(p["Payment Amount"]).replace(/[$,]/g, ""));
    const icon = amount < 0 ? "🔴" : "🟢";
    console.log(`${icon} ${p["Payment Date"]}: ${p["Payment Amount"]}`);
    console.log(`   Member ID: ${p["Member ID"]}`);
    console.log(`   Method: ${p["Payment Method"]}`);
    console.log(`   Details: ${p["Payment Details"]}`);
    console.log(`   Note: ${p["Payment Note"] || "(none)"}`);
    console.log("");
  }

  console.log("\n📋 STRIPE REFUNDS FOR SHANTA:");
  console.log("─".repeat(80));

  const stripeRefunds = await fetchStripeRefunds("shanta", "2026-01-01", "2026-10-31");

  if (stripeRefunds.length > 0) {
    for (const r of stripeRefunds) {
      console.log(`💳 ${r.date}: $${r.amount.toFixed(2)}`);
      console.log(`   Refund ID: ${r.refundId}`);
      console.log(`   Billing Name: ${r.billingName}`);
      console.log("");
    }
  } else {
    console.log("No Stripe refunds found for Shanta.\n");
  }

  // Check Stripe for refunds on specific dates
  console.log("\n📋 STRIPE REFUNDS ON SHANTA'S REFUND DATES:");
  console.log("─".repeat(80));

  const refundDates = ["2026-05-19", "2026-06-16", "2026-08-26", "2026-09-09"];

  for (const date of refundDates) {
    const startTs = Math.floor(new Date(date + "T00:00:00").getTime() / 1000);
    const endTs = Math.floor(new Date(date + "T23:59:59").getTime() / 1000);

    const refunds = await stripe.refunds.list({
      created: { gte: startTs, lte: endTs },
      limit: 50,
      expand: ["data.charge"],
    });

    console.log(`\n📅 ${date}:`);

    if (refunds.data.length === 0) {
      console.log("   No Stripe refunds on this date.");
    } else {
      for (const r of refunds.data) {
        const charge = r.charge as Stripe.Charge;
        const billingName = charge?.billing_details?.name || "(none)";
        console.log(`   💳 $${(r.amount / 100).toFixed(2)} - ${billingName}`);
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("ANALYSIS:");
  console.log("=".repeat(80));

  const negPayments = gmPayments.filter((p: any) =>
    parseFloat(String(p["Payment Amount"]).replace(/[$,]/g, "")) < 0
  );

  if (negPayments.length === 0) {
    console.log("\nNo refunds found in GymMaster for Shanta.");
  } else {
    for (const neg of negPayments) {
      const amount = Math.abs(parseFloat(String(neg["Payment Amount"]).replace(/[$,]/g, "")));
      const method = neg["Payment Method"] || "";
      const isManual = method.toLowerCase().includes("no payment") || method.toLowerCase().includes("adjustment");
      const isBilling = method.toLowerCase().includes("billing");

      console.log(`\n${neg["Payment Date"]}: $${amount.toFixed(2)} refund`);
      console.log(`   Method: ${method}`);

      if (isManual) {
        console.log("   → 📝 MANUAL ADJUSTMENT (not a Stripe refund)");
      } else if (isBilling) {
        const found = stripeRefunds.some((r: any) => Math.abs(r.amount - amount) < 1);
        if (found) {
          console.log("   → ✅ CONFIRMED: Found matching Stripe refund");
        } else {
          console.log("   → ⚠️ NOT FOUND in Stripe");
        }
      } else {
        console.log("   → ❓ UNKNOWN method - needs review");
      }
    }
  }

  console.log("\n");
}

main().catch(console.error);
