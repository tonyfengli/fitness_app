/**
 * Stripe Unmatched Refunds Deep Dive
 * GET /api/stripe/unmatched-refunds?year=2026
 * Fetches full charge details for refunds with missing customer info
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { validateApiAccess } from "~/lib/api-auth";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });
}

interface RefundDetail {
  refundId: string;
  refundDate: string;
  refundAmount: number;
  chargeId: string;
  chargeDate: string;
  chargeAmount: number;
  chargeDescription: string | null;
  billingName: string | null;
  billingEmail: string | null;
  receiptEmail: string | null;
  customerEmail: string | null;
  metadata: Record<string, string>;
  paymentMethod: string | null;
  statementDescriptor: string | null;
}

export async function GET(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(searchParams.get("year") || "2026");

  try {
    const startTimestamp = Math.floor(new Date(`${year}-01-01`).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(`${year}-12-31T23:59:59`).getTime() / 1000);

    // Fetch all refunds
    const refunds: Stripe.Refund[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const response = await getStripe().refunds.list({
        created: { gte: startTimestamp, lte: endTimestamp },
        limit: 100,
        ...(startingAfter && { starting_after: startingAfter }),
      });
      refunds.push(...response.data);
      hasMore = response.has_more;
      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1]!.id;
      }
    }

    // Get full details for each refund
    const details: RefundDetail[] = [];

    for (const refund of refunds) {
      const chargeId = typeof refund.charge === 'string' ? refund.charge : refund.charge?.id;

      if (!chargeId) continue;

      try {
        // Fetch the full charge with expanded customer
        const charge = await getStripe().charges.retrieve(chargeId, {
          expand: ['customer', 'payment_method_details'],
        });

        // Get customer details if available
        let customerEmail: string | null = null;
        if (charge.customer && typeof charge.customer !== 'string') {
          customerEmail = charge.customer.email;
        } else if (typeof charge.customer === 'string') {
          try {
            const customer = await getStripe().customers.retrieve(charge.customer);
            if (!customer.deleted) {
              customerEmail = customer.email;
            }
          } catch {
            // Customer may be deleted
          }
        }

        details.push({
          refundId: refund.id,
          refundDate: new Date(refund.created * 1000).toISOString().split('T')[0]!,
          refundAmount: refund.amount / 100,
          chargeId: charge.id,
          chargeDate: new Date(charge.created * 1000).toISOString().split('T')[0]!,
          chargeAmount: charge.amount / 100,
          chargeDescription: charge.description,
          billingName: charge.billing_details?.name || null,
          billingEmail: charge.billing_details?.email || null,
          receiptEmail: charge.receipt_email,
          customerEmail,
          metadata: (charge.metadata || {}) as Record<string, string>,
          paymentMethod: charge.payment_method_details?.type || null,
          statementDescriptor: charge.statement_descriptor || charge.calculated_statement_descriptor || null,
        });
      } catch (err) {
        console.error(`Failed to fetch charge ${chargeId}:`, err);
      }
    }

    // Sort by refund amount descending
    details.sort((a, b) => b.refundAmount - a.refundAmount);

    // Categorize
    const withGymMasterBillId = details.filter(d => d.metadata.bill_id);
    const withRealtimeId = details.filter(d => d.metadata.realtime_id);
    const noMetadata = details.filter(d => !d.metadata.bill_id && !d.metadata.realtime_id);

    return NextResponse.json({
      year,
      total: details.length,
      summary: {
        gymMasterPayments: withGymMasterBillId.length,
        realtimePayments: withRealtimeId.length,
        noMetadata: noMetadata.length,
      },
      refunds: details,
    });
  } catch (err) {
    console.error("Unmatched refunds error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
