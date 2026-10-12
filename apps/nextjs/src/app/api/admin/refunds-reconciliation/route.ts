/**
 * Administrative Refunds Reconciliation API (v2)
 * GET /api/admin/refunds-reconciliation?year=2026
 *
 * Primary source: GymMaster (has member context)
 * Verification: Stripe monthly totals
 * Edge cases: Surface variance for manual review
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-09-30.endive",
});

interface MemberPaymentHistory {
  month: string;
  expected: number;
  actual: number;
}

interface GymMasterRefund {
  memberId: string;
  memberName: string;
  refundDate: string;
  refundAmount: number;
  reason: string;
  status: "on_track" | "needs_review";
  paymentHistory: MemberPaymentHistory[];
}

interface MonthlyReconciliation {
  month: string;
  gymMasterTotal: number;
  gymMasterCount: number;
  stripeTotal: number;
  stripeCount: number;
  variance: number;
  status: "reconciled" | "variance";
}

interface UnmatchedStripeRefund {
  refundId: string;
  date: string;
  amount: number;
  customerEmail: string | null;
  billingName: string | null;
}

async function fetchGymMasterPayments(
  startDate: string,
  endDate: string
): Promise<Record<string, any>[]> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing GymMaster configuration");
  }

  const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-GM-API-KEY": apiKey,
    },
    body: JSON.stringify({
      report_id: 103, // ALL_PAYMENTS
      start_date: startDate,
      end_date: endDate,
    }),
  });

  if (!response.ok) {
    throw new Error(`GymMaster API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result || [];
}

async function fetchCurrentMembers(year: number): Promise<Record<string, any>[]> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  if (!baseUrl || !apiKey) return [];

  try {
    const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-GM-API-KEY": apiKey,
      },
      body: JSON.stringify({
        report_id: 1,
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.result || [];
  } catch {
    return [];
  }
}

function parseAmount(value: any): number {
  return parseFloat(String(value || "0").replace(/[$,]/g, ""));
}

function getMonthKey(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthName(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  if (!year || !month) return monthKey;
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(searchParams.get("year") || "2026");

  try {
    // ========================================
    // 1. Fetch GymMaster payments
    // ========================================
    const gmPayments = await fetchGymMasterPayments(`${year}-01-01`, `${year}-12-31`);
    const currentMembers = await fetchCurrentMembers(year);

    // Build member fee lookup
    const memberFeeByName: Map<string, number> = new Map();
    for (const member of currentMembers) {
      const name = String(member["Member Name"] || "").toLowerCase().trim();
      const fee = parseAmount(member["Membership Fee"]);
      if (name && fee > 0) {
        memberFeeByName.set(name, fee);
      }
    }

    // Build payment history by member (GROSS charges - what was billed)
    // Group refund entries by member+date to identify journal entries
    const refundDates: Map<string, Set<string>> = new Map(); // member -> set of refund dates
    for (const payment of gmPayments) {
      const name = String(payment["Name"] || "").toLowerCase().trim();
      const amount = parseAmount(payment["Payment Amount"]);
      const dateStr = String(payment["Payment Date"] || "");
      const details = String(payment["Payment Details"] || "").toLowerCase();

      if (amount < 0 || details.includes("payment refund")) {
        if (!refundDates.has(name)) refundDates.set(name, new Set());
        refundDates.get(name)!.add(dateStr);
      }
    }

    const paymentsByMember: Map<string, Map<string, number>> = new Map();
    for (const payment of gmPayments) {
      const name = String(payment["Name"] || "").toLowerCase().trim();
      const amount = parseAmount(payment["Payment Amount"]);
      const dateStr = String(payment["Payment Date"] || "");
      const details = String(payment["Payment Details"] || "").toLowerCase();

      // Skip negative amounts (refunds)
      if (amount <= 0) continue;

      // Skip "Refunded" journal entries - those on the SAME day as a refund
      if (details === "refunded") {
        const memberRefundDates = refundDates.get(name);
        if (memberRefundDates && memberRefundDates.has(dateStr)) {
          continue; // This is a journal entry, skip it
        }
        // Otherwise it's an actual charge that was later refunded - keep it
      }

      const monthKey = getMonthKey(dateStr);
      if (!monthKey) continue;

      if (!paymentsByMember.has(name)) {
        paymentsByMember.set(name, new Map());
      }
      paymentsByMember.get(name)!.set(
        monthKey,
        (paymentsByMember.get(name)!.get(monthKey) || 0) + amount
      );
    }

    // ========================================
    // 2. Extract GymMaster refunds (negative amounts)
    // ========================================
    const gmRefunds: GymMasterRefund[] = [];
    const gmMonthlyTotals: Map<string, { total: number; count: number }> = new Map();

    for (const payment of gmPayments) {
      const amount = parseAmount(payment["Payment Amount"]);
      const details = String(payment["Payment Details"] || "").toLowerCase();

      // Only include actual refund transactions (negative amounts with "payment refund" type)
      if (amount >= 0 || !details.includes("payment refund")) continue;

      const memberId = String(payment["Member ID"] || "");
      const memberName = String(payment["Name"] || "");
      const memberNameLower = memberName.toLowerCase().trim();
      const dateStr = String(payment["Payment Date"] || "");
      const refundDate = new Date(dateStr).toISOString().split("T")[0] || dateStr;
      const refundAmount = Math.abs(amount);
      const reason = String(payment["Payment Note"] || "No reason provided");
      const monthKey = getMonthKey(dateStr);

      // Get expected fee
      let expectedFee = memberFeeByName.get(memberNameLower) || 0;

      // Build 6-month payment history
      const paymentHistory: MemberPaymentHistory[] = [];
      const memberPayments = paymentsByMember.get(memberNameLower) || new Map();

      const refundDateObj = new Date(refundDate);
      for (let i = 5; i >= 0; i--) {
        const historyDate = new Date(refundDateObj);
        historyDate.setMonth(historyDate.getMonth() - i);
        const historyMonthKey = `${historyDate.getFullYear()}-${String(historyDate.getMonth() + 1).padStart(2, "0")}`;

        paymentHistory.push({
          month: getMonthName(historyMonthKey),
          expected: expectedFee,
          actual: memberPayments.get(historyMonthKey) || 0,
        });
      }

      // Calculate expected from history if not found
      if (expectedFee === 0) {
        const nonZero = paymentHistory.filter((h) => h.actual > 0);
        if (nonZero.length > 0) {
          expectedFee = Math.round(nonZero.reduce((s, h) => s + h.actual, 0) / nonZero.length / 10) * 10;
          for (const h of paymentHistory) h.expected = expectedFee;
        }
      }

      // Determine status
      const needsReview = paymentHistory.some((h) => h.actual < h.expected && h.expected > 0);

      gmRefunds.push({
        memberId,
        memberName,
        refundDate,
        refundAmount,
        reason,
        status: needsReview ? "needs_review" : "on_track",
        paymentHistory,
      });

      // Update monthly totals
      if (monthKey) {
        if (!gmMonthlyTotals.has(monthKey)) {
          gmMonthlyTotals.set(monthKey, { total: 0, count: 0 });
        }
        const totals = gmMonthlyTotals.get(monthKey)!;
        totals.total += refundAmount;
        totals.count++;
      }
    }

    // Sort refunds by date descending
    gmRefunds.sort((a, b) => new Date(b.refundDate).getTime() - new Date(a.refundDate).getTime());

    // ========================================
    // 3. Fetch Stripe refunds
    // ========================================
    const startTimestamp = Math.floor(new Date(`${year}-01-01`).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(`${year}-12-31T23:59:59`).getTime() / 1000);

    const stripeRefunds: Stripe.Refund[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const response = await stripe.refunds.list({
        created: { gte: startTimestamp, lte: endTimestamp },
        limit: 100,
        expand: ["data.charge"],
        ...(startingAfter && { starting_after: startingAfter }),
      });
      stripeRefunds.push(...response.data);
      hasMore = response.has_more;
      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1]!.id;
      }
    }

    // Sum Stripe refunds by month
    const stripeMonthlyTotals: Map<string, { total: number; count: number }> = new Map();
    for (const refund of stripeRefunds) {
      const date = new Date(refund.created * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const amount = refund.amount / 100;

      if (!stripeMonthlyTotals.has(monthKey)) {
        stripeMonthlyTotals.set(monthKey, { total: 0, count: 0 });
      }
      const totals = stripeMonthlyTotals.get(monthKey)!;
      totals.total += amount;
      totals.count++;
    }

    // ========================================
    // 4. Build monthly reconciliation
    // ========================================
    const allMonths = new Set([...gmMonthlyTotals.keys(), ...stripeMonthlyTotals.keys()]);
    const monthlyReconciliation: MonthlyReconciliation[] = [];

    for (const monthKey of Array.from(allMonths).sort()) {
      const gm = gmMonthlyTotals.get(monthKey) || { total: 0, count: 0 };
      const st = stripeMonthlyTotals.get(monthKey) || { total: 0, count: 0 };
      const variance = Math.abs(gm.total - st.total);

      monthlyReconciliation.push({
        month: getMonthName(monthKey),
        gymMasterTotal: Math.round(gm.total * 100) / 100,
        gymMasterCount: gm.count,
        stripeTotal: Math.round(st.total * 100) / 100,
        stripeCount: st.count,
        variance: Math.round(variance * 100) / 100,
        status: variance < 1 ? "reconciled" : "variance",
      });
    }

    // ========================================
    // 5. Identify unmatched Stripe refunds (if variance exists)
    // ========================================
    const unmatchedStripeRefunds: UnmatchedStripeRefund[] = [];
    const totalVariance = monthlyReconciliation.reduce((s, m) => s + m.variance, 0);

    if (totalVariance > 1) {
      // For now, list Stripe refunds without billing names as potentially unmatched
      for (const refund of stripeRefunds) {
        const charge = refund.charge as Stripe.Charge | null;
        const billingName = charge?.billing_details?.name || null;

        if (!billingName) {
          unmatchedStripeRefunds.push({
            refundId: refund.id,
            date: new Date(refund.created * 1000).toISOString().split("T")[0]!,
            amount: refund.amount / 100,
            customerEmail: charge?.receipt_email || null,
            billingName: null,
          });
        }
      }
    }

    // ========================================
    // 6. Summary stats
    // ========================================
    const totalGymMasterRefunds = gmRefunds.length;
    const totalGymMasterAmount = gmRefunds.reduce((s, r) => s + r.refundAmount, 0);
    const totalStripeAmount = stripeRefunds.reduce((s, r) => s + r.amount / 100, 0);
    const needsReviewCount = gmRefunds.filter((r) => r.status === "needs_review").length;
    const onTrackCount = gmRefunds.filter((r) => r.status === "on_track").length;
    const reconciledMonths = monthlyReconciliation.filter((m) => m.status === "reconciled").length;

    return NextResponse.json({
      year,
      summary: {
        totalRefunds: totalGymMasterRefunds,
        totalGymMasterAmount: Math.round(totalGymMasterAmount * 100) / 100,
        totalStripeAmount: Math.round(totalStripeAmount * 100) / 100,
        totalVariance: Math.round(totalVariance * 100) / 100,
        needsReviewCount,
        onTrackCount,
        reconciledMonths,
        totalMonths: monthlyReconciliation.length,
      },
      monthlyReconciliation,
      refunds: gmRefunds,
      unmatchedStripeRefunds,
    });
  } catch (err) {
    console.error("Refunds reconciliation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
