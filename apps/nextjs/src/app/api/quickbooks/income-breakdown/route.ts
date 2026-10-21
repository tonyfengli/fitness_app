/**
 * QuickBooks Income Breakdown API
 * GET /api/quickbooks/income-breakdown?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * Shows detailed income account breakdown for debugging
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchProfitAndLoss, isQuickBooksConnected } from "~/lib/quickbooks";
import { validateApiAccess } from "~/lib/api-auth";

export async function GET(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const connected = await isQuickBooksConnected();
  if (!connected) {
    return NextResponse.json(
      { error: "QuickBooks not connected", needsAuth: true },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("start_date") || "2026-01-01";
  const endDate = searchParams.get("end_date") || "2026-09-30";

  try {
    const report = await fetchProfitAndLoss(startDate, endDate);

    if (!report) {
      return NextResponse.json(
        { error: "Failed to fetch P&L report" },
        { status: 500 }
      );
    }

    // Group income by account name patterns
    const stripeAccounts = report.income.filter(r =>
      r.account.toLowerCase().includes("stripe")
    );
    const otherAccounts = report.income.filter(r =>
      !r.account.toLowerCase().includes("stripe")
    );

    const stripeTotal = stripeAccounts.reduce((sum, r) => sum + r.amount, 0);
    const otherTotal = otherAccounts.reduce((sum, r) => sum + r.amount, 0);

    return NextResponse.json({
      dateRange: { startDate, endDate },
      totalIncome: report.totalIncome,
      stripeIncome: {
        total: stripeTotal,
        accounts: stripeAccounts,
      },
      otherIncome: {
        total: otherTotal,
        accounts: otherAccounts,
      },
      allIncomeAccounts: report.income,
    });
  } catch (err) {
    console.error("Income breakdown error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
