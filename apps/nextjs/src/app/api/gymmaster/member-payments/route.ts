/**
 * GymMaster Member Payments API
 * GET /api/gymmaster/member-payments?name=Shanta&year=2026
 * Searches for all payments by a member name
 */

import { NextRequest, NextResponse } from "next/server";
import { validateApiAccess } from "~/lib/api-auth";

const REPORT_ID_ALL_PAYMENTS = 103;

interface PaymentRecord {
  memberId: string;
  memberName: string;
  paymentDate: string;
  paymentAmount: number;
  paymentType: string;
  membershipType: string;
  status: string;
}

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
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const searchName = searchParams.get("name") || "";
  const year = parseInt(searchParams.get("year") || "2026");

  if (!searchName) {
    return NextResponse.json(
      { error: "name parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Fetch entire year of payments
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const allPayments = await fetchPaymentsReport(startDate, endDate);

    // Filter by member name (case-insensitive partial match)
    const searchLower = searchName.toLowerCase();
    const matchingPayments = allPayments.filter((row) => {
      const name = String(row["Member Name"] || row["Name"] || "").toLowerCase();
      return name.includes(searchLower);
    });

    // Parse and format the results
    const payments: PaymentRecord[] = matchingPayments.map((row) => ({
      memberId: String(row["Member ID"] || ""),
      memberName: String(row["Member Name"] || row["Name"] || ""),
      paymentDate: String(row["Payment Date"] || ""),
      paymentAmount: parseFloat(String(row["Payment Amount"] || row["Amount"] || "0").replace(/[$,]/g, "")),
      paymentType: String(row["Payment Type"] || row["Type"] || ""),
      membershipType: String(row["Membership Type"] || row["Membership"] || ""),
      status: String(row["Status"] || row["Payment Status"] || ""),
    }));

    // Sort by date descending
    payments.sort((a, b) => {
      const dateA = new Date(a.paymentDate).getTime() || 0;
      const dateB = new Date(b.paymentDate).getTime() || 0;
      return dateB - dateA;
    });

    // Calculate totals
    const totalAmount = payments.reduce((sum, p) => sum + p.paymentAmount, 0);

    // Get unique member IDs
    const uniqueMembers = [...new Set(payments.map(p => p.memberId))];

    return NextResponse.json({
      search: searchName,
      year,
      matchCount: payments.length,
      totalAmount,
      uniqueMembers,
      payments,
      // Also return column names from first row for debugging
      availableColumns: allPayments.length > 0 ? Object.keys(allPayments[0]) : [],
    });
  } catch (err) {
    console.error("GymMaster member payments error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch payments" },
      { status: 500 }
    );
  }
}
