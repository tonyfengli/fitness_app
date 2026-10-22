/**
 * Retention Wins API for OpenClaw Retention Specialist
 * GET /api/agent/retention-wins?startMonth=1&endMonth=9&year=2026
 *
 * Returns members who were flagged as at-risk but have since returned.
 * Tracks retention wins to measure intervention effectiveness.
 */

import { sql } from "@acme/db";
import { db } from "@acme/db/client";
import { NextRequest, NextResponse } from "next/server";
import { validateApiAccess } from "~/lib/api-auth";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface RetentionWin {
  memberId: string;
  memberName: string;
  flaggedDate: string;
  returnedDate: string;
  daysToReturn: number;
  atRiskTier: string | null;
  monthlyRevenue: number | null;
  outreachSent: boolean;
}

interface RetentionLoss {
  memberId: string;
  memberName: string;
  flaggedDate: string;
  churnedDate: string;
  daysToChurn: number;
  atRiskTier: string | null;
  monthlyRevenue: number | null;
  outreachSent: boolean;
}

export async function GET(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const startMonthStr = searchParams.get("startMonth");
  const endMonthStr = searchParams.get("endMonth");
  const yearStr = searchParams.get("year");

  const now = new Date();
  const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
  const startMonth = startMonthStr ? parseInt(startMonthStr, 10) : 1;
  const endMonth = endMonthStr ? parseInt(endMonthStr, 10) : now.getMonth() + 1;

  // Validate months
  if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
    return NextResponse.json(
      { error: "Invalid month. Must be 1-12." },
      { status: 400 }
    );
  }

  const startDate = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(endMonth).padStart(2, "0")}-31`;

  try {
    // Get all retention events in the date range
    const events = await db.execute(sql`
      SELECT
        member_id,
        member_name,
        event_type,
        event_date,
        at_risk_tier,
        days_gone,
        monthly_revenue,
        outreach_method,
        notes
      FROM retention_event
      WHERE event_date >= ${startDate}::date
        AND event_date <= ${endDate}::date
      ORDER BY member_id, event_date
    `);

    // Group events by member
    const memberEvents = new Map<string, Array<{
      eventType: string;
      eventDate: string;
      atRiskTier: string | null;
      monthlyRevenue: number | null;
      outreachMethod: string | null;
      memberName: string;
    }>>();

    for (const row of events.rows) {
      const memberId = String(row.member_id);
      if (!memberEvents.has(memberId)) {
        memberEvents.set(memberId, []);
      }
      memberEvents.get(memberId)!.push({
        eventType: String(row.event_type),
        eventDate: String(row.event_date),
        atRiskTier: row.at_risk_tier ? String(row.at_risk_tier) : null,
        monthlyRevenue: row.monthly_revenue ? Number(row.monthly_revenue) : null,
        outreachMethod: row.outreach_method ? String(row.outreach_method) : null,
        memberName: String(row.member_name),
      });
    }

    // Analyze each member's journey
    const wins: RetentionWin[] = [];
    const losses: RetentionLoss[] = [];
    const stillAtRisk: Array<{
      memberId: string;
      memberName: string;
      flaggedDate: string;
      daysSinceFlagged: number;
      atRiskTier: string | null;
      monthlyRevenue: number | null;
      outreachSent: boolean;
    }> = [];

    for (const [memberId, events] of memberEvents) {
      // Find the most recent flagged_at_risk event
      const flaggedEvents = events.filter(e => e.eventType === "flagged_at_risk");
      const returnedEvents = events.filter(e => e.eventType === "returned");
      const churnedEvents = events.filter(e => e.eventType === "churned");
      const outreachEvents = events.filter(e => e.eventType === "outreach_sent");

      if (flaggedEvents.length === 0) continue;

      const lastFlagged = flaggedEvents[flaggedEvents.length - 1];
      const outreachSent = outreachEvents.some(
        e => new Date(e.eventDate) >= new Date(lastFlagged.eventDate)
      );

      // Check if they returned after being flagged
      const returnAfterFlag = returnedEvents.find(
        e => new Date(e.eventDate) > new Date(lastFlagged.eventDate)
      );

      // Check if they churned after being flagged
      const churnAfterFlag = churnedEvents.find(
        e => new Date(e.eventDate) > new Date(lastFlagged.eventDate)
      );

      if (returnAfterFlag) {
        // This is a win!
        const flagDate = new Date(lastFlagged.eventDate);
        const returnDate = new Date(returnAfterFlag.eventDate);
        const daysToReturn = Math.ceil(
          (returnDate.getTime() - flagDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        wins.push({
          memberId,
          memberName: lastFlagged.memberName,
          flaggedDate: lastFlagged.eventDate,
          returnedDate: returnAfterFlag.eventDate,
          daysToReturn,
          atRiskTier: lastFlagged.atRiskTier,
          monthlyRevenue: lastFlagged.monthlyRevenue,
          outreachSent,
        });
      } else if (churnAfterFlag) {
        // This is a loss
        const flagDate = new Date(lastFlagged.eventDate);
        const churnDate = new Date(churnAfterFlag.eventDate);
        const daysToChurn = Math.ceil(
          (churnDate.getTime() - flagDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        losses.push({
          memberId,
          memberName: lastFlagged.memberName,
          flaggedDate: lastFlagged.eventDate,
          churnedDate: churnAfterFlag.eventDate,
          daysToChurn,
          atRiskTier: lastFlagged.atRiskTier,
          monthlyRevenue: lastFlagged.monthlyRevenue,
          outreachSent,
        });
      } else {
        // Still at risk
        const flagDate = new Date(lastFlagged.eventDate);
        const daysSinceFlagged = Math.ceil(
          (now.getTime() - flagDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        stillAtRisk.push({
          memberId,
          memberName: lastFlagged.memberName,
          flaggedDate: lastFlagged.eventDate,
          daysSinceFlagged,
          atRiskTier: lastFlagged.atRiskTier,
          monthlyRevenue: lastFlagged.monthlyRevenue,
          outreachSent,
        });
      }
    }

    // Calculate summary statistics
    const totalFlagged = wins.length + losses.length + stillAtRisk.length;
    const winRate = totalFlagged > 0
      ? Math.round((wins.length / totalFlagged) * 10000) / 100
      : 0;

    const revenueSaved = wins.reduce(
      (sum, w) => sum + (w.monthlyRevenue || 0), 0
    );
    const revenueLost = losses.reduce(
      (sum, l) => sum + (l.monthlyRevenue || 0), 0
    );
    const revenueAtRisk = stillAtRisk.reduce(
      (sum, s) => sum + (s.monthlyRevenue || 0), 0
    );

    // Outreach effectiveness
    const winsWithOutreach = wins.filter(w => w.outreachSent).length;
    const lossesWithOutreach = losses.filter(l => l.outreachSent).length;
    const outreachWinRate = (winsWithOutreach + lossesWithOutreach) > 0
      ? Math.round((winsWithOutreach / (winsWithOutreach + lossesWithOutreach)) * 10000) / 100
      : 0;

    return NextResponse.json({
      status: "success",
      year,
      startMonth,
      endMonth,
      period: `${MONTH_NAMES[startMonth - 1]} - ${MONTH_NAMES[endMonth - 1]} ${year}`,

      summary: {
        totalFlagged,
        wins: wins.length,
        losses: losses.length,
        stillAtRisk: stillAtRisk.length,
        winRate,
        revenueSaved: Math.round(revenueSaved * 100) / 100,
        revenueLost: Math.round(revenueLost * 100) / 100,
        revenueAtRisk: Math.round(revenueAtRisk * 100) / 100,
        outreach: {
          winsWithOutreach,
          lossesWithOutreach,
          outreachWinRate,
        },
      },

      wins,
      losses,
      stillAtRisk,

      _meta: {
        generatedAt: new Date().toISOString(),
        dataSource: "supabase",
      },
    });
  } catch (error) {
    console.error("[API /agent/retention-wins] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to fetch retention wins: ${message}` },
      { status: 500 }
    );
  }
}
