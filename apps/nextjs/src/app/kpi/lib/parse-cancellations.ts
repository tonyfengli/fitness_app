import * as Papa from "papaparse";

export interface CancellationEntry {
  memberId: string;
  name: string;
  membershipType: string; // The OLD/cancelled membership
  cancellationDate: string;
  feedback: string;
  cancelReason: string; // "Membership Change", "Cancelled", "Expired"
  billingComment: string;
  hadPaymentInPeriod: boolean;
  paymentAmount: number;
  // Price-based calculations
  estimatedMonthlyLoss: number; // Based on membership type price lookup
  // For membership changes
  newMembershipType?: string;
  newMembershipFee?: number;
  priceDifference?: number; // Old - New (positive = downgrade/loss, negative = upgrade)
}

export interface CancellationsResult {
  // True cancellations: Cancel status + no payment in period
  trueCancellations: CancellationEntry[];
  trueCancellationCount: number;

  // Membership changes: Cancel status + has payment (still paying, just changed plan)
  membershipChanges: CancellationEntry[];
  membershipChangeCount: number;

  // Expired memberships
  expiredMemberships: CancellationEntry[];
  expiredCount: number;

  // Revenue calculations
  cancellationRevenueLost: number; // Sum of estimated monthly loss from cancellations
  membershipChangeRevenueLost: number; // Sum of price differences (downgrades only)
  totalRevenueLost: number;

  // Members who appear in Current Members but NOT in All Payments (potential issue)
  unpaidCurrentMembers: string[];

  // Calculation details for transparency
  calculationNotes: string[];
}

interface CancellationsRow {
  "Member ID": string;
  "Member Name": string;
  "Membership ID": string;
  "Membership Type Name": string;
  "Membership Cancellation Date": string;
  "Membership Feedback": string;
  "Cancel Reason": string;
  "Member Billing Comment": string;
}

interface AllPaymentsRow {
  "Member ID": string;
  "Payment Amount": string;
  "Payment Details": string;
}

interface CurrentMembersRow {
  "Member ID": string;
  "Member Name": string;
  "Membership Type Name": string;
  "Membership Fee": string;
}

