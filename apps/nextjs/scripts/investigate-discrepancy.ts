import Stripe from "stripe";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

async function main() {
  // Look up the customer who had failed charges
  const customerId = "cus_Tg3qi5lroHPWz1";

  console.log("=== INVESTIGATING THE $110.97 FAILED CHARGE ===\n");

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    console.log("Customer was deleted");
  } else {
    console.log("Customer email:", customer.email);
    console.log("Customer name:", customer.name);
    console.log("Customer metadata:", customer.metadata);
  }

  // Check GymMaster for $110.97 on March 5
  console.log("\n\n=== CHECKING GYMMASTER FOR $110.97 ===\n");

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
      start_date: "2026-03-05",
      end_date: "2026-03-05",
    }),
  });

  const data = await response.json();
  const payments = data.result || [];

  console.log("GymMaster payments on March 5, 2026:");
  console.log("Total payments:", payments.length);

  // Look for $110.97 or close amounts
  const matching = payments.filter((p: any) => {
    const amt = parseFloat(String(p["Payment Amount"] || "0").replace(/[$,]/g, ""));
    return Math.abs(amt - 110.97) < 1 || Math.abs(amt - 101.97) < 1;
  });

  console.log("\nPayments around $101.97 or $110.97:");
  for (const p of matching) {
    const amt = parseFloat(String(p["Payment Amount"] || "0").replace(/[$,]/g, ""));
    console.log(`  ${p["Name"]}: $${amt.toFixed(2)} (${p["Payment Method"]})`);
  }

  // Also show ALL payments to see the full picture
  console.log("\n\n=== ALL MARCH 5 PAYMENTS ===");
  for (const p of payments) {
    const amt = parseFloat(String(p["Payment Amount"] || "0").replace(/[$,]/g, ""));
    const method = p["Payment Method"];
    if (method?.toLowerCase().includes("billing") || method?.toLowerCase().includes("stripe")) {
      console.log(`  ${p["Name"]}: $${amt.toFixed(2)} (${method})`);
    }
  }

  // Check if $101.97 members have any Stripe customer record
  console.log("\n\n=== SEARCHING STRIPE FOR PARK, SHARON ===");
  const search1 = await stripe.customers.search({
    query: 'name~"Park" OR email~"park"',
    limit: 5,
  });
  for (const c of search1.data) {
    console.log(`  ${c.name} - ${c.email} (${c.id})`);
  }

  console.log("\n=== SEARCHING STRIPE FOR RODRIGUEZ, MELISSA ===");
  const search2 = await stripe.customers.search({
    query: 'name~"Rodriguez" OR email~"rodriguez"',
    limit: 5,
  });
  for (const c of search2.data) {
    console.log(`  ${c.name} - ${c.email} (${c.id})`);
  }
}

main().catch(console.error);
