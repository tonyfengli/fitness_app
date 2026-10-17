/**
 * Manual Reconciliation Script
 * Fetches raw data from GymMaster and Stripe to manually trace reconciliation
 */

import Stripe from "stripe";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env.local from nextjs app
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia" as any,
});

interface GymMasterPayment {
  date: string;
  memberId: string;
  memberName: string;
  amount: number;
  paymentMethod: string;
}

interface StripeTransaction {
  id: string;
  type: string;
  created: string;
  availableOn: string;
  amount: number;
  fee: number;
  net: number;
  description: string;
}

async function fetchGymMasterPayments(startDate: string, endDate: string): Promise<GymMasterPayment[]> {
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
  const payments: GymMasterPayment[] = [];

  for (const row of data.result || []) {
    const amount = parseFloat(String(row["Payment Amount"] || "0").replace(/[$,]/g, ""));
    const paymentMethod = String(row["Payment Method"] || "Unknown");
    const dateStr = String(row["Payment Date"] || "");

    // Parse date
    let date = "";
    try {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        date = parsed.toISOString().split("T")[0]!;
      }
    } catch {}

    // Only include Stripe payments (Billing or Online Payment)
    const isStripe = paymentMethod.toLowerCase().includes("stripe") ||
                     paymentMethod.toLowerCase().includes("online payment") ||
                     paymentMethod.toLowerCase() === "billing";

    if (isStripe && date) {
      payments.push({
        date,
        memberId: String(row["Member ID"] || ""),
        memberName: String(row["Name"] || ""),
        amount,
        paymentMethod,
      });
    }
  }

  return payments.sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount);
}

async function fetchStripeTransactions(startDate: string, endDate: string): Promise<StripeTransaction[]> {
  const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  const transactions: StripeTransaction[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await stripe.balanceTransactions.list({
      created: { gte: startTimestamp, lte: endTimestamp },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const tx of response.data) {
      if (tx.type === "charge" || tx.type === "refund") {
        transactions.push({
          id: tx.id,
          type: tx.type,
          created: new Date(tx.created * 1000).toISOString().split("T")[0]!,
          availableOn: new Date(tx.available_on * 1000).toISOString().split("T")[0]!,
          amount: tx.amount / 100,
          fee: tx.fee / 100,
          net: tx.net / 100,
          description: tx.description || "",
        });
      }
    }

    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1]!.id;
    }
  }

  return transactions.sort((a, b) => a.created.localeCompare(b.created) || a.amount - b.amount);
}

async function fetchStripePayouts(startDate: string, endDate: string) {
  const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  const payouts: Array<{ id: string; arrivalDate: string; amount: number }> = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await stripe.payouts.list({
      arrival_date: { gte: startTimestamp, lte: endTimestamp },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const p of response.data) {
      payouts.push({
        id: p.id,
        arrivalDate: new Date(p.arrival_date * 1000).toISOString().split("T")[0]!,
        amount: p.amount / 100,
      });
    }

    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1]!.id;
    }
  }

  return payouts.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
}

async function fetchMemberDetails(memberIds: string[]): Promise<Map<string, string>> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_API_KEY;

  const names = new Map<string, string>();

  for (const id of memberIds) {
    try {
      // Try multiple API formats
      const response = await fetch(`${baseUrl}/api/v1/members/${id}`, {
        headers: {
          Accept: "application/json",
          "X-API-KEY": apiKey!,
        },
      });
      const data = await response.json();
      if (data.firstname || data.lastname) {
        names.set(id, `${data.firstname || ''} ${data.lastname || ''}`.trim());
      } else if (data.result && data.result.firstname) {
        names.set(id, `${data.result.firstname || ''} ${data.result.lastname || ''}`.trim());
      }
    } catch {
      // ignore
    }
  }

  return names;
}

