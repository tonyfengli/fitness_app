/**
 * P&L Refresh API - pull fresh data from GymMaster, Stripe and QuickBooks into the saved months
 * POST /api/pnl/refresh - { year, startMonth, endMonth }
 *
 * Finalized months are skipped (reopen them first). Needs a live QuickBooks
 * connection; a month whose QuickBooks pull fails isn't saved, so stored expenses
 * never get overwritten with zeros.
 */

import { and, eq, gte, lte } from "@acme/db";
import { db } from "@acme/db/client";
import { PnlMonthlySnapshot } from "@acme/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { validateApiAccess } from "~/lib/api-auth";
import { isQuickBooksConnected } from "~/lib/quickbooks";
import { fetchMonthData } from "~/lib/revenue-reconciliation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const startMonth = Number(body?.startMonth);
  const endMonth = Number(body?.endMonth);
  if (!year || !(startMonth >= 1) || !(endMonth <= 12) || startMonth > endMonth) {
    return NextResponse.json({ error: "year, startMonth and endMonth (1-12) are required" }, { status: 400 });
  }

  if (!(await isQuickBooksConnected())) {
    return NextResponse.json({ error: "QuickBooks not connected", needsAuth: true }, { status: 401 });
  }

  try {
    const existing = await db
      .select({ month: PnlMonthlySnapshot.month, status: PnlMonthlySnapshot.status })
      .from(PnlMonthlySnapshot)
      .where(and(eq(PnlMonthlySnapshot.year, year), gte(PnlMonthlySnapshot.month, startMonth), lte(PnlMonthlySnapshot.month, endMonth)));
    const finalized = new Set(existing.filter((r) => r.status === "finalized").map((r) => r.month));

    const toRefresh: number[] = [];
    for (let m = startMonth; m <= endMonth; m++) if (!finalized.has(m)) toRefresh.push(m);

    const results = await Promise.all(
      toRefresh.map(async (month) => {
        try {
          const data = await fetchMonthData(year, month);
          if (!data.quickbooks.connected) return { month, ok: false };
          const values = { month, year, data: data as unknown as Record<string, unknown>, refreshedAt: new Date() };
          await db
            .insert(PnlMonthlySnapshot)
            .values(values)
            .onConflictDoUpdate({
              target: [PnlMonthlySnapshot.month, PnlMonthlySnapshot.year],
              set: { data: values.data, refreshedAt: values.refreshedAt },
            });
          return { month, ok: true };
        } catch (err) {
          console.error(`[API /pnl/refresh] ${year}-${month} failed:`, err);
          return { month, ok: false };
        }
      })
    );

    return NextResponse.json({
      refreshed: results.filter((r) => r.ok).map((r) => r.month),
      failed: results.filter((r) => !r.ok).map((r) => r.month),
      skippedFinalized: [...finalized].sort((a, b) => a - b),
    });
  } catch (error) {
    console.error("[API /pnl/refresh] Error:", error);
    return NextResponse.json({ error: "Failed to refresh P&L data" }, { status: 500 });
  }
}
