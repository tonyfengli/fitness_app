/**
 * Verify all group members are counted in August
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

async function verifyGroupMembers() {
  console.log("=".repeat(80));
  console.log("VERIFYING ALL GROUP MEMBERS ARE COUNTED - AUGUST 2026");
  console.log("=".repeat(80));

  const data = await fetchKpiReportsAsCsv(2026, 8);
  const paymentRows = parseCsv(data.current.allPaymentsCsv);

  // All gym/small group payments
  console.log("\n--- ALL GYM/SMALL GROUP PAYMENTS ---");
  const groupPayments: { memberId: string; name: string; amount: number; details: string }[] = [];

  for (const row of paymentRows) {
    const memberId = row["Member ID"] || "";
    const name = row["Name"] || "";
    const amount = parseFloat((row["Payment Amount"] || "0").replace(/[$,]/g, "")) || 0;
    const details = row["Payment Details"] || "";

    if (details.includes("Gym Memberships") || details.includes("Small Group")) {
      groupPayments.push({ memberId, name, amount, details: details.substring(0, 50) });
    }
  }

  // Show all individual payments
  console.log(`\nTotal group payments: ${groupPayments.length}`);
  for (const p of groupPayments) {
    console.log(`  ${p.name} (${p.memberId}): $${p.amount.toFixed(2)} - ${p.details}`);
  }

  // Aggregate by member
  console.log("\n--- AGGREGATED BY MEMBER ---");
  const memberTotals = new Map<string, { name: string; total: number; payments: number[] }>();

  for (const p of groupPayments) {
    if (!memberTotals.has(p.memberId)) {
      memberTotals.set(p.memberId, { name: p.name, total: 0, payments: [] });
    }
    const m = memberTotals.get(p.memberId)!;
    m.total += p.amount;
    m.payments.push(p.amount);
  }

  // Count members with positive net
  let positiveCount = 0;
  let zeroOrNegCount = 0;

  const sorted = [...memberTotals.entries()].sort((a, b) => b[1].total - a[1].total);

  console.log("\nMembers with POSITIVE net (counted):");
  for (const [id, m] of sorted) {
    if (m.total > 0) {
      positiveCount++;
      console.log(`  ✓ ${m.name} (${id}): $${m.total.toFixed(2)} [${m.payments.map(p => `$${p}`).join(" + ")}]`);
    }
  }

  console.log("\nMembers with ZERO or NEGATIVE net (NOT counted):");
  for (const [id, m] of sorted) {
    if (m.total <= 0) {
      zeroOrNegCount++;
      console.log(`  ✗ ${m.name} (${id}): $${m.total.toFixed(2)} [${m.payments.map(p => `$${p}`).join(" + ")}]`);
    }
  }

  console.log("\n--- SUMMARY ---");
  console.log(`Group members counted (positive net): ${positiveCount}`);
  console.log(`Group members excluded (zero/negative net): ${zeroOrNegCount}`);
  console.log(`Total unique members with group payments: ${memberTotals.size}`);
}

verifyGroupMembers().catch(console.error);
