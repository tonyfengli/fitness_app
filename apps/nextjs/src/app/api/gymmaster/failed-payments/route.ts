/**
 * GymMaster Failed/Delinquent Payments API
 * GET /api/gymmaster/failed-payments?start_date=2026-06-01&end_date=2026-09-30
 * Returns payments with $0 amount (failed billing attempts)
 */

import { NextRequest, NextResponse } from "next/server";

const REPORT_ID_ALL_PAYMENTS = 103;

async function fetchPaymentsReport(
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
      report_id: REPORT_ID_ALL_PAYMENTS,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GymMaster API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.result || [];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("start_date") || "2026-06-01";
  const endDate = searchParams.get("end_date") || "2026-09-30";

  try {
    const allPayments = await fetchPaymentsReport(startDate, endDate);

    // Filter for $0 payments (failed billing attempts)
    const failedPayments = allPayments.filter((row) => {
      const amount = parseFloat(String(row["Payment Amount"] || "0").replace(/[$,]/g, ""));
      const details = String(row["Payment Details"] || "").toLowerCase();
      // $0 payments that aren't refunds
      return amount === 0 && !details.includes("refund");
    });

    // Format results
    const results = failedPayments.map((row) => ({
      memberId: String(row["Member ID"] || ""),
      memberName: String(row["Name"] || ""),
      paymentDate: String(row["Payment Date"] || ""),
      paymentAmount: parseFloat(String(row["Payment Amount"] || "0").replace(/[$,]/g, "")),
      paymentDetails: String(row["Payment Details"] || ""),
      paymentNote: String(row["Payment Note"] || ""),
      paymentMethod: String(row["Payment Method"] || ""),
    }));

    // Sort by date descending
    results.sort((a, b) => {
      const dateA = new Date(a.paymentDate).getTime() || 0;
      const dateB = new Date(b.paymentDate).getTime() || 0;
      return dateB - dateA;
    });

    return NextResponse.json({
      dateRange: { startDate, endDate },
      count: results.length,
      failedPayments: results,
    });
  } catch (err) {
    console.error("GymMaster failed payments error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
