/**
 * Trace Veronica Maciel's -$120 entries
 * Cross-reference GymMaster payments with Stripe refunds
 * Run: npx tsx scripts/trace-veronica-maciel.ts
 */

import Stripe from "stripe";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

async function fetchGymMasterPayments(memberId: string, startDate: string, endDate: string) {
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
  const allPayments = data.result || [];

  // Filter for this member
  return allPayments.filter((p: any) => String(p["Member ID"]) === memberId);
}

async function fetchStripeRefunds(startDate: string, endDate: string) {
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  const refunds: Stripe.Refund[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await stripe.refunds.list({
      created: { gte: startTs, lte: endTs },
      limit: 100,
      expand: ["data.charge"],
      ...(startingAfter && { starting_after: startingAfter }),
    });

    refunds.push(...response.data);
    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }

  return refunds;
}

async function main() {
  const memberId = "322714"; // Veronica Maciel
  const memberName = "Veronica Maciel";

  console.log("=".repeat(80));
  console.log(`TRACING ${memberName} (#${memberId}) - REFUND INVESTIGATION`);
  console.log("=".repeat(80));

  // Fetch Aug-Sep-Oct payments
  const startDate = "2026-08-01";
  const endDate = "2026-10-31";

  console.log(`\nFetching GymMaster payments for ${startDate} to ${endDate}...`);
  const gmPayments = await fetchGymMasterPayments(memberId, startDate, endDate);

  console.log(`\n📋 GYMMASTER PAYMENTS (${gmPayments.length} records):`);
  console.log("─".repeat(80));

  for (const p of gmPayments) {
    const amount = p["Payment Amount"];
    const date = p["Payment Date"];
    const method = p["Payment Method"];
    const details = p["Payment Details"];
    const note = p["Payment Note"];
    const origin = p["Payment Origin"];

    const isNegative = parseFloat(String(amount).replace(/[$,]/g, "")) < 0;
    const icon = isNegative ? "🔴" : "🟢";

    console.log(`${icon} ${date}: ${amount}`);
    console.log(`   Method: ${method}`);
    console.log(`   Details: ${details}`);
    console.log(`   Note: ${note || "(none)"}`);
    console.log(`   Origin: ${origin}`);
    console.log("");
  }

  // Fetch Stripe refunds for the same period
  console.log("\n📋 STRIPE REFUNDS (Aug-Oct 2026):");
  console.log("─".repeat(80));

  const stripeRefunds = await fetchStripeRefunds(startDate, endDate);

  // Look for refunds that might match Veronica
  // We need to check charge metadata or customer email
  let matchingRefunds: any[] = [];

  for (const refund of stripeRefunds) {
    const charge = refund.charge as Stripe.Charge;
    const amount = refund.amount / 100;
    const created = new Date(refund.created * 1000).toISOString().split("T")[0];

    // Check if this could be Veronica's refund
    const billingName = charge?.billing_details?.name || "";
    const email = charge?.billing_details?.email || charge?.receipt_email || "";
    const metadata = charge?.metadata || {};

    // Check for match (name contains "maciel" or "veronica", or amount is $120)
    const nameMatch = billingName.toLowerCase().includes("maciel") ||
                      billingName.toLowerCase().includes("veronica");
    const amountMatch = amount === 120;

    if (nameMatch || (amountMatch && created >= "2026-08-01" && created <= "2026-10-31")) {
      matchingRefunds.push({
        refundId: refund.id,
        chargeId: charge?.id,
        amount,
        created,
        billingName,
        email,
        metadata,
        reason: refund.reason,
        status: refund.status,
      });
    }
  }

  if (matchingRefunds.length > 0) {
    console.log(`Found ${matchingRefunds.length} potentially matching Stripe refunds:\n`);
    for (const r of matchingRefunds) {
      console.log(`💳 ${r.created}: $${r.amount.toFixed(2)}`);
      console.log(`   Refund ID: ${r.refundId}`);
      console.log(`   Charge ID: ${r.chargeId}`);
      console.log(`   Billing Name: ${r.billingName || "(none)"}`);
      console.log(`   Email: ${r.email || "(none)"}`);
      console.log(`   Reason: ${r.reason || "(none)"}`);
      console.log(`   Status: ${r.status}`);
      console.log("");
    }
  } else {
    console.log("No matching Stripe refunds found for this member/amount.\n");
  }

  // Also search for any $120 refunds specifically
  console.log("\n📋 ALL $120 STRIPE REFUNDS (Aug-Oct 2026):");
  console.log("─".repeat(80));

  const refunds120 = stripeRefunds.filter(r => r.amount === 12000); // $120 in cents

  if (refunds120.length > 0) {
    for (const refund of refunds120) {
      const charge = refund.charge as Stripe.Charge;
      const created = new Date(refund.created * 1000).toISOString().split("T")[0];
      const billingName = charge?.billing_details?.name || "";
      const email = charge?.billing_details?.email || charge?.receipt_email || "";

      console.log(`💳 ${created}: $120.00`);
      console.log(`   Refund ID: ${refund.id}`);
      console.log(`   Billing Name: ${billingName || "(none)"}`);
      console.log(`   Email: ${email || "(none)"}`);
      console.log("");
    }
  } else {
    console.log("No $120 Stripe refunds found in this period.\n");
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("ANALYSIS:");
  console.log("=".repeat(80));

  const negativePayments = gmPayments.filter((p: any) =>
    parseFloat(String(p["Payment Amount"]).replace(/[$,]/g, "")) < 0
  );

  for (const neg of negativePayments) {
    const amount = parseFloat(String(neg["Payment Amount"]).replace(/[$,]/g, ""));
    const date = neg["Payment Date"];
    const method = neg["Payment Method"];
    const origin = neg["Payment Origin"];

    console.log(`\n${date}: $${Math.abs(amount).toFixed(2)} refund`);
    console.log(`   Payment Method: ${method}`);
    console.log(`   Origin: ${origin}`);

    // Determine if it's a manual adjustment or actual refund
    const isManualAdjustment =
      method?.toLowerCase().includes("no payment") ||
      method?.toLowerCase().includes("adjustment") ||
      origin?.toLowerCase().includes("manual") ||
      origin?.toLowerCase().includes("adjustment");

    const isBillingRefund =
      method?.toLowerCase().includes("billing") ||
      method?.toLowerCase().includes("stripe") ||
      origin?.toLowerCase().includes("billing");

    if (isManualAdjustment) {
      console.log(`   → 📝 MANUAL ADJUSTMENT (not a Stripe refund)`);
    } else if (isBillingRefund) {
      console.log(`   → 💳 BILLING REFUND (should appear in Stripe)`);

      // Check if we found a matching Stripe refund
      const matchDate = date; // e.g., "Sep 7 2026"
      const matchAmount = Math.abs(amount);
      const found = matchingRefunds.some(r =>
        r.amount === matchAmount
      );

      if (found) {
        console.log(`   → ✅ CONFIRMED: Found matching Stripe refund`);
      } else {
        console.log(`   → ⚠️ NOT FOUND in Stripe - may need investigation`);
      }
    } else {
      console.log(`   → ❓ UNKNOWN - needs manual review`);
    }
  }

  console.log("\n");
}

main().catch(console.error);
