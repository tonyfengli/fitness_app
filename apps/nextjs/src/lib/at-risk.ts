/**
 * The at-risk list: every member the KPI overview counts, with days since their last class.
 * Shared by the Retention tab's /api/agent/at-risk route and the Kilo retention board sync,
 * so both always agree on who is at risk and how urgent.
 *
 * Days gone never exceed days since they joined; members on a PT plan are left off (they
 * don't book classes); founders can exclude a member by hand (exclude_from_at_risk).
 */

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiMemberOverride } from "@acme/db/schema";

import { paymentKind } from "~/app/kpi/lib/plan-categories";
import { fetchGymMasterReport } from "./gymmaster-report";
import { getKpiRoster, type KpiRoster } from "./kpi-roster";

// Status tiers based on days gone
export const STATUS_TIERS = {
  BEST_ODDS: { maxDays: 14, label: "Best odds", returnRate: 63 },
  FADING: { maxDays: 30, label: "Fading", returnRate: 39 },
  LONG_SHOT: { maxDays: 45, label: "Long shot", returnRate: 28 },
  CRITICAL: { maxDays: Infinity, label: "Critical", returnRate: 15 },
};

export const AT_RISK_DAYS = 14; // on the list from this many days gone
export const LOOKBACK_DAYS = 60; // bookings window; no booking in it reads as 60 days gone
// PT clients don't book classes; their latest membership payment in this window says they're PT
const PT_LOOKBACK_DAYS = 180;

// Valid booking results that count as "attended"
export const VALID_ATTENDANCE = ["Booking", "Showed", "Showed late"];

interface BookingRow {
  "Member ID": number;
  Name: string;
  "Booking Date": string;
  "Booking Start Time": string;
  "Booking Result": string;
  "Class Name": string | null;
  Service: string;
}

export interface WeeklyVisits {
  week0: number;
  week1: number;
  week2: number;
  week3: number;
  week4: number;
}

export interface AtRiskMember {
  memberId: string;
  name: string;
  daysGone: number;
  lastAttendance: string | null;
  lastAttendanceTime: string | null;
  statusTier: string;
  returnRate: number;
  monthlyRevenue: number;
  paidBy: string | null; // payer's name when another member pays for them
  planPrice?: string | null; // GymMaster plan price per month, e.g. "$148/mo"
  lastClass: string | null;
  memberSince: string | null;
  membershipType: string | null;
  phone: string | null;
  tenureMonths: number;
  weeklyVisits: WeeklyVisits;
  totalVisits: number;
}

/** Where every roster member stands, at risk or not */
export interface MemberStanding {
  memberId: string;
  name: string;
  daysGone: number;
  lastAttendance: string | null; // YYYY-MM-DD
  monthlyRevenue: number;
  atRisk: boolean; // on the list: 14+ days, not excluded, not PT
  excluded: boolean;
  pt: boolean;
}

export interface AtRiskComputation {
  roster: KpiRoster;
  members: AtRiskMember[]; // the list, most days gone first
  standing: Map<string, MemberStanding>; // every roster member
  excludedMemberIds: Set<string>;
  ptMembers: Set<string>;
  bookingsQueried: number;
  gymMasterError: string | null;
}

interface CurrentMemberRow {
  "Member ID": number;
  Name?: string;
  "Member Name"?: string;
  "Membership Start Date": string;
  _memberSince?: string | null; // first joined (old account's date when they were there)
  "Membership Type Name"?: string;
  "Membership Type"?: string;
  "Member Cell"?: string;
  Mobile?: string;
  Phone?: string;
}

export function getStatusTier(daysGone: number): { label: string; returnRate: number } {
  if (daysGone <= STATUS_TIERS.BEST_ODDS.maxDays) return STATUS_TIERS.BEST_ODDS;
  if (daysGone <= STATUS_TIERS.FADING.maxDays) return STATUS_TIERS.FADING;
  if (daysGone <= STATUS_TIERS.LONG_SHOT.maxDays) return STATUS_TIERS.LONG_SHOT;
  return STATUS_TIERS.CRITICAL;
}

function parseGymMasterDate(dateStr: string): Date {
  // GymMaster format: "Oct 1 2026"
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

  // Fallback parsing
  const parts = dateStr.match(/(\w+)\s+(\d+)\s+(\d+)/);
  if (parts) {
    return new Date(`${parts[1]} ${parts[2]}, ${parts[3]}`);
  }
  return new Date();
}

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getWeekNumber(date: Date, referenceDate: Date): number {
  const diffTime = referenceDate.getTime() - date.getTime();
  return Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
}

