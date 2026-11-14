/**
 * P&L Snapshots API - the P&L tab's default data, no QuickBooks needed
 * GET /api/pnl/snapshots?year=2026 - Saved months + totals (same shape as revenue-reconciliation)
 * PATCH /api/pnl/snapshots - { month, year, status: "draft" | "finalized" } finalize or reopen a month
 */

import { and, asc, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { PnlMonthlySnapshot } from "@acme/db/schema";
import { after, NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { syncMonthToNotion } from "~/lib/kpi-notion-sync";
import { isQuickBooksConnected } from "~/lib/quickbooks";
import { summarizeMonths, type MonthlyReconciliation } from "~/lib/revenue-reconciliation";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // the Notion update after finalize/reopen runs after the response

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  const year = parseInt(request.nextUrl.searchParams.get("year") || String(new Date().getFullYear()));

  try {
    const [rows, connected] = await Promise.all([
      db.select().from(PnlMonthlySnapshot).where(eq(PnlMonthlySnapshot.year, year)).orderBy(asc(PnlMonthlySnapshot.month)),
      isQuickBooksConnected(),
    ]);

    const months = rows.map((r) => r.data as unknown as MonthlyReconciliation);
    return NextResponse.json({
      ...summarizeMonths(year, months),
      // Live connection status: whether "Refresh from QuickBooks" can run right now
      quickbooksConnected: connected,
      snapshots: rows.map((r) => ({
        month: r.month,
        status: r.status,
        finalizedAt: r.finalizedAt,
        refreshedAt: r.refreshedAt,
      })),
    });
  } catch (error) {
    console.error("[API /pnl/snapshots] GET error:", error);
    return NextResponse.json({ error: "Failed to load saved P&L data" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const { month, year, status } = body ?? {};
  if (!month || !year || (status !== "draft" && status !== "finalized")) {
    return NextResponse.json({ error: "month, year and status ('draft' or 'finalized') are required" }, { status: 400 });
  }

  try {
    const updated = await db
      .update(PnlMonthlySnapshot)
      .set({ status, finalizedAt: status === "finalized" ? new Date() : null })
      .where(and(eq(PnlMonthlySnapshot.month, month), eq(PnlMonthlySnapshot.year, year)))
      .returning({ id: PnlMonthlySnapshot.id });
    if (!updated.length) {
      return NextResponse.json({ error: "No saved P&L data for that month" }, { status: 404 });
    }
    // Notion's Monthly KPIs page shows the P&L as Final or Draft, after the response
    after(() => syncMonthToNotion(Number(year), Number(month), status === "finalized" ? "P&L finalized" : "P&L reopened"));
    return NextResponse.json({ success: true, message: status === "finalized" ? "Month finalized" : "Month reopened" });
  } catch (error) {
    console.error("[API /pnl/snapshots] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update month status" }, { status: 500 });
  }
}
