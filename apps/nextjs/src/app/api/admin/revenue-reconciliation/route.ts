/**
 * Revenue Reconciliation API
 * GET /api/admin/revenue-reconciliation?year=2026
 *
 * Compares GymMaster P&L revenue to Stripe charges to QuickBooks income to bank deposits.
 * Uses deterministic date matching (charge/payment date) for reconciliation.
 * The month-by-month logic lives in ~/lib/revenue-reconciliation.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { fetchMonthData, summarizeMonths, type MonthlyReconciliation } from "~/lib/revenue-reconciliation";

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(
    searchParams.get("year") || String(new Date().getFullYear())
  );

  // Determine which months to fetch
  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : 12;
  const startMonth = parseInt(searchParams.get("startMonth") || "1");
  const endMonth = parseInt(
    searchParams.get("endMonth") || String(currentMonth)
  );

  try {
    // Fetch all months in parallel
    const monthPromises: Promise<MonthlyReconciliation>[] = [];
    for (let m = startMonth; m <= endMonth; m++) {
      monthPromises.push(fetchMonthData(year, m));
    }

    const months = await Promise.all(monthPromises);

    return NextResponse.json(summarizeMonths(year, months));
  } catch (err) {
    console.error("Revenue reconciliation error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch reconciliation data",
      },
      { status: 500 }
    );
  }
}