async function fetchGymMasterBookings(startDate: string, endDate: string): Promise<BookingRow[]> {
  return (await fetchGymMasterReport(9, startDate, endDate)) as unknown as BookingRow[];
}

/** Members whose latest membership payment is for a PT plan: their coach tracks them, not class bookings */
async function fetchPtMembers(endDate: string): Promise<Set<string>> {
  const from = new Date(Date.parse(endDate) - PT_LOOKBACK_DAYS * 864e5).toISOString().split("T")[0]!;
  const latest = new Map<string, { date: number; pt: boolean }>();
  for (const p of await fetchGymMasterReport(103, from, endDate)) {
    const kind = paymentKind(p);
    if (kind.kind !== "membership") continue;
    const memberId = String(p["Member ID"]);
    const date = parseGymMasterDate(String(p["Payment Date"] ?? "")).getTime();
    const seen = latest.get(memberId);
    if (!seen || date >= seen.date) latest.set(memberId, { date, pt: kind.bucket === "pt" });
  }
  return new Set([...latest].filter(([, v]) => v.pt).map(([memberId]) => memberId));
}

async function fetchGymMasterCurrentMembers(now: Date): Promise<CurrentMemberRow[]> {
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = now.toISOString().split("T")[0]!;
  return (await fetchGymMasterReport(1, startDate, endDate)) as unknown as CurrentMemberRow[];
}

