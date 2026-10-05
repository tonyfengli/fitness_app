/**
 * Trace Kleiser specifically
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

async function traceKleiser() {
  const KLEISER_ID = "322787";

  console.log("=".repeat(80));
  console.log("TRACING KLEISER (ID: 322787)");
  console.log("=".repeat(80));

  for (const month of [7, 8]) {
    console.log(`\n--- ${month === 7 ? "July" : "August"} 2026 ---`);

    if (month === 8) await new Promise(r => setTimeout(r, 1500));

    const data = await fetchKpiReportsAsCsv(2026, month);

    // Check payments
    const payments = parseCsv(data.current.allPaymentsCsv);
    const kleiserPayments = payments.filter(p => p["Member ID"] === KLEISER_ID);
    console.log(`\nPayments in month:`);
    if (kleiserPayments.length === 0) {
      console.log("  (none)");
    } else {
      for (const p of kleiserPayments) {
        console.log(`  - $${p["Payment Amount"]} - ${p["Payment Details"]}`);
      }
    }

    // Check on hold
    const onHold = parseCsv(data.current.membersOnHoldCsv);
    const kleiserOnHold = onHold.filter(h => h["Member ID"] === KLEISER_ID);
    console.log(`\nOn Hold status:`);
    if (kleiserOnHold.length === 0) {
      console.log("  NOT on hold");
    } else {
      for (const h of kleiserOnHold) {
        console.log(`  ON HOLD: ${h["Date Hold Starts"]} to ${h["Date Hold Ends"]}`);
      }
    }

    // Check current members
    const members = parseCsv(data.current.currentMembersCsv);
    const kleiserMember = members.filter(m => m["Member ID"] === KLEISER_ID);
    console.log(`\nCurrent Members list:`);
    if (kleiserMember.length === 0) {
      console.log("  NOT in list");
    } else {
      for (const m of kleiserMember) {
        console.log(`  IN LIST: ${m["Membership Type Name"]} - $${m["Membership Fee"]}`);
      }
    }

    // Check previous month on hold (for "newly on hold" detection)
    const prevOnHold = parseCsv(data.previous.membersOnHoldCsv);
    const kleiserPrevOnHold = prevOnHold.filter(h => h["Member ID"] === KLEISER_ID);
    console.log(`\nPrevious month On Hold:`);
    if (kleiserPrevOnHold.length === 0) {
      console.log("  NOT on hold in previous month");
    } else {
      for (const h of kleiserPrevOnHold) {
        console.log(`  WAS ON HOLD: ${h["Date Hold Starts"]} to ${h["Date Hold Ends"]}`);
      }
    }
  }
}

traceKleiser().catch(console.error);
