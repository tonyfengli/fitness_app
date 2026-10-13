/**
 * Investigate refund variance between GymMaster and Stripe
 * Run: npx tsx scripts/investigate-refund-variance.ts
 */

import Stripe from "stripe";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from nextjs app
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

interface GymMasterRefund {
  memberId: string;
  memberName: string;
  date: string;
  amount: number;
  paymentMethod: string;
  details: string;
  note: string;
}

interface StripeRefundInfo {
  id: string;
  date: string;
  amount: number;
  customerEmail: string | null;
  billingName: string | null;
  chargeId: string | null;
}

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

function getMonthKey(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function investigate() {
  const year = 2026;
  console.log(`\n${"=".repeat(80)}`);
  console.log(`REFUND VARIANCE INVESTIGATION - ${year}`);
  console.log(`${"=".repeat(80)}\n`);

  // Fetch GymMaster payments
  console.log("Fetching GymMaster payments...");
  const gmPayments = await fetchGymMasterPayments(`${year}-01-01`, `${year}-12-31`);

  // Extract GymMaster refunds with all available fields
  const gmRefunds: GymMasterRefund[] = [];
  const gmRefundsByMonth: Map<string, GymMasterRefund[]> = new Map();

  // First, let's see what fields are available
  const sampleRefund = gmPayments.find(p => parseAmount(p["Payment Amount"]) < 0);
  if (sampleRefund) {
    console.log("\nGymMaster refund fields available:");
    console.log(Object.keys(sampleRefund).join(", "));
    console.log("\nSample refund record:");
    console.log(JSON.stringify(sampleRefund, null, 2));
  }

  for (const payment of gmPayments) {
    const amount = parseAmount(payment["Payment Amount"]);
    const details = String(payment["Payment Details"] || "").toLowerCase();

    if (amount >= 0 || !details.includes("payment refund")) continue;

    const dateStr = String(payment["Payment Date"] || "");
    const monthKey = getMonthKey(dateStr);
    if (!monthKey) continue;

    const refund: GymMasterRefund = {
      memberId: String(payment["Member ID"] || ""),
      memberName: String(payment["Name"] || ""),
      date: new Date(dateStr).toISOString().split("T")[0] || dateStr,
      amount: Math.abs(amount),
      paymentMethod: String(payment["Payment Method"] || payment["Method"] || "Unknown"),
      details: String(payment["Payment Details"] || ""),
      note: String(payment["Payment Note"] || ""),
    };

    gmRefunds.push(refund);

    if (!gmRefundsByMonth.has(monthKey)) {
      gmRefundsByMonth.set(monthKey, []);
    }
    gmRefundsByMonth.get(monthKey)!.push(refund);
  }

  // Fetch Stripe refunds
  console.log("\nFetching Stripe refunds...");
  const startTimestamp = Math.floor(new Date(`${year}-01-01`).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(`${year}-12-31T23:59:59`).getTime() / 1000);

  const stripeRefunds: StripeRefundInfo[] = [];
  const stripeRefundsByMonth: Map<string, StripeRefundInfo[]> = new Map();

  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await stripe.refunds.list({
      created: { gte: startTimestamp, lte: endTimestamp },
      limit: 100,
      expand: ["data.charge"],
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const refund of response.data) {
      const charge = refund.charge as Stripe.Charge | null;
      const date = new Date(refund.created * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const info: StripeRefundInfo = {
        id: refund.id,
        date: date.toISOString().split("T")[0]!,
        amount: refund.amount / 100,
        customerEmail: charge?.receipt_email || charge?.billing_details?.email || null,
        billingName: charge?.billing_details?.name || null,
        chargeId: typeof refund.charge === "string" ? refund.charge : charge?.id || null,
      };

      stripeRefunds.push(info);

      if (!stripeRefundsByMonth.has(monthKey)) {
        stripeRefundsByMonth.set(monthKey, []);
      }
      stripeRefundsByMonth.get(monthKey)!.push(info);
    }

    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1]!.id;
    }
  }

  // Analyze months with variance
  const monthsToAnalyze = ["2026-07", "2026-09"]; // Jul and Sep have variance

  for (const monthKey of monthsToAnalyze) {
    const gmMonthRefunds = gmRefundsByMonth.get(monthKey) || [];
    const stripeMonthRefunds = stripeRefundsByMonth.get(monthKey) || [];

    const gmTotal = gmMonthRefunds.reduce((s, r) => s + r.amount, 0);
    const stripeTotal = stripeMonthRefunds.reduce((s, r) => s + r.amount, 0);

    console.log(`\n${"=".repeat(80)}`);
    console.log(`MONTH: ${monthKey}`);
    console.log(`${"=".repeat(80)}`);
    console.log(`GymMaster: ${gmMonthRefunds.length} refunds, $${gmTotal.toFixed(2)}`);
    console.log(`Stripe: ${stripeMonthRefunds.length} refunds, $${stripeTotal.toFixed(2)}`);
    console.log(`Variance: $${Math.abs(gmTotal - stripeTotal).toFixed(2)}`);

    console.log(`\n--- GymMaster Refunds ---`);
    for (const r of gmMonthRefunds.sort((a, b) => a.date.localeCompare(b.date))) {
      console.log(`  ${r.date} | $${r.amount.toFixed(2).padStart(8)} | ${r.memberName.padEnd(25)} | Method: ${r.paymentMethod} | ${r.note.substring(0, 40)}`);
    }

    console.log(`\n--- Stripe Refunds ---`);
    for (const r of stripeMonthRefunds.sort((a, b) => a.date.localeCompare(b.date))) {
      console.log(`  ${r.date} | $${r.amount.toFixed(2).padStart(8)} | ${(r.billingName || "Unknown").padEnd(25)} | ${r.customerEmail || "no email"}`);
    }

    // Try to match refunds
    console.log(`\n--- Matching Analysis ---`);
    const unmatchedGM: GymMasterRefund[] = [];
    const matchedStripeIds = new Set<string>();

    for (const gmRef of gmMonthRefunds) {
      // Try to find a matching Stripe refund by amount and approximate date
      const potentialMatches = stripeMonthRefunds.filter(sr =>
        !matchedStripeIds.has(sr.id) &&
        Math.abs(sr.amount - gmRef.amount) < 0.02 // Allow 2 cent variance
      );

      if (potentialMatches.length === 1) {
        matchedStripeIds.add(potentialMatches[0]!.id);
        console.log(`  MATCHED: ${gmRef.memberName} ($${gmRef.amount}) <-> ${potentialMatches[0]!.billingName} ($${potentialMatches[0]!.amount})`);
      } else if (potentialMatches.length > 1) {
        // Try to match by name similarity
        const nameMatch = potentialMatches.find(sr => {
          const gmName = gmRef.memberName.toLowerCase();
          const stripeName = (sr.billingName || "").toLowerCase();
          return gmName.includes(stripeName.split(" ")[0] || "") || stripeName.includes(gmName.split(",")[0] || "");
        });

        if (nameMatch) {
          matchedStripeIds.add(nameMatch.id);
          console.log(`  MATCHED (by name): ${gmRef.memberName} ($${gmRef.amount}) <-> ${nameMatch.billingName} ($${nameMatch.amount})`);
        } else {
          unmatchedGM.push(gmRef);
        }
      } else {
        unmatchedGM.push(gmRef);
      }
    }

    const unmatchedStripe = stripeMonthRefunds.filter(sr => !matchedStripeIds.has(sr.id));

    if (unmatchedGM.length > 0) {
      console.log(`\n  UNMATCHED GymMaster refunds (${unmatchedGM.length}):`);
      for (const r of unmatchedGM) {
        console.log(`    - ${r.date} | $${r.amount.toFixed(2)} | ${r.memberName} | Method: ${r.paymentMethod} | ${r.note}`);
      }
    }

    if (unmatchedStripe.length > 0) {
      console.log(`\n  UNMATCHED Stripe refunds (${unmatchedStripe.length}):`);
      for (const r of unmatchedStripe) {
        console.log(`    - ${r.date} | $${r.amount.toFixed(2)} | ${r.billingName} | ${r.customerEmail}`);
      }
    }

    // Check payment methods of unmatched GM refunds
    const paymentMethodCounts: Record<string, number> = {};
    for (const r of unmatchedGM) {
      paymentMethodCounts[r.paymentMethod] = (paymentMethodCounts[r.paymentMethod] || 0) + 1;
    }
    if (Object.keys(paymentMethodCounts).length > 0) {
      console.log(`\n  Payment methods of unmatched GymMaster refunds:`);
      for (const [method, count] of Object.entries(paymentMethodCounts)) {
        console.log(`    - ${method}: ${count}`);
      }
    }
  }

  // Summary
  console.log(`\n${"=".repeat(80)}`);
  console.log("SUMMARY");
  console.log(`${"=".repeat(80)}`);

  // Check all unique payment methods in GymMaster
  const allPaymentMethods = new Set(gmRefunds.map(r => r.paymentMethod));
  console.log("\nAll payment methods found in GymMaster refunds:");
  for (const method of allPaymentMethods) {
    const count = gmRefunds.filter(r => r.paymentMethod === method).length;
    const total = gmRefunds.filter(r => r.paymentMethod === method).reduce((s, r) => s + r.amount, 0);
    console.log(`  - ${method}: ${count} refunds, $${total.toFixed(2)}`);
  }
}

investigate().catch(console.error);
