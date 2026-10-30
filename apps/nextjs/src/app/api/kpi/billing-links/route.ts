/**
 * KPI Billing Links API - members whose membership another member pays for
 * GET /api/kpi/billing-links - List links
 * POST /api/kpi/billing-links - Add or replace a link { memberId, paidByMemberId, paidByName, startMonth, startYear }
 *   (the member's name is looked up in GymMaster from memberId)
 * DELETE /api/kpi/billing-links?memberId=123 - Remove a link
 */

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { CreateKpiBillingLinkSchema, KpiBillingLink } from "@acme/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { validateApiAccess } from "~/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  try {
    const links = await db.select().from(KpiBillingLink);
    return NextResponse.json({ links });
  } catch (error) {
    console.error("[API /kpi/billing-links] GET error:", error);
    return NextResponse.json({ error: "Failed to load billing links" }, { status: 500 });
  }
}

// Member name from GymMaster's staff API, as "Surname, Firstname" to match the KPI lists
async function lookupMemberName(memberId: string): Promise<string | null> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_STAFF_API_KEY;
  if (!baseUrl || !apiKey || !/^\d+$/.test(memberId)) return null;

  const response = await fetch(`${baseUrl}/api/v3/member/${memberId}`, {
    headers: { Accept: "application/json", "X-GM-API-KEY": apiKey },
  });
  if (!response.ok) return null;
  const record = await response.json();
  const m = (Array.isArray(record) ? record[0] : record) as { firstname?: string; surname?: string } | undefined;
  const name = [m?.surname, m?.firstname].filter(Boolean).join(", ");
  return name || null;
}

export async function POST(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const memberId = String(body?.memberId ?? "").trim();
  const memberName = await lookupMemberName(memberId).catch(() => null);
  if (!memberName) {
    return NextResponse.json({ error: `No GymMaster member found with ID ${memberId || "(blank)"}` }, { status: 400 });
  }

  const parsed = CreateKpiBillingLinkSchema.safeParse({ ...body, memberId, memberName });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid billing link", issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.memberId === parsed.data.paidByMemberId) {
    return NextResponse.json({ error: "A member can't pay for themselves" }, { status: 400 });
  }

  try {
    const [link] = await db
      .insert(KpiBillingLink)
      .values(parsed.data)
      .onConflictDoUpdate({ target: KpiBillingLink.memberId, set: parsed.data })
      .returning();
    return NextResponse.json({ success: true, link });
  } catch (error) {
    console.error("[API /kpi/billing-links] POST error:", error);
    return NextResponse.json({ error: "Failed to save billing link" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const memberId = request.nextUrl.searchParams.get("memberId");
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

  try {
    await db.delete(KpiBillingLink).where(eq(KpiBillingLink.memberId, memberId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /kpi/billing-links] DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove billing link" }, { status: 500 });
  }
}
