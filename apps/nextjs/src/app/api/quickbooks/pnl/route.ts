/**
 * QuickBooks P&L API
 * GET /api/quickbooks/pnl?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * Fetches Profit and Loss report from QuickBooks
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchProfitAndLoss, isQuickBooksConnected } from "~/lib/quickbooks";

export async function GET(request: NextRequest) {
  // Check if QuickBooks is connected
  const connected = await isQuickBooksConnected();
  if (!connected) {
    return NextResponse.json(
      { error: "QuickBooks not connected", needsAuth: true },
      { status: 401 }
    );
  }

  // Get date range from query params
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "start_date and end_date are required" },
      { status: 400 }
    );
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD" },
      { status: 400 }
    );
  }

  try {
    const report = await fetchProfitAndLoss(startDate, endDate);

    if (!report) {
      return NextResponse.json(
        { error: "Failed to fetch P&L report" },
        { status: 500 }
      );
    }

    return NextResponse.json(report);
  } catch (err) {
    console.error("P&L API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
