/**
 * Retention Event API for OpenClaw Retention Specialist
 *
 * POST /api/agent/retention-event - Log a retention event
 * GET /api/agent/retention-event?memberId=123 - Get events for a member
 *
 * Used to track retention activities: flagging at-risk, sending outreach,
 * recording returns and churns.
 */

import { sql } from "@acme/db";
import { db } from "@acme/db/client";
import { NextRequest, NextResponse } from "next/server";
import { validateApiAccess } from "~/lib/api-auth";

export const dynamic = "force-dynamic";

interface RetentionEventInput {
  memberId: string;
  memberName: string;
  eventType: "flagged_at_risk" | "outreach_sent" | "returned" | "churned";
  eventDate?: string; // YYYY-MM-DD, defaults to today
  atRiskTier?: string;
  daysGone?: number;
  monthlyRevenue?: number;
  outreachMethod?: "sms" | "email" | "phone" | "in_person";
  outreachMessage?: string;
  notes?: string;
  createdBy?: string;
}

export async function POST(request: NextRequest) {
  const authError = await validateApiAccess(request);
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

    const validEventTypes = ["flagged_at_risk", "outreach_sent", "returned", "churned"];
    if (!validEventTypes.includes(body.eventType)) {
      return NextResponse.json(
        { error: `eventType must be one of: ${validEventTypes.join(", ")}` },
        { status: 400 }
      );
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
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const memberId = searchParams.get("memberId");
  const eventType = searchParams.get("eventType");
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    let query;

    if (memberId) {
      // Get events for a specific member
      query = sql`
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
          notes,
          created_by,
          created_at
        FROM retention_event
        WHERE member_id = ${memberId}
        ORDER BY event_date DESC, created_at DESC
        LIMIT ${limit}
      `;
    } else if (eventType) {
      // Get events of a specific type
      query = sql`
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
          notes,
          created_by,
          created_at
        FROM retention_event
        WHERE event_type = ${eventType}::retention_event_type
        ORDER BY event_date DESC, created_at DESC
        LIMIT ${limit}
      `;
    } else {
      // Get recent events
      query = sql`
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
          notes,
          created_by,
          created_at
        FROM retention_event
        ORDER BY event_date DESC, created_at DESC
        LIMIT ${limit}
      `;
    }

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
        filters: { memberId, eventType, limit },
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
