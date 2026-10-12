/**
 * Stripe Balance Transactions API
 * GET /api/stripe/balance?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * Returns balance transactions with fee breakdown
 */

import { NextRequest, NextResponse } from "next/server";
import { getBalanceTransactionsRaw } from "~/lib/stripe";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("start_date") || "2026-01-01";
  const endDate = searchParams.get("end_date") || "2026-09-30";
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    const data = await getBalanceTransactionsRaw(startDate, endDate, limit);

    // Calculate totals
    const charges = data.transactions.filter((t) => t.type === "charge");
    const totalGross = charges.reduce((sum, t) => sum + t.amount, 0);
    const totalFees = charges.reduce((sum, t) => sum + t.fee, 0);
    const totalNet = charges.reduce((sum, t) => sum + t.net, 0);
    const feePercentage = totalGross > 0 ? (totalFees / totalGross) * 100 : 0;

    return NextResponse.json({
      dateRange: { startDate, endDate },
      summary: {
        totalTransactions: data.total,
        chargeCount: charges.length,
        totalGross,
        totalFees,
        totalNet,
        feePercentage: feePercentage.toFixed(2) + "%",
      },
      transactions: data.transactions,
    });
  } catch (err) {
    console.error("Stripe API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch Stripe data" },
      { status: 500 }
    );
  }
}
