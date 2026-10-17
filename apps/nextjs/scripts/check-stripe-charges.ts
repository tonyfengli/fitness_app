/**
 * Check Stripe charges for specific members
 * Run: npx tsx scripts/check-stripe-charges.ts
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

async function check() {
  const namesToFind = ["atkins", "shanta", "martinez", "elisabeth"];

  console.log("Searching Stripe for charges matching these names...\n");

  // Search charges from 2026
  const startTimestamp = Math.floor(new Date("2026-01-01").getTime() / 1000);
  const endTimestamp = Math.floor(new Date("2026-12-31T23:59:59").getTime() / 1000);

  let hasMore = true;
  let startingAfter: string | undefined;
  let foundCharges: any[] = [];

  while (hasMore) {
    const response = await stripe.charges.list({
      created: { gte: startTimestamp, lte: endTimestamp },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const charge of response.data) {
      const billingName = (charge.billing_details?.name || "").toLowerCase();
      const email = (charge.receipt_email || charge.billing_details?.email || "").toLowerCase();

      const matches = namesToFind.some(name =>
        billingName.includes(name) || email.includes(name)
      );

      if (matches) {
        foundCharges.push({
          date: new Date(charge.created * 1000).toISOString().split("T")[0],
          amount: charge.amount / 100,
          name: charge.billing_details?.name || "Unknown",
          email: charge.receipt_email || charge.billing_details?.email || "No email",
          status: charge.status,
          refunded: charge.refunded,
          amountRefunded: charge.amount_refunded / 100,
        });
      }
    }

    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1]!.id;
    }
  }

  if (foundCharges.length === 0) {
    console.log("No Stripe charges found for Atkins/Shanta or Martinez/Elisabeth in 2026.");
    console.log("\nThis confirms these members are NOT being charged through Stripe.");
    console.log("Their 'Billing' payments go through a different processor (likely ACH/bank draft).");
  } else {
    console.log(`Found ${foundCharges.length} Stripe charges:\n`);
    foundCharges.sort((a, b) => a.date.localeCompare(b.date));

    for (const c of foundCharges) {
      console.log(`${c.date} | $${c.amount.toFixed(2).padStart(8)} | ${c.name.padEnd(25)} | ${c.status} | Refunded: ${c.refunded ? `$${c.amountRefunded}` : "No"}`);
    }
  }
}

check().catch(console.error);
