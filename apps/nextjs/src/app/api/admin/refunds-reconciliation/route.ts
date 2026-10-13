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
  monthKey: string;
  expected: number;
  paid: number;      // Gross amount paid (before refunds)
  refunded: number;  // Refund amount for this month (0 if none)
  actual: number;    // Net amount (paid - refunded) - for backwards compat
}

interface GymMasterRefund {
  memberId: string;
  memberName: string;
  refundDate: string;
  refundAmount: number;
  reason: string;
  status: "on_track" | "needs_review";
  paymentMethod: string;
  isNonStripeAdjustment: boolean; // True if "No Payment / Adjustment" - not an actual Stripe refund
  paymentHistory: MemberPaymentHistory[];
}

interface UnmatchedRefund {
  source: "gymmaster" | "stripe";
  date: string;
  amount: number;
  name: string;
  paymentMethod?: string;
  isAdjustment?: boolean;
  reason?: string;
}

interface MonthlyReconciliation {
  month: string;
  monthKey: string; // "YYYY-MM" format for filtering
  gymMasterTotal: number; // Excludes "No Payment / Adjustment" entries
  gymMasterCount: number;
  stripeTotal: number;
  stripeCount: number;
  variance: number;
  status: "reconciled" | "variance";
  unmatchedRefunds: UnmatchedRefund[]; // Refunds that don't have a match in the other system
  // "No Payment / Adjustment" entries (not actual Stripe refunds)
  adjustmentsTotal: number;
  adjustmentsCount: number;
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
  // For "YYYY-MM-DD" format, just extract directly to avoid timezone issues
  if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateStr.substring(0, 7); // "YYYY-MM"
  }
  // Fallback for other date formats - use UTC to avoid timezone issues
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
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

    // Build refunds by member (for payment history breakdown)
    const refundsByMember: Map<string, Map<string, number>> = new Map();
    for (const payment of gmPayments) {
      const name = String(payment["Name"] || "").toLowerCase().trim();
      const amount = parseAmount(payment["Payment Amount"]);
      const dateStr = String(payment["Payment Date"] || "");
      const details = String(payment["Payment Details"] || "").toLowerCase();

      // Only include actual refund transactions
      if (amount >= 0 || !details.includes("payment refund")) continue;

      const monthKey = getMonthKey(dateStr);
      if (!monthKey) continue;

      if (!refundsByMember.has(name)) {
        refundsByMember.set(name, new Map());
      }
      refundsByMember.get(name)!.set(
        monthKey,
        (refundsByMember.get(name)!.get(monthKey) || 0) + Math.abs(amount)
      );
    }

    // ========================================
    // 2. Extract GymMaster refunds (negative amounts)
    // ========================================
    const gmRefunds: GymMasterRefund[] = [];

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
      const paymentMethod = String(payment["Payment Method"] || "Unknown");
      const isNonStripeAdjustment = paymentMethod.toLowerCase().includes("no payment") ||
                                     paymentMethod.toLowerCase().includes("adjustment");
      const monthKey = getMonthKey(dateStr);

      // Get expected fee
      let expectedFee = memberFeeByName.get(memberNameLower) || 0;

      // Build 6-month payment history
      const paymentHistory: MemberPaymentHistory[] = [];
      const memberPayments = paymentsByMember.get(memberNameLower) || new Map();
      const memberRefunds = refundsByMember.get(memberNameLower) || new Map();

      const refundDateObj = new Date(refundDate);
      for (let i = 5; i >= 0; i--) {
        const historyDate = new Date(refundDateObj);
        historyDate.setMonth(historyDate.getMonth() - i);
        const historyMonthKey = `${historyDate.getFullYear()}-${String(historyDate.getMonth() + 1).padStart(2, "0")}`;

        const paid = memberPayments.get(historyMonthKey) || 0;
        const refunded = memberRefunds.get(historyMonthKey) || 0;

        paymentHistory.push({
          month: getMonthName(historyMonthKey),
          monthKey: historyMonthKey,
          expected: expectedFee,
          paid,
          refunded,
          actual: paid - refunded, // Net amount
        });
      }

      // Calculate expected from history if not found
      if (expectedFee === 0) {
        const nonZero = paymentHistory.filter((h) => h.paid > 0);
        if (nonZero.length > 0) {
          expectedFee = Math.round(nonZero.reduce((s, h) => s + h.paid, 0) / nonZero.length / 10) * 10;
          for (const h of paymentHistory) h.expected = expectedFee;
        }
      }

      // Determine status - check if NET is less than expected
      const needsReview = paymentHistory.some((h) => h.actual < h.expected && h.expected > 0);

      gmRefunds.push({
        memberId,
        memberName,
        refundDate,
        refundAmount,
        reason,
        status: needsReview ? "needs_review" : "on_track",
        paymentMethod,
        isNonStripeAdjustment,
        paymentHistory,
      });
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

    // ========================================
    // 4. Calculate monthly totals (excluding "No Payment / Adjustment")
    // ========================================
    // GymMaster totals - separate adjustments from regular refunds
    const gmRegularMonthlyTotals: Map<string, { total: number; count: number }> = new Map();
    const gmAdjustmentsMonthlyTotals: Map<string, { total: number; count: number }> = new Map();

    for (const refund of gmRefunds) {
      const monthKey = getMonthKey(refund.refundDate);
      if (!monthKey) continue;

      if (refund.isNonStripeAdjustment) {
        // "No Payment / Adjustment" - track separately, not included in Stripe reconciliation
        if (!gmAdjustmentsMonthlyTotals.has(monthKey)) {
          gmAdjustmentsMonthlyTotals.set(monthKey, { total: 0, count: 0 });
        }
        const totals = gmAdjustmentsMonthlyTotals.get(monthKey)!;
        totals.total += refund.refundAmount;
        totals.count++;
      } else {
        // Regular refund - include in Stripe reconciliation
        if (!gmRegularMonthlyTotals.has(monthKey)) {
          gmRegularMonthlyTotals.set(monthKey, { total: 0, count: 0 });
        }
        const totals = gmRegularMonthlyTotals.get(monthKey)!;
        totals.total += refund.refundAmount;
        totals.count++;
      }
    }

    // Sum Stripe refunds by month and store details for matching
    const stripeMonthlyTotals: Map<string, { total: number; count: number }> = new Map();
    const stripeRefundsByMonth: Map<string, Array<{ amount: number; name: string; date: string }>> = new Map();

    for (const refund of stripeRefunds) {
      const date = new Date(refund.created * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const amount = refund.amount / 100;
      const charge = refund.charge as Stripe.Charge | null;
      const billingName = charge?.billing_details?.name || "Unknown";

      if (!stripeMonthlyTotals.has(monthKey)) {
        stripeMonthlyTotals.set(monthKey, { total: 0, count: 0 });
        stripeRefundsByMonth.set(monthKey, []);
      }
      const totals = stripeMonthlyTotals.get(monthKey)!;
      totals.total += amount;
      totals.count++;

      stripeRefundsByMonth.get(monthKey)!.push({
        amount,
        name: billingName,
        date: date.toISOString().split("T")[0]!,
      });
    }

    // Group GymMaster refunds by month for matching (excluding adjustments)
    const gmRefundsByMonth: Map<string, GymMasterRefund[]> = new Map();
    for (const refund of gmRefunds) {
      // Exclude "No Payment / Adjustment" from matching
      if (refund.isNonStripeAdjustment) continue;

      const monthKey = getMonthKey(refund.refundDate);
      if (!gmRefundsByMonth.has(monthKey)) {
        gmRefundsByMonth.set(monthKey, []);
      }
      gmRefundsByMonth.get(monthKey)!.push(refund);
    }

    // ========================================
    // 5. Build monthly reconciliation with unmatched refunds
    // ========================================
    const allMonths = new Set([...gmRegularMonthlyTotals.keys(), ...stripeMonthlyTotals.keys()]);
    const monthlyReconciliation: MonthlyReconciliation[] = [];

    for (const monthKey of Array.from(allMonths).sort()) {
      const gm = gmRegularMonthlyTotals.get(monthKey) || { total: 0, count: 0 };
      const st = stripeMonthlyTotals.get(monthKey) || { total: 0, count: 0 };
      const gmAdj = gmAdjustmentsMonthlyTotals.get(monthKey) || { total: 0, count: 0 };
      const variance = Math.abs(gm.total - st.total);

      // Find unmatched refunds for this month
      const unmatchedRefunds: UnmatchedRefund[] = [];
      const gmMonthRefunds = gmRefundsByMonth.get(monthKey) || [];
      const stripeMonthRefunds = stripeRefundsByMonth.get(monthKey) || [];

      // Create copies for matching (so we can remove matched items)
      const unmatchedGM = [...gmMonthRefunds];
      const unmatchedStripe = [...stripeMonthRefunds];

      // Match by amount (within 2 cents tolerance)
      for (let i = unmatchedGM.length - 1; i >= 0; i--) {
        const gmRef = unmatchedGM[i]!;
        const stripeMatchIdx = unmatchedStripe.findIndex(
          (sr) => Math.abs(sr.amount - gmRef.refundAmount) < 0.02
        );

        if (stripeMatchIdx !== -1) {
          // Found a match - remove both from unmatched lists
          unmatchedGM.splice(i, 1);
          unmatchedStripe.splice(stripeMatchIdx, 1);
        }
      }

      // Add remaining unmatched GymMaster refunds (Stripe customers only)
      for (const gmRef of unmatchedGM) {
        unmatchedRefunds.push({
          source: "gymmaster",
          date: gmRef.refundDate,
          amount: gmRef.refundAmount,
          name: gmRef.memberName,
          paymentMethod: gmRef.paymentMethod,
          isAdjustment: gmRef.isNonStripeAdjustment,
          reason: gmRef.reason,
        });
      }

      // Add remaining unmatched Stripe refunds
      for (const sr of unmatchedStripe) {
        unmatchedRefunds.push({
          source: "stripe",
          date: sr.date,
          amount: sr.amount,
          name: sr.name,
        });
      }

      monthlyReconciliation.push({
        month: getMonthName(monthKey),
        monthKey,
        gymMasterTotal: Math.round(gm.total * 100) / 100,
        gymMasterCount: gm.count,
        stripeTotal: Math.round(st.total * 100) / 100,
        stripeCount: st.count,
        variance: Math.round(variance * 100) / 100,
        status: variance < 1 ? "reconciled" : "variance",
        unmatchedRefunds,
        // "No Payment / Adjustment" entries (not actual Stripe refunds)
        adjustmentsTotal: Math.round(gmAdj.total * 100) / 100,
        adjustmentsCount: gmAdj.count,
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

    // Regular refunds (excluding adjustments)
    const regularRefunds = gmRefunds.filter((r) => !r.isNonStripeAdjustment);
    const needsReviewCount = regularRefunds.filter((r) => r.status === "needs_review").length;
    const onTrackCount = regularRefunds.filter((r) => r.status === "on_track").length;
    const reconciledMonths = monthlyReconciliation.filter((m) => m.status === "reconciled").length;

    // Adjustment stats (payment method = "No Payment / Adjustment")
    const adjustments = gmRefunds.filter((r) => r.isNonStripeAdjustment);
    const adjustmentsCount = adjustments.length;
    const adjustmentsAmount = adjustments.reduce((s, r) => s + r.refundAmount, 0);

    // Regular GymMaster amount (for reconciliation)
    const regularGymMasterAmount = regularRefunds.reduce((s, r) => s + r.refundAmount, 0);

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
        // Adjustment stats ("No Payment / Adjustment" entries)
        adjustmentsCount,
        adjustmentsAmount: Math.round(adjustmentsAmount * 100) / 100,
        // Regular GymMaster total (for reconciliation, excludes adjustments)
        regularGymMasterAmount: Math.round(regularGymMasterAmount * 100) / 100,
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
