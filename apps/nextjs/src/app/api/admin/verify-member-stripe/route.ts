/**
 * Verify Member Transactions Against Stripe
 * GET /api/admin/verify-member-stripe?memberId=322714&startDate=2026-05-01&endDate=2026-10-31
 *
 * Returns verification status for each GymMaster transaction
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { validateApiAccess } from "~/lib/api-auth";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });
}

type VerificationStatus = "verified" | "uncertain" | "manual" | "not_found";

interface TransactionVerification {
  date: string;
  amount: number;
  type: "charge" | "refund";
  paymentMethod: string;
  status: VerificationStatus;
  stripeMatch?: {
    id: string;
    amount: number;
    date: string;
  };
}

interface VerifyMemberResponse {
  memberId: string;
  memberName: string;
  transactions: TransactionVerification[];
  summary: {
    verified: number;
    uncertain: number;
    manual: number;
    notFound: number;
    total: number;
  };
}

// Fetch GymMaster payments for a specific member
async function fetchMemberPayments(
  memberId: string,
  startDate: string,
  endDate: string
): Promise<Record<string, unknown>[]> {
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
  const allPayments = data.result || [];

  // Filter for this member
  return allPayments.filter(
    (p: Record<string, unknown>) => String(p["Member ID"]) === memberId
  );
}

// Fetch Stripe charges for a date range
async function fetchStripeCharges(
  startDate: string,
  endDate: string
): Promise<Map<string, Stripe.Charge[]>> {
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  // Map of date -> charges on that date
  const chargesByDate = new Map<string, Stripe.Charge[]>();

  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await getStripe().charges.list({
      created: { gte: startTs, lte: endTs },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const charge of response.data) {
      if (charge.status === "succeeded" && charge.paid) {
        const date = new Date(charge.created * 1000).toISOString().split("T")[0] ?? "";
        if (date && !chargesByDate.has(date)) {
          chargesByDate.set(date, []);
        }
        if (date) chargesByDate.get(date)!.push(charge);
      }
    }

    hasMore = response.has_more;
    const lastItem = response.data[response.data.length - 1];
    if (lastItem) {
      startingAfter = lastItem.id;
    }
  }

  return chargesByDate;
}

// Fetch Stripe refunds for a date range
async function fetchStripeRefunds(
  startDate: string,
  endDate: string
): Promise<Map<string, Stripe.Refund[]>> {
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  // Map of date -> refunds on that date
  const refundsByDate = new Map<string, Stripe.Refund[]>();

  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await getStripe().refunds.list({
      created: { gte: startTs, lte: endTs },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const refund of response.data) {
      if (refund.status === "succeeded") {
        const date = new Date(refund.created * 1000).toISOString().split("T")[0] ?? "";
        if (date && !refundsByDate.has(date)) {
          refundsByDate.set(date, []);
        }
        if (date) refundsByDate.get(date)!.push(refund);
      }
    }

    hasMore = response.has_more;
    const lastItem = response.data[response.data.length - 1];
    if (lastItem) {
      startingAfter = lastItem.id;
    }
  }

  return refundsByDate;
}

// Parse GymMaster date format to ISO
function parseGymMasterDate(dateStr: string): string {
  // Handle "Oct 5 2026" format
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04",
    May: "05", Jun: "06", Jul: "07", Aug: "08",
    Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };

  const match = dateStr.match(/^(\w+)\s+(\d+)\s+(\d{4})$/);
  if (match) {
    const [, monthName, day, year] = match;
    const month = months[monthName!];
    if (month) {
      return `${year}-${month}-${day!.padStart(2, "0")}`;
    }
  }

  // Already ISO format
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateStr.substring(0, 10);
  }

  return dateStr;
}

// Check if payment method is Stripe-related
function isStripePaymentMethod(method: string): boolean {
  const lower = method.toLowerCase();
  return lower.includes("billing") || lower.includes("stripe") || lower.includes("online payment");
}

export async function GET(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const memberId = searchParams.get("memberId");
  const startDate = searchParams.get("startDate") || "2026-01-01";
  const endDate = searchParams.get("endDate") || "2026-12-31";

  if (!memberId) {
    return NextResponse.json(
      { error: "memberId parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Fetch data in parallel
    const [gmPayments, stripeCharges, stripeRefunds] = await Promise.all([
      fetchMemberPayments(memberId, startDate, endDate),
      fetchStripeCharges(startDate, endDate),
      fetchStripeRefunds(startDate, endDate),
    ]);

    // Track used Stripe transactions to avoid double-matching
    const usedChargeIds = new Set<string>();
    const usedRefundIds = new Set<string>();

    // Get member name from first payment
    const firstPayment = gmPayments[0];
    const memberName = firstPayment
      ? String(firstPayment["Name"] || "Unknown")
      : "Unknown";

    // Verify each transaction
    const transactions: TransactionVerification[] = [];
    let verified = 0;
    let uncertain = 0;
    let manual = 0;
    let notFound = 0;

    for (const payment of gmPayments) {
      const rawDate = String(payment["Payment Date"] || "");
      const date = parseGymMasterDate(rawDate);
      const amount = parseFloat(String(payment["Payment Amount"] || "0").replace(/[$,]/g, ""));
      const paymentMethod = String(payment["Payment Method"] || "");
      const details = String(payment["Payment Details"] || "").toLowerCase();

      const isRefund = amount < 0 || details.includes("payment refund");
      const type: "charge" | "refund" = isRefund ? "refund" : "charge";
      const absAmount = Math.abs(amount);

      // Skip $0 transactions
      if (absAmount === 0) continue;

      // Check if this is a Stripe transaction
      if (!isStripePaymentMethod(paymentMethod)) {
        transactions.push({
          date: rawDate,
          amount,
          type,
          paymentMethod,
          status: "manual",
        });
        manual++;
        continue;
      }

      // Try to find matching Stripe transaction
      let status: VerificationStatus = "not_found";
      let stripeMatch: TransactionVerification["stripeMatch"] = undefined;

      if (isRefund) {
        // Look for matching Stripe refund
        // Check same day and nearby days (±2 days) for timing differences
        for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
          const checkDate = new Date(date);
          checkDate.setDate(checkDate.getDate() + dayOffset);
          const checkDateStr = checkDate.toISOString().split("T")[0] ?? "";

          const dayRefunds = stripeRefunds.get(checkDateStr) || [];
          for (const refund of dayRefunds) {
            const refundAmount = refund.amount / 100;
            // Match if amount is within $0.01
            if (Math.abs(refundAmount - absAmount) < 0.01 && !usedRefundIds.has(refund.id)) {
              usedRefundIds.add(refund.id);
              status = "verified";
              stripeMatch = {
                id: refund.id,
                amount: refundAmount,
                date: checkDateStr || "",
              };
              break;
            }
          }
          if (status === "verified") break;

          // Also check previous days
          if (dayOffset > 0) {
            const checkDatePrev = new Date(date);
            checkDatePrev.setDate(checkDatePrev.getDate() - dayOffset);
            const checkDatePrevStr = checkDatePrev.toISOString().split("T")[0] ?? "";

            const dayRefundsPrev = stripeRefunds.get(checkDatePrevStr) || [];
            for (const refund of dayRefundsPrev) {
              const refundAmount = refund.amount / 100;
              if (Math.abs(refundAmount - absAmount) < 0.01 && !usedRefundIds.has(refund.id)) {
                usedRefundIds.add(refund.id);
                status = "verified";
                stripeMatch = {
                  id: refund.id,
                  amount: refundAmount,
                  date: checkDatePrevStr || "",
                };
                break;
              }
            }
            if (status === "verified") break;
          }
        }
      } else {
        // Look for matching Stripe charge
        for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
          const checkDate = new Date(date);
          checkDate.setDate(checkDate.getDate() + dayOffset);
          const checkDateStr = checkDate.toISOString().split("T")[0] ?? "";

          const dayCharges = stripeCharges.get(checkDateStr) || [];
          for (const charge of dayCharges) {
            const chargeAmount = charge.amount / 100;
            if (Math.abs(chargeAmount - absAmount) < 0.01 && !usedChargeIds.has(charge.id)) {
              usedChargeIds.add(charge.id);
              status = "verified";
              stripeMatch = {
                id: charge.id,
                amount: chargeAmount,
                date: checkDateStr || "",
              };
              break;
            }
          }
          if (status === "verified") break;

          // Also check previous days
          if (dayOffset > 0) {
            const checkDatePrev = new Date(date);
            checkDatePrev.setDate(checkDatePrev.getDate() - dayOffset);
            const checkDatePrevStr = checkDatePrev.toISOString().split("T")[0] ?? "";

            const dayChargesPrev = stripeCharges.get(checkDatePrevStr) || [];
            for (const charge of dayChargesPrev) {
              const chargeAmount = charge.amount / 100;
              if (Math.abs(chargeAmount - absAmount) < 0.01 && !usedChargeIds.has(charge.id)) {
                usedChargeIds.add(charge.id);
                status = "verified";
                stripeMatch = {
                  id: charge.id,
                  amount: chargeAmount,
                  date: checkDatePrevStr || "",
                };
                break;
              }
            }
            if (status === "verified") break;
          }
        }
      }

      // If not found but it's a Stripe method, mark as uncertain
      if (status === "not_found") {
        status = "uncertain";
        uncertain++;
      } else if (status === "verified") {
        verified++;
      } else {
        notFound++;
      }

      transactions.push({
        date: rawDate,
        amount,
        type,
        paymentMethod,
        status,
        stripeMatch,
      });
    }

    const response: VerifyMemberResponse = {
      memberId,
      memberName,
      transactions,
      summary: {
        verified,
        uncertain,
        manual,
        notFound,
        total: transactions.length,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Verify member stripe error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to verify" },
      { status: 500 }
    );
  }
}
