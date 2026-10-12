/**
 * Stripe Refunds API
 * GET /api/stripe/refunds?start_month=1&end_month=9&year=2026
 * Returns detailed refund breakdown by month
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

interface RefundDetail {
  id: string;
  amount: number;
  created: string;
  reason: string | null;
  status: string;
  chargeId: string;
  description: string | null;
}

interface MonthRefunds {
  month: string;
  year: number;
  total: number;
  count: number;
  refunds: RefundDetail[];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startMonth = parseInt(searchParams.get("start_month") || "1");
  const endMonth = parseInt(searchParams.get("end_month") || "9");
  const year = parseInt(searchParams.get("year") || "2026");

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  try {
    const results: MonthRefunds[] = [];

    for (let m = startMonth; m <= endMonth; m++) {
      const startDate = `${year}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(year, m, 0).getDate();
      const endDate = `${year}-${String(m).padStart(2, "0")}-${lastDay}`;

      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

      // Fetch refunds for this month
      const refunds: Stripe.Refund[] = [];
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        const response = await stripe.refunds.list({
          created: {
            gte: startTimestamp,
            lte: endTimestamp,
          },
          limit: 100,
          ...(startingAfter && { starting_after: startingAfter }),
        });

        refunds.push(...response.data);
        hasMore = response.has_more;
        if (response.data.length > 0) {
          startingAfter = response.data[response.data.length - 1]!.id;
        }
      }

      // Get charge details for each refund
      const refundDetails: RefundDetail[] = await Promise.all(
        refunds.map(async (refund) => {
          let description: string | null = null;

          // Try to get the charge to get more details
          if (refund.charge && typeof refund.charge === 'string') {
            try {
              const charge = await stripe.charges.retrieve(refund.charge);
              description = charge.description || charge.billing_details?.name || null;
            } catch {
              // Ignore errors fetching charge details
            }
          }

          return {
            id: refund.id,
            amount: refund.amount / 100,
            created: new Date(refund.created * 1000).toISOString(),
            reason: refund.reason,
            status: refund.status || 'unknown',
            chargeId: typeof refund.charge === 'string' ? refund.charge : refund.charge?.id || '',
            description,
          };
        })
      );

      const total = refundDetails.reduce((sum, r) => sum + r.amount, 0);

      results.push({
        month: MONTH_NAMES[m - 1]!,
        year,
        total,
        count: refundDetails.length,
        refunds: refundDetails,
      });
    }

    const grandTotal = results.reduce((sum, m) => sum + m.total, 0);
    const totalCount = results.reduce((sum, m) => sum + m.count, 0);

    return NextResponse.json({
      dateRange: { startMonth, endMonth, year },
      months: results,
      totals: {
        amount: grandTotal,
        count: totalCount,
      },
    });
  } catch (err) {
    console.error("Stripe refunds API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch refunds" },
      { status: 500 }
    );
  }
}
