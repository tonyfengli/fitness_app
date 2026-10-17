import Stripe from "stripe";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

async function main() {
  const startTimestamp = Math.floor(new Date("2026-03-01").getTime() / 1000);
  const endTimestamp = Math.floor(new Date("2026-03-31T23:59:59").getTime() / 1000);

  console.log("Checking Stripe for failed charges in March 2026...\n");

  // Get all charges (including failed)
  const charges = await stripe.charges.list({
    created: { gte: startTimestamp, lte: endTimestamp },
    limit: 100,
  });

  const failed = charges.data.filter(c => c.status === "failed" || c.paid === false);

  console.log("Total charges found:", charges.data.length);
  console.log("Failed/unpaid charges found:", failed.length);

  if (failed.length > 0) {
    console.log("\n=== FAILED CHARGES ===");
    for (const c of failed) {
      console.log(`\nDate: ${new Date(c.created * 1000).toISOString().split("T")[0]}`);
      console.log(`Amount: $${(c.amount / 100).toFixed(2)}`);
      console.log(`Status: ${c.status}`);
      console.log(`Failure: ${c.failure_message || c.outcome?.reason || "unknown"}`);
      console.log(`Customer: ${c.customer || "N/A"}`);
    }
  } else {
    console.log("\n>>> No failed charges found in Stripe for this period.");
    console.log(">>> This means the $203.94 discrepancy is NOT from failed Stripe charges.");
    console.log(">>> The payments were likely never SENT to Stripe in the first place.");
  }

  // Also check for payment intents that failed
  console.log("\n\nChecking PaymentIntents...");
  const intents = await stripe.paymentIntents.list({
    created: { gte: startTimestamp, lte: endTimestamp },
    limit: 100,
  });

  const failedIntents = intents.data.filter(pi =>
    pi.status === "requires_payment_method" ||
    pi.status === "canceled" ||
    pi.last_payment_error
  );

  console.log("Total PaymentIntents:", intents.data.length);
  console.log("Failed/incomplete:", failedIntents.length);

  if (failedIntents.length > 0) {
    console.log("\n=== FAILED PAYMENT INTENTS ===");
    for (const pi of failedIntents) {
      console.log(`\nDate: ${new Date(pi.created * 1000).toISOString().split("T")[0]}`);
      console.log(`Amount: $${(pi.amount / 100).toFixed(2)}`);
      console.log(`Status: ${pi.status}`);
      console.log(`Error: ${pi.last_payment_error?.message || "N/A"}`);
    }
  }
}

main().catch(console.error);
