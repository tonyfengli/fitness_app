/**
 * Calculate new members using payment-based logic
 *
 * Logic:
 * - New member in Month X if:
 *   1. Net positive payment in Month X
 *   2. AND no payment in Month X-1
 *   3. AND no payment in Month X-2
 *
 * Categories:
 * - "Gym Memberships" -> New Group Members
 * - "Personal Training Packages" -> New PT Clients
 */

export interface PaymentRecord {
  memberId: string;
  name: string;
  amount: number;
  date: string;
  category: "gym" | "pt" | "other";
}

export interface NewMember {
  memberId: string;
  name: string;
  amount: number;
  isReactivation: boolean;
}

export interface NewMembersResult {
  newGroupMembers: NewMember[];
  newPtClients: NewMember[];
  groupMemberCount: number;
  groupMemberRevenue: number;
  ptClientCount: number;
  ptClientRevenue: number;
}

/**
 * Parse payment category from Payment Details field
 */
function parseCategory(details: string): "gym" | "pt" | "other" {
  if (details.includes("Gym Memberships")) return "gym";
  if (details.includes("Personal Training")) return "pt";
  return "other";
}

/**
 * Parse payments from CSV into structured records
 */
export function parsePayments(paymentsCsv: string): PaymentRecord[] {
  if (!paymentsCsv.trim()) return [];

  const lines = paymentsCsv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]!.split(",").map((h) => h.trim());
  const memberIdIdx = headers.findIndex((h) => h === "Member ID");
  const nameIdx = headers.findIndex((h) => h === "Name");
  const amountIdx = headers.findIndex((h) => h === "Payment Amount");
  const dateIdx = headers.findIndex((h) => h === "Payment Date");
  const detailsIdx = headers.findIndex((h) => h === "Payment Details");

  if (memberIdIdx === -1 || amountIdx === -1) return [];

  const records: PaymentRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    // Handle CSV with quoted fields
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

    const memberId = values[memberIdIdx] || "";
    const name = values[nameIdx] || "";
    const amountStr = values[amountIdx] || "0";
    const date = values[dateIdx] || "";
    const details = values[detailsIdx] || "";

    // Parse amount (remove $, commas, handle negatives)
    const amount = parseFloat(amountStr.replace(/[$,]/g, "")) || 0;
    const category = parseCategory(details);

    if (memberId && category !== "other") {
      records.push({ memberId, name, amount, date, category });
    }
  }

  return records;
}

/**
 * Calculate net payments per member for a given category
 */
function calculateNetPayments(
  payments: PaymentRecord[],
  category: "gym" | "pt"
): Map<string, { name: string; netPayment: number }> {
  const result = new Map<string, { name: string; netPayment: number }>();

  for (const p of payments) {
    if (p.category !== category) continue;

    if (!result.has(p.memberId)) {
      result.set(p.memberId, { name: p.name, netPayment: 0 });
    }
    result.get(p.memberId)!.netPayment += p.amount;
  }

  return result;
}

/**
 * Calculate new members based on payment data from 3 months
 *
 * @param currentMonthPayments - Payments CSV for the target month
 * @param prevMonthPayments - Payments CSV for month X-1
 * @param prev2MonthPayments - Payments CSV for month X-2
 * @param olderPayments - Optional: payments from earlier months (for reactivation detection)
 */
export function calculateNewMembers(
  currentMonthPayments: string,
  prevMonthPayments: string,
  prev2MonthPayments: string,
  olderPayments?: string
): NewMembersResult {
  // Parse all payment data
  const currentRecords = parsePayments(currentMonthPayments);
  const prevRecords = parsePayments(prevMonthPayments);
  const prev2Records = parsePayments(prev2MonthPayments);
  const olderRecords = olderPayments ? parsePayments(olderPayments) : [];

  // Calculate for both categories
  const result: NewMembersResult = {
    newGroupMembers: [],
    newPtClients: [],
    groupMemberCount: 0,
    groupMemberRevenue: 0,
    ptClientCount: 0,
    ptClientRevenue: 0,
  };

  for (const category of ["gym", "pt"] as const) {
    const currentNet = calculateNetPayments(currentRecords, category);
    const prevNet = calculateNetPayments(prevRecords, category);
    const prev2Net = calculateNetPayments(prev2Records, category);
    const olderNet = calculateNetPayments(olderRecords, category);

    const newMembers: NewMember[] = [];

    currentNet.forEach((data, memberId) => {
      // Must have positive payment in current month
      if (data.netPayment <= 0) return;

      // Must NOT have payment in X-1 or X-2
      const prevPayment = prevNet.get(memberId)?.netPayment || 0;
      const prev2Payment = prev2Net.get(memberId)?.netPayment || 0;

      if (prevPayment <= 0 && prev2Payment <= 0) {
        // Check if reactivation (had payments before X-2)
        const olderPayment = olderNet.get(memberId)?.netPayment || 0;
        const isReactivation = olderPayment > 0;

        newMembers.push({
          memberId,
          name: data.name,
          amount: data.netPayment,
          isReactivation,
        });
      }
    });

    // Sort by amount descending
    newMembers.sort((a, b) => b.amount - a.amount);

    if (category === "gym") {
      result.newGroupMembers = newMembers;
      result.groupMemberCount = newMembers.length;
      result.groupMemberRevenue = newMembers.reduce((sum, m) => sum + m.amount, 0);
    } else {
      result.newPtClients = newMembers;
      result.ptClientCount = newMembers.length;
      result.ptClientRevenue = newMembers.reduce((sum, m) => sum + m.amount, 0);
    }
  }

  return result;
}
