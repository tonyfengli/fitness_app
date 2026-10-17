/**
 * Trace Elisabeth's payments and refunds
 * Cross-reference GymMaster with Stripe
 * Run: npx tsx scripts/trace-elisabeth.ts
 */

import Stripe from "stripe";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

async function fetchGymMasterPayments(startDate: string, endDate: string) {
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

async function fetchStripeCharges(searchName: string, startDate: string, endDate: string) {
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

async function fetchStripeRefunds(searchName: string, startDate: string, endDate: string) {
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
      if (billingName.toLowerCase().includes(searchName.toLowerCase())) {
        refunds.push({
          id: refund.id,
          chargeId: charge?.id,
          date: new Date(refund.created * 1000).toISOString().split("T")[0],
          amount: refund.amount / 100,
          status: refund.status,
          billingName,
          reason: refund.reason,
          chargeDate: charge ? new Date(charge.created * 1000).toISOString().split("T")[0] : null,
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

async function main() {
  console.log("=".repeat(100));
  console.log("TRACING ELISABETH - GYMMASTER + STRIPE ANALYSIS");
  console.log("=".repeat(100));

  // First, find Elisabeth in GymMaster payments
  const gmPayments = await fetchGymMasterPayments("2026-05-01", "2026-10-31");

  // Find all payments containing "elisabeth" (case insensitive)
  const elisabethPayments = gmPayments.filter((p: any) =>
    String(p["Name"] || "").toLowerCase().includes("elisabeth")
  );

  if (elisabethPayments.length === 0) {
    console.log("No payments found for Elisabeth in GymMaster");
    return;
  }

  // Get member ID and name
  const memberId = elisabethPayments[0]["Member ID"];
  const memberName = elisabethPayments[0]["Name"];
  console.log(`\nFound: ${memberName} (ID: ${memberId})`);

  // Group payments by month
  const paymentsByMonth = new Map<string, any[]>();
  for (const p of elisabethPayments) {
    const dateStr = String(p["Payment Date"] || "");
    // Parse date - could be "Sep 5 2026" or "2026-09-05"
    let monthKey = "";
    if (dateStr.match(/^\d{4}-\d{2}/)) {
      monthKey = dateStr.substring(0, 7);
    } else {
      const months: Record<string, string> = {
        Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
        Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
      };
      const match = dateStr.match(/^(\w+)\s+\d+\s+(\d{4})$/);
      if (match) {
        const [, monthName, year] = match;
        const month = months[monthName!];
        if (month) monthKey = `${year}-${month}`;
      }
    }
    if (!monthKey) continue;

    if (!paymentsByMonth.has(monthKey)) {
      paymentsByMonth.set(monthKey, []);
    }
    paymentsByMonth.get(monthKey)!.push(p);
  }

  // Display GymMaster data
  console.log("\n" + "─".repeat(100));
  console.log("GYMMASTER PAYMENTS BY MONTH");
  console.log("─".repeat(100));

  const sortedMonths = [...paymentsByMonth.keys()].sort();
  for (const monthKey of sortedMonths) {
    const payments = paymentsByMonth.get(monthKey)!;
    console.log(`\n📅 ${monthKey}:`);

    let monthPaid = 0;
    let monthRefunded = 0;

    for (const p of payments) {
      const amount = parseFloat(String(p["Payment Amount"]).replace(/[$,]/g, ""));
      const method = String(p["Payment Method"] || "");
      const details = String(p["Payment Details"] || "");
      const date = String(p["Payment Date"] || "");

      const isManual = method.toLowerCase().includes("no payment") || method.toLowerCase().includes("adjustment");
      const isBilling = method.toLowerCase().includes("billing") || method.toLowerCase().includes("stripe");
      const icon = amount < 0 ? "🔴" : "🟢";
      const typeIcon = isManual ? "📝" : isBilling ? "💳" : "❓";

      console.log(`   ${icon} ${typeIcon} ${date}: $${amount.toFixed(2)}`);
      console.log(`      Method: ${method}`);
      if (details) console.log(`      Details: ${details}`);

      if (amount < 0) {
        monthRefunded += Math.abs(amount);
      } else {
        monthPaid += amount;
      }
    }

    console.log(`   ─────────────────`);
    console.log(`   Paid: $${monthPaid.toFixed(2)} | Refunded: $${monthRefunded.toFixed(2)} | Net: $${(monthPaid - monthRefunded).toFixed(2)}`);
  }

  // Now fetch Stripe data
  console.log("\n" + "─".repeat(100));
  console.log("STRIPE TRANSACTIONS (Source of Truth)");
  console.log("─".repeat(100));

  // Search by first name "Elisabeth"
  const stripeCharges = await fetchStripeCharges("elisabeth", "2026-05-01", "2026-10-31");
  const stripeRefunds = await fetchStripeRefunds("elisabeth", "2026-05-01", "2026-10-31");

  console.log("\n💳 STRIPE CHARGES:");
  if (stripeCharges.length === 0) {
    console.log("   No charges found for Elisabeth");
  } else {
    for (const c of stripeCharges) {
      console.log(`   ${c.date}: $${c.amount.toFixed(2)} - ${c.status}${c.refunded ? " (REFUNDED)" : ""}`);
      console.log(`      ID: ${c.id}`);
      console.log(`      Billing Name: ${c.billingName}`);
      if (c.amountRefunded > 0) {
        console.log(`      Amount Refunded: $${c.amountRefunded.toFixed(2)}`);
      }
    }
  }

  console.log("\n🔴 STRIPE REFUNDS:");
  if (stripeRefunds.length === 0) {
    console.log("   No refunds found for Elisabeth");
  } else {
    for (const r of stripeRefunds) {
      console.log(`   ${r.date}: $${r.amount.toFixed(2)} - ${r.status}`);
      console.log(`      Refund ID: ${r.id}`);
      console.log(`      Original Charge Date: ${r.chargeDate}`);
      console.log(`      Billing Name: ${r.billingName}`);
    }
  }

  // Focus on September
  console.log("\n" + "=".repeat(100));
  console.log("SEPTEMBER 2026 ANALYSIS");
  console.log("=".repeat(100));

  const sepPayments = paymentsByMonth.get("2026-09") || [];
  console.log("\n📋 GYMMASTER SEPTEMBER TRANSACTIONS:");

  for (const p of sepPayments) {
    const amount = parseFloat(String(p["Payment Amount"]).replace(/[$,]/g, ""));
    const method = String(p["Payment Method"] || "");
    const details = String(p["Payment Details"] || "");
    const date = String(p["Payment Date"] || "");
    const note = String(p["Payment Note"] || "");

    const isManual = method.toLowerCase().includes("no payment") || method.toLowerCase().includes("adjustment");
    const isBilling = method.toLowerCase().includes("billing") || method.toLowerCase().includes("stripe");

    console.log(`\n   ${amount < 0 ? "🔴" : "🟢"} ${date}: $${amount.toFixed(2)}`);
    console.log(`      Payment Method: ${method}`);
    console.log(`      Payment Details: ${details || "(none)"}`);
    console.log(`      Payment Note: ${note || "(none)"}`);
    console.log(`      Type: ${isManual ? "📝 MANUAL ADJUSTMENT" : isBilling ? "💳 STRIPE/BILLING" : "❓ UNKNOWN"}`);
  }

  // September Stripe data
  const sepStripeCharges = stripeCharges.filter(c => c.date.startsWith("2026-09"));
  const sepStripeRefunds = stripeRefunds.filter(r => r.date.startsWith("2026-09"));

  console.log("\n💳 STRIPE SEPTEMBER CHARGES:");
  if (sepStripeCharges.length === 0) {
    console.log("   No charges in September");
  } else {
    for (const c of sepStripeCharges) {
      console.log(`   ${c.date}: $${c.amount.toFixed(2)}`);
    }
  }

  console.log("\n🔴 STRIPE SEPTEMBER REFUNDS:");
  if (sepStripeRefunds.length === 0) {
    console.log("   No refunds in September");
  } else {
    for (const r of sepStripeRefunds) {
      console.log(`   ${r.date}: $${r.amount.toFixed(2)} (original charge: ${r.chargeDate})`);
    }
  }

  // Conclusion
  console.log("\n" + "=".repeat(100));
  console.log("CONCLUSION");
  console.log("=".repeat(100));

  const sepGmPaid = sepPayments.filter((p: any) => parseFloat(String(p["Payment Amount"]).replace(/[$,]/g, "")) > 0)
    .reduce((sum: number, p: any) => sum + parseFloat(String(p["Payment Amount"]).replace(/[$,]/g, "")), 0);
  const sepGmRefunded = sepPayments.filter((p: any) => parseFloat(String(p["Payment Amount"]).replace(/[$,]/g, "")) < 0)
    .reduce((sum: number, p: any) => sum + Math.abs(parseFloat(String(p["Payment Amount"]).replace(/[$,]/g, ""))), 0);

  const sepStripePaid = sepStripeCharges.reduce((sum, c) => sum + c.amount, 0);
  const sepStripeRefunded = sepStripeRefunds.reduce((sum, r) => sum + r.amount, 0);

  console.log(`\nGymMaster September: Paid $${sepGmPaid.toFixed(2)}, Refunded $${sepGmRefunded.toFixed(2)}, Net $${(sepGmPaid - sepGmRefunded).toFixed(2)}`);
  console.log(`Stripe September: Charged $${sepStripePaid.toFixed(2)}, Refunded $${sepStripeRefunded.toFixed(2)}, Net $${(sepStripePaid - sepStripeRefunded).toFixed(2)}`);

  // Check for manual adjustments
  const manualAdjustments = sepPayments.filter((p: any) => {
    const method = String(p["Payment Method"] || "").toLowerCase();
    return method.includes("no payment") || method.includes("adjustment");
  });

  if (manualAdjustments.length > 0) {
    console.log(`\n📝 MANUAL ADJUSTMENTS (not in Stripe):`);
    for (const adj of manualAdjustments) {
      const amount = parseFloat(String(adj["Payment Amount"]).replace(/[$,]/g, ""));
      console.log(`   ${adj["Payment Date"]}: $${amount.toFixed(2)} - ${adj["Payment Details"] || adj["Payment Note"] || "(no details)"}`);
    }
    console.log(`\n   → These are GymMaster-only entries, NOT actual Stripe transactions.`);
    console.log(`   → They represent manual credits/adjustments made by staff.`);
  }

  console.log("\n");
}

main().catch(console.error);
