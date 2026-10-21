import { NextRequest, NextResponse } from "next/server";
import { fetchKpiReportsAsCsv } from "~/app/kpi/lib/gymmaster-api";
import { validateApiAccess } from "~/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/kpi/fetch-reports
 *
 * Fetches KPI reports from GymMaster API for a given month.
 *
 * Query params:
 *   - month: 1-12 (required)
 *   - year: YYYY (required)
 *
 * Returns CSV strings for all 5 reports needed for KPI calculation,
 * plus previous month data for ghost churn detection.
 */
export async function GET(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const monthStr = searchParams.get("month");
    const yearStr = searchParams.get("year");

    // Validate parameters
    if (!monthStr || !yearStr) {
      return NextResponse.json(
        { error: "Missing required parameters: month and year" },
        { status: 400 }
      );
    }

    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Invalid month. Must be 1-12." },
        { status: 400 }
      );
    }

    if (isNaN(year) || year < 2020 || year > 2100) {
      return NextResponse.json(
        { error: "Invalid year. Must be between 2020 and 2100." },
        { status: 400 }
      );
    }

    // Fetch reports from GymMaster
    const reports = await fetchKpiReportsAsCsv(year, month);

    return NextResponse.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    console.error("[API /kpi/fetch-reports] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";

    // Check for specific error types
    if (message.includes("Missing GymMaster configuration")) {
      return NextResponse.json(
        { error: "GymMaster API not configured. Check environment variables." },
        { status: 500 }
      );
    }

    if (message.includes("GymMaster API error")) {
      return NextResponse.json(
        { error: message },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: `Failed to fetch reports: ${message}` },
      { status: 500 }
    );
  }
}
