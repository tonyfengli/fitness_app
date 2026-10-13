/**
 * Clients Needing Review API
 * GET /api/admin/clients-needing-review?year=2026&month=10
 *
 * Identifies members who may need attention:
 * - Received refunds
 * - On hold
 * - Paid less than expected
 */

import { NextRequest, NextResponse } from "next/server";

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
  expected: number;
  paid: number;
  refunded: number;
  net: number;
}

interface ClientNeedingReview {
  memberId: string;
  memberName: string;
  expected: number;
  paid: number;
  refunded: number;
  net: number;
  statusFlags: ReviewStatusFlag[];
  isOnHold: boolean;
  paymentHistory: PaymentHistoryEntry[];
  // Billing data from Report 130
  billingAttempts: BillingAttempt[];
  billingStatus: BillingStatus;
  billingFailReason: string | null;
}

interface MonthlyReviewSummary {
  monthKey: string;
  monthName: string;
  clientsNeedingReview: number;
  refundCount: number;
  onHoldCount: number;
  notPaidCount: number;
  billingFailedCount: number;
}

interface ClientsNeedingReviewResponse {
  year: number;
  selectedMonth: string | null;
  monthlySummaries: MonthlyReviewSummary[];
  clients: ClientNeedingReview[];
}

// Helper functions
async function fetchGymMasterPayments(
  startDate: string,
  endDate: string
): Promise<Record<string, unknown>[]> {
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
      report_id: 103, // ALL_PAYMENTS
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

async function fetchBillingBatches(
  startDate: string,
  endDate: string
): Promise<Map<string, BillingAttempt[]>> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  if (!baseUrl || !apiKey) return new Map();

  try {
    const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-GM-API-KEY": apiKey,
      },
      body: JSON.stringify({
        report_id: 130, // BILLING_BATCHES
        start_date: startDate,
        end_date: endDate,
      }),
    });

    if (!response.ok) return new Map();
    const data = await response.json();
    const result = data.result || [];

    const billingByMember = new Map<string, BillingAttempt[]>();
    for (const row of result) {
      const memberId = String(row["Member ID"] || "");
      if (!memberId) continue;

      const failed = row["Failed"] === true;
      const billingStatus = row["Billing Status"] as string;
      let status: BillingStatus = "PENDING";
      if (billingStatus === "SUCCESS") status = "SUCCESS";
      else if (billingStatus === "REFUSED" || failed) status = "REFUSED";

      const attempt: BillingAttempt = {
        date: String(row["Billing Date"] || ""),
        amount: parseFloat(String(row["Amount"] || "0").replace(/[$,]/g, "")),
        status,
        failReason: row["Fail Reason"] ? String(row["Fail Reason"]) : null,
      };

      if (!billingByMember.has(memberId)) {
        billingByMember.set(memberId, []);
      }
      billingByMember.get(memberId)!.push(attempt);
    }
    return billingByMember;
  } catch {
    return new Map();
  }
}

