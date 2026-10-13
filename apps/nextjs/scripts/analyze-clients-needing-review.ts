/**
 * Analyze clients needing review for October 2026
 * Cross-reference billing, payments, on-hold, and member data
 * Run: npx tsx scripts/analyze-clients-needing-review.ts
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

const REPORT_IDS = {
  CURRENT_MEMBERS: 1,
  MEMBERS_WHO_OWE: 13,
  ALL_PAYMENTS: 103,
  BILLING_BATCHES: 130,
  MEMBERS_ON_HOLD: 314,
  CANCELLATIONS: 327,
};

// Members from the screenshot
const MEMBERS_TO_ANALYZE = [
  { id: "322744", name: "Balvas, Sam", expected: 120.00, paid: 0.00 },
  { id: "322746", name: "Bursey, Laura", expected: 177.28, paid: 0.00 },
  { id: "323067", name: "Lovo, Reneil", expected: 205.33, paid: 0.00 },
  { id: "322768", name: "Estrada, Roger", expected: 186.67, paid: 0.00 },
  { id: "323515", name: "Vargas, Edgar", expected: 154.50, paid: 0.00 },
  { id: "323492", name: "Contreras, Rebecca", expected: 148.00, paid: 0.00 },
  { id: "323888", name: "Shiao, Bruce", expected: 1605.00, paid: 0.00 },
  { id: "322714", name: "Maciel, Veronica", expected: 136.13, paid: 32.20 },
  { id: "322839", name: "Baez Gonzalez, Vanessa", expected: 88.57, paid: 50.98 },
  { id: "322996", name: "Villeda, Ruby", expected: 134.89, paid: 57.81 },
  { id: "323035", name: "Oviedo, Lexi", expected: 203.93, paid: 133.90 },
  { id: "323249", name: "Estrada, Rosa", expected: 160.00, paid: 148.00 },
  { id: "323462", name: "Jones, Sonja", expected: 160.00, paid: 153.16 },
  { id: "322750", name: "Erdtsieck, Jacob", expected: 242.40, paid: 240.00 },
];

async function fetchReport(reportId: number, startDate: string, endDate: string) {
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
      report_id: reportId,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  const data = await response.json();
  return data.result || [];
}

function parseAmount(val: unknown): number {
  return parseFloat(String(val || "0").replace(/[$,]/g, "")) || 0;
}

async function main() {
  console.log("=".repeat(100));
  console.log("ANALYZING CLIENTS NEEDING REVIEW - OCTOBER 2026");
  console.log("=".repeat(100));

  // Fetch all relevant reports for October
  const octStart = "2026-10-01";
  const octEnd = "2026-10-31";

  // Also get September for context
  const sepStart = "2026-09-01";
  const sepEnd = "2026-09-30";

  console.log("\nFetching GymMaster reports...");

  const [
    billingOct,
    paymentsOct,
    paymentsSep,
    onHoldOct,
    membersWhoOwe,
    cancellationsOct,
    currentMembers,
  ] = await Promise.all([
    fetchReport(REPORT_IDS.BILLING_BATCHES, octStart, octEnd),
    fetchReport(REPORT_IDS.ALL_PAYMENTS, octStart, octEnd),
    fetchReport(REPORT_IDS.ALL_PAYMENTS, sepStart, sepEnd),
    fetchReport(REPORT_IDS.MEMBERS_ON_HOLD, octStart, octEnd),
    fetchReport(REPORT_IDS.MEMBERS_WHO_OWE, octStart, octEnd),
    fetchReport(REPORT_IDS.CANCELLATIONS, octStart, octEnd),
    fetchReport(REPORT_IDS.CURRENT_MEMBERS, octStart, octEnd),
  ]);

  console.log(`  Billing batches (Oct): ${billingOct.length}`);
  console.log(`  Payments (Oct): ${paymentsOct.length}`);
  console.log(`  Payments (Sep): ${paymentsSep.length}`);
  console.log(`  On Hold (Oct): ${onHoldOct.length}`);
  console.log(`  Members Who Owe: ${membersWhoOwe.length}`);
  console.log(`  Cancellations (Oct): ${cancellationsOct.length}`);
  console.log(`  Current Members: ${currentMembers.length}`);

  // Index data by member ID
  const billingByMember = new Map<string, any[]>();
  for (const row of billingOct) {
    const id = String(row["Member ID"]);
    if (!billingByMember.has(id)) billingByMember.set(id, []);
    billingByMember.get(id)!.push(row);
  }

  const paymentsOctByMember = new Map<string, any[]>();
  for (const row of paymentsOct) {
    const id = String(row["Member ID"]);
    if (!paymentsOctByMember.has(id)) paymentsOctByMember.set(id, []);
    paymentsOctByMember.get(id)!.push(row);
  }

  const paymentsSepByMember = new Map<string, any[]>();
  for (const row of paymentsSep) {
    const id = String(row["Member ID"]);
    if (!paymentsSepByMember.has(id)) paymentsSepByMember.set(id, []);
    paymentsSepByMember.get(id)!.push(row);
  }

  const onHoldIds = new Set(onHoldOct.map((r: any) => String(r["Member ID"])));
  const owesById = new Map(membersWhoOwe.map((r: any) => [String(r["Member ID"]), r]));
  const cancelledIds = new Set(cancellationsOct.map((r: any) => String(r["Member ID"])));
  const currentMemberById = new Map(currentMembers.map((r: any) => [String(r["Member ID"]), r]));

  console.log("\n" + "=".repeat(100));
  console.log("MEMBER-BY-MEMBER ANALYSIS");
  console.log("=".repeat(100));

  for (const member of MEMBERS_TO_ANALYZE) {
    console.log(`\n${"─".repeat(100)}`);
    console.log(`📋 ${member.name} #${member.id}`);
    console.log(`   Dashboard shows: Expected $${member.expected.toFixed(2)} | Paid $${member.paid.toFixed(2)} | Gap: $${(member.expected - member.paid).toFixed(2)}`);
    console.log("─".repeat(100));

    // Check billing batches
    const billingRecords = billingByMember.get(member.id) || [];
    if (billingRecords.length > 0) {
      console.log("\n   💳 BILLING BATCHES (Report 130):");
      for (const b of billingRecords) {
        const status = b["Billing Status"];
        const failed = b["Failed"];
        const amount = b["Amount"];
        const date = b["Billing Date"];
        const failReason = b["Fail Reason"];
        const icon = failed ? "❌" : "✅";
        console.log(`      ${icon} ${date}: ${amount} - ${status}${failReason ? ` (${failReason})` : ""}`);
      }
    } else {
      console.log("\n   💳 BILLING BATCHES: No billing attempts found in October");
    }

    // Check October payments
    const octPayments = paymentsOctByMember.get(member.id) || [];
    if (octPayments.length > 0) {
      console.log("\n   💵 OCTOBER PAYMENTS (Report 103):");
      let totalOct = 0;
      for (const p of octPayments) {
        const amt = parseAmount(p["Payment Amount"]);
        totalOct += amt;
        const details = p["Payment Details"] || "";
        const method = p["Payment Method"] || "";
        console.log(`      ${p["Payment Date"]}: $${amt.toFixed(2)} - ${details.substring(0, 50)} (${method})`);
      }
      console.log(`      TOTAL: $${totalOct.toFixed(2)}`);
    } else {
      console.log("\n   💵 OCTOBER PAYMENTS: None recorded");
    }

    // Check September payments for context
    const sepPayments = paymentsSepByMember.get(member.id) || [];
    if (sepPayments.length > 0) {
      console.log("\n   📅 SEPTEMBER PAYMENTS (for context):");
      let totalSep = 0;
      for (const p of sepPayments) {
        const amt = parseAmount(p["Payment Amount"]);
        totalSep += amt;
        console.log(`      ${p["Payment Date"]}: $${amt.toFixed(2)}`);
      }
      console.log(`      TOTAL: $${totalSep.toFixed(2)}`);
    }

    // Check on-hold status
    if (onHoldIds.has(member.id)) {
      const holdInfo = onHoldOct.find((r: any) => String(r["Member ID"]) === member.id);
      console.log(`\n   ⏸️  ON HOLD: Yes`);
      if (holdInfo) {
        console.log(`      Start: ${holdInfo["Date Hold Starts"]} | End: ${holdInfo["Date Hold Ends"]}`);
        console.log(`      Reason: ${holdInfo["Reason"] || "Not specified"}`);
      }
    }

    // Check if they owe money
    const owesInfo = owesById.get(member.id);
    if (owesInfo) {
      console.log(`\n   ⚠️  OWES MONEY:`);
      console.log(`      Amount: ${owesInfo["Owe End"]}`);
      console.log(`      Last Payment: ${owesInfo["Last Payment"] || "Never"}`);
    }

    // Check if cancelled
    if (cancelledIds.has(member.id)) {
      const cancelInfo = cancellationsOct.find((r: any) => String(r["Member ID"]) === member.id);
      console.log(`\n   🚫 CANCELLED in October`);
      if (cancelInfo) {
        console.log(`      Date: ${cancelInfo["Membership Cancellation Date"]}`);
        console.log(`      Reason: ${cancelInfo["Cancel Reason"] || cancelInfo["Membership Feedback"] || "Not specified"}`);
      }
    }

    // Check current membership info
    const memberInfo = currentMemberById.get(member.id);
    if (memberInfo) {
      console.log(`\n   👤 CURRENT MEMBERSHIP:`);
      console.log(`      Type: ${memberInfo["Membership Type Name"]}`);
      console.log(`      Fee: ${memberInfo["Membership Fee"]}`);
      console.log(`      Billing: ${memberInfo["Price Description"]}`);
      console.log(`      Start: ${memberInfo["Membership Start Date"]}`);
    } else {
      console.log(`\n   👤 CURRENT MEMBERSHIP: Not found in current members list`);
    }

    // AI Analysis
    console.log("\n   🤖 ANALYSIS:");

    const hasBillingFailed = billingRecords.some((b: any) => b["Failed"] === true);
    const hasNoBilling = billingRecords.length === 0;
    const isOnHold = onHoldIds.has(member.id);
    const isCancelled = cancelledIds.has(member.id);
    const owes = owesById.has(member.id);
    const paidSomething = member.paid > 0;
    const notInCurrentMembers = !currentMemberById.has(member.id);

    if (isOnHold) {
      console.log("      → Member is ON HOLD - billing paused, expected to not pay");
    } else if (isCancelled) {
      console.log("      → Member CANCELLED - no longer expected to pay");
    } else if (notInCurrentMembers) {
      console.log("      → NOT in current members list - may have churned or data issue");
    } else if (hasBillingFailed) {
      const failedBilling = billingRecords.find((b: any) => b["Failed"]);
      console.log(`      → BILLING FAILED: ${failedBilling["Fail Reason"] || "Unknown reason"}`);
      console.log("      → ACTION: Contact member to update payment method");
    } else if (hasNoBilling && !paidSomething) {
      console.log("      → No billing attempt recorded - may be billed later in month or billing issue");
      console.log("      → ACTION: Check if billing date hasn't arrived yet");
    } else if (paidSomething && member.paid < member.expected) {
      const gap = member.expected - member.paid;
      console.log(`      → PARTIAL PAYMENT: Paid $${member.paid.toFixed(2)} vs expected $${member.expected.toFixed(2)}`);
      console.log(`      → Gap of $${gap.toFixed(2)} - could be prorated, multiple memberships, or billing issue`);
    } else {
      console.log("      → Needs manual investigation");
    }
  }

  console.log("\n" + "=".repeat(100));
  console.log("ANALYSIS COMPLETE");
  console.log("=".repeat(100));
}

main().catch(console.error);
