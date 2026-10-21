/**
 * GymMaster Full Member Payment Details
 * GET /api/gymmaster/member-full?name=Shanta&year=2026
 * Returns ALL fields from GymMaster for debugging
 */

import { NextRequest, NextResponse } from "next/server";
import { validateApiAccess } from "~/lib/api-auth";

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
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const allPayments = await fetchPaymentsReport(startDate, endDate);

    // Filter by member name (case-insensitive partial match)
    const searchLower = searchName.toLowerCase();
    const matchingPayments = allPayments.filter((row) => {
      const name = String(row["Name"] || "").toLowerCase();
      return name.includes(searchLower);
    });

    // Return raw data with all fields (excluding sorted_ fields)
    const cleanedPayments = matchingPayments.map((row) => {
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        if (!key.startsWith("sorted_")) {
          cleaned[key] = value;
        }
      }
      return cleaned;
    });

    return NextResponse.json({
      search: searchName,
      year,
      count: cleanedPayments.length,
      payments: cleanedPayments,
    });
  } catch (err) {
    console.error("GymMaster full member error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
