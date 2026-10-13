/**
 * Verify if Payment Details can predict Stripe vs non-Stripe refunds
 * Run: npx tsx scripts/verify-refund-patterns.ts
 */

import Stripe from "stripe";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
      report_id: 103,
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

async function verify() {
  console.log("Fetching 2026 data from both GymMaster and Stripe...\n");

  // Fetch GymMaster refunds
  const gmPayments = await fetchGymMasterPayments("2026-01-01", "2026-12-31");
  const gmRefunds = gmPayments.filter(p => {
    const amount = parseAmount(p["Payment Amount"]);
    const details = String(p["Payment Details"] || "").toLowerCase();
    return amount < 0 && details.includes("refund");
  });

  // Fetch Stripe refunds
  const startTimestamp = Math.floor(new Date("2026-01-01").getTime() / 1000);
  const endTimestamp = Math.floor(new Date("2026-12-31T23:59:59").getTime() / 1000);

  const stripeRefunds: Array<{ date: string; amount: number; name: string }> = [];
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
      stripeRefunds.push({
        date: new Date(refund.created * 1000).toISOString().split("T")[0]!,
        amount: refund.amount / 100,
        name: charge?.billing_details?.name || "Unknown",
      });
    }

    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1]!.id;
    }
  }

  console.log(`GymMaster refunds: ${gmRefunds.length}`);
  console.log(`Stripe refunds: ${stripeRefunds.length}\n`);

  // Group GymMaster refunds by Payment Details
  const byDetails: Map<string, Array<{
    name: string;
    amount: number;
    date: string;
    method: string;
    matchedStripe: boolean;
  }>> = new Map();

  for (const gm of gmRefunds) {
    const details = String(gm["Payment Details"] || "Unknown");
    const amount = Math.abs(parseAmount(gm["Payment Amount"]));
    const name = String(gm["Name"] || "");
    const date = new Date(gm["Payment Date"]).toISOString().split("T")[0] || "";
    const method = String(gm["Payment Method"] || "");

    // Try to find matching Stripe refund (by amount, within 2 cents)
    const stripeMatch = stripeRefunds.find(sr => Math.abs(sr.amount - amount) < 0.02);
    const matchedStripe = !!stripeMatch;

    // If matched, remove from stripeRefunds to prevent double matching
    if (stripeMatch) {
      const idx = stripeRefunds.indexOf(stripeMatch);
      stripeRefunds.splice(idx, 1);
    }

    if (!byDetails.has(details)) {
      byDetails.set(details, []);
    }
    byDetails.get(details)!.push({ name, amount, date, method, matchedStripe });
  }

  // Report results
  console.log("=".repeat(80));
  console.log("RESULTS: GymMaster Payment Details vs Stripe Match Rate");
  console.log("=".repeat(80));

  for (const [details, refunds] of byDetails) {
    const matched = refunds.filter(r => r.matchedStripe).length;
    const total = refunds.length;
    const matchRate = ((matched / total) * 100).toFixed(1);

    console.log(`\n"${details}":`);
    console.log(`  Total: ${total} refunds`);
    console.log(`  Matched to Stripe: ${matched} (${matchRate}%)`);
    console.log(`  NOT matched: ${total - matched}`);

    // Show payment methods breakdown
    const methodCounts: Record<string, { matched: number; unmatched: number }> = {};
    for (const r of refunds) {
      if (!methodCounts[r.method]) methodCounts[r.method] = { matched: 0, unmatched: 0 };
      if (r.matchedStripe) methodCounts[r.method].matched++;
      else methodCounts[r.method].unmatched++;
    }
    console.log(`  By Payment Method:`);
    for (const [method, counts] of Object.entries(methodCounts)) {
      console.log(`    "${method}": ${counts.matched} matched, ${counts.unmatched} unmatched`);
    }

    // Show unmatched examples
    const unmatched = refunds.filter(r => !r.matchedStripe);
    if (unmatched.length > 0 && unmatched.length <= 5) {
      console.log(`  Unmatched examples:`);
      for (const r of unmatched) {
        console.log(`    - ${r.name} | $${r.amount.toFixed(2)} | ${r.date} | ${r.method}`);
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));

  let totalMatched = 0;
  let totalUnmatched = 0;
  for (const [details, refunds] of byDetails) {
    const matched = refunds.filter(r => r.matchedStripe).length;
    totalMatched += matched;
    totalUnmatched += refunds.length - matched;
  }

  console.log(`\nTotal GymMaster refunds: ${totalMatched + totalUnmatched}`);
  console.log(`Matched to Stripe: ${totalMatched}`);
  console.log(`NOT matched (GymMaster only): ${totalUnmatched}`);
  console.log(`Remaining unmatched Stripe refunds: ${stripeRefunds.length}`);

  if (stripeRefunds.length > 0) {
    console.log(`\nUnmatched Stripe refunds:`);
    for (const sr of stripeRefunds.slice(0, 10)) {
      console.log(`  - ${sr.name} | $${sr.amount.toFixed(2)} | ${sr.date}`);
    }
  }
}

verify().catch(console.error);
