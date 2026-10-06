/**
 * Debug script to trace member count discrepancies
 *
 * Issue: March has 24 members, April has +4 new / -3 lost, but shows 26 total (should be 25)
 *
 * Run: npx tsx scripts/debug-member-math.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

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

interface MemberPayment {
  memberId: string;
  name: string;
  total: number;
  details: string[];
}

function parsePayments(rows: any[]): Map<string, MemberPayment> {
  const members = new Map<string, MemberPayment>();

  for (const row of rows) {
    const memberId = row["Member ID"] || "";
    const name = row["Name"] || "";
    const amount = parseFloat(String(row["Payment Amount"] || "0").replace(/[$,]/g, "")) || 0;
    const details = row["Payment Details"] || "";

    if (!memberId) continue;

    if (!members.has(memberId)) {
      members.set(memberId, { memberId, name, total: 0, details: [] });
    }
    const m = members.get(memberId)!;
    m.total += amount;
    if (details && !m.details.includes(details)) {
      m.details.push(details);
    }
    if (name && !m.name) m.name = name;
  }

  return members;
}

function getPayingMembers(payments: Map<string, MemberPayment>): Map<string, MemberPayment> {
  const paying = new Map<string, MemberPayment>();
  for (const [id, m] of payments) {
    if (m.total > 0) {
      paying.set(id, m);
    }
  }
  return paying;
}

async function main() {
  console.log("Fetching payment data for Feb, Mar, Apr, May 2026...\n");

  // Fetch all payments for each month
  const [febRows, marRows, aprRows, mayRows] = await Promise.all([
    fetchReport(103, "2026-02-01", "2026-02-28"),
    fetchReport(103, "2026-03-01", "2026-03-31"),
    fetchReport(103, "2026-04-01", "2026-04-30"),
    fetchReport(103, "2026-05-01", "2026-05-31"),
  ]);

  const febPayments = parsePayments(febRows);
  const marPayments = parsePayments(marRows);
  const aprPayments = parsePayments(aprRows);
  const mayPayments = parsePayments(mayRows);

  const febPaying = getPayingMembers(febPayments);
  const marPaying = getPayingMembers(marPayments);
  const aprPaying = getPayingMembers(aprPayments);
  const mayPaying = getPayingMembers(mayPayments);

  console.log("=== TOTAL PAYING MEMBERS PER MONTH ===");
  console.log(`Feb: ${febPaying.size}`);
  console.log(`Mar: ${marPaying.size}`);
  console.log(`Apr: ${aprPaying.size}`);
  console.log(`May: ${mayPaying.size}`);

  // Calculate NEW members for April (paid in Apr, NOT in Mar, NOT in Feb)
  const newInApr: MemberPayment[] = [];
  for (const [id, m] of aprPaying) {
    const paidMar = marPaying.has(id);
    const paidFeb = febPaying.has(id);
    if (!paidMar && !paidFeb) {
      newInApr.push(m);
    }
  }

  // Calculate LOST members for April (paid in Mar, NOT in Apr, not on hold - simplified)
  const lostInApr: MemberPayment[] = [];
  for (const [id, m] of marPaying) {
    if (!aprPaying.has(id)) {
      lostInApr.push(m);
    }
  }

  console.log("\n=== APRIL ANALYSIS ===");
  console.log(`New members (paid Apr, NOT Mar, NOT Feb): ${newInApr.length}`);
  console.log(`Lost members (paid Mar, NOT Apr): ${lostInApr.length}`);
  console.log(`Expected Apr total: ${marPaying.size} + ${newInApr.length} - ${lostInApr.length} = ${marPaying.size + newInApr.length - lostInApr.length}`);
  console.log(`Actual Apr total: ${aprPaying.size}`);
  console.log(`Discrepancy: ${aprPaying.size - (marPaying.size + newInApr.length - lostInApr.length)}`);

  // Find the "ghost" members - in April but not explained by new members
  console.log("\n=== FINDING UNEXPLAINED MEMBERS ===");
  console.log("Members paying in April who are NOT in March AND NOT counted as new:");

  const unexplained: MemberPayment[] = [];
  for (const [id, m] of aprPaying) {
    const inMar = marPaying.has(id);
    const isNew = newInApr.some(n => n.memberId === id);

    if (!inMar && !isNew) {
      // This shouldn't happen with our logic, but let's check
      unexplained.push(m);
    }
  }

  if (unexplained.length > 0) {
    for (const m of unexplained) {
      console.log(`  - ${m.name} (${m.memberId}): $${m.total.toFixed(2)}`);
    }
  } else {
    console.log("  None found in this category");
  }

  // The real question: who is in April that wasn't in March?
  console.log("\n=== MEMBERS IN APRIL BUT NOT IN MARCH ===");
  const inAprNotMar: MemberPayment[] = [];
  for (const [id, m] of aprPaying) {
    if (!marPaying.has(id)) {
      inAprNotMar.push(m);
    }
  }

  console.log(`Total: ${inAprNotMar.length}`);
  for (const m of inAprNotMar) {
    const paidFeb = febPaying.has(m.memberId);
    const isNew = !paidFeb; // New = not in Feb either
    console.log(`  ${isNew ? "[NEW]" : "[REACTIVATION]"} ${m.name} (${m.memberId}): $${m.total.toFixed(2)}`);
    if (paidFeb) {
      console.log(`    ^ Paid in Feb ($${febPaying.get(m.memberId)!.total.toFixed(2)}), skipped Mar, back in Apr`);
    }
  }

  // Members lost from March
  console.log("\n=== MEMBERS IN MARCH BUT NOT IN APRIL ===");
  console.log(`Total: ${lostInApr.length}`);
  for (const m of lostInApr) {
    console.log(`  [LOST] ${m.name} (${m.memberId}): was $${m.total.toFixed(2)}/mo`);
  }

  // Summary
  console.log("\n=== RECONCILIATION ===");
  const reactivations = inAprNotMar.filter(m => febPaying.has(m.memberId));
  const trueNew = inAprNotMar.filter(m => !febPaying.has(m.memberId));

  console.log(`March paying members: ${marPaying.size}`);
  console.log(`  + True new (not in Feb or Mar): ${trueNew.length}`);
  console.log(`  + Reactivations (in Feb, not Mar, back in Apr): ${reactivations.length}`);
  console.log(`  - Lost (in Mar, not Apr): ${lostInApr.length}`);
  console.log(`  = Expected: ${marPaying.size + trueNew.length + reactivations.length - lostInApr.length}`);
  console.log(`  = Actual: ${aprPaying.size}`);

  if (reactivations.length > 0) {
    console.log("\n=== REACTIVATIONS (the likely cause of discrepancy) ===");
    for (const m of reactivations) {
      console.log(`  ${m.name} (${m.memberId})`);
      console.log(`    Feb: $${febPaying.get(m.memberId)!.total.toFixed(2)}`);
      console.log(`    Mar: $0 (skipped)`);
      console.log(`    Apr: $${m.total.toFixed(2)}`);
    }
  }
}

main().catch(console.error);
