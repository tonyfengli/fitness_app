/**
 * Stripe Refund Reconciliation API
 * GET /api/stripe/refund-reconciliation?year=2026
 * Cross-references Stripe refunds with GymMaster to verify net = $0
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });
}

interface ReconciliationResult {
  refundId: string;
  date: string;
  customerName: string;
  refundAmount: number;
  matchingChargeInGM: number | null;
  netAmount: number | null;
  status: "VERIFIED" | "UNMATCHED" | "OVERPAID" | "ERROR";
  notes: string;
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(searchParams.get("year") || "2026");

  try {
    // Fetch all Stripe refunds for the year
    const startTimestamp = Math.floor(new Date(`${year}-01-01`).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(`${year}-12-31T23:59:59`).getTime() / 1000);

    const refunds: Stripe.Refund[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const response = await getStripe().refunds.list({
        created: { gte: startTimestamp, lte: endTimestamp },
        limit: 100,
        expand: ['data.charge'],
        ...(startingAfter && { starting_after: startingAfter }),
      });
      refunds.push(...response.data);
      hasMore = response.has_more;
      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1]!.id;
      }
    }

    // Fetch all GymMaster payments for the year
    const gmPayments = await fetchGymMasterPayments(`${year}-01-01`, `${year}-12-31`);

    // Build lookup by name (lowercase, trimmed)
    const gmByName: Map<string, Record<string, any>[]> = new Map();
    for (const payment of gmPayments) {
      const name = String(payment["Name"] || "").toLowerCase().trim();
      if (!gmByName.has(name)) {
        gmByName.set(name, []);
      }
      gmByName.get(name)!.push(payment);
    }

    // Reconcile each refund
    const results: ReconciliationResult[] = [];

    for (const refund of refunds) {
      const charge = refund.charge as Stripe.Charge | null;
      const customerName = charge?.billing_details?.name || "Unknown";
      const refundAmount = refund.amount / 100;
      const refundDate = new Date(refund.created * 1000).toISOString().split('T')[0]!;

      // Try to find matching GymMaster record
      // GymMaster uses "Last, First" format, Stripe uses "First Last"
      const nameLower = customerName.toLowerCase().trim();
      const nameParts = nameLower.split(/[\s,]+/).filter(Boolean);

      let gmMatches: Record<string, any>[] = [];

      // Try exact match first
      if (gmByName.has(nameLower)) {
        gmMatches = gmByName.get(nameLower)!;
      }

      // Try "Last, First" format
      if (gmMatches.length === 0 && nameParts.length >= 2) {
        const lastFirst = `${nameParts[nameParts.length - 1]}, ${nameParts[0]}`;
        if (gmByName.has(lastFirst)) {
          gmMatches = gmByName.get(lastFirst)!;
        }
      }

      // Try partial match on last name
      if (gmMatches.length === 0 && nameParts.length >= 1) {
        const lastName = nameParts[nameParts.length - 1];
        for (const [gmName, payments] of gmByName.entries()) {
          if (gmName.startsWith(lastName + ",") || gmName.includes(lastName)) {
            gmMatches = gmMatches.concat(payments);
          }
        }
      }

      // Find the corresponding charge in GymMaster (same amount, within 7 days)
      let matchingCharge: number | null = null;
      let matchingRefund: number | null = null;
      let notes = "";

      for (const gm of gmMatches) {
        const gmAmount = parseFloat(String(gm["Payment Amount"] || "0").replace(/[$,]/g, ""));
        const gmDate = String(gm["Payment Date"] || "");
        const gmDetails = String(gm["Payment Details"] || "");

        // Check if this is the refund record in GymMaster
        if (Math.abs(gmAmount + refundAmount) < 0.01 && gmDetails.includes("Refund")) {
          matchingRefund = Math.abs(gmAmount);
          notes = String(gm["Payment Note"] || "");
        }

        // Check if this is the original charge
        if (Math.abs(gmAmount - refundAmount) < 0.01 && !gmDetails.includes("Refund")) {
          matchingCharge = gmAmount;
        }
      }

      let status: ReconciliationResult["status"];
      let netAmount: number | null = null;

      if (matchingCharge !== null && matchingRefund !== null) {
        netAmount = matchingCharge - refundAmount;
        status = Math.abs(netAmount) < 0.01 ? "VERIFIED" : "OVERPAID";
      } else if (matchingCharge !== null) {
        netAmount = matchingCharge - refundAmount;
        status = "VERIFIED";
      } else if (gmMatches.length === 0) {
        status = "UNMATCHED";
        notes = "No GymMaster records found for this customer";
      } else {
        status = "ERROR";
        notes = `Found ${gmMatches.length} GM records but no matching charge amount`;
      }

      results.push({
        refundId: refund.id,
        date: refundDate,
        customerName,
        refundAmount,
        matchingChargeInGM: matchingCharge,
        netAmount,
        status,
        notes,
      });
    }

    // Sort by status (UNMATCHED first, then by amount)
    results.sort((a, b) => {
      const statusOrder = { UNMATCHED: 0, OVERPAID: 1, ERROR: 2, VERIFIED: 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return b.refundAmount - a.refundAmount;
    });

    // Summary
    const verified = results.filter(r => r.status === "VERIFIED");
    const unmatched = results.filter(r => r.status === "UNMATCHED");
    const overpaid = results.filter(r => r.status === "OVERPAID");
    const errors = results.filter(r => r.status === "ERROR");

    return NextResponse.json({
      year,
      summary: {
        total: results.length,
        verified: verified.length,
        unmatched: unmatched.length,
        overpaid: overpaid.length,
        errors: errors.length,
        totalRefunded: results.reduce((sum, r) => sum + r.refundAmount, 0),
        unmatchedAmount: unmatched.reduce((sum, r) => sum + r.refundAmount, 0),
      },
      results,
    });
  } catch (err) {
    console.error("Reconciliation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reconcile" },
      { status: 500 }
    );
  }
}
