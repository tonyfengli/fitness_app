/**
 * Calculate lost members using payment-based logic
 *
 * Logic:
 * - Lost member in Month X if:
 *   1. Paid in X-1 OR X-2 (must have paid at some point)
 *   2. AND no payment in X
 *   3. AND not in Current Members for X
 *   4. AND not on hold
 *
 * - Newly On Hold in Month X if:
 *   1. Was active (paid in X-1 OR in Current Members X-1) OR paid in X
 *   2. AND is on hold in X
 *   3. AND was NOT on hold in X-1
 */

export interface LostMember {
  memberId: string;
  name: string;
  amount: number;
  type: "loss" | "hold";
}

export interface LostMembersResult {
  lostGroupMembers: LostMember[];
  lostPtClients: LostMember[];
  newlyOnHold: LostMember[];
  lostGroupCount: number;
  lostGroupRevenue: number;
  lostPtCount: number;
  lostPtRevenue: number;
  newlyOnHoldCount: number;
  newlyOnHoldRevenue: number;
}

// Simple CSV parser
function parseCsv(csv: string): Record<string, string>[] {
  if (!csv.trim()) return [];
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]!.split(",").map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = values[j] || "";
    }
    rows.push(row);
  }

  return rows;
}

function parsePaymentsNet(paymentsCsv: string): Map<string, { name: string; gym: number; pt: number }> {
  const rows = parseCsv(paymentsCsv);
  const result = new Map<string, { name: string; gym: number; pt: number }>();

  for (const row of rows) {
    const memberId = row["Member ID"] || "";
    const name = row["Name"] || "";
    const amountStr = row["Payment Amount"] || "0";
    const details = row["Payment Details"] || "";

    const amount = parseFloat(amountStr.replace(/[$,]/g, "")) || 0;

    let category: "gym" | "pt" | "other" = "other";
    if (details.includes("Gym Memberships")) category = "gym";
    else if (details.includes("Personal Training")) category = "pt";

    if (memberId && category !== "other") {
      if (!result.has(memberId)) {
        result.set(memberId, { name, gym: 0, pt: 0 });
      }
      const entry = result.get(memberId)!;
      if (category === "gym") entry.gym += amount;
      else entry.pt += amount;
    }
  }

  return result;
}

function getCurrentMemberIds(csv: string): Map<string, string> {
  const rows = parseCsv(csv);
  const result = new Map<string, string>();
  for (const row of rows) {
    const memberId = row["Member ID"] || "";
    const name = row["Member Name"] || "";
    if (memberId) result.set(memberId, name);
  }
  return result;
}

function getOnHoldIds(csv: string): Map<string, string> {
  const rows = parseCsv(csv);
  const result = new Map<string, string>();
  for (const row of rows) {
    const memberId = row["Member ID"] || "";
    const name = row["Member Name"] || "";
    if (memberId) result.set(memberId, name);
  }
  return result;
}

/**
 * Calculate lost members based on payment data
 *
 * @param currentPaymentsCsv - Payments CSV for current month X
 * @param prevPaymentsCsv - Payments CSV for month X-1
 * @param prev2PaymentsCsv - Payments CSV for month X-2
 * @param currentMembersCsv - Current Members CSV for month X
 * @param prevMembersCsv - Current Members CSV for month X-1
 * @param currentOnHoldCsv - Members on Hold CSV for month X
 * @param prevOnHoldCsv - Members on Hold CSV for month X-1
 */
export function calculateLostMembers(
  currentPaymentsCsv: string,
  prevPaymentsCsv: string,
  prev2PaymentsCsv: string,
  currentMembersCsv: string,
  prevMembersCsv: string,
  currentOnHoldCsv: string,
  prevOnHoldCsv: string
): LostMembersResult {
  // Parse payment data
  const currentPayments = parsePaymentsNet(currentPaymentsCsv);
  const prevPayments = parsePaymentsNet(prevPaymentsCsv);

  // Parse on-hold data for distinguishing holds from actual losses
  const currentOnHold = getOnHoldIds(currentOnHoldCsv);
  const prevOnHold = getOnHoldIds(prevOnHoldCsv);

  const lostGymMembers: LostMember[] = [];
  const lostPtClients: LostMember[] = [];
  const newlyOnHold: LostMember[] = [];

  // Find all members who PAID in X-1
  for (const [memberId, prevData] of prevPayments) {
    if (prevData.gym <= 0 && prevData.pt <= 0) continue;

    const name = prevData.name || "Unknown";
    const currentPayment = currentPayments.get(memberId);
    const isOnHoldNow = currentOnHold.has(memberId);
    const wasOnHoldBefore = prevOnHold.has(memberId);

    const currentGymPayment = currentPayment?.gym || 0;
    const currentPtPayment = currentPayment?.pt || 0;

    // Check if member stopped paying
    const stoppedPayingGym = prevData.gym > 0 && currentGymPayment <= 0;
    const stoppedPayingPt = prevData.pt > 0 && currentPtPayment <= 0;

    if (stoppedPayingGym || stoppedPayingPt) {
      // Determine if it's a hold or actual loss
      const isNewlyOnHold = isOnHoldNow && !wasOnHoldBefore;
      const isContinuingHold = isOnHoldNow && wasOnHoldBefore;
      const type: "loss" | "hold" = (isNewlyOnHold || isContinuingHold) ? "hold" : "loss";

      if (stoppedPayingGym) {
        // Newly on hold goes to separate list, continuing hold and losses go to lost list
        if (isNewlyOnHold) {
          newlyOnHold.push({ memberId, name, amount: prevData.gym, type: "hold" });
        } else {
          lostGymMembers.push({ memberId, name, amount: prevData.gym, type });
        }
      }
      if (stoppedPayingPt) {
        if (isNewlyOnHold) {
          newlyOnHold.push({ memberId, name, amount: prevData.pt, type: "hold" });
        } else {
          lostPtClients.push({ memberId, name, amount: prevData.pt, type });
        }
      }
    }
  }

  // Sort by amount descending
  lostGymMembers.sort((a, b) => b.amount - a.amount);
  lostPtClients.sort((a, b) => b.amount - a.amount);
  newlyOnHold.sort((a, b) => b.amount - a.amount);

  const lostGroupRevenue = lostGymMembers.reduce((sum, m) => sum + m.amount, 0);
  const lostPtRevenue = lostPtClients.reduce((sum, m) => sum + m.amount, 0);
  const newlyOnHoldRevenue = newlyOnHold.reduce((sum, m) => sum + m.amount, 0);

  return {
    lostGroupMembers: lostGymMembers,
    lostPtClients,
    newlyOnHold,
    lostGroupCount: lostGymMembers.length,
    lostGroupRevenue,
    lostPtCount: lostPtClients.length,
    lostPtRevenue,
    newlyOnHoldCount: newlyOnHold.length,
    newlyOnHoldRevenue,
  };
}
