/**
 * Final Revenue Reconciliation
 * Properly accounts for refunds
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

async function reconcileMonth(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "short" });

  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  // Fetch GymMaster
  const gmPayments = await fetchGymMasterBilling(startDate, endDate);

  let gmGross = 0;
  let gmRefunds = 0;

  for (const p of gmPayments) {
    const amt = parseFloat(String(p["Payment Amount"] || "0").replace(/[$,]/g, ""));
    const method = String(p["Payment Method"] || "").toLowerCase();

    if (method.includes("billing") || method.includes("stripe") || method.includes("online")) {
      if (amt >= 0) {
        gmGross += amt;
      } else {
        gmRefunds += Math.abs(amt);
      }
    }
  }

  // Fetch Stripe successful charges
  const charges = await stripe.charges.list({
    created: { gte: startTs, lte: endTs },
    limit: 100,
  });

  const successful = charges.data.filter(c => c.status === "succeeded" && c.paid);
  const stripeGross = successful.reduce((s, c) => s + c.amount / 100, 0);

  // Fetch Stripe refunds
  const refunds = await stripe.refunds.list({
    created: { gte: startTs, lte: endTs },
    limit: 100,
  });
  const stripeRefunds = refunds.data.reduce((s, r) => s + r.amount / 100, 0);

  // Compare
  const grossVariance = gmGross - stripeGross;
  const refundVariance = gmRefunds - stripeRefunds;
  const netVariance = (gmGross - gmRefunds) - (stripeGross - stripeRefunds);

  return {
    month: `${monthName} ${year}`,
    gmGross,
    gmRefunds,
    gmNet: gmGross - gmRefunds,
    stripeGross,
    stripeRefunds,
    stripeNet: stripeGross - stripeRefunds,
    grossVariance,
    refundVariance,
    netVariance,
    isReconciled: Math.abs(grossVariance) < 1,
  };
}

async function main() {
  console.log(`\n${"=".repeat(90)}`);
  console.log(`GYMMASTER vs STRIPE RECONCILIATION`);
  console.log(`${"=".repeat(90)}\n`);

  console.log(`Month       │ GM Gross   │ GM Refund │ GM Net     │ Stripe Gross │ Stripe Ref │ Variance │ Status`);
  console.log(`${"─".repeat(90)}`);

  for (let month = 1; month <= 10; month++) {
    const r = await reconcileMonth(2026, month);

    const status = r.isReconciled ? "✓" : `$${r.grossVariance.toFixed(0)} off`;
    console.log(
      `${r.month.padEnd(11)} │ ` +
      `$${r.gmGross.toFixed(2).padStart(9)} │ ` +
      `$${r.gmRefunds.toFixed(2).padStart(8)} │ ` +
      `$${r.gmNet.toFixed(2).padStart(9)} │ ` +
      `$${r.stripeGross.toFixed(2).padStart(11)} │ ` +
      `$${r.stripeRefunds.toFixed(2).padStart(9)} │ ` +
      `$${r.grossVariance.toFixed(2).padStart(7)} │ ` +
      status
    );
  }

  console.log(`${"─".repeat(90)}`);
  console.log(`\nNote: Variance should be ~$0. Small variances may be timing differences.`);
  console.log(`Large variances indicate charges recorded in GymMaster but not processed by Stripe.\n`);
}

main().catch(console.error);
