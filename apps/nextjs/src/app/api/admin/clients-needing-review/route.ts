/**
 * Clients Needing Review API
 * POST /api/admin/clients-needing-review
 *
 * Body: { year: number, excludeFromLost?: string[] }
 *
 * Identifies ACTIVE members who may need attention:
 * - Active = in Current Members OR excluded from "lost" by user
 * - Has payment issue: refund, on hold, underpaid, billing failed
 */

import { NextRequest, NextResponse } from "next/server";
import { validateApiAccess } from "~/lib/api-auth";

// Types
type ReviewStatusFlag = "Refund" | "On Hold" | "Not Paid" | "Billing Failed";
type BillingStatus = "SUCCESS" | "REFUSED" | "PENDING" | "NO_ATTEMPT";

interface BillingAttempt {
  date: string;
  amount: number;
  status: BillingStatus;
  failReason: string | null;
}

interface PaymentHistoryEntry {
  monthKey: string;
  monthName: string;
  paid: number;
  refunded: number;
  net: number;
}

interface ClientNeedingReview {
  memberId: string;
  memberName: string;
  membershipType: string;
  membershipFee: number;
  paid: number;
  refunded: number;
  net: number;
  statusFlags: ReviewStatusFlag[];
  isOnHold: boolean;
  paymentHistory: PaymentHistoryEntry[];
  billingAttempts: BillingAttempt[];
  billingStatus: BillingStatus;
  billingFailReason: string | null;
}

interface ClientsNeedingReviewResponse {
  year: number;
  month: string;
  monthName: string;
  clients: ClientNeedingReview[];
  summary: {
    total: number;
    refundCount: number;
    onHoldCount: number;
    notPaidCount: number;
    billingFailedCount: number;
  };
}

