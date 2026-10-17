/**
 * Stripe Detailed Refunds API
 * GET /api/stripe/refunds-detailed?start_month=1&end_month=9&year=2026
 * Returns detailed refund info with customer/member data
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });
}

interface RefundDetail {
  id: string;
  amount: number;
  date: string;
  reason: string | null;
  customerName: string | null;
  customerEmail: string | null;
  chargeDescription: string | null;
  metadata: Record<string, string>;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startMonth = parseInt(searchParams.get("start_month") || "1");
  const endMonth = parseInt(searchParams.get("end_month") || "9");
  const year = parseInt(searchParams.get("year") || "2026");

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  try {
    // Get date range
    const startDate = `${year}-${String(startMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(year, endMonth, 0).getDate();
    const endDate = `${year}-${String(endMonth).padStart(2, "0")}-${lastDay}`;

    const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

    // Fetch all refunds
    const refunds: Stripe.Refund[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const response = await getStripe().refunds.list({
        created: {
          gte: startTimestamp,
          lte: endTimestamp,
        },
        limit: 100,
        expand: ['data.charge', 'data.charge.customer'],
        ...(startingAfter && { starting_after: startingAfter }),
      });

      refunds.push(...response.data);
      hasMore = response.has_more;
      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1]!.id;
      }
    }

    // Process each refund to get member details
    const detailedRefunds: RefundDetail[] = await Promise.all(
      refunds.map(async (refund) => {
        let customerName: string | null = null;
        let customerEmail: string | null = null;
        let chargeDescription: string | null = null;
        let metadata: Record<string, string> = {};

        const charge = refund.charge as Stripe.Charge | null;

        if (charge) {
          chargeDescription = charge.description;
          metadata = (charge.metadata || {}) as Record<string, string>;

          // Get customer info from billing details first
          if (charge.billing_details) {
            customerName = charge.billing_details.name;
            customerEmail = charge.billing_details.email;
          }

          // If no billing details, try to get from customer object
          if (!customerName && charge.customer) {
            try {
              const customerId = typeof charge.customer === 'string'
                ? charge.customer
                : charge.customer.id;
              const customer = await getStripe().customers.retrieve(customerId);
              if (customer && !customer.deleted) {
                customerName = customer.name;
                customerEmail = customer.email;
              }
            } catch {
              // Ignore customer fetch errors
            }
          }

          // Try receipt_email as fallback
          if (!customerEmail && charge.receipt_email) {
            customerEmail = charge.receipt_email;
          }
        }

        const refundDate = new Date(refund.created * 1000);
        const monthIndex = refundDate.getMonth();

        return {
          id: refund.id,
          amount: refund.amount / 100,
          date: refundDate.toISOString().split('T')[0]!,
          month: MONTH_NAMES[monthIndex],
          reason: refund.reason,
          customerName,
          customerEmail,
          chargeDescription,
          metadata,
        };
      })
    );

    // Group by month
    const byMonth: Record<string, RefundDetail[]> = {};
    for (const refund of detailedRefunds) {
      const monthKey = (refund as any).month;
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = [];
      }
      byMonth[monthKey].push(refund);
    }

    // Sort refunds within each month by amount descending
    for (const month of Object.keys(byMonth)) {
      byMonth[month]!.sort((a, b) => b.amount - a.amount);
    }

    return NextResponse.json({
      dateRange: { startMonth, endMonth, year },
      totalRefunds: detailedRefunds.length,
      totalAmount: detailedRefunds.reduce((sum, r) => sum + r.amount, 0),
      byMonth,
      allRefunds: detailedRefunds.sort((a, b) => b.amount - a.amount),
    });
  } catch (err) {
    console.error("Stripe detailed refunds API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch refunds" },
      { status: 500 }
    );
  }
}
