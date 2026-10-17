/**
 * Administrative Refunds Summary API
 * GET /api/admin/refunds-summary?year=2026
 * Returns refunds with member payment history and "on track" status
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Lazy init to avoid build-time errors when env vars aren't available
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });
}

interface MemberPaymentHistory {
  month: string;
  expected: number;
  actual: number;
}

interface RefundWithHistory {
  refundId: string;
  refundDate: string;
  refundAmount: number;
  memberName: string;
  memberId: string | null;
  originalCharge: number;
  netKept: number;
  reason: string;
  status: "on_track" | "needs_review";
  paymentHistory: MemberPaymentHistory[];
}

interface MonthlyRefundSummary {
  month: string;
  count: number;
  totalAmount: number;
}

async function fetchGymMasterPayments(
  startDate: string,
  endDate: string
): Promise<Record<string, any>[]> {
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

async function fetchCurrentMembers(year: number): Promise<Record<string, any>[]> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  if (!baseUrl || !apiKey) {
    return []; // Return empty if config missing
  }

  try {
    const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-GM-API-KEY": apiKey,
      },
      body: JSON.stringify({
        report_id: 1, // CURRENT_MEMBERS
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
      }),
    });

    if (!response.ok) {
      console.warn("CURRENT_MEMBERS report unavailable, using payment history for expected amounts");
      return [];
    }

    const data = await response.json();
    return data.result || [];
  } catch (err) {
    console.warn("Failed to fetch CURRENT_MEMBERS:", err);
    return [];
  }
}

function parseAmount(value: any): number {
  return parseFloat(String(value || "0").replace(/[$,]/g, ""));
}

function getMonthKey(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthName(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year!), parseInt(month!) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Convert "First Last" to "last, first" format for GymMaster lookup
function convertToGymMasterFormat(stripeName: string): string[] {
  const name = stripeName.toLowerCase().trim();
  const parts = name.split(/\s+/).filter(Boolean);

  const formats: string[] = [name]; // Include original

  if (parts.length >= 2) {
    // "First Last" -> "last, first"
    const lastName = parts[parts.length - 1];
    const firstName = parts.slice(0, -1).join(" ");
    formats.push(`${lastName}, ${firstName}`);

    // Also try just "last, first" with single first name
    if (parts.length > 2) {
      formats.push(`${lastName}, ${parts[0]}`);
    }
  }

  return formats;
}

// Find matching GymMaster name key with fuzzy matching
function findGymMasterNameKey(
  stripeName: string,
  paymentsByMember: Map<string, Map<string, number>>
): string | null {
  const nameFormats = convertToGymMasterFormat(stripeName);

  // Try exact matches first
  for (const format of nameFormats) {
    if (paymentsByMember.has(format)) {
      return format;
    }
  }

  const stripeLower = stripeName.toLowerCase().trim();
  const stripeParts = stripeLower.split(/\s+/).filter(Boolean);

  if (stripeParts.length >= 2) {
    const stripeLastName = stripeParts[stripeParts.length - 1];
    const stripeFirstName = stripeParts[0];

    for (const gmName of paymentsByMember.keys()) {
      // GymMaster format: "LastName, FirstName" or "LastName LastName2, FirstName"
      const commaIdx = gmName.indexOf(", ");
      if (commaIdx === -1) continue;

      const gmLastPart = gmName.substring(0, commaIdx);
      const gmFirstPart = gmName.substring(commaIdx + 2).split(" ")[0];

      // Check if last names match (exact or partial - Stripe "orozco" in GM "villabon orozco")
      const lastNameMatches =
        gmLastPart === stripeLastName ||
        gmLastPart.endsWith(" " + stripeLastName) ||
        gmLastPart.startsWith(stripeLastName + " ");

      if (!lastNameMatches) continue;

      // Check if first names share a common prefix (at least 3 chars)
      if (gmFirstPart && stripeFirstName.length >= 3 && gmFirstPart.length >= 3) {
        const minLen = Math.min(3, gmFirstPart.length, stripeFirstName.length);
        if (gmFirstPart.substring(0, minLen) === stripeFirstName.substring(0, minLen)) {
          return gmName;
        }
      }
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(searchParams.get("year") || "2026");

  try {
    // Fetch Stripe refunds for the year
    const startTimestamp = Math.floor(new Date(`${year}-01-01`).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(`${year}-12-31T23:59:59`).getTime() / 1000);

    const refunds: Stripe.Refund[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const response = await getStripe().refunds.list({
        created: { gte: startTimestamp, lte: endTimestamp },
        limit: 100,
        expand: ["data.charge"],
        ...(startingAfter && { starting_after: startingAfter }),
      });
      refunds.push(...response.data);
      hasMore = response.has_more;
      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1]!.id;
      }
    }

    // Fetch GymMaster payments for the year (for payment history)
    const gmPayments = await fetchGymMasterPayments(`${year}-01-01`, `${year}-12-31`);

    // Fetch current members for expected amounts and billing comments
    const currentMembers = await fetchCurrentMembers(year);

    // Build member lookup by name and ID
    const memberFeeByName: Map<string, number> = new Map();
    const memberFeeById: Map<string, number> = new Map();
    // Map billing comment (card owner name) → member name
    const billingCommentToMember: Map<string, string> = new Map();

    for (const member of currentMembers) {
      const name = String(member["Member Name"] || "").toLowerCase().trim();
      const id = String(member["Member ID"] || "");
      const fee = parseAmount(member["Membership Fee"]);
      const billingComment = String(member["Member Billing Comment"] || "").toLowerCase().trim();

      if (name && fee > 0) {
        memberFeeByName.set(name, fee);
      }
      if (id && fee > 0) {
        memberFeeById.set(id, fee);
      }
      // Map card owner name to member name (e.g., "marianne tapales" → "lovo, reneil")
      if (billingComment && name) {
        billingCommentToMember.set(billingComment, name);
      }
    }

    // Build payment history by member name
    const paymentsByMember: Map<string, Map<string, number>> = new Map();

    for (const payment of gmPayments) {
      const name = String(payment["Name"] || "").toLowerCase().trim();
      const amount = parseAmount(payment["Payment Amount"]);
      const dateStr = String(payment["Payment Date"] || "");
      const details = String(payment["Payment Details"] || "").toLowerCase();

      // Skip actual refund transactions (negative amounts or "Payment Refund" type)
      // But keep positive charges even if they have "Refunded" in details
      if (amount <= 0) continue;
      if (details.includes("payment refund")) continue;

      const monthKey = getMonthKey(dateStr);
      if (!monthKey || monthKey === "NaN-NaN") continue;

      if (!paymentsByMember.has(name)) {
        paymentsByMember.set(name, new Map());
      }
      const memberPayments = paymentsByMember.get(name)!;
      memberPayments.set(monthKey, (memberPayments.get(monthKey) || 0) + amount);
    }

    // Build GymMaster lookups
    const gmByBillId: Map<string, Record<string, any>> = new Map();
    const gmByMemberId: Map<string, Record<string, any>> = new Map();
    const gmRefundsByName: Map<string, Record<string, any>[]> = new Map();
    const gmRefundsByAmountDate: Map<string, Record<string, any>[]> = new Map();

    for (const payment of gmPayments) {
      const billId = String(payment["Bill ID"] || "");
      const memberId = String(payment["Member ID"] || "");
      const name = String(payment["Name"] || "").toLowerCase().trim();
      const details = String(payment["Payment Details"] || "").toLowerCase();
      const amount = parseAmount(payment["Payment Amount"]);

      if (billId) {
        gmByBillId.set(billId, payment);
      }

      // Store first payment record per member ID for name lookup
      if (memberId && !gmByMemberId.has(memberId)) {
        gmByMemberId.set(memberId, payment);
      }

      if (details.includes("refund") || amount < 0) {
        if (!gmRefundsByName.has(name)) {
          gmRefundsByName.set(name, []);
        }
        gmRefundsByName.get(name)!.push(payment);

        // Index refunds by amount+date for Unknown matching
        const dateStr = String(payment["Payment Date"] || "");
        const refundAmount = Math.abs(amount);
        const key = `${refundAmount.toFixed(2)}`;
        if (!gmRefundsByAmountDate.has(key)) {
          gmRefundsByAmountDate.set(key, []);
        }
        gmRefundsByAmountDate.get(key)!.push(payment);
      }
    }

    // Process each refund
    const refundsWithHistory: RefundWithHistory[] = [];
    const monthlyTotals: Map<string, { count: number; amount: number }> = new Map();

    for (const refund of refunds) {
      const charge = refund.charge as Stripe.Charge | null;
      const refundAmount = refund.amount / 100;
      const refundDate = new Date(refund.created * 1000).toISOString().split("T")[0]!;
      const monthKey = getMonthKey(refundDate);

      // Get customer info
      const customerName = charge?.billing_details?.name || "Unknown";
      const nameLower = customerName.toLowerCase().trim();
      const nameFormats = convertToGymMasterFormat(customerName);

      // Try to find member from Stripe metadata
      const billId = charge?.metadata?.bill_id || null;
      const clientId = charge?.metadata?.clientid || null;
      let memberId: string | null = null;
      let gmRecord: Record<string, any> | null = null;
      let gmNameKey: string | null = null;

      // Try bill_id first
      if (billId && gmByBillId.has(billId)) {
        gmRecord = gmByBillId.get(billId)!;
        memberId = String(gmRecord["Member ID"] || "");
        gmNameKey = String(gmRecord["Name"] || "").toLowerCase().trim();
      }

      // Try clientid (GymMaster Member ID) if no bill_id match
      if (!gmRecord && clientId && gmByMemberId.has(clientId)) {
        gmRecord = gmByMemberId.get(clientId)!;
        memberId = clientId;
        gmNameKey = String(gmRecord["Name"] || "").toLowerCase().trim();
      }

      // If no bill_id match, try to find by name formats with fuzzy matching
      if (!gmNameKey) {
        gmNameKey = findGymMasterNameKey(customerName, paymentsByMember);
      }

      // Check if this is a card owner paying for another member (e.g., Marianne Tapales → Reneil Lovo)
      if (!gmNameKey && billingCommentToMember.has(nameLower)) {
        gmNameKey = billingCommentToMember.get(nameLower)!;
      }

      // For Unknown members, try to match by refund amount + customer email
      if (customerName === "Unknown" && !gmRecord) {
        const amountKey = refundAmount.toFixed(2);
        const candidates = gmRefundsByAmountDate.get(amountKey) || [];

        // Try to extract name hints from customer email (e.g., shantaatkins@icloud.com → shanta, atkins)
        const customerEmail = charge?.receipt_email || "";
        const emailName = customerEmail.split("@")[0]?.toLowerCase() || "";
        const emailParts = emailName.split(/[._-]/).filter(Boolean);

        // Find a GymMaster refund with matching amount (date within ±3 days)
        // Priority: 1) email match + negative amount, 2) email match, 3) negative amount, 4) any match
        const stripeDate = new Date(refundDate);
        let bestCandidate: Record<string, any> | null = null;
        let bestScore = 0;

        for (const candidate of candidates) {
          const gmDateStr = String(candidate["Payment Date"] || "");
          const gmDate = new Date(gmDateStr);
          const daysDiff = Math.abs((stripeDate.getTime() - gmDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysDiff > 3) continue;

          const candidateAmount = parseAmount(candidate["Payment Amount"]);
          const isNegative = candidateAmount < 0;
          const candidateName = String(candidate["Name"] || "").toLowerCase();

          // Score the match
          let score = 1; // Base score for date match

          // Check if email parts appear in the GymMaster name
          const emailMatches = emailParts.some(part =>
            part.length >= 3 && candidateName.includes(part)
          );
          if (emailMatches) score += 10;

          // Prefer negative amounts (actual refund records)
          if (isNegative) score += 5;

          // Prefer closer dates
          score += (3 - daysDiff);

          if (score > bestScore) {
            bestScore = score;
            bestCandidate = candidate;
          }
        }

        if (bestCandidate) {
          gmRecord = bestCandidate;
          memberId = String(bestCandidate["Member ID"] || "");
          gmNameKey = String(bestCandidate["Name"] || "").toLowerCase().trim();
        }
      }

      // Get refund reason from GymMaster
      let reason = "No reason provided";

      // First, check if we have a direct gmRecord match (from amount+date matching)
      if (gmRecord) {
        const note = String(gmRecord["Payment Note"] || "");
        if (note) {
          reason = note;
        }
      }

      // If no reason yet, try looking up by name formats
      if (reason === "No reason provided") {
        // Include gmNameKey in the search if we have it
        const searchFormats = gmNameKey ? [gmNameKey, ...nameFormats] : nameFormats;
        for (const format of searchFormats) {
          const gmRefunds = gmRefundsByName.get(format) || [];
          for (const gmRefund of gmRefunds) {
            const note = String(gmRefund["Payment Note"] || "");
            if (note) {
              reason = note;
              break;
            }
          }
          if (reason !== "No reason provided") break;
        }
      }

      // Get original charge amount
      const originalCharge = charge ? charge.amount / 100 : refundAmount;
      const netKept = originalCharge - refundAmount;

      // Get expected monthly fee from CURRENT_MEMBERS report
      let expectedFee = 0;
      if (memberId && memberFeeById.has(memberId)) {
        expectedFee = memberFeeById.get(memberId)!;
      } else {
        // Try multiple name formats
        for (const format of nameFormats) {
          if (memberFeeByName.has(format)) {
            expectedFee = memberFeeByName.get(format)!;
            break;
          }
        }
      }

      // Build 6-month payment history
      const paymentHistory: MemberPaymentHistory[] = [];
      const memberPayments = paymentsByMember.get(gmNameKey || nameLower) || new Map();

      // Get last 6 months from refund date
      const refundDateObj = new Date(refundDate);
      for (let i = 5; i >= 0; i--) {
        const historyDate = new Date(refundDateObj);
        historyDate.setMonth(historyDate.getMonth() - i);
        const historyMonthKey = `${historyDate.getFullYear()}-${String(historyDate.getMonth() + 1).padStart(2, "0")}`;

        paymentHistory.push({
          month: getMonthName(historyMonthKey),
          expected: expectedFee,
          actual: memberPayments.get(historyMonthKey) || 0,
        });
      }

      // Fallback: Calculate expected from average of non-zero payments if no membership fee found
      if (expectedFee === 0) {
        const nonZeroPayments = paymentHistory.filter((h) => h.actual > 0);
        if (nonZeroPayments.length > 0) {
          const avgPayment = nonZeroPayments.reduce((sum, h) => sum + h.actual, 0) / nonZeroPayments.length;
          // Round to nearest common fee amount ($80, $100, $120, etc.)
          expectedFee = Math.round(avgPayment / 10) * 10;
          // Update payment history with calculated expected
          for (const h of paymentHistory) {
            h.expected = expectedFee;
          }
        }
      }

      // Determine status: "needs_review" if any month actual < expected
      const needsReview = paymentHistory.some((h) => h.actual < h.expected && h.expected > 0);

      // Use GymMaster name if Stripe name is unknown
      let displayName = customerName;
      if (customerName === "Unknown" && gmRecord) {
        const gmName = String(gmRecord["Name"] || "");
        if (gmName) {
          displayName = gmName;
        }
      }

      refundsWithHistory.push({
        refundId: refund.id,
        refundDate,
        refundAmount,
        memberName: displayName,
        memberId,
        originalCharge,
        netKept,
        reason,
        status: needsReview ? "needs_review" : "on_track",
        paymentHistory,
      });

      // Update monthly totals
      if (!monthlyTotals.has(monthKey)) {
        monthlyTotals.set(monthKey, { count: 0, amount: 0 });
      }
      const totals = monthlyTotals.get(monthKey)!;
      totals.count++;
      totals.amount += refundAmount;
    }

    // Sort refunds by date descending
    refundsWithHistory.sort((a, b) => new Date(b.refundDate).getTime() - new Date(a.refundDate).getTime());

    // Convert monthly totals to array and sort
    const monthlySummary: MonthlyRefundSummary[] = Array.from(monthlyTotals.entries())
      .map(([month, data]) => ({
        month: getMonthName(month),
        count: data.count,
        totalAmount: data.amount,
      }))
      .sort((a, b) => {
        // Sort by month chronologically
        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const aMonth = a.month.split(" ")[0]!;
        const bMonth = b.month.split(" ")[0]!;
        return monthOrder.indexOf(aMonth) - monthOrder.indexOf(bMonth);
      });

    // Summary stats
    const totalRefunds = refundsWithHistory.length;
    const totalRefundAmount = refundsWithHistory.reduce((sum, r) => sum + r.refundAmount, 0);
    const needsReviewCount = refundsWithHistory.filter((r) => r.status === "needs_review").length;
    const onTrackCount = refundsWithHistory.filter((r) => r.status === "on_track").length;

    return NextResponse.json({
      year,
      summary: {
        totalRefunds,
        totalRefundAmount,
        needsReviewCount,
        onTrackCount,
      },
      monthlySummary,
      refunds: refundsWithHistory,
    });
  } catch (err) {
    console.error("Admin refunds summary error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
