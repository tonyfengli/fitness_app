/**
 * KPI Summary API for OpenClaw
 * GET /api/kpi/summary?month=10&year=2026
 *
 * Returns aggregated KPI metrics for the specified month.
 * Designed for AI agent consumption - clean, structured JSON.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchKpiReports } from "~/app/kpi/lib/gymmaster-api";
import { validateApiAccess } from "~/lib/api-auth";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Membership type categories for revenue breakdown
const MEMBERSHIP_CATEGORIES = {
  openGym: ["open gym", "open-gym", "opengym", "og "],
  pt: ["personal training", "pt ", "1-on-1", "1 on 1", "private"],
  sportsPerf: ["sports perf", "sport perf", "athletic", "performance"],
  smallGroup: ["small group", "semi-private", "group training", "class"],
  remote: ["remote", "online", "virtual"],
};

function categorizeMembership(membershipName: string): keyof typeof MEMBERSHIP_CATEGORIES | "other" {
  const lower = membershipName.toLowerCase();

  for (const [category, keywords] of Object.entries(MEMBERSHIP_CATEGORIES)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category as keyof typeof MEMBERSHIP_CATEGORIES;
    }
  }

  return "other";
}

export async function GET(request: NextRequest) {
  // Validate API key or session
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const monthStr = searchParams.get("month");
  const yearStr = searchParams.get("year");

  // Default to current month if not specified
  const now = new Date();
  const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
  const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

  if (month < 1 || month > 12) {
    return NextResponse.json(
      { error: "Invalid month. Must be 1-12." },
      { status: 400 }
    );
  }

  try {
    // Fetch reports from GymMaster
    const reports = await fetchKpiReports(year, month);

    // Count members
    const totalMembers = reports.current.currentMembers.length;
    const newMembersCount = reports.current.newMembers.length;
    const lostMembersCount = reports.current.cancellations.length;
    const onHoldCount = reports.current.membersOnHold.length;

    // Calculate revenue from all payments
    const revenueByCategory: Record<string, number> = {
      openGym: 0,
      pt: 0,
      sportsPerf: 0,
      smallGroup: 0,
      remote: 0,
      other: 0,
    };

    let totalRevenue = 0;

    for (const payment of reports.current.allPayments) {
      const amount = typeof payment["Payment Amount"] === "number"
        ? payment["Payment Amount"]
        : parseFloat(String(payment["Payment Amount"] || "0").replace(/[^0-9.-]/g, ""));

      if (isNaN(amount) || amount <= 0) continue;

      totalRevenue += amount;

      // Categorize by membership type
      const membershipType = String(payment["Membership Type"] || payment["Description"] || "");
      const category = categorizeMembership(membershipType);
      revenueByCategory[category] += amount;
    }

    // Calculate metrics
    const arm = totalMembers > 0 ? totalRevenue / totalMembers : 0;
    const churn = totalMembers > 0 ? (lostMembersCount / totalMembers) * 100 : 0;

    // Build response
    const response = {
      period: {
        month,
        year,
        monthName: MONTH_NAMES[month - 1],
        startDate: reports.current.period.startDate,
        endDate: reports.current.period.endDate,
      },
      membership: {
        totalMembers,
        newMembers: newMembersCount,
        lostMembers: lostMembersCount,
        onHold: onHoldCount,
        netChange: newMembersCount - lostMembersCount,
      },
      revenue: {
        total: Math.round(totalRevenue * 100) / 100,
        openGym: Math.round(revenueByCategory.openGym * 100) / 100,
        pt: Math.round(revenueByCategory.pt * 100) / 100,
        sportsPerf: Math.round(revenueByCategory.sportsPerf * 100) / 100,
        smallGroup: Math.round(revenueByCategory.smallGroup * 100) / 100,
        remote: Math.round(revenueByCategory.remote * 100) / 100,
        other: Math.round(revenueByCategory.other * 100) / 100,
      },
      metrics: {
        arm: Math.round(arm * 100) / 100,
        churn: Math.round(churn * 100) / 100,
      },
      _meta: {
        generatedAt: new Date().toISOString(),
        dataSource: "gymmaster",
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API /kpi/summary] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("Missing GymMaster configuration")) {
      return NextResponse.json(
        { error: "GymMaster API not configured", needsSetup: true },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `Failed to fetch KPI summary: ${message}` },
      { status: 500 }
    );
  }
}