// Helper: fetch GymMaster report
async function fetchReport(reportId: number, startDate: string, endDate: string): Promise<Record<string, unknown>[]> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing GymMaster configuration");
  }

  const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-GM-API-KEY": apiKey,
    },
    body: JSON.stringify({
      report_id: reportId,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  if (!response.ok) {
    throw new Error(`GymMaster API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result || [];
}

function parseAmount(value: unknown): number {
  return parseFloat(String(value || "0").replace(/[$,]/g, ""));
}

function getMonthKey(dateStr: string): string {
  if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateStr.substring(0, 7);
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getMonthName(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  if (!year || !month) return monthKey;
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getMonthRange(year: number, month: number): { startDate: string; endDate: string } {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  return { startDate, endDate };
}

function getPreviousMonthKey(monthKey: string, monthsBack: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year!, month! - 1);
  date.setMonth(date.getMonth() - monthsBack);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const year = body.year || new Date().getFullYear();
    const excludeFromLost: string[] = body.excludeFromLost || [];

    // Determine current month
    const now = new Date();
    const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : 12;
    const monthKey = `${year}-${String(currentMonth).padStart(2, "0")}`;
    const { startDate, endDate } = getMonthRange(year, currentMonth);

    // Fetch data in parallel
    const [currentMembersRaw, onHoldRaw, billingRaw, paymentsRaw] = await Promise.all([
      fetchReport(1, startDate, endDate),   // CURRENT_MEMBERS
      fetchReport(314, startDate, endDate), // MEMBERS_ON_HOLD
      fetchReport(130, startDate, endDate), // BILLING_BATCHES
      // Fetch 6 months of payments for history
      fetchReport(103, getPreviousMonthKey(monthKey, 5).replace(/-/, "-") + "-01", endDate),
    ]);

    // Build Current Members set with membership info
    const currentMembers = new Map<string, { name: string; membershipType: string; fee: number }>();
    for (const row of currentMembersRaw) {
      const memberId = String(row["Member ID"] || "");
      const name = String(row["Member Name"] || "");
      const membershipType = String(row["Membership Type Name"] || "");
      const fee = parseAmount(row["Membership Fee"]);
      if (memberId) {
        currentMembers.set(memberId, { name, membershipType, fee });
      }
    }

    // Build On Hold set
    const onHoldIds = new Set<string>();
    for (const row of onHoldRaw) {
      const memberId = String(row["Member ID"] || "");
      if (memberId) onHoldIds.add(memberId);
    }

    // Build Billing data by member
    const billingByMember = new Map<string, BillingAttempt[]>();
    for (const row of billingRaw) {
      const memberId = String(row["Member ID"] || "");
      if (!memberId) continue;

      const failed = row["Failed"] === true;
      const billingStatus = row["Billing Status"] as string;
      let status: BillingStatus = "PENDING";
      if (billingStatus === "SUCCESS") status = "SUCCESS";
      else if (billingStatus === "REFUSED" || failed) status = "REFUSED";

      const attempt: BillingAttempt = {
        date: String(row["Billing Date"] || ""),
        amount: parseAmount(row["Amount"]),
        status,
        failReason: row["Fail Reason"] ? String(row["Fail Reason"]) : null,
      };

      if (!billingByMember.has(memberId)) {
        billingByMember.set(memberId, []);
      }
      billingByMember.get(memberId)!.push(attempt);
    }

    // Build payment history by member
    type MemberMonthData = { paid: number; refunded: number; name: string };
    const paymentsByMember = new Map<string, Map<string, MemberMonthData>>();

    for (const payment of paymentsRaw) {
      const memberId = String(payment["Member ID"] || "");
      const memberName = String(payment["Name"] || "");
      const amount = parseAmount(payment["Payment Amount"]);
      const dateStr = String(payment["Payment Date"] || "");
      const details = String(payment["Payment Details"] || "").toLowerCase();
      const paymentMonthKey = getMonthKey(dateStr);

      if (!memberId || !paymentMonthKey) continue;

      if (!paymentsByMember.has(memberId)) {
        paymentsByMember.set(memberId, new Map());
      }
      const memberData = paymentsByMember.get(memberId)!;

      if (!memberData.has(paymentMonthKey)) {
        memberData.set(paymentMonthKey, { paid: 0, refunded: 0, name: memberName });
      }
      const monthData = memberData.get(paymentMonthKey)!;
      if (!monthData.name && memberName) monthData.name = memberName;

      if (amount < 0 || details.includes("payment refund")) {
        monthData.refunded += Math.abs(amount);
      } else if (amount > 0) {
        monthData.paid += amount;
      }
    }

    // Determine active members: Current Members OR excluded from lost
    const activeMembers = new Set<string>();
    for (const memberId of currentMembers.keys()) {
      activeMembers.add(memberId);
    }
    for (const memberId of excludeFromLost) {
      activeMembers.add(memberId);
    }

    // Analyze each active member
    const clients: ClientNeedingReview[] = [];
    let refundCount = 0;
    let onHoldCount = 0;
    let notPaidCount = 0;
    let billingFailedCount = 0;

    for (const memberId of activeMembers) {
      const memberInfo = currentMembers.get(memberId);
      const memberMonths = paymentsByMember.get(memberId);

      // Get current month payment data
      const currentPaymentData = memberMonths?.get(monthKey) || { paid: 0, refunded: 0, name: "" };
      const paid = currentPaymentData.paid;
      const refunded = currentPaymentData.refunded;
      const net = paid - refunded;

      // Get member name (from current members or payment data)
      let memberName = memberInfo?.name || currentPaymentData.name || "";
      if (!memberName && memberMonths) {
        for (const [, data] of memberMonths) {
          if (data.name) {
            memberName = data.name;
            break;
          }
        }
      }

      const membershipType = memberInfo?.membershipType || "";
      const membershipFee = memberInfo?.fee || 0;

      // Get billing data
      const memberBillingAttempts = billingByMember.get(memberId) || [];
      let billingStatus: BillingStatus = "NO_ATTEMPT";
      let billingFailReason: string | null = null;

      if (memberBillingAttempts.length > 0) {
        const hasSuccess = memberBillingAttempts.some(b => b.status === "SUCCESS");
        const hasRefused = memberBillingAttempts.some(b => b.status === "REFUSED");

        if (hasSuccess && !hasRefused) {
          billingStatus = "SUCCESS";
        } else if (hasRefused) {
          billingStatus = "REFUSED";
          const failedAttempt = memberBillingAttempts.find(b => b.status === "REFUSED");
          billingFailReason = failedAttempt?.failReason || "Payment refused";
        } else {
          billingStatus = "PENDING";
        }
      }

      const isOnHold = onHoldIds.has(memberId);

      // Determine status flags
      const statusFlags: ReviewStatusFlag[] = [];

      if (refunded > 0) {
        statusFlags.push("Refund");
      }
      if (isOnHold) {
        statusFlags.push("On Hold");
      }
      if (billingStatus === "REFUSED") {
        statusFlags.push("Billing Failed");
      }
      // "Not Paid" = paid less than membership fee (and no refund, not billing failed)
      if (membershipFee > 0 && net < membershipFee && refunded === 0 && billingStatus !== "REFUSED") {
        statusFlags.push("Not Paid");
      }

      // Only include if has flags (has an issue)
      if (statusFlags.length === 0) continue;

      // Count flags
      if (statusFlags.includes("Refund")) refundCount++;
      if (statusFlags.includes("On Hold")) onHoldCount++;
      if (statusFlags.includes("Billing Failed")) billingFailedCount++;
      if (statusFlags.includes("Not Paid")) notPaidCount++;

      // Build 6-month payment history
      const paymentHistory: PaymentHistoryEntry[] = [];
      for (let i = 5; i >= 0; i--) {
        const histMonth = getPreviousMonthKey(monthKey, i);
        const histData = memberMonths?.get(histMonth) || { paid: 0, refunded: 0 };
        paymentHistory.push({
          monthKey: histMonth,
          monthName: getMonthName(histMonth),
          paid: histData.paid,
          refunded: histData.refunded,
          net: histData.paid - histData.refunded,
        });
      }

      clients.push({
        memberId,
        memberName: memberName || "Unknown",
        membershipType,
        membershipFee,
        paid,
        refunded,
        net,
        statusFlags,
        isOnHold,
        paymentHistory,
        billingAttempts: memberBillingAttempts,
        billingStatus,
        billingFailReason,
      });
    }

    // Sort by net (lowest first - most concerning)
    clients.sort((a, b) => a.net - b.net);

    const response: ClientsNeedingReviewResponse = {
      year,
      month: monthKey,
      monthName: getMonthName(monthKey),
      clients,
      summary: {
        total: clients.length,
        refundCount,
        onHoldCount,
        notPaidCount,
        billingFailedCount,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Clients needing review error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch data" },
      { status: 500 }
    );
  }
}

// Keep GET for backwards compatibility (without filtering)
export async function GET(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  // Create a mock request with empty excludeFromLost
  const mockRequest = {
    json: async () => ({ year, excludeFromLost: [] }),
  } as NextRequest;

  return POST(mockRequest);
}
