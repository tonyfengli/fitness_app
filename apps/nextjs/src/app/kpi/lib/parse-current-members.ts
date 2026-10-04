import * as Papa from "papaparse";

export interface MembershipTypeStats {
  typeName: string;
  count: number;
  monthlyFee: number; // Most common fee for this type
  totalMonthlyRevenue: number; // count * monthlyFee
}

export interface MissingPaymentMember {
  memberId: string;
  name: string;
  membershipType: string;
  expectedFee: number;
  reason: "on_hold" | "cancelled" | "unexplained"; // Categorized reason
  holdReason?: string; // If on hold, the reason from the report
  cancelReason?: string; // If cancelled, the reason from the report
}

export interface CurrentMembersResult {
  totalMembers: number;

  // Breakdown by membership type
  membershipTypes: MembershipTypeStats[];

  // Price lookup table: Membership Type Name -> Monthly Fee
  priceLookup: Map<string, number>;

  // For display
  payingMembers: number; // Members with fee > 0
  freeMembers: number; // Members with fee = 0

  // Billing frequency breakdown
  monthlyBilling: number;
  biweeklyBilling: number;
  otherBilling: number;

  // Cross-reference: paying members who didn't pay
  actualPayingMembers: number; // Members who actually paid (from All Payments)
  missingPayments: MissingPaymentMember[]; // All paying members with no payment
  missingOnHold: MissingPaymentMember[]; // Subset: on hold (expected)
  missingCancelled: MissingPaymentMember[]; // Subset: cancelled (expected)
  missingUnexplained: MissingPaymentMember[]; // Subset: unexplained (needs investigation)
  missingOnHoldRevenue: number; // Expected missing (on hold)
  missingCancelledRevenue: number; // Expected missing (cancelled)
  missingUnexplainedRevenue: number; // Unexpected missing (needs investigation)
}

interface CurrentMembersRow {
  "Member ID": string;
  "Member Name": string;
  "Membership Type Name": string;
  "Membership Fee": string;
  "Price Description": string;
  "All Memberships": string;
}

interface AllPaymentsRow {
  "Member ID": string;
  "Payment Amount": string;
  "Payment Details": string;
}

interface MembersOnHoldRow {
  "Member ID": string;
  "Member Name": string;
  "Reason": string;
}

interface CancellationsRow {
  "Member ID": string;
  "Member Name": string;
  "Cancel Reason": string;
  "Membership Feedback": string;
}

