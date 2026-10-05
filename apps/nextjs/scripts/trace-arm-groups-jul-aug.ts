/**
 * Trace ARM for Groups: July vs August
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../.env.local") });

import { fetchKpiReportsAsCsv } from "../src/app/kpi/lib/gymmaster-api";

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
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else current += char;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]!] = values[j] || "";
    rows.push(row);
  }
  return rows;
}

async function traceArmGroups() {
  console.log("=".repeat(80));
  console.log("ARM FOR GROUPS: JULY vs AUGUST 2026");
  console.log("=".repeat(80));

  for (const month of [7, 8]) {
    const monthName = month === 7 ? "July" : "August";
    console.log(`\n${"=".repeat(40)}`);
    console.log(`${monthName} 2026`);
    console.log("=".repeat(40));

    if (month === 8) await new Promise(r => setTimeout(r, 1500));

    const data = await fetchKpiReportsAsCsv(2026, month);
    const paymentRows = parseCsv(data.current.allPaymentsCsv);

    // Track by member
    const memberData = new Map<string, {
      name: string;
      gymTotal: number;
      smallGroupTotal: number;
      ptTotal: number;
      otherTotal: number;
      total: number;
    }>();

    for (const row of paymentRows) {
      const memberId = row["Member ID"] || "";
      const name = row["Name"] || "";
      const amount = parseFloat((row["Payment Amount"] || "0").replace(/[$,]/g, "")) || 0;
      const details = row["Payment Details"] || "";

      if (!memberId) continue;

      if (!memberData.has(memberId)) {
        memberData.set(memberId, { name, gymTotal: 0, smallGroupTotal: 0, ptTotal: 0, otherTotal: 0, total: 0 });
      }
      const m = memberData.get(memberId)!;
      m.total += amount;

      if (details.includes("Gym Memberships")) {
        m.gymTotal += amount;
      } else if (details.includes("Small Group")) {
        m.smallGroupTotal += amount;
      } else if (details.includes("Personal Training")) {
        m.ptTotal += amount;
      } else {
        m.otherTotal += amount;
      }
    }

    // Calculate group members and revenue
    let groupRevenue = 0;
    let groupMemberCount = 0;
    const groupMembers: { name: string; id: string; gym: number; sg: number; groupTotal: number }[] = [];

    for (const [memberId, m] of memberData) {
      const groupTotal = m.gymTotal + m.smallGroupTotal;
      if (groupTotal > 0) {
        groupMemberCount++;
        groupRevenue += groupTotal;
        groupMembers.push({ name: m.name, id: memberId, gym: m.gymTotal, sg: m.smallGroupTotal, groupTotal });
      }
    }

    // Sort by group total descending
    groupMembers.sort((a, b) => b.groupTotal - a.groupTotal);

    const armGroups = groupMemberCount > 0 ? groupRevenue / groupMemberCount : 0;

    console.log(`\nGroup Revenue: $${groupRevenue.toFixed(2)}`);
    console.log(`Group Members: ${groupMemberCount}`);
    console.log(`ARM (Groups): $${armGroups.toFixed(2)}`);

    console.log(`\n--- GROUP MEMBERS (${groupMemberCount}) ---`);
    for (const m of groupMembers) {
      console.log(`  ${m.name}: $${m.groupTotal.toFixed(2)} (Gym: $${m.gym.toFixed(2)}, SmallGroup: $${m.sg.toFixed(2)})`);
    }
  }
}

traceArmGroups().catch(console.error);
