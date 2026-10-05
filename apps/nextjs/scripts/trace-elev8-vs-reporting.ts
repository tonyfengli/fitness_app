/**
 * Compare "For Elev8 HQ" count vs Reporting tab count
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

async function compareCountMethods() {
  console.log("=".repeat(80));
  console.log("COMPARING COUNT METHODS FOR AUGUST 2026");
  console.log("=".repeat(80));

  const data = await fetchKpiReportsAsCsv(2026, 8);
  const paymentRows = parseCsv(data.current.allPaymentsCsv);

  // Method 1: "For Elev8 HQ" style - count all unique member IDs (regardless of net)
  const allMemberIds = new Set<string>();
  const memberTotals = new Map<string, { name: string; total: number }>();

  for (const row of paymentRows) {
    const memberId = row["Member ID"] || "";
    const name = row["Name"] || "";
    const amount = parseFloat((row["Payment Amount"] || "0").replace(/[$,]/g, "")) || 0;

    if (memberId) {
      allMemberIds.add(memberId);
      if (!memberTotals.has(memberId)) {
        memberTotals.set(memberId, { name, total: 0 });
      }
      memberTotals.get(memberId)!.total += amount;
    }
  }

  // Method 2: Reporting tab style - count members with positive NET payment
  let positiveNetCount = 0;
  const positiveNetMembers: string[] = [];
  const zeroOrNegativeMembers: string[] = [];

  for (const [memberId, data] of memberTotals) {
    if (data.total > 0) {
      positiveNetCount++;
      positiveNetMembers.push(`${data.name} (${memberId}): $${data.total.toFixed(2)}`);
    } else {
      zeroOrNegativeMembers.push(`${data.name} (${memberId}): $${data.total.toFixed(2)}`);
    }
  }

  console.log("\n--- COMPARISON ---");
  console.log(`Method 1 (All unique member IDs): ${allMemberIds.size}`);
  console.log(`Method 2 (Positive NET only): ${positiveNetCount}`);
  console.log(`Difference: ${allMemberIds.size - positiveNetCount}`);

  console.log("\n--- MEMBERS WITH $0 OR NEGATIVE NET (excluded in Method 2) ---");
  for (const m of zeroOrNegativeMembers) {
    console.log(`  ${m}`);
  }

  console.log("\n--- WHICH IS CORRECT? ---");
  console.log("For Elev8 HQ shows: unique member IDs who appear in payments");
  console.log("Reporting tab shows: members with positive NET payment");
  console.log("\nRecommendation: Both should use positive NET to exclude refunded members.");
}

compareCountMethods().catch(console.error);
