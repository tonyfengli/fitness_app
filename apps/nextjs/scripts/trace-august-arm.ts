/**
 * Trace August ARM for groups calculation
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

async function traceAugustArm() {
  console.log("=".repeat(80));
  console.log("TRACING AUGUST 2026 - ALL MEMBERS");
  console.log("=".repeat(80));

  const data = await fetchKpiReportsAsCsv(2026, 8);
  const paymentRows = parseCsv(data.current.allPaymentsCsv);

  // Track all payments by member
  const allMembers = new Map<string, {
    name: string;
    gymRevenue: number;
    smallGroupRevenue: number;
    ptRevenue: number;
    otherRevenue: number;
    totalRevenue: number;
    payments: { amount: number; details: string }[];
  }>();

  for (const row of paymentRows) {
    const memberId = row["Member ID"] || "";
    const name = row["Name"] || "";
    const amount = parseFloat((row["Payment Amount"] || "0").replace(/[$,]/g, "")) || 0;
    const details = row["Payment Details"] || "";

    if (!memberId) continue;

    if (!allMembers.has(memberId)) {
      allMembers.set(memberId, {
        name,
        gymRevenue: 0,
        smallGroupRevenue: 0,
        ptRevenue: 0,
        otherRevenue: 0,
        totalRevenue: 0,
        payments: [],
      });
    }

    const member = allMembers.get(memberId)!;
    member.totalRevenue += amount;
    member.payments.push({ amount, details });

    if (details.includes("Personal Training")) {
      member.ptRevenue += amount;
    } else if (details.includes("Small Group")) {
      member.smallGroupRevenue += amount;
    } else if (details.includes("Gym Memberships")) {
      member.gymRevenue += amount;
    } else {
      member.otherRevenue += amount;
    }
  }

  // Categorize members
  const inBoth27And23: string[] = []; // Gym/SmallGroup members (positive payment)
  const onlyIn27: string[] = []; // PT-only or Other-only members
  const zeroPaymentMembers: string[] = []; // Members with $0 total

  for (const [memberId, info] of allMembers) {
    const hasPositivePayment = info.totalRevenue > 0;
    const hasGroupPayment = (info.gymRevenue > 0 || info.smallGroupRevenue > 0);

    if (!hasPositivePayment) {
      zeroPaymentMembers.push(memberId);
    } else if (hasGroupPayment) {
      inBoth27And23.push(memberId);
    } else {
      onlyIn27.push(memberId);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`MEMBERS IN THE 27 (all paying members)`);
  console.log("=".repeat(80));

  // Sort by total revenue
  const payingMembers = [...allMembers.entries()]
    .filter(([_, info]) => info.totalRevenue > 0)
    .sort((a, b) => b[1].totalRevenue - a[1].totalRevenue);

  console.log(`\nTotal: ${payingMembers.length} members\n`);

  for (const [memberId, info] of payingMembers) {
    const categories: string[] = [];
    if (info.gymRevenue > 0) categories.push(`Gym: $${info.gymRevenue.toFixed(2)}`);
    if (info.smallGroupRevenue > 0) categories.push(`SmallGroup: $${info.smallGroupRevenue.toFixed(2)}`);
    if (info.ptRevenue > 0) categories.push(`PT: $${info.ptRevenue.toFixed(2)}`);
    if (info.otherRevenue > 0) categories.push(`Other: $${info.otherRevenue.toFixed(2)}`);

    const inGroup = (info.gymRevenue > 0 || info.smallGroupRevenue > 0) ? "✓ IN 23" : "✗ NOT in 23";

    console.log(`${info.name} (${memberId}): $${info.totalRevenue.toFixed(2)} [${inGroup}]`);
    console.log(`   ${categories.join(" | ")}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("MEMBERS IN THE 23 (group members only)");
  console.log("=".repeat(80));
  console.log(`\nThese are members who paid for Gym Memberships or Small Group:\n`);

  const groupMembers = payingMembers.filter(([_, info]) => info.gymRevenue > 0 || info.smallGroupRevenue > 0);
  console.log(`Total: ${groupMembers.length} members\n`);
  for (const [memberId, info] of groupMembers) {
    const groupTotal = info.gymRevenue + info.smallGroupRevenue;
    console.log(`${info.name}: $${groupTotal.toFixed(2)} (Gym: $${info.gymRevenue.toFixed(2)}, SmallGroup: $${info.smallGroupRevenue.toFixed(2)})`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("MEMBERS IN 27 BUT NOT IN 23 (PT-only or Other-only)");
  console.log("=".repeat(80));

  const nonGroupMembers = payingMembers.filter(([_, info]) => info.gymRevenue === 0 && info.smallGroupRevenue === 0);
  console.log(`\nTotal: ${nonGroupMembers.length} members\n`);
  for (const [memberId, info] of nonGroupMembers) {
    console.log(`${info.name} (${memberId}): $${info.totalRevenue.toFixed(2)}`);
    console.log(`   PT: $${info.ptRevenue.toFixed(2)} | Other: $${info.otherRevenue.toFixed(2)}`);
    for (const p of info.payments) {
      console.log(`   - $${p.amount.toFixed(2)}: ${p.details}`);
    }
  }

  if (zeroPaymentMembers.length > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("MEMBERS WITH $0 PAYMENTS (not counted in 27)");
    console.log("=".repeat(80));
    console.log(`\nTotal: ${zeroPaymentMembers.length} members\n`);
    for (const memberId of zeroPaymentMembers) {
      const info = allMembers.get(memberId)!;
      console.log(`${info.name} (${memberId})`);
      for (const p of info.payments) {
        console.log(`   - $${p.amount.toFixed(2)}: ${p.details}`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`\n27 Total Paying Members = ${groupMembers.length} group + ${nonGroupMembers.length} non-group`);
  console.log(`23 Group Members = only those who paid for Gym Memberships or Small Group`);
  console.log(`${nonGroupMembers.length} members are in 27 but NOT in 23 (PT-only or Other-only)`);
}

traceAugustArm().catch(console.error);
