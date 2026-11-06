/**
 * At-Risk Members API for OpenClaw Retention Specialist
 * GET /api/agent/at-risk?month=10&year=2026
 *
 * Returns members who haven't attended a class/session recently. Days gone never exceed
 * days since they joined; members on a PT plan are left off (they don't book classes).
 * Combines finalized KPI data (source of truth for paying members)
 * with live GymMaster booking data (attendance tracking). The list itself is
 * computed in ~/lib/at-risk, shared with the Kilo retention board sync.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { computeAtRisk, LOOKBACK_DAYS } from "~/lib/at-risk";
import { getPlanPrices } from "~/lib/plan-price";
import { getMemberPhone } from "~/lib/gymmaster-member";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Validate API key or session
  const authError = await validateFounderAccess(request);
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
    const computed = await computeAtRisk(now);

    if (!computed) {
      return NextResponse.json({
        status: "no_data",
        message: "No finalized KPI snapshot found. Please finalize a month first.",
        atRiskMembers: [],
        _meta: {
          generatedAt: new Date().toISOString(),
        },
      });
    }

    const { roster, members: atRiskMembers, excludedMemberIds, ptMembers, bookingsQueried, gymMasterError } = computed;
    const snapshotData = { month: roster.month, year: roster.year, status: "finalized" };
    const payingMembers = roster.members;

    if (payingMembers.length === 0) {
      return NextResponse.json({
        status: "no_members",
        message: "No members in the KPI roster.",
        atRiskMembers: [],
        _meta: {
          generatedAt: new Date().toISOString(),
          snapshotMonth: snapshotData.month,
          snapshotYear: snapshotData.year,
        },
      });
    }

    const planPrices = await getPlanPrices(atRiskMembers.map(m => m.memberId));
    for (const m of atRiskMembers) m.planPrice = planPrices.get(m.memberId) ?? null;
    // The new account's members report has no phone column: look the missing ones up
    await Promise.all(atRiskMembers.filter(m => !m.phone).map(async m => { m.phone = await getMemberPhone(m.memberId).catch(() => null); }));

    // 6. Build summary stats
    const summary = {
      totalAtRisk: atRiskMembers.length,
      byTier: {
        bestOdds: atRiskMembers.filter(m => m.statusTier === "Best odds").length,
        fading: atRiskMembers.filter(m => m.statusTier === "Fading").length,
        longShot: atRiskMembers.filter(m => m.statusTier === "Long shot").length,
        critical: atRiskMembers.filter(m => m.statusTier === "Critical").length,
      },
      revenueAtRisk: Math.round(atRiskMembers.reduce((sum, m) => sum + m.monthlyRevenue, 0) * 100) / 100,
    };

    return NextResponse.json({
      status: gymMasterError ? "partial" : "live",
      warning: gymMasterError ? `GymMaster unavailable: ${gymMasterError}. Showing members without recent attendance data.` : null,
      month,
      year,
      summary,
      atRiskMembers,
      _meta: {
        generatedAt: new Date().toISOString(),
        dataSource: gymMasterError ? "supabase_only" : "supabase+gymmaster",
        snapshotMonth: snapshotData.month,
        snapshotYear: snapshotData.year,
        snapshotStatus: snapshotData.status,
        bookingsQueried,
        lookbackDays: LOOKBACK_DAYS,
        excludedByOverride: excludedMemberIds.size,
        excludedPt: payingMembers.filter(m => ptMembers.has(m.memberId)).length,
      },
    });
  } catch (error) {
    console.error("[API /agent/at-risk] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to fetch at-risk members: ${message}` },
      { status: 500 }
    );
  }
}
