/**
 * Trace Veronica and Shanta charges/refunds using Stripe as source of truth
 * Run: npx tsx scripts/trace-stripe-aug-sep.ts
 */

import Stripe from "stripe";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

async function getStripeCharges(startDate: string, endDate: string, searchName: string) {
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  const charges: any[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await stripe.charges.list({
      created: { gte: startTs, lte: endTs },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const charge of response.data) {
      const billingName = charge.billing_details?.name || "";
      if (billingName.toLowerCase().includes(searchName.toLowerCase())) {
        charges.push({
          id: charge.id,
          date: new Date(charge.created * 1000).toISOString().split("T")[0],
          amount: charge.amount / 100,
          status: charge.status,
          billingName,
          refunded: charge.refunded,
          amountRefunded: charge.amount_refunded / 100,
        });
      }
    }

    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }
  return charges;
}

async function getStripeRefunds(startDate: string, endDate: string, searchName: string) {
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
      // Match by name OR if no name, we'll include all for manual review
      if (billingName.toLowerCase().includes(searchName.toLowerCase()) || !billingName) {
        refunds.push({
          id: refund.id,
          chargeId: charge?.id,
          date: new Date(refund.created * 1000).toISOString().split("T")[0],
          amount: refund.amount / 100,
          status: refund.status,
          billingName: billingName || "(no name)",
          reason: refund.reason,
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

async function traceMember(name: string, searchTerm: string, memberId: string) {
  console.log("\n" + "=".repeat(80));
  console.log(`📋 ${name} (#${memberId}) - STRIPE SOURCE OF TRUTH`);
  console.log("=".repeat(80));

  for (const month of ["August", "September"]) {
    const startDate = month === "August" ? "2026-08-01" : "2026-09-01";
    const endDate = month === "August" ? "2026-08-31" : "2026-09-30";

    console.log(`\n${"─".repeat(40)}`);
    console.log(`${month} 2026`);
    console.log("─".repeat(40));

    // Get charges
    const charges = await getStripeCharges(startDate, endDate, searchTerm);

    console.log(`\n💳 STRIPE CHARGES:`);
    if (charges.length === 0) {
      console.log("   No charges found.");
    } else {
      let totalCharged = 0;
      for (const c of charges) {
        console.log(`   ${c.date}: $${c.amount.toFixed(2)} - ${c.status}${c.refunded ? " (refunded)" : ""}`);
        console.log(`      Charge ID: ${c.id}`);
        if (c.amountRefunded > 0) {
          console.log(`      Amount Refunded: $${c.amountRefunded.toFixed(2)}`);
        }
        totalCharged += c.amount;
      }
      console.log(`   ─────────────────`);
      console.log(`   TOTAL CHARGED: $${totalCharged.toFixed(2)}`);
    }

    // Get refunds
    const refunds = await getStripeRefunds(startDate, endDate, searchTerm);
    // Filter to only show refunds that match this member
    const memberRefunds = refunds.filter(r =>
      r.billingName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      charges.some(c => c.id === r.chargeId)
    );

    console.log(`\n🔴 STRIPE REFUNDS:`);
    if (memberRefunds.length === 0) {
      console.log("   No refunds found.");
    } else {
      let totalRefunded = 0;
      for (const r of memberRefunds) {
        console.log(`   ${r.date}: $${r.amount.toFixed(2)} - ${r.status}`);
        console.log(`      Refund ID: ${r.id}`);
        console.log(`      Billing Name: ${r.billingName}`);
        totalRefunded += r.amount;
      }
      console.log(`   ─────────────────`);
      console.log(`   TOTAL REFUNDED: $${totalRefunded.toFixed(2)}`);
    }

    // Summary
    const totalCharged = charges.reduce((sum, c) => sum + c.amount, 0);
    const totalRefunded = memberRefunds.reduce((sum, r) => sum + r.amount, 0);
    const net = totalCharged - totalRefunded;

    console.log(`\n📊 ${month.toUpperCase()} SUMMARY (STRIPE):`);
    console.log(`   Charged:  $${totalCharged.toFixed(2)}`);
    console.log(`   Refunded: $${totalRefunded.toFixed(2)}`);
    console.log(`   NET:      $${net.toFixed(2)}`);
  }
}

async function main() {
  console.log("=".repeat(80));
  console.log("STRIPE SOURCE OF TRUTH - AUGUST & SEPTEMBER 2026");
  console.log("=".repeat(80));

  // Veronica Maciel - search by "Veronica" (her Stripe name is "Veronica Hernandez")
  await traceMember("Veronica Maciel", "veronica", "322714");

  // Shanta Atkins - search by "shanta" but also check charges without names
  await traceMember("Shanta Atkins", "shanta", "323251");

  // Also search for refunds with no billing name that match Shanta's amounts
  console.log("\n" + "=".repeat(80));
  console.log("🔍 SHANTA - CHECKING REFUNDS WITH NO BILLING NAME");
  console.log("=".repeat(80));

  for (const month of ["August", "September"]) {
    const startDate = month === "August" ? "2026-08-01" : "2026-09-01";
    const endDate = month === "August" ? "2026-08-31" : "2026-09-30";

    console.log(`\n${month} - $80 refunds with no name:`);

    const startTs = Math.floor(new Date(startDate).getTime() / 1000);
    const endTs = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

    const refunds = await stripe.refunds.list({
      created: { gte: startTs, lte: endTs },
      limit: 100,
      expand: ["data.charge"],
    });

    const noNameRefunds = refunds.data.filter(r => {
      const charge = r.charge as Stripe.Charge;
      const name = charge?.billing_details?.name || "";
      return !name && r.amount === 8000; // $80 in cents
    });

    if (noNameRefunds.length === 0) {
      console.log("   None found.");
    } else {
      for (const r of noNameRefunds) {
        const charge = r.charge as Stripe.Charge;
        console.log(`   ${new Date(r.created * 1000).toISOString().split("T")[0]}: $${(r.amount/100).toFixed(2)}`);
        console.log(`      Refund ID: ${r.id}`);
        console.log(`      Charge ID: ${charge?.id}`);
        console.log(`      Charge Date: ${charge ? new Date(charge.created * 1000).toISOString().split("T")[0] : "N/A"}`);
      }
    }
  }

  console.log("\n");
}

main().catch(console.error);
