/**
 * Stripe Monthly Summary API
 * GET /api/stripe/monthly?start_month=1&end_month=9&year=2026
 * Returns monthly breakdown of Stripe charges and fees
 */

import { NextRequest, NextResponse } from "next/server";
import { getMonthlyStripeSummary } from "~/lib/stripe";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startMonth = parseInt(searchParams.get("start_month") || "1");
  const endMonth = parseInt(searchParams.get("end_month") || "9");
  const year = parseInt(searchParams.get("year") || "2026");

  try {
    const monthlyData = await getMonthlyStripeSummary(startMonth, endMonth, year);

    // Calculate totals
    const totals = monthlyData.reduce(
      (acc, m) => ({
        grossAmount: acc.grossAmount + m.grossAmount,
        fees: acc.fees + m.fees,
        netAmount: acc.netAmount + m.netAmount,
        chargeCount: acc.chargeCount + m.chargeCount,
        refunds: acc.refunds + m.refunds,
      }),
      { grossAmount: 0, fees: 0, netAmount: 0, chargeCount: 0, refunds: 0 }
    );

    const avgFeePercentage =
      totals.grossAmount > 0 ? (totals.fees / totals.grossAmount) * 100 : 0;

    return NextResponse.json({
      dateRange: { startMonth, endMonth, year },
      months: monthlyData,
      totals: {
        ...totals,
        avgFeePercentage: avgFeePercentage.toFixed(2) + "%",
      },
    });
  } catch (err) {
    console.error("Stripe monthly API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch Stripe data" },
      { status: 500 }
    );
  }
}
