/**
 * Retention Event API for OpenClaw Retention Specialist
 *
 * POST /api/agent/retention-event - Log a retention event
 * GET /api/agent/retention-event?memberId=123 - Get events for a member
 *   (optional filters, combinable: memberId, eventType, context; limit)
 *
 * Used to track retention activities: flagging at-risk, sending outreach,
 * recording returns and churns, onboarding new members and celebrating milestones.
 * Save Calls fields (outcome, context, milestone, followUpOn) are optional.
 */

import { sql, type SQL } from "@acme/db";
import { db } from "@acme/db/client";
import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";

export const dynamic = "force-dynamic";

const EVENT_TYPES = ["flagged_at_risk", "outreach_sent", "returned", "churned", "onboarded", "milestone_celebrated"] as const;
const OUTCOMES = ["reached", "no_answer", "voicemail", "texted", "emailed"] as const;
const CONTEXTS = ["at_risk", "low_frequency", "new_members", "milestones"] as const;

interface RetentionEventInput {
  memberId: string;
  memberName: string;
  eventType: (typeof EVENT_TYPES)[number];
  eventDate?: string; // YYYY-MM-DD, defaults to today
  atRiskTier?: string;
  daysGone?: number;
  monthlyRevenue?: number;
  outreachMethod?: "sms" | "email" | "phone" | "in_person";
  outreachMessage?: string;
  notes?: string;
  createdBy?: string;
  // Save Calls logging
  outcome?: (typeof OUTCOMES)[number];
  context?: (typeof CONTEXTS)[number];
  milestone?: number; // milestone_celebrated: class count (25, 50, 60, ...)
  followUpOn?: string; // YYYY-MM-DD: when the member should come back to the list
}

export async function POST(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  try {
    const body: RetentionEventInput = await request.json();

    // Validate required fields
    if (!body.memberId || !body.memberName || !body.eventType) {
      return NextResponse.json(
        { error: "memberId, memberName, and eventType are required" },
        { status: 400 }
      );
    }

    if (!EVENT_TYPES.includes(body.eventType)) {
      return NextResponse.json(
        { error: `eventType must be one of: ${EVENT_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (body.outcome && !OUTCOMES.includes(body.outcome)) {
      return NextResponse.json({ error: `outcome must be one of: ${OUTCOMES.join(", ")}` }, { status: 400 });
    }
    if (body.context && !CONTEXTS.includes(body.context)) {
      return NextResponse.json({ error: `context must be one of: ${CONTEXTS.join(", ")}` }, { status: 400 });
    }
    if (body.eventType === "milestone_celebrated" && !Number.isInteger(body.milestone)) {
      return NextResponse.json({ error: "milestone (class count) is required for milestone_celebrated" }, { status: 400 });
    }
    if (body.followUpOn && !/^\d{4}-\d{2}-\d{2}$/.test(body.followUpOn)) {
      return NextResponse.json({ error: "followUpOn must be YYYY-MM-DD" }, { status: 400 });
    }

    const eventDate = body.eventDate || new Date().toISOString().split("T")[0];

    // Insert the event
    const result = await db.execute(sql`
      INSERT INTO retention_event (
        member_id,
        member_name,
        event_type,
        event_date,
        at_risk_tier,
        days_gone,
        monthly_revenue,
        outreach_method,
        outreach_message,
        outcome,
        context,
        milestone,
        follow_up_on,
        notes,
        created_by
      ) VALUES (
        ${body.memberId},
        ${body.memberName},
        ${body.eventType}::retention_event_type,
        ${eventDate}::date,
        ${body.atRiskTier || null},
        ${body.daysGone || null},
        ${body.monthlyRevenue || null},
        ${body.outreachMethod || null},
        ${body.outreachMessage || null},
        ${body.outcome || null},
        ${body.context || null},
        ${body.milestone ?? null},
        ${body.followUpOn || null}::date,
        ${body.notes || null},
        ${body.createdBy || "agent"}
      )
      RETURNING id, member_id, event_type, event_date
    `);

    const inserted = result.rows[0];

    return NextResponse.json({
      status: "success",
      message: `Retention event logged: ${body.eventType} for ${body.memberName}`,
      event: {
        id: inserted.id,
        memberId: inserted.member_id,
        eventType: inserted.event_type,
        eventDate: inserted.event_date,
      },
    });
  } catch (error) {
    console.error("[API /agent/retention-event POST] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to log retention event: ${message}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const memberId = searchParams.get("memberId");
  const eventType = searchParams.get("eventType");
  const context = searchParams.get("context");
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    const conditions: SQL[] = [];
    if (memberId) conditions.push(sql`member_id = ${memberId}`);
    if (eventType) conditions.push(sql`event_type = ${eventType}::retention_event_type`);
    if (context) conditions.push(sql`context = ${context}`);
    const where = conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const query = sql`
      SELECT
        id,
        member_id,
        member_name,
        event_type,
        event_date,
        at_risk_tier,
        days_gone,
        monthly_revenue,
        outreach_method,
        outreach_message,
        outcome,
        context,
        milestone,
        follow_up_on,
        notes,
        created_by,
        created_at
      FROM retention_event
      ${where}
      ORDER BY event_date DESC, created_at DESC
      LIMIT ${limit}
    `;

    const result = await db.execute(query);

    const events = result.rows.map(row => ({
      id: row.id,
      memberId: row.member_id,
      memberName: row.member_name,
      eventType: row.event_type,
      eventDate: row.event_date,
      atRiskTier: row.at_risk_tier,
      daysGone: row.days_gone,
      monthlyRevenue: row.monthly_revenue ? Number(row.monthly_revenue) : null,
      outreachMethod: row.outreach_method,
      outreachMessage: row.outreach_message,
      outcome: row.outcome,
      context: row.context,
      milestone: row.milestone,
      followUpOn: row.follow_up_on,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      status: "success",
      count: events.length,
      events,
      _meta: {
        generatedAt: new Date().toISOString(),
        filters: { memberId, eventType, context, limit },
      },
    });
  } catch (error) {
    console.error("[API /agent/retention-event GET] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to fetch retention events: ${message}` },
      { status: 500 }
    );
  }
}
