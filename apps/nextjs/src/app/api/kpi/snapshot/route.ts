/**
 * KPI Snapshot API
 * GET /api/kpi/snapshot?month=10&year=2026 - Load snapshot
 * POST /api/kpi/snapshot - Save snapshot
 * PATCH /api/kpi/snapshot - Update status (finalize/reopen)
 */

import { eq, and, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiMonthlySnapshot, KpiMemberOverride } from "@acme/db/schema";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Load snapshot for a month
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const monthStr = searchParams.get("month");
  const yearStr = searchParams.get("year");

  if (!monthStr || !yearStr) {
    return NextResponse.json(
      { error: "month and year are required" },
      { status: 400 }
    );
  }

  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  try {
    // Get snapshot
    const snapshot = await db
      .select()
      .from(KpiMonthlySnapshot)
      .where(
        and(
          eq(KpiMonthlySnapshot.month, month),
          eq(KpiMonthlySnapshot.year, year)
        )
      )
      .limit(1);

    // Get overrides for this month
    const overrides = await db
      .select()
      .from(KpiMemberOverride)
      .where(
        and(
          eq(KpiMemberOverride.month, month),
          eq(KpiMemberOverride.year, year)
        )
      );

    if (!snapshot.length) {
      return NextResponse.json({
        exists: false,
        month,
        year,
        snapshot: null,
        overrides: overrides.map(o => ({
          memberId: o.memberId,
          overrideType: o.overrideType,
          reason: o.reason,
        })),
      });
    }

    return NextResponse.json({
      exists: true,
      month,
      year,
      snapshot: {
        id: snapshot[0].id,
        status: snapshot[0].status,
        finalizedAt: snapshot[0].finalizedAt,
        data: snapshot[0].data,
        updatedAt: snapshot[0].updatedAt,
      },
      overrides: overrides.map(o => ({
        memberId: o.memberId,
        overrideType: o.overrideType,
        reason: o.reason,
      })),
    });
  } catch (error) {
    console.error("[API /kpi/snapshot GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to load snapshot" },
      { status: 500 }
    );
  }
}

// POST - Save snapshot (create or update)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { month, year, data, overrides } = body;

    if (!month || !year || !data) {
      return NextResponse.json(
        { error: "month, year, and data are required" },
        { status: 400 }
      );
    }

    // Check if snapshot exists
    const existing = await db
      .select()
      .from(KpiMonthlySnapshot)
      .where(
        and(
          eq(KpiMonthlySnapshot.month, month),
          eq(KpiMonthlySnapshot.year, year)
        )
      )
      .limit(1);

    let snapshotId: string;

    if (existing.length) {
      // Update existing
      await db
        .update(KpiMonthlySnapshot)
        .set({
          data,
          // Don't change status - keep draft/finalized as is
        })
        .where(eq(KpiMonthlySnapshot.id, existing[0].id));
      snapshotId = existing[0].id;
    } else {
      // Create new
      const result = await db
        .insert(KpiMonthlySnapshot)
        .values({
          month,
          year,
          status: "draft",
          data,
        })
        .returning({ id: KpiMonthlySnapshot.id });
      snapshotId = result[0].id;
    }

    // Update overrides if provided
    if (overrides && typeof overrides === "object") {
      // Delete existing overrides for this month
      await db
        .delete(KpiMemberOverride)
        .where(
          and(
            eq(KpiMemberOverride.month, month),
            eq(KpiMemberOverride.year, year)
          )
        );

      // Insert new overrides
      const overrideRecords: Array<{
        month: number;
        year: number;
        memberId: string;
        overrideType: "exclude_from_new" | "exclude_from_lost";
        reason?: string;
      }> = [];

      // overrides format: { "2026-10": { excludeFromNew: [...], excludeFromLost: [...] } }
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      const monthOverrides = overrides[monthKey];

      if (monthOverrides) {
        for (const memberId of monthOverrides.excludeFromNew || []) {
          overrideRecords.push({
            month,
            year,
            memberId,
            overrideType: "exclude_from_new",
          });
        }
        for (const memberId of monthOverrides.excludeFromLost || []) {
          overrideRecords.push({
            month,
            year,
            memberId,
            overrideType: "exclude_from_lost",
          });
        }
      }

      if (overrideRecords.length > 0) {
        await db.insert(KpiMemberOverride).values(overrideRecords);
      }
    }

    return NextResponse.json({
      success: true,
      snapshotId,
      message: "Snapshot saved",
    });
  } catch (error) {
    console.error("[API /kpi/snapshot POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to save snapshot" },
      { status: 500 }
    );
  }
}

// PATCH - Update snapshot status (finalize/reopen)
export async function PATCH(request: NextRequest) {
  console.log("[PATCH] Starting...");

  try {
    const body = await request.json();
    const { month, year, status } = body;
    console.log("[PATCH] Parsed body:", { month, year, status });

    if (!month || !year || !status) {
      return NextResponse.json(
        { error: "month, year, and status are required" },
        { status: 400 }
      );
    }

    if (status !== "draft" && status !== "finalized") {
      return NextResponse.json(
        { error: "status must be 'draft' or 'finalized'" },
        { status: 400 }
      );
    }

    console.log("[PATCH] Querying existing snapshot...");
    const existing = await db
      .select()
      .from(KpiMonthlySnapshot)
      .where(
        and(
          eq(KpiMonthlySnapshot.month, month),
          eq(KpiMonthlySnapshot.year, year)
        )
      )
      .limit(1);
    console.log("[PATCH] Found existing:", existing.length > 0 ? { id: existing[0]?.id, status: existing[0]?.status } : "none");

    if (!existing.length) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 }
      );
    }

    console.log("[PATCH] About to update with status:", status);

    // Use raw SQL because finalizedAt column has mode: "date" which doesn't work with sql`now()`
    if (status === "finalized") {
      console.log("[PATCH] Executing finalize update with raw SQL...");
      try {
        await db.execute(
          sql`UPDATE kpi_monthly_snapshot
              SET status = 'finalized', finalized_at = NOW(), updated_at = NOW()
              WHERE id = ${existing[0].id}`
        );
        console.log("[PATCH] Finalize update completed");
      } catch (updateError) {
        console.error("[PATCH] Finalize update error:", updateError);
        throw updateError;
      }
    } else {
      console.log("[PATCH] Executing draft update with raw SQL...");
      try {
        await db.execute(
          sql`UPDATE kpi_monthly_snapshot
              SET status = 'draft', finalized_at = NULL, updated_at = NOW()
              WHERE id = ${existing[0].id}`
        );
        console.log("[PATCH] Draft update completed");
      } catch (updateError) {
        console.error("[PATCH] Draft update error:", updateError);
        throw updateError;
      }
    }

    console.log("[PATCH] Success!");
    return NextResponse.json({
      success: true,
      message: status === "finalized" ? "Month finalized" : "Month reopened for editing",
    });
  } catch (error) {
    console.error("[API /kpi/snapshot PATCH] Error:", error);
    console.error("[API /kpi/snapshot PATCH] Error stack:", error instanceof Error ? error.stack : "no stack");
    return NextResponse.json(
      { error: "Failed to update snapshot status" },
      { status: 500 }
    );
  }
}