export async function parseCurrentMembers(
  currentMembersCsv: string,
  allPaymentsCsv?: string,
  membersOnHoldCsv?: string,
  cancellationsCsv?: string
): Promise<CurrentMembersResult> {
  console.log("=== parseCurrentMembers DEBUG ===");

  // Step 1: Parse All Payments to get who actually paid (net amount > 0)
  const membersPaid = new Set<string>();
  const memberPaymentTotals = new Map<string, number>();

  if (allPaymentsCsv) {
    await new Promise<void>((resolve) => {
      Papa.parse<AllPaymentsRow>(allPaymentsCsv, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          // First pass: calculate net totals per member (let refunds net out naturally)
          for (const row of results.data) {
            const memberId = row["Member ID"] || "";
            const amount = parseFloat(row["Payment Amount"]?.replace(/[^0-9.-]/g, "") || "0") || 0;

            if (memberId) {
              const current = memberPaymentTotals.get(memberId) || 0;
              memberPaymentTotals.set(memberId, current + amount);
            }
          }
          // Second pass: only count as "paid" if net amount > 0
          for (const [memberId, total] of memberPaymentTotals) {
            if (total > 0) {
              membersPaid.add(memberId);
            }
          }
          console.log("Members who paid:", membersPaid.size);
          resolve();
        },
      });
    });
  }

  // Step 2: Parse Members on Hold to get who is frozen
  const membersOnHold = new Map<string, string>(); // memberId -> reason

  if (membersOnHoldCsv) {
    await new Promise<void>((resolve) => {
      Papa.parse<MembersOnHoldRow>(membersOnHoldCsv, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          for (const row of results.data) {
            const memberId = row["Member ID"] || "";
            const reason = row["Reason"] || "On hold";

            if (memberId) {
              membersOnHold.set(memberId, reason);
            }
          }
          console.log("Members on hold:", membersOnHold.size);
          resolve();
        },
      });
    });
  }

  // Step 3: Parse Cancellations to get who cancelled
  const membersCancelled = new Map<string, string>(); // memberId -> reason

  if (cancellationsCsv) {
    await new Promise<void>((resolve) => {
      Papa.parse<CancellationsRow>(cancellationsCsv, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          for (const row of results.data) {
            const memberId = row["Member ID"] || "";
            const cancelReason = row["Cancel Reason"] || "";
            const feedback = row["Membership Feedback"] || "";

            // Only count actual cancellations, not membership changes
            if (memberId && cancelReason === "Cancelled") {
              membersCancelled.set(memberId, feedback || "Cancelled");
            }
          }
          console.log("Members cancelled:", membersCancelled.size);
          resolve();
        },
      });
    });
  }

  const membershipTypeMap = new Map<string, { count: number; fees: number[]; }>();
  const priceLookup = new Map<string, number>();

  // Track paying members for cross-reference
  const payingMembersList: { memberId: string; name: string; membershipType: string; fee: number; }[] = [];

  let totalMembers = 0;
  let payingMembers = 0;
  let freeMembers = 0;
  let monthlyBilling = 0;
  let biweeklyBilling = 0;
  let otherBilling = 0;

  await new Promise<void>((resolve) => {
    Papa.parse<CurrentMembersRow>(currentMembersCsv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log("Current Members parsed rows:", results.data.length);

        for (const row of results.data) {
          const memberId = row["Member ID"] || "";
          const name = row["Member Name"] || "";
          const membershipType = row["Membership Type Name"] || "Unknown";
          const feeStr = row["Membership Fee"] || "0";
          const fee = parseFloat(feeStr.replace(/[^0-9.-]/g, "")) || 0;
          const priceDesc = row["Price Description"] || "";

          totalMembers++;

          // Count paying vs free
          if (fee > 0) {
            payingMembers++;
            payingMembersList.push({ memberId, name, membershipType, fee });
          } else {
            freeMembers++;
          }

          // Billing frequency
          if (priceDesc.toLowerCase().includes("monthly")) {
            monthlyBilling++;
          } else if (priceDesc.toLowerCase().includes("fortnightly") || priceDesc.toLowerCase().includes("bi-weekly")) {
            biweeklyBilling++;
          } else {
            otherBilling++;
          }

          // Track membership types
          const existing = membershipTypeMap.get(membershipType);
          if (existing) {
            existing.count++;
            existing.fees.push(fee);
          } else {
            membershipTypeMap.set(membershipType, { count: 1, fees: [fee] });
          }
        }

        // Build price lookup (use most common fee for each type)
        for (const [typeName, data] of membershipTypeMap) {
          const nonZeroFees = data.fees.filter(f => f > 0);
          if (nonZeroFees.length > 0) {
            const feeFrequency = new Map<number, number>();
            for (const fee of nonZeroFees) {
              feeFrequency.set(fee, (feeFrequency.get(fee) || 0) + 1);
            }
            let mostCommonFee = nonZeroFees[0]!;
            let maxFreq = 0;
            for (const [fee, freq] of feeFrequency) {
              if (freq > maxFreq) {
                maxFreq = freq;
                mostCommonFee = fee;
              }
            }
            priceLookup.set(typeName, mostCommonFee);
          } else {
            priceLookup.set(typeName, 0);
          }
        }

        resolve();
      },
    });
  });

  // Build membership type stats array
  const membershipTypes: MembershipTypeStats[] = [];
  for (const [typeName, data] of membershipTypeMap) {
    const monthlyFee = priceLookup.get(typeName) || 0;
    membershipTypes.push({
      typeName,
      count: data.count,
      monthlyFee,
      totalMonthlyRevenue: data.count * monthlyFee,
    });
  }
  membershipTypes.sort((a, b) => b.count - a.count);

  // Cross-reference: find paying members who didn't pay and categorize
  const missingPayments: MissingPaymentMember[] = [];
  const missingOnHold: MissingPaymentMember[] = [];
  const missingCancelled: MissingPaymentMember[] = [];
  const missingUnexplained: MissingPaymentMember[] = [];

  for (const member of payingMembersList) {
    if (!membersPaid.has(member.memberId)) {
      const isOnHold = membersOnHold.has(member.memberId);
      const isCancelled = membersCancelled.has(member.memberId);
      const holdReason = membersOnHold.get(member.memberId);
      const cancelReason = membersCancelled.get(member.memberId);

      // Determine reason (priority: on_hold > cancelled > unexplained)
      let reason: "on_hold" | "cancelled" | "unexplained" = "unexplained";
      if (isOnHold) {
        reason = "on_hold";
      } else if (isCancelled) {
        reason = "cancelled";
      }

      const entry: MissingPaymentMember = {
        memberId: member.memberId,
        name: member.name,
        membershipType: member.membershipType,
        expectedFee: member.fee,
        reason,
        holdReason,
        cancelReason,
      };

      missingPayments.push(entry);

      if (isOnHold) {
        missingOnHold.push(entry);
      } else if (isCancelled) {
        missingCancelled.push(entry);
      } else {
        missingUnexplained.push(entry);
      }
    }
  }

  const missingOnHoldRevenue = missingOnHold.reduce((sum, m) => sum + m.expectedFee, 0);
  const missingCancelledRevenue = missingCancelled.reduce((sum, m) => sum + m.expectedFee, 0);
  const missingUnexplainedRevenue = missingUnexplained.reduce((sum, m) => sum + m.expectedFee, 0);
  const actualPayingMembers = membersPaid.size;

  console.log("=== CURRENT MEMBERS RESULTS ===");
  console.log("Total:", totalMembers);
  console.log("Paying (should pay):", payingMembers);
  console.log("Actually paid:", actualPayingMembers);
  console.log("Missing - On Hold:", missingOnHold.length);
  console.log("Missing - Cancelled:", missingCancelled.length);
  console.log("Missing - Unexplained:", missingUnexplained.length);

  return {
    totalMembers,
    membershipTypes,
    priceLookup,
    payingMembers,
    freeMembers,
    monthlyBilling,
    biweeklyBilling,
    otherBilling,
    actualPayingMembers,
    missingPayments,
    missingOnHold,
    missingCancelled,
    missingUnexplained,
    missingOnHoldRevenue,
    missingCancelledRevenue,
    missingUnexplainedRevenue,
  };
}

/**
 * Helper to look up price for a membership type
 * Exported so other parsers can use it
 */
export function getMembershipPrice(
  priceLookup: Map<string, number>,
  membershipTypeName: string
): number {
  // Try exact match first
  if (priceLookup.has(membershipTypeName)) {
    return priceLookup.get(membershipTypeName)!;
  }

  // Try partial match (membership names can vary slightly)
  for (const [typeName, price] of priceLookup) {
    if (
      typeName.toLowerCase().includes(membershipTypeName.toLowerCase()) ||
      membershipTypeName.toLowerCase().includes(typeName.toLowerCase())
    ) {
      return price;
    }
  }

  return 0;
}
