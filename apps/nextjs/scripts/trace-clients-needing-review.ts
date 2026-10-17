/**
 * Trace Clients Needing Review - verify the logic
 * Run: npx tsx scripts/trace-clients-needing-review.ts
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

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

function parseAmount(value: unknown): number {
  return parseFloat(String(value || "0").replace(/[$,]/g, ""));
}

function getMonthKey(dateStr: string): string {
  if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateStr.substring(0, 7);
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  console.log("=".repeat(100));
  console.log("TRACING CLIENTS NEEDING REVIEW - OCTOBER 2026");
  console.log("=".repeat(100));

  // Members to trace from the screenshot
  const membersToTrace = [
    { id: "322744", name: "Balvas, Sam", uiExpected: 120, uiPaid: 0, uiStatus: "Not Paid" },
    { id: "322752", name: "Palencia, Neftali", uiExpected: 120, uiPaid: 0, uiStatus: "On Hold, Not Paid" },
    { id: "322747", name: "Martinez, Elisabeth", uiExpected: 196, uiPaid: 148, uiStatus: "Not Paid" },
    { id: "322750", name: "Erdtsieck, Jacob", uiExpected: 242.40, uiPaid: 240, uiStatus: "Billing Failed" },
    { id: "323888", name: "Shiao, Bruce", uiExpected: 1605, uiPaid: 0, uiStatus: "Not Paid" },
    { id: "322714", name: "Maciel, Veronica", uiExpected: 216.13, uiPaid: 32.20, uiStatus: "Not Paid" },
  ];

  // Fetch payments from Jul 2026 to Oct 2026 (need lookback for expected calculation)
  const payments = await fetchReport(103, "2026-07-01", "2026-10-31");

  // Fetch members on hold for October
  const onHoldReport = await fetchReport(314, "2026-10-01", "2026-10-31");
  const onHoldIds = new Set(onHoldReport.map((r: any) => String(r["Member ID"])));

  // Fetch billing batches for October
  const billingReport = await fetchReport(130, "2026-10-01", "2026-10-31");
  const billingByMember = new Map<string, any[]>();
  for (const row of billingReport) {
    const memberId = String(row["Member ID"] || "");
    if (!memberId) continue;
    if (!billingByMember.has(memberId)) billingByMember.set(memberId, []);
    billingByMember.get(memberId)!.push(row);
  }

  console.log(`\nOn Hold Members in Oct: ${onHoldIds.size}`);
  console.log(`Billing Records in Oct: ${billingReport.length}`);

  // Build payment history by member
  type MonthData = { paid: number; refunded: number };
  const paymentsByMember = new Map<string, Map<string, MonthData>>();

  for (const payment of payments) {
    const memberId = String(payment["Member ID"] || "");
    const amount = parseAmount(payment["Payment Amount"]);
    const dateStr = String(payment["Payment Date"] || "");
    const details = String(payment["Payment Details"] || "").toLowerCase();
    const monthKey = getMonthKey(dateStr);

    if (!memberId || !monthKey) continue;

    if (!paymentsByMember.has(memberId)) {
      paymentsByMember.set(memberId, new Map());
    }
    const memberData = paymentsByMember.get(memberId)!;

    if (!memberData.has(monthKey)) {
      memberData.set(monthKey, { paid: 0, refunded: 0 });
    }
    const monthData = memberData.get(monthKey)!;

    if (amount < 0 || details.includes("payment refund")) {
      monthData.refunded += Math.abs(amount);
    } else if (amount > 0) {
      monthData.paid += amount;
    }
  }

  // Trace each member
  for (const member of membersToTrace) {
    console.log("\n" + "─".repeat(100));
    console.log(`📋 ${member.name} (ID: ${member.id})`);
    console.log("─".repeat(100));

    const memberMonths = paymentsByMember.get(member.id);

    if (!memberMonths) {
      console.log("❌ NO PAYMENT DATA FOUND FOR THIS MEMBER");
      continue;
    }

    // Show all months
    console.log("\n📅 Payment History:");
    const sortedMonths = [...memberMonths.keys()].sort();
    for (const monthKey of sortedMonths) {
      const data = memberMonths.get(monthKey)!;
      const net = data.paid - data.refunded;
      console.log(`   ${monthKey}: Paid $${data.paid.toFixed(2)}, Refunded $${data.refunded.toFixed(2)}, Net $${net.toFixed(2)}`);
    }

    // Calculate expected (avg of Jul, Aug, Sep - the 3 months before Oct)
    const lookbackMonths = ["2026-07", "2026-08", "2026-09"];
    const lookbackPayments: number[] = [];

    console.log("\n📊 Expected Calculation (X-1, X-2, X-3):");
    for (const lbMonth of lookbackMonths) {
      const data = memberMonths.get(lbMonth);
      if (data && data.paid > 0) {
        lookbackPayments.push(data.paid);
        console.log(`   ${lbMonth}: $${data.paid.toFixed(2)} ✓`);
      } else {
        console.log(`   ${lbMonth}: $0 (not counted)`);
      }
    }

    if (lookbackPayments.length < 2) {
      console.log(`\n⚠️  Only ${lookbackPayments.length} non-zero months - should be SKIPPED (< 2)`);
      console.log(`   But UI shows this member - WHY?`);
    }

    const expected = lookbackPayments.length > 0
      ? lookbackPayments.reduce((a, b) => a + b, 0) / lookbackPayments.length
      : 0;

    console.log(`\n   Calculated Expected: $${expected.toFixed(2)}`);
    console.log(`   UI Shows Expected: $${member.uiExpected.toFixed(2)}`);
    console.log(`   Match: ${Math.abs(expected - member.uiExpected) < 0.01 ? "✅" : "❌"}`);

    // October data
    const octData = memberMonths.get("2026-10") || { paid: 0, refunded: 0 };
    const octNet = octData.paid - octData.refunded;

    console.log("\n📆 October 2026:");
    console.log(`   Paid: $${octData.paid.toFixed(2)} (UI: $${member.uiPaid.toFixed(2)})`);
    console.log(`   Refunded: $${octData.refunded.toFixed(2)}`);
    console.log(`   Net: $${octNet.toFixed(2)}`);

    // Status flags
    console.log("\n🏷️  Status Flags:");
    const isOnHold = onHoldIds.has(member.id);
    const billingAttempts = billingByMember.get(member.id) || [];
    const hasBillingFailed = billingAttempts.some((b: any) =>
      b["Billing Status"] === "REFUSED" || b["Failed"] === true
    );

    console.log(`   On Hold: ${isOnHold ? "YES" : "NO"}`);
    console.log(`   Billing Failed: ${hasBillingFailed ? "YES" : "NO"}`);
    console.log(`   Has Refund: ${octData.refunded > 0 ? "YES" : "NO"}`);
    console.log(`   Not Paid (net < expected): ${octNet < expected ? "YES" : "NO"}`);
    console.log(`   UI Status: ${member.uiStatus}`);

    // Should this member appear?
    const shouldAppear = (
      lookbackPayments.length >= 2 && (
        octData.refunded > 0 ||
        isOnHold ||
        hasBillingFailed ||
        octNet < expected
      )
    );
    console.log(`\n🎯 Should Appear: ${shouldAppear ? "YES" : "NO (shouldn't be in list)"}`);

    // If billing failed, show details
    if (billingAttempts.length > 0) {
      console.log("\n💳 Billing Attempts:");
      for (const attempt of billingAttempts) {
        console.log(`   Date: ${attempt["Billing Date"]}, Amount: ${attempt["Amount"]}, Status: ${attempt["Billing Status"]}, Failed: ${attempt["Failed"]}, Reason: ${attempt["Fail Reason"] || "-"}`);
      }
    }
  }

  // Now let's also count total members that SHOULD appear vs what UI shows (18)
  console.log("\n" + "=".repeat(100));
  console.log("TOTAL COUNT VERIFICATION");
  console.log("=".repeat(100));

  let shouldAppearCount = 0;
  const shouldAppearMembers: string[] = [];

  for (const [memberId, memberMonths] of paymentsByMember) {
    const lookbackMonths = ["2026-07", "2026-08", "2026-09"];
    const lookbackPayments: number[] = [];

    for (const lbMonth of lookbackMonths) {
      const data = memberMonths.get(lbMonth);
      if (data && data.paid > 0) {
        lookbackPayments.push(data.paid);
      }
    }

    // Skip if < 2 non-zero months
    if (lookbackPayments.length < 2) continue;

    const expected = lookbackPayments.reduce((a, b) => a + b, 0) / lookbackPayments.length;
    const octData = memberMonths.get("2026-10") || { paid: 0, refunded: 0 };
    const octNet = octData.paid - octData.refunded;

    const isOnHold = onHoldIds.has(memberId);
    const billingAttempts = billingByMember.get(memberId) || [];
    const hasBillingFailed = billingAttempts.some((b: any) =>
      b["Billing Status"] === "REFUSED" || b["Failed"] === true
    );

    const hasFlags = octData.refunded > 0 || isOnHold || hasBillingFailed;
    const notPaid = octNet < expected;

    if (hasFlags || notPaid) {
      shouldAppearCount++;
      shouldAppearMembers.push(memberId);
    }
  }

  console.log(`\nUI Shows: 18 clients`);
  console.log(`Script Calculates: ${shouldAppearCount} clients`);
  console.log(`Match: ${shouldAppearCount === 18 ? "✅" : "❌"}`);

  if (shouldAppearCount !== 18) {
    console.log(`\nMember IDs that should appear: ${shouldAppearMembers.join(", ")}`);
  }

  console.log("\n");
}

main().catch(console.error);
