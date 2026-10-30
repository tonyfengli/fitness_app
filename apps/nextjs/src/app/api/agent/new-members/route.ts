/**
 * New Members API for OpenClaw Retention Specialist
 * GET /api/agent/new-members
 *
 * Returns members who joined since the last finalized KPI month: everyone the KPI
 * roster doesn't cover yet. Once that month is finalized they join the roster and
 * move to Retention / Payments.
 *
 * New = not on the KPI roster, and either
 * - paid since the cutoff with no payment in the finalized month (the KPI page's
 *   new-member rule: net payments per category, Gym Memberships or Personal Training), or
 * - has a membership that hasn't started yet (signed up ahead of their start date).
 * KPI "exclude from new" overrides for the cutoff month apply once that month is saved.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiMemberOverride } from "@acme/db/schema";
import { validateApiAccess } from "~/lib/api-auth";
import { getKpiRoster } from "~/lib/kpi-roster";

export const dynamic = "force-dynamic";

const FUTURE_START_DAYS = 90; // how far ahead to look for memberships that haven't started

type ReportRow = Record<string, string | number | null>;

interface NewMember {
  memberId: string;
  name: string;
  membershipType: string | null;
  membershipFee: number;
  memberSince: string; // membership start date, else first payment date since the cutoff
  daysSinceJoin: number; // 0 for memberships that haven't started
  signedUp: string; // first payment since the cutoff, else membership start: when onboarding starts
  daysSinceSignup: number;
  planPrice: string | null; // GymMaster plan price as one monthly number, e.g. "$120/mo" for $60 every 14 days
  phone: string | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const money = (v: unknown) => parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0;

function parseGymMasterDate(s: unknown): string {
  const d = new Date(String(s ?? ""));
  return isNaN(d.getTime()) ? "" : iso(d);
}

async function fetchReport(reportId: number, startDate: string, endDate: string): Promise<ReportRow[]> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing GymMaster configuration");

  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": apiKey },
      body: JSON.stringify({ report_id: reportId, start_date: startDate, end_date: endDate }),
    });
    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 1500 * 2 ** attempt));
      continue;
    }
    if (!response.ok) throw new Error(`GymMaster report ${reportId} error: ${response.status}`);
    const data = await response.json();
    return data.result || [];
  }
  throw new Error(`GymMaster report ${reportId} rate limited`);
}

async function fetchMemberPhone(memberId: string): Promise<string | null> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_STAFF_API_KEY;
  if (!baseUrl || !apiKey) return null;
  const response = await fetch(`${baseUrl}/api/v3/member/${memberId}`, {
    headers: { Accept: "application/json", "X-GM-API-KEY": apiKey },
  });
  if (!response.ok) return null;
  const record = await response.json();
  const m = (Array.isArray(record) ? record[0] : record) as { phonecell?: string; phonehome?: string; phonework?: string } | undefined;
  return m?.phonecell || m?.phonehome || m?.phonework || null;
}

interface Membership {
  startdate?: string;
  paymentfreq?: string;
  paymentdue?: string;
  history?: boolean;
  completed?: boolean;
}

// Billings counted per month: 28-day plans are treated as monthly
const BILLINGS_PER_MONTH: Record<string, number> = { "1 mon": 1, "28 days": 1, "14 days": 2, "7 days": 4 };

// GymMaster plan price of the member's newest live membership, as one monthly number
async function fetchPlanPrice(memberId: string): Promise<string | null> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_STAFF_API_KEY;
  if (!baseUrl || !apiKey) return null;
  const response = await fetch(`${baseUrl}/api/v3/member/${memberId}/membership`, {
    headers: { Accept: "application/json", "X-GM-API-KEY": apiKey },
  });
  if (!response.ok) return null;
  const memberships = ((await response.json()) || []) as Membership[];
  const plan = memberships
    .filter(m => !m.history && m.completed !== false && money(m.paymentdue) > 0)
    .sort((a, b) => String(b.startdate).localeCompare(String(a.startdate)))[0];
  if (!plan) return null;
  const monthly = Math.round(money(plan.paymentdue) * (BILLINGS_PER_MONTH[plan.paymentfreq ?? ""] ?? 1) * 100) / 100;
  return `$${Number.isInteger(monthly) ? monthly : monthly.toFixed(2)}/mo`;
}

// Net payments per member per KPI category (refunds net out), as on the KPI page
function netByCategory(payments: ReportRow[]) {
  const net = { gym: new Map<string, number>(), pt: new Map<string, number>() };
  for (const p of payments) {
    const details = String(p["Payment Details"] ?? "");
    const category = details.includes("Gym Memberships") ? "gym" : details.includes("Personal Training") ? "pt" : null;
    const memberId = String(p["Member ID"] ?? "");
    if (!category || !memberId) continue;
    net[category].set(memberId, (net[category].get(memberId) || 0) + money(p["Payment Amount"]));
  }
  return net;
}

export async function GET(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  try {
    // 1. Cutoff: the day after the latest finalized KPI month
    const roster = await getKpiRoster();
    if (!roster) {
      return NextResponse.json({
        status: "no_data",
        message: "No finalized KPI snapshot found. Please finalize a month first.",
        newMembers: [],
      });
    }
    const onRoster = new Set(roster.members.map(m => m.memberId));
    const pad = (n: number) => String(n).padStart(2, "0");
    const snapshotStart = `${roster.year}-${pad(roster.month)}-01`;
    const snapshotEnd = iso(new Date(Date.UTC(roster.year, roster.month, 0)));
    const cutoffMonth = roster.month === 12 ? 1 : roster.month + 1;
    const cutoffYear = roster.month === 12 ? roster.year + 1 : roster.year;
    const cutoff = `${cutoffYear}-${pad(cutoffMonth)}-01`;

    const now = new Date();
    const today = iso(now);
    const lookahead = new Date(now);
    lookahead.setDate(lookahead.getDate() + FUTURE_START_DAYS);

    // 2. Payments since the cutoff and in the finalized month; current members incl. future starts
    const [paymentsSince, paymentsSnapshotMonth, currentMembers, overrides] = await Promise.all([
      fetchReport(103, cutoff, today),
      fetchReport(103, snapshotStart, snapshotEnd),
      fetchReport(1, cutoff, iso(lookahead)),
      db
        .select({ memberId: KpiMemberOverride.memberId })
        .from(KpiMemberOverride)
        .where(
          and(
            eq(KpiMemberOverride.month, cutoffMonth),
            eq(KpiMemberOverride.year, cutoffYear),
            eq(KpiMemberOverride.overrideType, "exclude_from_new")
          )
        ),
    ]);
    const excluded = new Set(overrides.map(o => o.memberId));

    // 3. KPI-style new: net positive in a category since the cutoff, nothing in that category the month before
    const since = netByCategory(paymentsSince);
    const before = netByCategory(paymentsSnapshotMonth);
    const newIds = new Set<string>();
    for (const category of ["gym", "pt"] as const) {
      for (const [memberId, amount] of since[category]) {
        if (amount > 0 && (before[category].get(memberId) || 0) <= 0) newIds.add(memberId);
      }
    }

    // 4. Plus memberships that haven't started yet
    const currentById = new Map<string, ReportRow>();
    for (const row of currentMembers) {
      const memberId = String(row["Member ID"] ?? "");
      if (!memberId) continue;
      currentById.set(memberId, row);
      if (parseGymMasterDate(row["Membership Start Date"]) > today) newIds.add(memberId);
    }

    const firstPayment = new Map<string, { date: string; name: string }>();
    for (const p of paymentsSince) {
      const memberId = String(p["Member ID"] ?? "");
      const date = parseGymMasterDate(p["Payment Date"]);
      if (!memberId || !date || money(p["Payment Amount"]) <= 0) continue;
      const seen = firstPayment.get(memberId);
      if (!seen || date < seen.date) firstPayment.set(memberId, { date, name: String(p["Name"] ?? p["Member Name"] ?? "") });
    }

    // 5. Build rows for members the roster doesn't cover yet
    const ids = [...newIds].filter(id => !onRoster.has(id) && !excluded.has(id));
    const newMembers: NewMember[] = await Promise.all(
      ids.map(async (memberId) => {
        const row = currentById.get(memberId);
        const startDate = parseGymMasterDate(row?.["Membership Start Date"]);
        const memberSince = startDate || firstPayment.get(memberId)?.date || today;
        const daysSince = (date: string) => Math.max(0, Math.round((Date.parse(today) - Date.parse(date)) / 864e5));
        const signedUp = firstPayment.get(memberId)?.date || (startDate && startDate <= today ? startDate : today);
        let phone = row?.["Member Cell"] || null;
        const [planPrice, fallbackPhone] = await Promise.all([
          fetchPlanPrice(memberId).catch(() => null),
          phone ? Promise.resolve(null) : fetchMemberPhone(memberId).catch(() => null),
        ]);
        phone = phone || fallbackPhone;
        return {
          memberId,
          name: String(row?.["Member Name"] || row?.["Name"] || firstPayment.get(memberId)?.name || `Member ${memberId}`),
          membershipType: row?.["Membership Type Name"] ? String(row["Membership Type Name"]) : null,
          membershipFee: money(row?.["Membership Fee"]),
          memberSince,
          daysSinceJoin: daysSince(memberSince),
          signedUp,
          daysSinceSignup: daysSince(signedUp),
          planPrice,
          phone: phone ? String(phone) : null,
        };
      })
    );

    // Most recent first
    newMembers.sort((a, b) => b.memberSince.localeCompare(a.memberSince) || a.name.localeCompare(b.name));

    return NextResponse.json({
      status: "live",
      since: cutoff,
      totalNewMembers: newMembers.length,
      newMembers,
      _meta: {
        generatedAt: new Date().toISOString(),
        dataSource: "gymmaster",
        snapshotMonth: roster.month,
        snapshotYear: roster.year,
      },
    });
  } catch (error) {
    console.error("[API /agent/new-members] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to fetch new members: ${message}` },
      { status: 500 }
    );
  }
}