/** null when no month is finalized yet (no roster) */
export async function computeAtRisk(now = new Date()): Promise<AtRiskComputation | null> {
  // 1. Members the KPI overview counts (rolled from finalized snapshots + KPI overrides)
  const roster = await getKpiRoster();
  if (!roster) return null;
  const payingMembers = roster.members;

  // 1b. Members manually excluded from the at-risk list
  // (exclude_from_new / exclude_from_lost are already applied by the roster)
  let overrides: { memberId: string }[] = [];
  try {
    overrides = await db
      .select({ memberId: KpiMemberOverride.memberId })
      .from(KpiMemberOverride)
      .where(eq(KpiMemberOverride.overrideType, "exclude_from_at_risk"));
  } catch (err) {
    console.warn("[at-risk] exclude_from_at_risk enum not migrated, no at-risk exclusions applied");
  }
  const excludedMemberIds = new Set(overrides.map(o => o.memberId));

  // 2. Query GymMaster for booking data (last 60 days) and current members
  const endDate = now.toISOString().split("T")[0]!;
  const startDateObj = new Date(now);
  startDateObj.setDate(startDateObj.getDate() - LOOKBACK_DAYS);
  const startDate = startDateObj.toISOString().split("T")[0]!;

  let bookings: BookingRow[] = [];
  let currentMembers: CurrentMemberRow[] = [];
  let ptMembers = new Set<string>();
  let gymMasterError: string | null = null;

  try {
    const [bookingsResult, membersResult, ptResult] = await Promise.all([
      fetchGymMasterBookings(startDate, endDate),
      fetchGymMasterCurrentMembers(now),
      fetchPtMembers(endDate),
    ]);
    bookings = bookingsResult;
    currentMembers = membersResult;
    ptMembers = ptResult;
  } catch (err) {
    gymMasterError = err instanceof Error ? err.message : "Unknown error";
    console.error("[at-risk] GymMaster error:", gymMasterError);
  }

  // 3. Build a map of member ID -> member info (start date, type, phone)
  const memberInfoMap = new Map<string, {
    memberSince: string | null;
    membershipType: string | null;
    phone: string | null;
    tenureMonths: number;
  }>();
  for (const member of currentMembers) {
    const memberId = String(member["Member ID"]);
    const startDateStr = member._memberSince || member["Membership Start Date"];
    const membershipType = member["Membership Type Name"] || member["Membership Type"] || null;
    const phone = member["Member Cell"] || member["Mobile"] || member["Phone"] || null;

    let memberSince: string | null = null;
    let tenureMonths = 0;

    if (startDateStr) {
      const parsed = parseGymMasterDate(startDateStr);
      if (!isNaN(parsed.getTime())) {
        memberSince = parsed.toISOString().split("T")[0] ?? null;
        tenureMonths = Math.floor((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 30));
      }
    }

    if (memberId) {
      memberInfoMap.set(memberId, {
        memberSince,
        membershipType: membershipType ? String(membershipType) : null,
        phone: phone ? String(phone) : null,
        tenureMonths,
      });
    }
  }

  // 4. Build a map of member ID -> last valid attendance AND weekly visits
  const lastAttendanceMap = new Map<string, { date: Date; time: string | null; className: string | null }>();
  const weeklyVisitsMap = new Map<string, WeeklyVisits>();

  for (const booking of bookings) {
    if (!VALID_ATTENDANCE.includes(booking["Booking Result"])) continue;

    const memberId = String(booking["Member ID"]);
    const bookingDate = parseGymMasterDate(booking["Booking Date"]);
    const bookingTime = booking["Booking Start Time"] || null;
    const className = booking["Class Name"] || booking["Service"] || null;

    // Track last attendance
    const existing = lastAttendanceMap.get(memberId);
    if (!existing || bookingDate > existing.date) {
      lastAttendanceMap.set(memberId, { date: bookingDate, time: bookingTime, className });
    }

    // Track weekly visits
    const weeksAgo = getWeekNumber(bookingDate, now);
    if (weeksAgo >= 0 && weeksAgo <= 4) {
      if (!weeklyVisitsMap.has(memberId)) {
        weeklyVisitsMap.set(memberId, { week0: 0, week1: 0, week2: 0, week3: 0, week4: 0 });
      }
      const visits = weeklyVisitsMap.get(memberId)!;
      if (weeksAgo === 0) visits.week0++;
      else if (weeksAgo === 1) visits.week1++;
      else if (weeksAgo === 2) visits.week2++;
      else if (weeksAgo === 3) visits.week3++;
      else if (weeksAgo === 4) visits.week4++;
    }
  }

  // 5. Calculate days gone for each paying member
  const atRiskMembers: AtRiskMember[] = [];
  const standing = new Map<string, MemberStanding>();

  for (const member of payingMembers) {
    const lastAttendance = lastAttendanceMap.get(member.memberId);

    let daysGone: number;
    let lastAttendanceStr: string | null = null;
    let lastAttendanceTime: string | null = null;
    let lastClass: string | null = null;

    if (lastAttendance) {
      daysGone = daysBetween(lastAttendance.date, now);
      lastAttendanceStr = lastAttendance.date.toISOString().split("T")[0] ?? null;
      lastAttendanceTime = lastAttendance.time;
      lastClass = lastAttendance.className;
    } else {
      // No booking found in last 60 days: gone since they joined, if that's sooner
      const since = memberInfoMap.get(member.memberId)?.memberSince;
      daysGone = since ? Math.min(LOOKBACK_DAYS, daysBetween(new Date(since), now)) : LOOKBACK_DAYS;
    }

    const excluded = excludedMemberIds.has(member.memberId);
    const pt = ptMembers.has(member.memberId);
    const atRisk = daysGone >= AT_RISK_DAYS && !excluded && !pt;
    standing.set(member.memberId, {
      memberId: member.memberId,
      name: member.name,
      daysGone,
      lastAttendance: lastAttendanceStr,
      monthlyRevenue: member.revenue,
      atRisk,
      excluded,
      pt,
    });

    // Only include members who are "at risk" (14+ days gone) and not excluded
    if (atRisk) {
      const tier = getStatusTier(daysGone);
      const memberInfo = memberInfoMap.get(member.memberId);
      const weeklyVisits = weeklyVisitsMap.get(member.memberId) || { week0: 0, week1: 0, week2: 0, week3: 0, week4: 0 };
      const totalVisits = weeklyVisits.week0 + weeklyVisits.week1 + weeklyVisits.week2 + weeklyVisits.week3;
      atRiskMembers.push({
        memberId: member.memberId,
        name: member.name,
        daysGone,
        lastAttendance: lastAttendanceStr,
        lastAttendanceTime,
        statusTier: tier.label,
        returnRate: tier.returnRate,
        monthlyRevenue: member.revenue,
        paidBy: member.paidBy?.name ?? null,
        lastClass,
        memberSince: memberInfo?.memberSince || null,
        membershipType: memberInfo?.membershipType || null,
        phone: memberInfo?.phone || null,
        tenureMonths: memberInfo?.tenureMonths || 0,
        weeklyVisits,
        totalVisits,
      });
    }
  }

  // 6. Sort by days gone (most urgent first)
  atRiskMembers.sort((a, b) => b.daysGone - a.daysGone);

  return { roster, members: atRiskMembers, standing, excludedMemberIds, ptMembers, bookingsQueried: bookings.length, gymMasterError };
}
