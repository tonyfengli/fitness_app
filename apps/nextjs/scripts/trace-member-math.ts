/**
 * Trace member math across Jul/Aug/Sep to find discrepancy
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../.env.local") });

import { fetchKpiReportsAsCsv } from "../src/app/kpi/lib/gymmaster-api";
import { calculateNewMembers } from "../src/app/kpi/lib/calculate-new-members";
import { calculateLostMembers } from "../src/app/kpi/lib/calculate-lost-members";

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

function getPayingMembers(csv: string): Set<string> {
  const rows = parseCsv(csv);
  const memberTotals = new Map<string, number>();

  for (const row of rows) {
    const memberId = row["Member ID"] || "";
    const amount = parseFloat((row["Payment Amount"] || "0").replace(/[$,]/g, "")) || 0;
    if (memberId) {
      memberTotals.set(memberId, (memberTotals.get(memberId) || 0) + amount);
    }
  }

  // Only return members with positive NET payment
  const result = new Set<string>();
  for (const [id, total] of memberTotals) {
    if (total > 0) result.add(id);
  }
  return result;
}

function getMemberNames(csv: string): Map<string, string> {
  const rows = parseCsv(csv);
  const result = new Map<string, string>();
  for (const row of rows) {
    const memberId = row["Member ID"] || "";
    const name = row["Name"] || "";
    if (memberId && name) result.set(memberId, name);
  }
  return result;
}

async function traceMemberMath() {
  console.log("=".repeat(80));
  console.log("TRACING MEMBER MATH: Jul → Aug → Sep 2026");
  console.log("=".repeat(80));

  const months = [7, 8, 9];
  const monthNames = ["July", "August", "September"];

  const monthData: {
    month: string;
    payingMembers: Set<string>;
    newMembers: string[];
    lostMembers: string[];
    names: Map<string, string>;
  }[] = [];

  for (let i = 0; i < months.length; i++) {
    const month = months[i]!;
    console.log(`\nFetching ${monthNames[i]}...`);

    if (i > 0) await new Promise(r => setTimeout(r, 1500));

    const data = await fetchKpiReportsAsCsv(2026, month);

    const payingMembers = getPayingMembers(data.current.allPaymentsCsv);
    const names = getMemberNames(data.current.allPaymentsCsv);

    // Calculate new members
    const newMembersResult = calculateNewMembers(
      data.current.allPaymentsCsv,
      data.previous.allPaymentsCsv,
      data.previous2.allPaymentsCsv
    );

    // Calculate lost members (including on hold)
    const lostMembersResult = calculateLostMembers(
      data.current.allPaymentsCsv,
      data.previous.allPaymentsCsv,
      data.previous2.allPaymentsCsv,
      data.current.currentMembersCsv,
      data.previous.currentMembersCsv,
      data.current.membersOnHoldCsv,
      data.previous.membersOnHoldCsv
    );

    const newMemberIds = [
      ...newMembersResult.newGroupMembers.map(m => m.memberId),
      ...newMembersResult.newPtClients.map(m => m.memberId),
    ];

    const lostMemberIds = [
      ...lostMembersResult.lostGroupMembers.map(m => m.memberId),
      ...lostMembersResult.lostPtClients.map(m => m.memberId),
      ...lostMembersResult.newlyOnHold.map(m => m.memberId),
    ];

    monthData.push({
      month: monthNames[i]!,
      payingMembers,
      newMembers: newMemberIds,
      lostMembers: lostMemberIds,
      names,
    });
  }

  // Now analyze
  console.log("\n" + "=".repeat(80));
  console.log("ANALYSIS");
  console.log("=".repeat(80));

  for (let i = 0; i < monthData.length; i++) {
    const m = monthData[i]!;
    console.log(`\n${m.month}:`);
    console.log(`  Total Paying Members: ${m.payingMembers.size}`);
    console.log(`  New Members: ${m.newMembers.length}`);
    console.log(`  Lost Members: ${m.lostMembers.length}`);
    console.log(`  Net Change: ${m.newMembers.length - m.lostMembers.length}`);
  }

  // Check the math
  console.log("\n" + "=".repeat(80));
  console.log("CHECKING THE MATH");
  console.log("=".repeat(80));

  const jul = monthData[0]!;
  const aug = monthData[1]!;
  const sep = monthData[2]!;

  // July → August transition
  console.log("\n--- July → August ---");
  console.log(`July Total: ${jul.payingMembers.size}`);
  console.log(`August New: +${aug.newMembers.length}`);
  console.log(`August Lost: -${aug.lostMembers.length}`);
  const expectedAug = jul.payingMembers.size + aug.newMembers.length - aug.lostMembers.length;
  console.log(`Expected August Total: ${jul.payingMembers.size} + ${aug.newMembers.length} - ${aug.lostMembers.length} = ${expectedAug}`);
  console.log(`Actual August Total: ${aug.payingMembers.size}`);
  console.log(`Difference: ${aug.payingMembers.size - expectedAug}`);

  // August → September transition
  console.log("\n--- August → September ---");
  console.log(`August Total: ${aug.payingMembers.size}`);
  console.log(`September New: +${sep.newMembers.length}`);
  console.log(`September Lost: -${sep.lostMembers.length}`);
  const expectedSep = aug.payingMembers.size + sep.newMembers.length - sep.lostMembers.length;
  console.log(`Expected September Total: ${aug.payingMembers.size} + ${sep.newMembers.length} - ${sep.lostMembers.length} = ${expectedSep}`);
  console.log(`Actual September Total: ${sep.payingMembers.size}`);
  console.log(`Difference: ${sep.payingMembers.size - expectedSep}`);

  // Find who's in both sets and who's missing
  console.log("\n" + "=".repeat(80));
  console.log("DETAILED MEMBER COMPARISON: July vs August");
  console.log("=".repeat(80));

  // Members in July but not in August (should be "lost in August")
  const inJulNotAug: string[] = [];
  for (const id of jul.payingMembers) {
    if (!aug.payingMembers.has(id)) {
      inJulNotAug.push(id);
    }
  }

  // Members in August but not in July (should be "new in August")
  const inAugNotJul: string[] = [];
  for (const id of aug.payingMembers) {
    if (!jul.payingMembers.has(id)) {
      inAugNotJul.push(id);
    }
  }

  console.log(`\nMembers in July but NOT in August (${inJulNotAug.length}):`);
  console.log("  These SHOULD be counted as 'Lost in August'");
  for (const id of inJulNotAug) {
    const name = jul.names.get(id) || aug.names.get(id) || "Unknown";
    const isInLostList = aug.lostMembers.includes(id);
    console.log(`  - ${name} (${id}) ${isInLostList ? "✓ in lost list" : "✗ NOT in lost list"}`);
  }

  console.log(`\nMembers in August but NOT in July (${inAugNotJul.length}):`);
  console.log("  These SHOULD be counted as 'New in August'");
  for (const id of inAugNotJul) {
    const name = aug.names.get(id) || "Unknown";
    const isInNewList = aug.newMembers.includes(id);
    console.log(`  - ${name} (${id}) ${isInNewList ? "✓ in new list" : "✗ NOT in new list"}`);
  }

  console.log(`\nAugust 'Lost' list (${aug.lostMembers.length}):`);
  for (const id of aug.lostMembers) {
    const name = jul.names.get(id) || aug.names.get(id) || "Unknown";
    const wasInJuly = jul.payingMembers.has(id);
    const isInAugust = aug.payingMembers.has(id);
    console.log(`  - ${name} (${id}) - Was in July: ${wasInJuly ? "✓" : "✗"}, Is in August: ${isInAugust ? "✓" : "✗"}`);
  }

  console.log(`\nAugust 'New' list (${aug.newMembers.length}):`);
  for (const id of aug.newMembers) {
    const name = aug.names.get(id) || "Unknown";
    const wasInJuly = jul.payingMembers.has(id);
    const isInAugust = aug.payingMembers.has(id);
    console.log(`  - ${name} (${id}) - Was in July: ${wasInJuly ? "✓" : "✗"}, Is in August: ${isInAugust ? "✓" : "✗"}`);
  }
}

traceMemberMath().catch(console.error);
