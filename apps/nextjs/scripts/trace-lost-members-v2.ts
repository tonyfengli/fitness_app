/**
 * Trace lost members by month - Version 2
 *
 * Option C: Lost = (paid in X-1 OR was in Current Members in X-1),
 *           no payment in X, not in Current Members in X
 * Option D: On Hold = newly on hold (in On Hold X, but NOT in On Hold X-1)
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

interface MemberInfo {
  memberId: string;
  name: string;
  amount: number;
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

async function traceLostMembers() {
  const year = 2026;

  console.log("=".repeat(80));
  console.log("LOST MEMBERS BY MONTH (Version 2)");
  console.log("=".repeat(80));
  console.log("\nLogic:");
  console.log("  Lost = (paid in X-1 OR in Current Members X-1),");
  console.log("         AND no payment in X, AND not in Current Members X");
  console.log("  On Hold = newly on hold (in On Hold X, but NOT in On Hold X-1)\n");

  for (let month = 2; month <= 9; month++) {
    console.log("-".repeat(80));
    console.log(`${MONTHS[month - 1]} ${year}`);
    console.log("-".repeat(80));

    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Fetch current month and previous month
      const currentReports = await fetchKpiReportsAsCsv(year, month);

      // For X-1, we need to fetch separately to get Current Members and On Hold for that month
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth < 1) {
        prevMonth = 12;
        prevYear = year - 1;
      }
      const prevReports = await fetchKpiReportsAsCsv(prevYear, prevMonth);

      // Parse data
      const currentPayments = parsePaymentsNet(currentReports.current.allPaymentsCsv);
      const prevPayments = parsePaymentsNet(prevReports.current.allPaymentsCsv);

      const currentMembers = getCurrentMemberIds(currentReports.current.currentMembersCsv);
      const prevMembers = getCurrentMemberIds(prevReports.current.currentMembersCsv);

      const currentOnHold = getOnHoldIds(currentReports.current.membersOnHoldCsv);
      const prevOnHold = getOnHoldIds(prevReports.current.membersOnHoldCsv);

      const lostGymMembers: MemberInfo[] = [];
      const lostPtClients: MemberInfo[] = [];
      const newlyOnHold: MemberInfo[] = [];

      // Find all members who were active in X-1 (paid OR in Current Members)
      const activeInPrev = new Set<string>();
      const memberNames = new Map<string, string>();

      for (const [memberId, data] of prevPayments) {
        if (data.gym > 0 || data.pt > 0) {
          activeInPrev.add(memberId);
          memberNames.set(memberId, data.name);
        }
      }
      for (const [memberId, name] of prevMembers) {
        activeInPrev.add(memberId);
        if (!memberNames.has(memberId)) {
          memberNames.set(memberId, name);
        }
      }

      // Check each member who was active in X-1
      for (const memberId of activeInPrev) {
        const name = memberNames.get(memberId) || "Unknown";
        const currentPayment = currentPayments.get(memberId);
        const isInCurrentMembers = currentMembers.has(memberId);
        const isOnHoldNow = currentOnHold.has(memberId);
        const wasOnHoldBefore = prevOnHold.has(memberId);

        const currentGymPayment = currentPayment?.gym || 0;
        const currentPtPayment = currentPayment?.pt || 0;
        const prevGymPayment = prevPayments.get(memberId)?.gym || 0;
        const prevPtPayment = prevPayments.get(memberId)?.pt || 0;

        // Check if newly on hold (was not on hold before, is on hold now)
        if (isOnHoldNow && !wasOnHoldBefore) {
          const amount = prevGymPayment || prevPtPayment || 0;
          if (amount > 0) {
            newlyOnHold.push({ memberId, name, amount });
          }
          continue; // Don't count as lost if on hold
        }

        // Skip if still on hold (continuing from before)
        if (isOnHoldNow) continue;

        // Check if lost (no payment in X AND not in Current Members X)
        // ONLY count if they actually paid at some point (X-1 or X-2)
        if (!isInCurrentMembers) {
          const prev2Payments = parsePaymentsNet(prevReports.previous.allPaymentsCsv);
          const prev2GymPayment = prev2Payments.get(memberId)?.gym || 0;
          const prev2PtPayment = prev2Payments.get(memberId)?.pt || 0;

          const everPaidGym = prevGymPayment > 0 || prev2GymPayment > 0;
          const everPaidPt = prevPtPayment > 0 || prev2PtPayment > 0;

          // Lost gym member - must have paid at some point
          if (everPaidGym && currentGymPayment <= 0) {
            const amount = prevGymPayment > 0 ? prevGymPayment : prev2GymPayment;
            lostGymMembers.push({ memberId, name, amount });
          }
          // Lost PT client - must have paid at some point
          else if (everPaidPt && currentPtPayment <= 0) {
            const amount = prevPtPayment > 0 ? prevPtPayment : prev2PtPayment;
            lostPtClients.push({ memberId, name, amount });
          }
          // Skip members who were in Current Members but never paid (trials, comps)
        }
      }

      // Also check: members who paid in CURRENT month X and are on hold in X
      // (These are new members who immediately went on hold)
      for (const [memberId, data] of currentPayments) {
        const isOnHoldNow = currentOnHold.has(memberId);
        const wasOnHoldBefore = prevOnHold.has(memberId);
        const alreadyAdded = newlyOnHold.some(m => m.memberId === memberId);

        if (isOnHoldNow && !wasOnHoldBefore && !alreadyAdded) {
          const amount = data.gym > 0 ? data.gym : data.pt;
          if (amount > 0) {
            newlyOnHold.push({ memberId, name: data.name, amount });
          }
        }
      }

      // Sort by amount
      lostGymMembers.sort((a, b) => b.amount - a.amount);
      lostPtClients.sort((a, b) => b.amount - a.amount);
      newlyOnHold.sort((a, b) => b.amount - a.amount);

      const gymRevenueLost = lostGymMembers.reduce((sum, m) => sum + m.amount, 0);
      const ptRevenueLost = lostPtClients.reduce((sum, m) => sum + m.amount, 0);
      const holdRevenue = newlyOnHold.reduce((sum, m) => sum + m.amount, 0);

      // Output
      console.log(`\nLOST GROUP MEMBERS (${lostGymMembers.length}):`);
      if (lostGymMembers.length === 0) {
        console.log("  (none)");
      } else {
        for (const m of lostGymMembers) {
          console.log(`  - ${m.name}: $${m.amount.toFixed(2)}`);
        }
        console.log(`  REVENUE LOST: $${gymRevenueLost.toFixed(2)}/mo`);
      }

      console.log(`\nLOST PT CLIENTS (${lostPtClients.length}):`);
      if (lostPtClients.length === 0) {
        console.log("  (none)");
      } else {
        for (const m of lostPtClients) {
          console.log(`  - ${m.name}: $${m.amount.toFixed(2)}`);
        }
        console.log(`  REVENUE LOST: $${ptRevenueLost.toFixed(2)}/mo`);
      }

      console.log(`\nNEWLY ON HOLD (${newlyOnHold.length}):`);
      if (newlyOnHold.length === 0) {
        console.log("  (none)");
      } else {
        for (const m of newlyOnHold) {
          console.log(`  - ${m.name}: $${m.amount.toFixed(2)}`);
        }
        console.log(`  REVENUE ON HOLD: $${holdRevenue.toFixed(2)}/mo`);
      }

      console.log(`\n** TOTAL LOST: ${lostGymMembers.length + lostPtClients.length} **`);
      console.log(`** NEWLY ON HOLD: ${newlyOnHold.length} **`);
      console.log("");

    } catch (error) {
      console.error(`  Error: ${error}`);
    }
  }

  console.log("=".repeat(80));
  console.log("END OF REPORT");
  console.log("=".repeat(80));
}

traceLostMembers().catch(console.error);
