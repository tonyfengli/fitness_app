/**
 * Manual losses for the KPI Membership Overview
 * GET /api/kpi/manual-lost?year=2026 - Members marked lost by hand
 * POST /api/kpi/manual-lost - { memberId, memberName, month, year } mark lost from that month
 * DELETE /api/kpi/manual-lost?memberId=123&month=10&year=2026 - undo
 *
 * Stored as kpi_member_override rows of type "mark_lost" (reason holds the member's
 * name). Saved immediately, independent of the month's snapshot save. Billing isn't
 * touched: a cancellation fee may still be charged in GymMaster.
 */

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiMemberOverride } from "@acme/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  const year = request.nextUrl.searchParams.get("year");
  try {
    const rows = await db
      .select()
      .from(KpiMemberOverride)
      .where(
        year
          ? and(eq(KpiMemberOverride.overrideType, "mark_lost"), eq(KpiMemberOverride.year, Number(year)))
          : eq(KpiMemberOverride.overrideType, "mark_lost")
      );
    return NextResponse.json({
      manualLost: rows.map((r) => ({ memberId: r.memberId, name: r.reason || `Member ${r.memberId}`, month: r.month, year: r.year })),
    });
  } catch (error) {
    console.error("[API /kpi/manual-lost] GET error:", error);
    return NextResponse.json({ error: "Failed to load manual losses" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const memberId = String(body?.memberId ?? "").trim();
  const memberName = String(body?.memberName ?? "").trim();
  const month = Number(body?.month);
  const year = Number(body?.year);
  if (!memberId || !memberName || !(month >= 1 && month <= 12) || !year) {
    return NextResponse.json({ error: "memberId, memberName, month (1-12) and year are required" }, { status: 400 });
  }

  try {
    await db
      .insert(KpiMemberOverride)
      .values({ memberId, month, year, overrideType: "mark_lost", reason: memberName })
      .onConflictDoNothing();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /kpi/manual-lost] POST error:", error);
    return NextResponse.json({ error: "Failed to mark member lost" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  const params = request.nextUrl.searchParams;
  const memberId = params.get("memberId");
  const month = Number(params.get("month"));
  const year = Number(params.get("year"));
  if (!memberId || !month || !year) {
    return NextResponse.json({ error: "memberId, month and year are required" }, { status: 400 });
  }

  try {
    await db
      .delete(KpiMemberOverride)
      .where(
        and(
          eq(KpiMemberOverride.memberId, memberId),
          eq(KpiMemberOverride.month, month),
          eq(KpiMemberOverride.year, year),
          eq(KpiMemberOverride.overrideType, "mark_lost")
        )
      );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /kpi/manual-lost] DELETE error:", error);
    return NextResponse.json({ error: "Failed to undo manual loss" }, { status: 500 });
  }
}