async function fetchMembersOnHold(
  startDate: string,
  endDate: string
): Promise<Set<string>> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  if (!baseUrl || !apiKey) return new Set();

  try {
    const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-GM-API-KEY": apiKey,
      },
      body: JSON.stringify({
        report_id: 314, // MEMBERS_ON_HOLD
        start_date: startDate,
        end_date: endDate,
      }),
    });

    if (!response.ok) return new Set();
    const data = await response.json();
    const result = data.result || [];

    const onHoldIds = new Set<string>();
    for (const row of result) {
      const memberId = String(row["Member ID"] || "");
      if (memberId) onHoldIds.add(memberId);
    }
    return onHoldIds;
  } catch {
    return new Set();
  }
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
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const selectedMonth = searchParams.get("month"); // Optional: "01" to "12"

  try {
    // Fetch full year of payments (need history for expected calculation)
    // Extend to previous year for January lookback
    const extendedStartDate = `${year - 1}-10-01`; // Oct of previous year
    const endDate = `${year}-12-31`;

    const gmPayments = await fetchGymMasterPayments(extendedStartDate, endDate);

    // Build payment history by member: Map<memberId, Map<monthKey, {paid, refunded, name}>>
    type MemberMonthData = { paid: number; refunded: number; name: string };
    const paymentsByMember = new Map<string, Map<string, MemberMonthData>>();

    for (const payment of gmPayments) {
      const memberId = String(payment["Member ID"] || "");
      const memberName = String(payment["Name"] || "");
      const amount = parseAmount(payment["Payment Amount"]);
      const dateStr = String(payment["Payment Date"] || "");
      const details = String(payment["Payment Details"] || "").toLowerCase();
      const monthKey = getMonthKey(dateStr);

      if (!memberId || !monthKey) continue;

      if (!paymentsByMember.has(memberId)) {
        paymentsByMember.set(memberId, new Map());
      }
      const memberData = paymentsByMember.get(memberId)!;

      if (!memberData.has(monthKey)) {
        memberData.set(monthKey, { paid: 0, refunded: 0, name: memberName });
      }
      const monthData = memberData.get(monthKey)!;
      if (!monthData.name && memberName) monthData.name = memberName;

      if (amount < 0 || details.includes("payment refund")) {
        // Refund
        monthData.refunded += Math.abs(amount);
      } else if (amount > 0) {
        // Count all positive payments (including those later refunded)
        // The refund will be counted separately, giving correct net
        monthData.paid += amount;
      }
    }

    // Determine which months to analyze (current year only)
    const now = new Date();
    const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : 12;
    const monthsToAnalyze: string[] = [];
    for (let m = 1; m <= currentMonth; m++) {
      monthsToAnalyze.push(`${year}-${String(m).padStart(2, "0")}`);
    }

    // Fetch on-hold members and billing batches for each month (cache for efficiency)
    const onHoldByMonth = new Map<string, Set<string>>();
    const billingByMonth = new Map<string, Map<string, BillingAttempt[]>>();
    for (const monthKey of monthsToAnalyze) {
      const [y, m] = monthKey.split("-").map(Number);
      const { startDate, endDate: monthEnd } = getMonthRange(y!, m!);
      const onHoldIds = await fetchMembersOnHold(startDate, monthEnd);
      const billingData = await fetchBillingBatches(startDate, monthEnd);
      onHoldByMonth.set(monthKey, onHoldIds);
      billingByMonth.set(monthKey, billingData);
    }

    // Calculate monthly summaries and detailed clients
    const monthlySummaries: MonthlyReviewSummary[] = [];
    let selectedMonthClients: ClientNeedingReview[] = [];

    for (const monthKey of monthsToAnalyze) {
      const onHoldIds = onHoldByMonth.get(monthKey) || new Set();
      const billingData = billingByMonth.get(monthKey) || new Map();

      // Get lookback months (X-1, X-2, X-3)
      const lookbackMonths = [
        getPreviousMonthKey(monthKey, 1),
        getPreviousMonthKey(monthKey, 2),
        getPreviousMonthKey(monthKey, 3),
      ];

      // Find all members who paid in any lookback month
      const candidateMembers = new Set<string>();
      for (const [memberId, memberMonths] of paymentsByMember) {
        for (const lbMonth of lookbackMonths) {
          const data = memberMonths.get(lbMonth);
          if (data && data.paid > 0) {
            candidateMembers.add(memberId);
            break;
          }
        }
      }

      // Analyze each candidate
      const clientsForMonth: ClientNeedingReview[] = [];
      let refundCount = 0;
      let onHoldCount = 0;
      let notPaidCount = 0;
      let billingFailedCount = 0;

      for (const memberId of candidateMembers) {
        const memberMonths = paymentsByMember.get(memberId)!;

        // Calculate expected (avg of non-zero payments from X-1, X-2, X-3)
        const lookbackPayments: number[] = [];
        for (const lbMonth of lookbackMonths) {
          const data = memberMonths.get(lbMonth);
          if (data && data.paid > 0) {
            lookbackPayments.push(data.paid);
          }
        }

        // Skip if < 2 non-zero months (too new)
        if (lookbackPayments.length < 2) continue;

        const expected = lookbackPayments.reduce((a, b) => a + b, 0) / lookbackPayments.length;

        // Get current month data
        const currentData = memberMonths.get(monthKey) || { paid: 0, refunded: 0, name: "" };
        const paid = currentData.paid;
        const refunded = currentData.refunded;
        const net = paid - refunded;

        // Get member name from most recent data
        let memberName = currentData.name;
        if (!memberName) {
          for (const [, data] of memberMonths) {
            if (data.name) {
              memberName = data.name;
              break;
            }
          }
        }

        // Get billing attempts for this member
        const memberBillingAttempts = billingData.get(memberId) || [];

        // Determine overall billing status
        let billingStatus: BillingStatus = "NO_ATTEMPT";
        let billingFailReason: string | null = null;

        if (memberBillingAttempts.length > 0) {
          // Check if any billing succeeded
          const hasSuccess = memberBillingAttempts.some((b: BillingAttempt) => b.status === "SUCCESS");
          const hasRefused = memberBillingAttempts.some((b: BillingAttempt) => b.status === "REFUSED");

          if (hasSuccess && !hasRefused) {
            billingStatus = "SUCCESS";
          } else if (hasRefused) {
            billingStatus = "REFUSED";
            const failedAttempt = memberBillingAttempts.find((b: BillingAttempt) => b.status === "REFUSED");
            billingFailReason = failedAttempt?.failReason || "Payment refused";
          } else {
            billingStatus = "PENDING";
          }
        }

        // Determine status flags
        const statusFlags: ReviewStatusFlag[] = [];
        const isOnHold = onHoldIds.has(memberId);

        if (refunded > 0) {
          statusFlags.push("Refund");
          refundCount++;
        }
        if (isOnHold) {
          statusFlags.push("On Hold");
          onHoldCount++;
        }
        if (billingStatus === "REFUSED") {
          statusFlags.push("Billing Failed");
          billingFailedCount++;
        }
        if (net < expected && refunded === 0 && billingStatus !== "REFUSED") {
          statusFlags.push("Not Paid");
          notPaidCount++;
        }

        // Include if needs review (has flags OR net < expected)
        if (statusFlags.length > 0 || net < expected) {
          // Build 6-month payment history relative to selected month
          const paymentHistory: PaymentHistoryEntry[] = [];
          for (let i = 5; i >= 0; i--) {
            const histMonth = getPreviousMonthKey(monthKey, i);
            const histData = memberMonths.get(histMonth) || { paid: 0, refunded: 0 };
            paymentHistory.push({
              monthKey: histMonth,
              monthName: getMonthName(histMonth),
              expected: i === 0 ? expected : expected, // Same expected for context
              paid: histData.paid,
              refunded: histData.refunded,
              net: histData.paid - histData.refunded,
            });
          }

          clientsForMonth.push({
            memberId,
            memberName: memberName || "Unknown",
            expected: Math.round(expected * 100) / 100,
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
      }

      // Sort clients by net (lowest first - most concerning)
      clientsForMonth.sort((a, b) => a.net - b.net);

      monthlySummaries.push({
        monthKey,
        monthName: getMonthName(monthKey),
        clientsNeedingReview: clientsForMonth.length,
        refundCount,
        onHoldCount,
        notPaidCount,
        billingFailedCount,
      });

      // Store detailed clients for selected month
      if (selectedMonth && monthKey === `${year}-${selectedMonth.padStart(2, "0")}`) {
        selectedMonthClients = clientsForMonth;
      }
    }

    const response: ClientsNeedingReviewResponse = {
      year,
      selectedMonth: selectedMonth ? `${year}-${selectedMonth.padStart(2, "0")}` : null,
      monthlySummaries,
      clients: selectedMonthClients,
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