// Fetch all payments including member names directly from the raw API
async function fetchGymMasterPaymentsWithNames(startDate: string, endDate: string): Promise<Record<string, unknown>[]> {
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

async function main() {
  // Include February to capture cross-month payouts
  const startDate = "2026-02-01";
  const endDate = "2026-03-31";

  console.log(`\n${"=".repeat(80)}`);
  console.log(`MANUAL RECONCILIATION: ${startDate} to ${endDate}`);
  console.log("=".repeat(80));

  // Fetch all data (Feb+Mar for everything)
  const [gmPayments, stripeTxns, stripePayouts, rawGmPayments] = await Promise.all([
    fetchGymMasterPayments(startDate, endDate),
    fetchStripeTransactions(startDate, endDate),
    fetchStripePayouts(startDate, endDate), // Feb+March payouts
    fetchGymMasterPaymentsWithNames(startDate, endDate),
  ]);

  // Debug: Show raw field names from first payment
  if (rawGmPayments.length > 0) {
    console.log("\nGymMaster payment fields:", Object.keys(rawGmPayments[0]).join(", "));
  }

  const stripeCharges = stripeTxns.filter(t => t.type === "charge");
  const stripeRefunds = stripeTxns.filter(t => t.type === "refund");

  // ============ DEEP DIVE: MARCH 5 ============
  console.log(`\n${"─".repeat(80)}`);
  console.log("DEEP DIVE: March 5, 2026 (biggest variance)");
  console.log("─".repeat(80));

  const gmMarch5 = gmPayments.filter(p => p.date === "2026-03-05");
  const stripeMarch5 = stripeCharges.filter(c => c.created === "2026-03-05");

  console.log(`\nGYMMASTER MARCH 5 (${gmMarch5.length} payments, $${gmMarch5.reduce((s, p) => s + p.amount, 0).toFixed(2)}):`);
  const gmAmounts = gmMarch5.map(p => p.amount).sort((a, b) => a - b);
  console.log("Amounts:", gmAmounts.map(a => a.toFixed(2)).join(", "));

  console.log(`\nSTRIPE MARCH 5 (${stripeMarch5.length} charges, $${stripeMarch5.reduce((s, c) => s + c.amount, 0).toFixed(2)}):`);
  const stripeAmounts = stripeMarch5.map(c => c.amount).sort((a, b) => a - b);
  console.log("Amounts:", stripeAmounts.map(a => a.toFixed(2)).join(", "));

  // Find amounts in GM but not in Stripe
  const gmAmountsCopy = [...gmAmounts];
  const stripeAmountsCopy = [...stripeAmounts];

  const matched: number[] = [];
  const gmUnmatched: number[] = [];
  const stripeUnmatched: number[] = [];

  for (const gmAmt of gmAmountsCopy) {
    const idx = stripeAmountsCopy.findIndex(s => Math.abs(s - gmAmt) < 0.01);
    if (idx >= 0) {
      matched.push(gmAmt);
      stripeAmountsCopy.splice(idx, 1);
    } else {
      gmUnmatched.push(gmAmt);
    }
  }
  stripeUnmatched.push(...stripeAmountsCopy);

  console.log(`\nMATCHED (${matched.length}): ${matched.map(a => a.toFixed(2)).join(", ")}`);
  console.log(`GM UNMATCHED (${gmUnmatched.length}): ${gmUnmatched.map(a => a.toFixed(2)).join(", ")}`);
  console.log(`STRIPE UNMATCHED (${stripeUnmatched.length}): ${stripeUnmatched.map(a => a.toFixed(2)).join(", ")}`);

  // Check if unmatched amounts combine
  const gmUnmatchedTotal = gmUnmatched.reduce((s, a) => s + a, 0);
  const stripeUnmatchedTotal = stripeUnmatched.reduce((s, a) => s + a, 0);
  console.log(`\nGM Unmatched Total: $${gmUnmatchedTotal.toFixed(2)}`);
  console.log(`Stripe Unmatched Total: $${stripeUnmatchedTotal.toFixed(2)}`);
  console.log(`Difference: $${(gmUnmatchedTotal - stripeUnmatchedTotal).toFixed(2)}`);

  // Show WHO these unmatched GM payments are from
  console.log(`\n--- WHO ARE THE UNMATCHED GM PAYMENTS? ---`);
  const gmAmountsWithNames = gmMarch5.map(p => ({ amount: p.amount, name: p.memberName, id: p.memberId }));
  const stripeAmountsCopy2 = [...stripeAmounts];

  for (const gm of gmAmountsWithNames) {
    const idx = stripeAmountsCopy2.findIndex(s => Math.abs(s - gm.amount) < 0.01);
    if (idx >= 0) {
      stripeAmountsCopy2.splice(idx, 1);
    } else {
      console.log(`  $${gm.amount.toFixed(2).padStart(8)} - ${gm.name || 'Unknown'} (ID: ${gm.id})`);
    }
  }

  // Identify truly failed charges by member
  console.log(`\n--- ANALYZING FAILED CHARGES BY MEMBER ---`);

  // Group GM payments by member
  const gmByMember = new Map<string, { name: string; payments: number[]; total: number }>();
  for (const p of gmMarch5) {
    if (!gmByMember.has(p.memberId)) {
      gmByMember.set(p.memberId, { name: p.memberName, payments: [], total: 0 });
    }
    const member = gmByMember.get(p.memberId)!;
    member.payments.push(p.amount);
    member.total += p.amount;
  }

  // Check which member totals appear in Stripe
  const stripeAmountsForMatching = stripeAmounts.slice();
  const failedMembers: Array<{ id: string; name: string; total: number; payments: number[] }> = [];
  const matchedMembers: Array<{ id: string; name: string; total: number; stripeMatch: number }> = [];

  for (const [memberId, data] of gmByMember.entries()) {
    // Check if member's total matches a Stripe charge (could be batched)
    const idx = stripeAmountsForMatching.findIndex(s => Math.abs(s - data.total) < 0.01);
    if (idx >= 0) {
      matchedMembers.push({ id: memberId, name: data.name, total: data.total, stripeMatch: stripeAmountsForMatching[idx] });
      stripeAmountsForMatching.splice(idx, 1);
    } else {
      // Check if each individual payment matches
      let allFound = true;
      const tempStripe = stripeAmountsForMatching.slice();
      for (const amt of data.payments) {
        const pIdx = tempStripe.findIndex(s => Math.abs(s - amt) < 0.01);
        if (pIdx >= 0) {
          tempStripe.splice(pIdx, 1);
        } else {
          allFound = false;
          break;
        }
      }
      if (allFound) {
        // All individual payments found
        for (const amt of data.payments) {
          const pIdx = stripeAmountsForMatching.findIndex(s => Math.abs(s - amt) < 0.01);
          if (pIdx >= 0) stripeAmountsForMatching.splice(pIdx, 1);
        }
        matchedMembers.push({ id: memberId, name: data.name, total: data.total, stripeMatch: data.total });
      } else {
        failedMembers.push({ id: memberId, name: data.name, total: data.total, payments: data.payments });
      }
    }
  }

  // Get member names from raw payments data
  const memberNames = new Map<string, string>();
  for (const raw of rawGmPayments) {
    const memberId = String(raw["Member ID"] || "");
    const name = String(raw["Name"] || "");
    if (memberId && name) {
      memberNames.set(memberId, name);
    }
  }
  console.log(`\nFound names for ${memberNames.size} members from payment records`);

  console.log(`\n${"=".repeat(60)}`);
  console.log("FAILED CHARGES - MEMBERS WHO OWE MONEY");
  console.log("=".repeat(60));

  let totalFailed = 0;
  for (const member of failedMembers) {
    const name = memberNames.get(member.id) || member.name || `Member #${member.id}`;
    console.log(`\n  ${name} (ID: ${member.id})`);
    console.log(`    Total owed: $${member.total.toFixed(2)}`);
    console.log(`    Line items: ${member.payments.map(p => `$${p.toFixed(2)}`).join(' + ')}`);
    totalFailed += member.total;
  }

  // Check for combined Stripe charges and timing differences
  console.log(`\n--- VERIFYING AGAINST UNMATCHED STRIPE CHARGES ---`);
  console.log(`Unmatched Stripe charges: ${stripeAmountsForMatching.map(a => `$${a.toFixed(2)}`).join(', ')}`);

  const trulyFailed: typeof failedMembers = [];
  const actuallyPaid: Array<{ members: string[]; stripeAmount: number }> = [];

  // Check each failed member
  for (const member of failedMembers) {
    // Check if their amount appears on adjacent days in Stripe
    const stripeOnOtherDays = stripeCharges.find(c =>
      ["2026-03-03", "2026-03-04", "2026-03-06", "2026-03-07"].includes(c.created) &&
      Math.abs(c.amount - member.total) < 0.01
    );
    if (stripeOnOtherDays) {
      const name = memberNames.get(member.id) || member.id;
      console.log(`  ${name}: $${member.total.toFixed(2)} found on ${stripeOnOtherDays.created} - TIMING DIFFERENCE, NOT FAILED`);
      continue;
    }
    trulyFailed.push(member);
  }

  // Check if pairs of truly failed amounts combine to match a Stripe charge
  const accounted: Set<string> = new Set();
  for (const stripeAmt of stripeAmountsForMatching) {
    for (let i = 0; i < trulyFailed.length; i++) {
      if (accounted.has(trulyFailed[i].id)) continue;
      for (let j = i + 1; j < trulyFailed.length; j++) {
        if (accounted.has(trulyFailed[j].id)) continue;
        const combined = trulyFailed[i].total + trulyFailed[j].total;
        if (Math.abs(combined - stripeAmt) < 0.01) {
          const name1 = memberNames.get(trulyFailed[i].id) || trulyFailed[i].id;
          const name2 = memberNames.get(trulyFailed[j].id) || trulyFailed[j].id;
          console.log(`  $${stripeAmt.toFixed(2)} = ${name1} + ${name2} - COMBINED CHARGE, ACTUALLY PAID`);
          accounted.add(trulyFailed[i].id);
          accounted.add(trulyFailed[j].id);
        }
      }
    }
  }

  // Final list of truly failed
  const finalFailed = trulyFailed.filter(m => !accounted.has(m.id));

  console.log(`\n${"=".repeat(60)}`);
  console.log("TRULY FAILED CHARGES - MEMBERS WHO OWE MONEY");
  console.log("=".repeat(60));

  let actualUncollected = 0;
  if (finalFailed.length === 0) {
    console.log("\n  No truly failed charges found! All payments accounted for.");
  } else {
    for (const member of finalFailed) {
      const name = memberNames.get(member.id) || `Member #${member.id}`;
      console.log(`\n  ${name} (ID: ${member.id})`);
      console.log(`    Amount owed: $${member.total.toFixed(2)}`);
      actualUncollected += member.total;
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`ACTUAL UNCOLLECTED REVENUE (March 5): $${actualUncollected.toFixed(2)}`);
  console.log("─".repeat(60));

  // Check if these members also failed in February
  console.log(`\n--- CHECKING IF SAME MEMBERS FAILED IN FEBRUARY ---`);
  const failedMemberIds = finalFailed.map(m => m.id);
  const gmFeb5 = gmPayments.filter(p => p.date === "2026-02-05");
  const stripeFeb5 = stripeCharges.filter(c => c.created === "2026-02-05");

  for (const memberId of failedMemberIds) {
    const memberPayments = gmFeb5.filter(p => p.memberId === memberId);
    const memberTotal = memberPayments.reduce((s, p) => s + p.amount, 0);
    const name = memberNames.get(memberId) || memberId;

    if (memberPayments.length > 0) {
      // Check if this amount is in Stripe
      const inStripe = stripeFeb5.find(c => Math.abs(c.amount - memberTotal) < 0.01);
      if (inStripe) {
        console.log(`  ${name}: Paid in Feb ($${memberTotal.toFixed(2)})`);
      } else {
        console.log(`  ${name}: ALSO FAILED IN FEB ($${memberTotal.toFixed(2)}) - RECURRING ISSUE!`);
      }
    } else {
      console.log(`  ${name}: No Feb 5 payment found (may be new member)`);
    }
  }

  // ============ REFUNDS ============
  console.log(`\n${"─".repeat(80)}`);
  console.log("REFUNDS");
  console.log("─".repeat(80));

  console.log(`\nGYMMASTER REFUNDS (negative amounts):`);
  const gmRefunds = gmPayments.filter(p => p.amount < 0);
  for (const r of gmRefunds) {
    console.log(`  ${r.date}: $${r.amount.toFixed(2)} - ${r.memberName}`);
  }

  console.log(`\nSTRIPE REFUNDS:`);
  for (const r of stripeRefunds) {
    console.log(`  ${r.created}: $${r.amount.toFixed(2)} (avail: ${r.availableOn})`);
  }

  // ============ FULL PERIOD SUMMARY ============
  console.log(`\n${"─".repeat(80)}`);
  console.log("FULL PERIOD SUMMARY (Feb + March)");
  console.log("─".repeat(80));

  const gmTotal = gmPayments.reduce((s, p) => s + p.amount, 0);
  const stripeGross = stripeCharges.reduce((s, c) => s + c.amount, 0);
  const stripeFees = stripeCharges.reduce((s, c) => s + c.fee, 0);
  const stripeRefundTotal = stripeRefunds.reduce((s, r) => s + Math.abs(r.amount), 0);
  const payoutTotal = stripePayouts.reduce((s, p) => s + p.amount, 0);

  // March-only totals
  const gmMarchOnly = gmPayments.filter(p => p.date.startsWith("2026-03"));
  const stripeMarchOnly = stripeCharges.filter(c => c.created.startsWith("2026-03"));
  const gmMarchTotal = gmMarchOnly.reduce((s, p) => s + p.amount, 0);
  const stripeMarchGross = stripeMarchOnly.reduce((s, c) => s + c.amount, 0);

  console.log(`\nFEB+MARCH COMBINED:`);
  console.log(`  GymMaster Payments:     $${gmTotal.toFixed(2)} (${gmPayments.length} transactions)`);
  console.log(`  Stripe Gross Charges:   $${stripeGross.toFixed(2)} (${stripeCharges.length} charges)`);
  console.log(`  Stripe Fees:            $${stripeFees.toFixed(2)}`);
  console.log(`  Stripe Refunds:         $${stripeRefundTotal.toFixed(2)} (${stripeRefunds.length} refunds)`);
  console.log(`  Stripe Net:             $${(stripeGross - stripeFees - stripeRefundTotal).toFixed(2)}`);

  console.log(`\nMARCH ONLY:`);
  console.log(`  GymMaster Payments:     $${gmMarchTotal.toFixed(2)} (${gmMarchOnly.length} transactions)`);
  console.log(`  Stripe Gross Charges:   $${stripeMarchGross.toFixed(2)} (${stripeMarchOnly.length} charges)`);
  console.log(`  March Payouts:          $${payoutTotal.toFixed(2)} (${stripePayouts.length} payouts)`);

  console.log(`\n${"─".repeat(80)}`);
  console.log("DATE-BY-DATE MATCHING");
  console.log("─".repeat(80));

  // Group by date
  const gmByDate = new Map<string, number>();
  for (const p of gmPayments) {
    gmByDate.set(p.date, (gmByDate.get(p.date) || 0) + p.amount);
  }

  const stripeByDate = new Map<string, { gross: number; refunds: number }>();
  for (const c of stripeCharges) {
    if (!stripeByDate.has(c.created)) stripeByDate.set(c.created, { gross: 0, refunds: 0 });
    stripeByDate.get(c.created)!.gross += c.amount;
  }
  for (const r of stripeRefunds) {
    if (!stripeByDate.has(r.created)) stripeByDate.set(r.created, { gross: 0, refunds: 0 });
    stripeByDate.get(r.created)!.refunds += Math.abs(r.amount);
  }

  const allDates = new Set([...gmByDate.keys(), ...stripeByDate.keys()]);
  for (const date of [...allDates].sort()) {
    const gmAmt = gmByDate.get(date) || 0;
    const stripeData = stripeByDate.get(date) || { gross: 0, refunds: 0 };
    const stripeNet = stripeData.gross - stripeData.refunds;
    const diff = gmAmt - stripeNet;
    const status = Math.abs(diff) < 0.01 ? "✓" : diff > 0 ? "GM+" : "S+";

    if (stripeData.refunds > 0) {
      console.log(`${date}: GM $${gmAmt.toFixed(2).padStart(8)} | Stripe $${stripeData.gross.toFixed(2).padStart(8)} - $${stripeData.refunds.toFixed(2)} refund = $${stripeNet.toFixed(2).padStart(8)} | Diff: $${diff.toFixed(2).padStart(8)} ${status}`);
    } else {
      console.log(`${date}: GM $${gmAmt.toFixed(2).padStart(8)} | Stripe $${stripeData.gross.toFixed(2).padStart(8)} | Diff: $${diff.toFixed(2).padStart(8)} ${status}`);
    }
  }

  // ============ PAYOUT-BY-PAYOUT RECONCILIATION ============
  console.log(`\n${"─".repeat(80)}`);
  console.log("PAYOUT-BY-PAYOUT RECONCILIATION");
  console.log("─".repeat(80));
  console.log("\nThe question: For each payout, what Stripe charges funded it, and does");
  console.log("GymMaster's revenue for the same period match?");

  // Group stripe transactions by available_on date
  const stripeByAvailable = new Map<string, StripeTransaction[]>();
  for (const tx of stripeTxns) {
    if (!stripeByAvailable.has(tx.availableOn)) stripeByAvailable.set(tx.availableOn, []);
    stripeByAvailable.get(tx.availableOn)!.push(tx);
  }

  console.log(`\nStripe transactions grouped by available_on:`);
  for (const [date, txs] of [...stripeByAvailable.entries()].sort()) {
    const charges = txs.filter(t => t.type === "charge");
    const refunds = txs.filter(t => t.type === "refund");
    const gross = charges.reduce((s, c) => s + c.amount, 0);
    const fees = charges.reduce((s, c) => s + c.fee, 0);
    const refundAmt = refunds.reduce((s, r) => s + Math.abs(r.amount), 0);
    const net = gross - fees - refundAmt;
    console.log(`  ${date}: ${charges.length} charges ($${gross.toFixed(2)}) - fees ($${fees.toFixed(2)}) - refunds ($${refundAmt.toFixed(2)}) = net $${net.toFixed(2)}`);
  }

  console.log(`\nPayouts with their funding:`);
  const usedAvailDates = new Set<string>();

  for (const payout of stripePayouts) {
    console.log(`\n--- PAYOUT ${payout.arrivalDate}: $${payout.amount.toFixed(2)} ---`);

    // Find all available dates that would fund this payout
    // Available dates before or on the payout arrival date
    const fundingDates: string[] = [];
    const fundingTxns: StripeTransaction[] = [];

    for (const [availDate, txs] of stripeByAvailable.entries()) {
      if (availDate <= payout.arrivalDate && !usedAvailDates.has(availDate)) {
        fundingDates.push(availDate);
        fundingTxns.push(...txs);
        usedAvailDates.add(availDate);
      }
    }

    if (fundingDates.length === 0) {
      console.log("  No unassigned transactions found for this payout");
      continue;
    }

    // Calculate totals
    const charges = fundingTxns.filter(t => t.type === "charge");
    const refunds = fundingTxns.filter(t => t.type === "refund");
    const gross = charges.reduce((s, c) => s + c.amount, 0);
    const fees = charges.reduce((s, c) => s + c.fee, 0);
    const refundAmt = refunds.reduce((s, r) => s + Math.abs(r.amount), 0);
    const netCalc = gross - fees - refundAmt;

    // Get the charge creation dates to find the "revenue period"
    const chargeDates = charges.map(c => c.created).sort();
    const periodStart = chargeDates[0] || payout.arrivalDate;
    const periodEnd = chargeDates[chargeDates.length - 1] || payout.arrivalDate;

    console.log(`  Funding: available_on dates ${fundingDates.sort().join(", ")}`);
    console.log(`  Charges created: ${periodStart} to ${periodEnd}`);
    console.log(`  Stripe: ${charges.length} charges ($${gross.toFixed(2)}) - fees ($${fees.toFixed(2)}) - refunds ($${refundAmt.toFixed(2)}) = $${netCalc.toFixed(2)}`);
    console.log(`  Payout: $${payout.amount.toFixed(2)}`);
    console.log(`  Match: ${Math.abs(netCalc - payout.amount) < 0.01 ? "✓" : `variance $${(netCalc - payout.amount).toFixed(2)}`}`);

    // Now find GymMaster revenue for the same charge creation period
    const gmForPeriod = gmPayments.filter(p => p.date >= periodStart && p.date <= periodEnd);
    const gmPeriodTotal = gmForPeriod.reduce((s, p) => s + p.amount, 0);

    console.log(`  GymMaster (${periodStart} to ${periodEnd}): $${gmPeriodTotal.toFixed(2)} (${gmForPeriod.length} payments)`);

    // Compare GM to Stripe gross (before fees)
    const variance = gmPeriodTotal - gross;
    const variancePct = gross > 0 ? (variance / gross) * 100 : 0;
    const reconciled = Math.abs(variancePct) <= 3.5;

    console.log(`  GM vs Stripe Gross: ${reconciled ? "✓" : "✗"} variance $${variance.toFixed(2)} (${variancePct.toFixed(1)}%)`);
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

main().catch(console.error);
