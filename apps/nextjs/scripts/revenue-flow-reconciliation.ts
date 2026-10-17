/**
 * Revenue Flow Reconciliation
 * GymMaster (P&L) → Stripe Charges → Bank (Payouts)
 */

import Stripe from "stripe";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

async function fetchGymMasterBilling(startDate: string, endDate: string) {
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

async function fetchStripeData(startDate: string, endDate: string) {
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  // Get successful charges only
  const charges: Stripe.Charge[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await stripe.charges.list({
      created: { gte: startTs, lte: endTs },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });
    charges.push(...response.data);
    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }

  // Get payouts (bank deposits)
  const payouts: Stripe.Payout[] = [];
  hasMore = true;
  startingAfter = undefined;

  while (hasMore) {
    const response = await stripe.payouts.list({
      arrival_date: { gte: startTs, lte: endTs },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });
    payouts.push(...response.data);
    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }

  // Get balance transactions for fees
  const balanceTxns: Stripe.BalanceTransaction[] = [];
  hasMore = true;
  startingAfter = undefined;

  while (hasMore) {
    const response = await stripe.balanceTransactions.list({
      created: { gte: startTs, lte: endTs },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });
    balanceTxns.push(...response.data);
    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }

  return { charges, payouts, balanceTxns };
}

async function main() {
  const month = "2026-03";
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  console.log(`\n${"=".repeat(70)}`);
  console.log(`REVENUE FLOW RECONCILIATION: ${month}`);
  console.log(`${"=".repeat(70)}`);

  const [gmPayments, stripeData] = await Promise.all([
    fetchGymMasterBilling(startDate, endDate),
    fetchStripeData(startDate, endDate),
  ]);

  const { charges, payouts, balanceTxns } = stripeData;

  // === GYMMASTER (P&L SOURCE) ===
  let gmTotal = 0;
  let gmStripeTotal = 0;
  let gmOtherTotal = 0;

  for (const p of gmPayments) {
    const amt = parseFloat(String(p["Payment Amount"] || "0").replace(/[$,]/g, ""));
    const method = String(p["Payment Method"] || "").toLowerCase();
    gmTotal += amt;

    if (method.includes("billing") || method.includes("stripe") || method.includes("online")) {
      gmStripeTotal += amt;
    } else {
      gmOtherTotal += amt;
    }
  }

  // === STRIPE CHARGES ===
  const successfulCharges = charges.filter(c => c.status === "succeeded" && c.paid);
  const failedCharges = charges.filter(c => c.status === "failed" || !c.paid);

  const stripeGross = successfulCharges.reduce((s, c) => s + c.amount / 100, 0);
  const stripeFailed = failedCharges.reduce((s, c) => s + c.amount / 100, 0);

  // === STRIPE FEES & REFUNDS ===
  const chargeTxns = balanceTxns.filter(t => t.type === "charge");
  const refundTxns = balanceTxns.filter(t => t.type === "refund");

  const stripeFees = chargeTxns.reduce((s, t) => s + t.fee / 100, 0);
  const stripeRefunds = refundTxns.reduce((s, t) => s + Math.abs(t.amount) / 100, 0);
  const stripeNet = stripeGross - stripeFees - stripeRefunds;

  // === BANK DEPOSITS ===
  const bankDeposits = payouts
    .filter(p => p.status === "paid")
    .reduce((s, p) => s + p.amount / 100, 0);

  // === DISPLAY RESULTS ===
  console.log(`\n┌─────────────────────────────────────────────────────────────────────┐`);
  console.log(`│  STEP 1: GYMMASTER P&L (What you're reporting as revenue)          │`);
  console.log(`├─────────────────────────────────────────────────────────────────────┤`);
  console.log(`│  Total recorded:              $${gmTotal.toFixed(2).padStart(12)}                    │`);
  console.log(`│    ├─ Stripe/Billing:         $${gmStripeTotal.toFixed(2).padStart(12)}                    │`);
  console.log(`│    └─ Other (cash/check):     $${gmOtherTotal.toFixed(2).padStart(12)}                    │`);
  console.log(`└─────────────────────────────────────────────────────────────────────┘`);

  console.log(`                                    ↓`);
  console.log(`                      Should equal Stripe gross`);
  console.log(`                                    ↓`);

  console.log(`\n┌─────────────────────────────────────────────────────────────────────┐`);
  console.log(`│  STEP 2: STRIPE CHARGES (What actually got charged)                │`);
  console.log(`├─────────────────────────────────────────────────────────────────────┤`);
  console.log(`│  Successful charges:          $${stripeGross.toFixed(2).padStart(12)}                    │`);
  console.log(`│  Failed charges:              $${stripeFailed.toFixed(2).padStart(12)}  (not collected)  │`);
  console.log(`│  Fees:                       -$${stripeFees.toFixed(2).padStart(12)}                    │`);
  console.log(`│  Refunds:                    -$${stripeRefunds.toFixed(2).padStart(12)}                    │`);
  console.log(`│  ─────────────────────────────────────────                         │`);
  console.log(`│  Net to bank:                 $${stripeNet.toFixed(2).padStart(12)}                    │`);
  console.log(`└─────────────────────────────────────────────────────────────────────┘`);

  console.log(`                                    ↓`);
  console.log(`                       Should equal bank deposits`);
  console.log(`                                    ↓`);

  console.log(`\n┌─────────────────────────────────────────────────────────────────────┐`);
  console.log(`│  STEP 3: BANK DEPOSITS (What landed in your account)               │`);
  console.log(`├─────────────────────────────────────────────────────────────────────┤`);
  console.log(`│  Total deposited:             $${bankDeposits.toFixed(2).padStart(12)}                    │`);
  console.log(`└─────────────────────────────────────────────────────────────────────┘`);

  // === RECONCILIATION ===
  console.log(`\n${"─".repeat(70)}`);
  console.log(`RECONCILIATION CHECK`);
  console.log(`${"─".repeat(70)}`);

  const gmVsStripe = gmStripeTotal - stripeGross;
  const stripeVsBank = stripeNet - bankDeposits;

  console.log(`\n1. GymMaster Billing vs Stripe Gross:`);
  console.log(`   GymMaster:  $${gmStripeTotal.toFixed(2)}`);
  console.log(`   Stripe:     $${stripeGross.toFixed(2)}`);
  console.log(`   Variance:   $${gmVsStripe.toFixed(2)} ${Math.abs(gmVsStripe) < 1 ? "✓" : "← LEAKAGE"}`);

  if (Math.abs(gmVsStripe) >= 1) {
    const pct = (gmVsStripe / gmStripeTotal * 100).toFixed(1);
    console.log(`\n   ⚠ ${pct}% of GymMaster billing didn't make it to Stripe`);
    console.log(`   This is revenue recorded in P&L but NOT actually collected.`);
  }

  console.log(`\n2. Stripe Net vs Bank Deposits:`);
  console.log(`   Stripe Net: $${stripeNet.toFixed(2)}`);
  console.log(`   Bank:       $${bankDeposits.toFixed(2)}`);
  console.log(`   Variance:   $${stripeVsBank.toFixed(2)} ${Math.abs(stripeVsBank) < 1 ? "✓" : "← CHECK THIS"}`);

  if (Math.abs(stripeVsBank) > 1) {
    console.log(`\n   Note: Variance likely due to timing - charges near month boundaries`);
    console.log(`   may deposit in next month.`);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`SUMMARY`);
  console.log(`${"=".repeat(70)}`);
  console.log(`\n  P&L says you earned:     $${gmStripeTotal.toFixed(2)} (Stripe billing)`);
  console.log(`  You actually collected:  $${stripeGross.toFixed(2)}`);
  console.log(`  After Stripe fees:       $${stripeNet.toFixed(2)}`);
  console.log(`  Deposited in bank:       $${bankDeposits.toFixed(2)}`);
  console.log(`\n  Revenue leakage:         $${gmVsStripe.toFixed(2)} (${(gmVsStripe / gmStripeTotal * 100).toFixed(1)}%)`);
  console.log(`${"=".repeat(70)}\n`);
}

main().catch(console.error);