export async function parseCancellations(
  cancellationsCsv: string,
  allPaymentsCsv: string,
  currentMembersCsv: string
): Promise<CancellationsResult> {
  console.log("=== parseCancellations DEBUG ===");
  const calculationNotes: string[] = [];

  // Step 1: Parse All Payments - build map of Member ID -> total paid
  const paymentsByMemberId = new Map<string, number>();

  await new Promise<void>((resolve) => {
    Papa.parse<AllPaymentsRow>(allPaymentsCsv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        for (const row of results.data) {
          const memberId = row["Member ID"] || "";
          const amount = parseFloat(row["Payment Amount"]?.replace(/[^0-9.-]/g, "") || "0") || 0;
          const details = row["Payment Details"] || "";

          if (details.includes("Payment Refund")) continue;

          if (memberId) {
            const current = paymentsByMemberId.get(memberId) || 0;
            paymentsByMemberId.set(memberId, current + amount);
          }
        }
        resolve();
      },
    });
  });

  // Step 2: Parse Current Members - get member info AND build price lookup
  const currentMemberIds = new Set<string>();
  const currentMemberNames = new Map<string, string>();
  const currentMembershipByMemberId = new Map<string, { type: string; fee: number }>();
  const priceLookup = new Map<string, number[]>(); // type -> array of fees

  await new Promise<void>((resolve) => {
    Papa.parse<CurrentMembersRow>(currentMembersCsv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        for (const row of results.data) {
          const memberId = row["Member ID"] || "";
          const name = row["Member Name"] || "";
          const membershipType = row["Membership Type Name"] || "";
          const fee = parseFloat(row["Membership Fee"]?.replace(/[^0-9.-]/g, "") || "0") || 0;

          if (memberId) {
            currentMemberIds.add(memberId);
            currentMemberNames.set(memberId, name);
            currentMembershipByMemberId.set(memberId, { type: membershipType, fee });

            // Build price lookup
            if (membershipType) {
              const existing = priceLookup.get(membershipType) || [];
              existing.push(fee);
              priceLookup.set(membershipType, existing);
            }
          }
        }
        resolve();
      },
    });
  });

  // Build final price lookup (most common fee for each type)
  const finalPriceLookup = new Map<string, number>();
  for (const [typeName, fees] of priceLookup) {
    const nonZeroFees = fees.filter(f => f > 0);
    if (nonZeroFees.length > 0) {
      // Use the most frequent fee
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
      finalPriceLookup.set(typeName, mostCommonFee);
    }
  }
  console.log("Price lookup entries:", finalPriceLookup.size);

  // Step 3: Parse Cancellations and cross-reference
  const trueCancellations: CancellationEntry[] = [];
  const membershipChanges: CancellationEntry[] = [];
  const expiredMemberships: CancellationEntry[] = [];
  const seenMemberIds = new Set<string>();

  await new Promise<void>((resolve) => {
    Papa.parse<CancellationsRow>(cancellationsCsv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        for (const row of results.data) {
          const memberId = row["Member ID"] || "";
          const name = row["Member Name"] || "";
          const membershipType = row["Membership Type Name"] || "";
          const cancellationDate = row["Membership Cancellation Date"] || "";
          const feedback = row["Membership Feedback"] || "";
          const cancelReason = row["Cancel Reason"] || "";
          const billingComment = row["Member Billing Comment"] || "";

          if (seenMemberIds.has(memberId)) continue;
          seenMemberIds.add(memberId);

          const paymentAmount = paymentsByMemberId.get(memberId) || 0;
          const hadPaymentInPeriod = paymentAmount > 0;

          // Look up the estimated monthly price for the cancelled membership
          let estimatedMonthlyLoss = lookupPrice(finalPriceLookup, membershipType);

          // For membership changes, find their new membership
          let newMembershipType: string | undefined;
          let newMembershipFee: number | undefined;
          let priceDifference: number | undefined;

          if (cancelReason === "Membership Change") {
            const currentMembership = currentMembershipByMemberId.get(memberId);
            if (currentMembership) {
              newMembershipType = currentMembership.type;
              newMembershipFee = currentMembership.fee;
              priceDifference = estimatedMonthlyLoss - newMembershipFee;

              calculationNotes.push(
                `${name}: ${membershipType} ($${estimatedMonthlyLoss}) → ${newMembershipType} ($${newMembershipFee}) = ${priceDifference >= 0 ? '-' : '+'}$${Math.abs(priceDifference)}/mo`
              );
            }
          }

          const entry: CancellationEntry = {
            memberId,
            name,
            membershipType,
            cancellationDate,
            feedback,
            cancelReason,
            billingComment,
            hadPaymentInPeriod,
            paymentAmount,
            estimatedMonthlyLoss,
            newMembershipType,
            newMembershipFee,
            priceDifference,
          };

          if (cancelReason === "Membership Change") {
            membershipChanges.push(entry);
          } else if (cancelReason === "Expired") {
            expiredMemberships.push(entry);
          } else {
            trueCancellations.push(entry);
            if (estimatedMonthlyLoss > 0) {
              calculationNotes.push(
                `${name}: Cancelled ${membershipType} = -$${estimatedMonthlyLoss}/mo`
              );
            }
          }
        }
        resolve();
      },
    });
  });

  // Step 4: Find members in Current Members but NOT in All Payments
  const unpaidCurrentMembers: string[] = [];
  for (const memberId of currentMemberIds) {
    if (!paymentsByMemberId.has(memberId)) {
      const name = currentMemberNames.get(memberId) || memberId;
      unpaidCurrentMembers.push(name);
    }
  }

  // Calculate revenue lost
  const cancellationRevenueLost = trueCancellations
    .reduce((sum, c) => sum + c.estimatedMonthlyLoss, 0);

  // For membership changes, only count downgrades (positive price difference)
  const membershipChangeRevenueLost = membershipChanges
    .filter(c => c.priceDifference && c.priceDifference > 0)
    .reduce((sum, c) => sum + (c.priceDifference || 0), 0);

  const totalRevenueLost = cancellationRevenueLost + membershipChangeRevenueLost;

  console.log("=== CANCELLATIONS RESULTS ===");
  console.log("True Cancellations:", trueCancellations.length);
  console.log("Cancellation Revenue Lost:", cancellationRevenueLost);
  console.log("Membership Changes:", membershipChanges.length);
  console.log("Membership Change Revenue Lost:", membershipChangeRevenueLost);
  console.log("Total Revenue Lost:", totalRevenueLost);

  return {
    trueCancellations,
    trueCancellationCount: trueCancellations.length,
    membershipChanges,
    membershipChangeCount: membershipChanges.length,
    expiredMemberships,
    expiredCount: expiredMemberships.length,
    cancellationRevenueLost,
    membershipChangeRevenueLost,
    totalRevenueLost,
    unpaidCurrentMembers,
    calculationNotes,
  };
}

/**
 * Look up price for a membership type with fuzzy matching
 */
function lookupPrice(priceLookup: Map<string, number>, membershipType: string): number {
  // Try exact match first
  if (priceLookup.has(membershipType)) {
    return priceLookup.get(membershipType)!;
  }

  // Try partial match
  for (const [typeName, price] of priceLookup) {
    if (
      typeName.toLowerCase().includes(membershipType.toLowerCase()) ||
      membershipType.toLowerCase().includes(typeName.toLowerCase())
    ) {
      return price;
    }
  }

  return 0;
}
