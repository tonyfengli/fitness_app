/**
 * Check what payment methods exist and which ones are in Stripe
 * Run: npx tsx scripts/check-billing-methods.ts
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

async function check() {
  console.log("Analyzing GymMaster 'Billing' payments vs Stripe...\n");

  const gmPayments = await fetchGymMasterPayments("2026-09-01", "2026-09-30");

  // Get all unique member names with "Billing" payment method
  const billingMembers = new Map<string, { charges: number; total: number }>();

  for (const p of gmPayments) {
    const method = String(p["Payment Method"] || "");
    if (!method.toLowerCase().includes("billing")) continue;

    const name = String(p["Name"] || "").toLowerCase().trim();
    const amount = parseAmount(p["Payment Amount"]);

    if (amount <= 0) continue; // Skip refunds

    if (!billingMembers.has(name)) {
      billingMembers.set(name, { charges: 0, total: 0 });
    }
    const m = billingMembers.get(name)!;
    m.charges++;
    m.total += amount;
  }

  // Now check which of these are in Stripe
  const startTimestamp = Math.floor(new Date("2026-09-01").getTime() / 1000);
  const endTimestamp = Math.floor(new Date("2026-09-30T23:59:59").getTime() / 1000);

  const stripeNames = new Set<string>();

  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await stripe.charges.list({
      created: { gte: startTimestamp, lte: endTimestamp },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const charge of response.data) {
      const name = (charge.billing_details?.name || "").toLowerCase().trim();
      if (name) stripeNames.add(name);
    }

    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1]!.id;
    }
  }

  // Compare
  const inStripe: string[] = [];
  const notInStripe: string[] = [];

  for (const [name, stats] of billingMembers) {
    // Check if any part of the name matches
    const isInStripe = Array.from(stripeNames).some(stripeName => {
      const gmParts = name.split(/[,\s]+/).filter(p => p.length > 2);
      const stripeParts = stripeName.split(/[,\s]+/).filter(p => p.length > 2);
      return gmParts.some(gp => stripeParts.some(sp => sp.includes(gp) || gp.includes(sp)));
    });

    if (isInStripe) {
      inStripe.push(name);
    } else {
      notInStripe.push(`${name} (${stats.charges} charges, $${stats.total.toFixed(2)})`);
    }
  }

  console.log(`Total GymMaster 'Billing' members in Sep 2026: ${billingMembers.size}`);
  console.log(`  - Found in Stripe: ${inStripe.length}`);
  console.log(`  - NOT in Stripe: ${notInStripe.length}`);

  if (notInStripe.length > 0 && notInStripe.length <= 20) {
    console.log("\nMembers with 'Billing' charges NOT in Stripe:");
    for (const name of notInStripe) {
      console.log(`  - ${name}`);
    }
  }
}

check().catch(console.error);
