/**
 * Onboarding API for the New members tab
 * POST /api/agent/onboarding - { memberId, memberName } mark a new member onboarded
 * DELETE /api/agent/onboarding?memberId=123 - undo (removes their onboarded events)
 *
 * Stored as retention_event rows with event type "onboarded".
 */

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { RetentionEvent } from "@acme/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";

export const dynamic = "force-dynamic";

// Gym-local date, so "onboarded today" matches the gym's day
const gymToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

export async function POST(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const memberId = String(body?.memberId ?? "").trim();
  const memberName = String(body?.memberName ?? "").trim();
  if (!memberId || !memberName) {
    return NextResponse.json({ error: "memberId and memberName are required" }, { status: 400 });
  }

  try {
    const eventDate = gymToday();
    await db
      .insert(RetentionEvent)
      .values({ memberId, memberName, eventType: "onboarded", context: "new_members", eventDate, createdBy: "save-calls" });
    return NextResponse.json({ success: true, onboardedOn: eventDate });
  } catch (error) {
    console.error("[API /agent/onboarding] POST error:", error);
    return NextResponse.json({ error: "Failed to mark member onboarded" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  const memberId = request.nextUrl.searchParams.get("memberId");
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

  try {
    await db
      .delete(RetentionEvent)
      .where(and(eq(RetentionEvent.memberId, memberId), eq(RetentionEvent.eventType, "onboarded")));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /agent/onboarding] DELETE error:", error);
    return NextResponse.json({ error: "Failed to undo onboarding" }, { status: 500 });
  }
}
