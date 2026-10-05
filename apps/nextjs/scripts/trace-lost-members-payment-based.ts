/**
 * Trace lost members by month using payment-based logic
 *
 * Logic: Lost member in Month X if:
 * 1. Had net positive payment in Month X-1
 * 2. AND no net positive payment in Month X
 * 3. AND not on hold in Month X
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

interface LostMember {
  memberId: string;
  name: string;
  lastPayment: number;
  category: "gym" | "pt";
  lastMonth?: string;
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

function getMembersOnHold(holdCsv: string): Set<string> {
  const rows = parseCsv(holdCsv);
  const onHold = new Set<string>();
  for (const row of rows) {
    const memberId = row["Member ID"] || "";
    if (memberId) onHold.add(memberId);
  }
  return onHold;
}

async function traceLostMembersByMonth() {
  const year = 2026;

  console.log("=".repeat(80));
  console.log("LOST MEMBERS BY MONTH (Payment-Based Logic)");
  console.log("=".repeat(80));
  console.log("\nLogic: Lost member if:");
  console.log("  1. Paid in X-1 OR X-2, but NO payment in X");
  console.log("  2. AND not in Current Members for month X");
  console.log("  3. On Hold = same as above but appears in Members on Hold report\n");

  for (let month = 2; month <= 9; month++) {
    console.log("-".repeat(80));
    console.log(`${MONTHS[month - 1]} ${year}`);
    console.log("-".repeat(80));

    try {
      const reports = await fetchKpiReportsAsCsv(year, month);

      // Parse payments for current, previous, and X-2 months
      const currentPayments = parsePaymentsNet(reports.current.allPaymentsCsv);
      const prevPayments = parsePaymentsNet(reports.previous.allPaymentsCsv);
      const prev2Payments = parsePaymentsNet(reports.previous2.allPaymentsCsv);
      const membersOnHold = getMembersOnHold(reports.current.membersOnHoldCsv);

      const lostGymMembers: LostMember[] = [];
      const lostPtClients: LostMember[] = [];
      const onHoldGymMembers: LostMember[] = [];
      const onHoldPtClients: LostMember[] = [];

      // Build current member IDs set
      const currentMemberRows = parseCsv(reports.current.currentMembersCsv);
      const currentMemberIds = new Set<string>();
      for (const row of currentMemberRows) {
        const memberId = row["Member ID"] || "";
        if (memberId) currentMemberIds.add(memberId);
      }

      // Combine X-1 and X-2 payments to find anyone who paid recently
      const recentPayments = new Map<string, { name: string; gym: number; pt: number; lastMonth: string }>();

      for (const [memberId, data] of prev2Payments) {
        recentPayments.set(memberId, { ...data, lastMonth: MONTHS[month - 3] || "earlier" });
      }
      for (const [memberId, data] of prevPayments) {
        // X-1 overwrites X-2 if both exist (more recent)
        if (data.gym > 0 || data.pt > 0) {
          recentPayments.set(memberId, { ...data, lastMonth: MONTHS[month - 2] || "earlier" });
        }
      }

      // Find members who paid in X-1 or X-2 but not in X
      for (const [memberId, prevData] of recentPayments) {
        const currentData = currentPayments.get(memberId);
        const isOnHold = membersOnHold.has(memberId);
        const stillInCurrentMembers = currentMemberIds.has(memberId);

        // Check gym membership
        if (prevData.gym > 0) {
          const currentGym = currentData?.gym || 0;
          if (currentGym <= 0) {
            // Only count as lost if NOT in current members
            if (stillInCurrentMembers && !isOnHold) {
              // Skip - still a member, just billing gap
              continue;
            }
            const entry = {
              memberId,
              name: prevData.name,
              lastPayment: prevData.gym,
              category: "gym" as const,
              lastMonth: prevData.lastMonth,
            };
            if (isOnHold) {
              onHoldGymMembers.push(entry);
            } else {
              lostGymMembers.push(entry);
            }
          }
        }

        // Check PT
        if (prevData.pt > 0) {
          const currentPt = currentData?.pt || 0;
          if (currentPt <= 0) {
            // Only count as lost if NOT in current members
            if (stillInCurrentMembers && !isOnHold) {
              // Skip - still a member, just billing gap
              continue;
            }
            const entry = {
              memberId,
              name: prevData.name,
              lastPayment: prevData.pt,
              category: "pt" as const,
              lastMonth: prevData.lastMonth,
            };
            if (isOnHold) {
              onHoldPtClients.push(entry);
            } else {
              lostPtClients.push(entry);
            }
          }
        }
      }

      // Sort by last payment descending
      lostGymMembers.sort((a, b) => b.lastPayment - a.lastPayment);
      lostPtClients.sort((a, b) => b.lastPayment - a.lastPayment);
      onHoldGymMembers.sort((a, b) => b.lastPayment - a.lastPayment);
      onHoldPtClients.sort((a, b) => b.lastPayment - a.lastPayment);

      const gymRevenueLost = lostGymMembers.reduce((sum, m) => sum + m.lastPayment, 0);
      const ptRevenueLost = lostPtClients.reduce((sum, m) => sum + m.lastPayment, 0);
      const gymRevenueOnHold = onHoldGymMembers.reduce((sum, m) => sum + m.lastPayment, 0);
      const ptRevenueOnHold = onHoldPtClients.reduce((sum, m) => sum + m.lastPayment, 0);

      // Lost Group Members
      console.log(`\nLOST GROUP MEMBERS (${lostGymMembers.length}):`);
      if (lostGymMembers.length === 0) {
        console.log("  (none)");
      } else {
        for (const m of lostGymMembers) {
          console.log(`  - ${m.name}: $${m.lastPayment.toFixed(2)} (last payment in ${m.lastMonth})`);
        }
        console.log(`  REVENUE LOST: $${gymRevenueLost.toFixed(2)}/mo`);
      }

      // Lost PT Clients
      console.log(`\nLOST PT CLIENTS (${lostPtClients.length}):`);
      if (lostPtClients.length === 0) {
        console.log("  (none)");
      } else {
        for (const m of lostPtClients) {
          console.log(`  - ${m.name}: $${m.lastPayment.toFixed(2)} (last payment in ${m.lastMonth})`);
        }
        console.log(`  REVENUE LOST: $${ptRevenueLost.toFixed(2)}/mo`);
      }

      // On Hold Group Members
      console.log(`\nON HOLD - GROUP MEMBERS (${onHoldGymMembers.length}):`);
      if (onHoldGymMembers.length === 0) {
        console.log("  (none)");
      } else {
        for (const m of onHoldGymMembers) {
          console.log(`  - ${m.name}: $${m.lastPayment.toFixed(2)} (last payment in ${m.lastMonth})`);
        }
        console.log(`  REVENUE ON HOLD: $${gymRevenueOnHold.toFixed(2)}/mo`);
      }

      // On Hold PT Clients
      console.log(`\nON HOLD - PT CLIENTS (${onHoldPtClients.length}):`);
      if (onHoldPtClients.length === 0) {
        console.log("  (none)");
      } else {
        for (const m of onHoldPtClients) {
          console.log(`  - ${m.name}: $${m.lastPayment.toFixed(2)} (last payment in ${m.lastMonth})`);
        }
        console.log(`  REVENUE ON HOLD: $${ptRevenueOnHold.toFixed(2)}/mo`);
      }

      console.log(`\n** TOTAL LOST: ${lostGymMembers.length + lostPtClients.length} members, $${(gymRevenueLost + ptRevenueLost).toFixed(2)}/mo **`);
      console.log(`** TOTAL ON HOLD: ${onHoldGymMembers.length + onHoldPtClients.length} members, $${(gymRevenueOnHold + ptRevenueOnHold).toFixed(2)}/mo **`);
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
