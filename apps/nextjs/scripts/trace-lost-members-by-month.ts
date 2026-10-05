/**
 * Trace lost members by month using current cancellation logic
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, "../.env.local") });

import { fetchKpiReportsAsCsv } from "../src/app/kpi/lib/gymmaster-api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

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

interface CancellationEntry {
  memberId: string;
  name: string;
  membershipType: string;
  cancelReason: string;
  estimatedMonthlyLoss: number;
  newMembershipType?: string;
  priceDifference?: number;
}

async function analyzeCancellations(
  cancellationsCsv: string,
  allPaymentsCsv: string,
  currentMembersCsv: string
) {
  // Parse CSVs
  const cancellations = parseCsv(cancellationsCsv);
  const payments = parseCsv(allPaymentsCsv);
  const currentMembers = parseCsv(currentMembersCsv);

  // Build current member ID set and membership lookup
  const currentMemberIds = new Set<string>();
  const currentMembershipByMemberId = new Map<string, { type: string; fee: number }>();
  const priceLookup = new Map<string, number[]>();

  for (const row of currentMembers) {
    const memberId = row["Member ID"] || "";
    const membershipType = row["Membership Type Name"] || "";
    const fee = parseFloat(row["Membership Fee"]?.replace(/[^0-9.-]/g, "") || "0") || 0;

    if (memberId) {
      currentMemberIds.add(memberId);
      currentMembershipByMemberId.set(memberId, { type: membershipType, fee });

      if (membershipType) {
        const existing = priceLookup.get(membershipType) || [];
        existing.push(fee);
        priceLookup.set(membershipType, existing);
      }
    }
  }

  // Build final price lookup (most common fee)
  const finalPriceLookup = new Map<string, number>();
  for (const [typeName, fees] of priceLookup) {
    const nonZeroFees = fees.filter(f => f > 0);
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
      finalPriceLookup.set(typeName, mostCommonFee);
    }
  }

  // Lookup price with fuzzy matching
  function lookupPrice(membershipType: string): number {
    if (finalPriceLookup.has(membershipType)) {
      return finalPriceLookup.get(membershipType)!;
    }
    for (const [typeName, price] of finalPriceLookup) {
      if (typeName.toLowerCase().includes(membershipType.toLowerCase()) ||
          membershipType.toLowerCase().includes(typeName.toLowerCase())) {
        return price;
      }
    }
    return 0;
  }

  // Process cancellations
  const trueCancellations: CancellationEntry[] = [];
  const membershipChanges: CancellationEntry[] = [];
  const seenMemberIds = new Set<string>();

  for (const row of cancellations) {
    const memberId = row["Member ID"] || "";
    const name = row["Member Name"] || "";
    const membershipType = row["Membership Type Name"] || "";
    const cancelReason = row["Cancel Reason"] || "";

    if (seenMemberIds.has(memberId)) continue;
    seenMemberIds.add(memberId);

    const estimatedMonthlyLoss = lookupPrice(membershipType);

    const entry: CancellationEntry = {
      memberId,
      name,
      membershipType,
      cancelReason,
      estimatedMonthlyLoss,
    };

    if (cancelReason === "Membership Change") {
      const currentMembership = currentMembershipByMemberId.get(memberId);
      if (currentMembership) {
        entry.newMembershipType = currentMembership.type;
        entry.priceDifference = estimatedMonthlyLoss - currentMembership.fee;
      }
      membershipChanges.push(entry);
    } else if (cancelReason === "Cancelled" || cancelReason === "Expired") {
      // Only count as lost if NOT in current members
      if (!currentMemberIds.has(memberId)) {
        trueCancellations.push(entry);
      }
    }
  }

  const cancellationRevenueLost = trueCancellations.reduce((sum, c) => sum + c.estimatedMonthlyLoss, 0);
  const membershipChangeRevenueLost = membershipChanges
    .filter(c => c.priceDifference && c.priceDifference > 0)
    .reduce((sum, c) => sum + (c.priceDifference || 0), 0);

  return {
    trueCancellations,
    membershipChanges,
    lostMemberCount: trueCancellations.length,
    cancellationRevenueLost,
    membershipChangeRevenueLost,
    totalRevenueLost: cancellationRevenueLost + membershipChangeRevenueLost,
  };
}

async function traceLostMembersByMonth() {
  const year = 2026;

  console.log("=".repeat(80));
  console.log("LOST MEMBERS BY MONTH (Current Cancellation Logic)");
  console.log("=".repeat(80));
  console.log("\nLogic: Lost = (Cancelled or Expired) AND not in Current Members\n");

  for (let month = 2; month <= 9; month++) {
    console.log("-".repeat(80));
    console.log(`${MONTHS[month - 1]} ${year}`);
    console.log("-".repeat(80));

    try {
      const reports = await fetchKpiReportsAsCsv(year, month);

      const result = await analyzeCancellations(
        reports.current.cancellationsCsv,
        reports.current.allPaymentsCsv,
        reports.current.currentMembersCsv
      );

      // True Cancellations (Lost)
      console.log(`\nLOST MEMBERS - CANCELLED (${result.trueCancellations.length}):`);
      if (result.trueCancellations.length === 0) {
        console.log("  (none)");
      } else {
        for (const c of result.trueCancellations) {
          console.log(`  - ${c.name}: $${c.estimatedMonthlyLoss.toFixed(2)}/mo (${c.membershipType})`);
        }
        console.log(`  REVENUE LOST: $${result.cancellationRevenueLost.toFixed(2)}/mo`);
      }

      // Membership Changes (not lost)
      console.log(`\nMEMBERSHIP CHANGES (${result.membershipChanges.length}) - NOT LOST:`);
      if (result.membershipChanges.length === 0) {
        console.log("  (none)");
      } else {
        for (const c of result.membershipChanges) {
          const diff = c.priceDifference || 0;
          const diffStr = diff > 0 ? `-$${diff.toFixed(2)}` : diff < 0 ? `+$${Math.abs(diff).toFixed(2)}` : "$0";
          console.log(`  - ${c.name}: ${c.membershipType} → ${c.newMembershipType || "?"} (${diffStr}/mo)`);
        }
        console.log(`  REVENUE CHANGE: -$${result.membershipChangeRevenueLost.toFixed(2)}/mo`);
      }

      // Summary
      console.log(`\n** LOST MEMBER COUNT: ${result.lostMemberCount} **`);
      console.log(`** TOTAL REVENUE LOST: $${result.totalRevenueLost.toFixed(2)}/mo **`);
      console.log("");
    } catch (error) {
      console.error(`  Error: ${error}`);
    }
  }

  console.log("=".repeat(80));
  console.log("END OF REPORT");
  console.log("=".repeat(80));
}

traceLostMembersByMonth().catch(console.error);
