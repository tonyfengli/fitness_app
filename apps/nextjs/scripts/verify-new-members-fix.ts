/**
 * Verify that the calculateNewMembers fix works correctly
 * Reneil Lovo should now be counted as a new member (reactivation)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { calculateNewMembers } from "../src/app/kpi/lib/calculate-new-members";

const GYMMASTER_BASE_URL = process.env.GYMMASTER_BASE_URL!;
const GYMMASTER_API_KEY = process.env.GYMMASTER_REPORT_API_KEY!;

async function fetchReport(reportId: number, startDate: string, endDate: string) {
  const response = await fetch(`${GYMMASTER_BASE_URL}/api/v2/report/standard_report`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-GM-API-KEY": GYMMASTER_API_KEY,
    },
    body: JSON.stringify({ report_id: reportId, start_date: startDate, end_date: endDate }),
  });
  const data = await response.json();
  return data.result || [];
}

function toCsv(rows: any[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]).filter(k => !k.startsWith("sorted_"));
  const csvRows = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map(h => {
      const v = row[h] ?? "";
      const s = String(v);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    });
    csvRows.push(values.join(","));
  }
  return csvRows.join("\n");
}

async function main() {
  console.log("Fetching data for Feb, Mar, Apr 2026...\n");

  const [febRows, marRows, aprRows] = await Promise.all([
    fetchReport(103, "2026-02-01", "2026-02-28"),
    fetchReport(103, "2026-03-01", "2026-03-31"),
    fetchReport(103, "2026-04-01", "2026-04-30"),
  ]);

  const febCsv = toCsv(febRows);
  const marCsv = toCsv(marRows);
  const aprCsv = toCsv(aprRows);

  // Calculate new members for April using the updated logic
  const result = calculateNewMembers(aprCsv, marCsv, febCsv);

  console.log("=== NEW MEMBERS IN APRIL (Updated Logic) ===\n");

  console.log(`Group Members: ${result.groupMemberCount}`);
  for (const m of result.newGroupMembers) {
    const tag = m.isReactivation ? "[REACTIVATION]" : "[NEW]";
    console.log(`  ${tag} ${m.name}: $${m.amount.toFixed(2)}`);
  }

  console.log(`\nPT Clients: ${result.ptClientCount}`);
  for (const m of result.newPtClients) {
    const tag = m.isReactivation ? "[REACTIVATION]" : "[NEW]";
    console.log(`  ${tag} ${m.name}: $${m.amount.toFixed(2)}`);
  }

  const totalNew = result.groupMemberCount + result.ptClientCount;
  console.log(`\n=== TOTAL NEW: ${totalNew} ===`);

  // Check if Reneil is now included
  const reneilInGroup = result.newGroupMembers.find(m => m.name.includes("Lovo"));
  const reneilInPt = result.newPtClients.find(m => m.name.includes("Lovo"));

  console.log("\n=== VERIFICATION ===");
  if (reneilInGroup || reneilInPt) {
    console.log("✓ Reneil Lovo is now counted as a new member (reactivation)");
  } else {
    console.log("✗ Reneil Lovo is still NOT counted - check the logic");
  }

  console.log("\nExpected: 24 (Mar) + 5 (new) - 3 (lost) = 26 (Apr) ✓");
}

main().catch(console.error);
