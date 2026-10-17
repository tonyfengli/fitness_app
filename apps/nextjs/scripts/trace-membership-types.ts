/**
 * Trace membership types to see if we can separate Open Gym vs Classes
 * Run: npx tsx scripts/trace-membership-types.ts
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

async function fetchReport(reportId: number, startDate: string, endDate: string) {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-GM-API-KEY": apiKey!,
    },
    body: JSON.stringify({
      report_id: reportId,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  const data = await response.json();
  return data.result || [];
}

async function main() {
  console.log("=".repeat(100));
  console.log("TRACING MEMBERSHIP TYPES - CAN WE SEPARATE OPEN GYM VS CLASSES?");
  console.log("=".repeat(100));

  // Get Current Members (Report 1)
  const members = await fetchReport(1, "2026-09-01", "2026-09-30");

  // Show fields available
  if (members.length > 0) {
    console.log("\n=== FIELDS IN CURRENT MEMBERS REPORT ===");
    console.log(Object.keys(members[0]).join("\n"));
  }

  // Get unique membership types with counts and fees
  const types = new Map<string, { count: number; totalFee: number; sample: any }>();
  for (const m of members) {
    const type = m["Membership Type Name"] || "(none)";
    if (!types.has(type)) {
      types.set(type, { count: 0, totalFee: 0, sample: m });
    }
    const data = types.get(type)!;
    data.count++;
    data.totalFee += parseFloat(String(m["Membership Fee"] || "0").replace(/[^0-9.-]/g, ""));
  }

  console.log("\n=== MEMBERSHIP TYPES (from Current Members Report 1) ===");
  const sortedTypes = [...types.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [type, data] of sortedTypes) {
    console.log(`\n${type}:`);
    console.log(`  Count: ${data.count} members`);
    console.log(`  Total Monthly Fee: $${data.totalFee.toFixed(2)}`);
    console.log(`  Avg Fee: $${(data.totalFee / data.count).toFixed(2)}`);
  }

  // Now get payments for September
  const payments = await fetchReport(103, "2026-09-01", "2026-09-30");

  // Filter to Gym Memberships payments only
  const gymPayments = payments.filter((p: any) =>
    (p["Payment Details"] || "").includes("Gym Memberships")
  );

  console.log("\n" + "=".repeat(100));
  console.log("CROSS-REFERENCING PAYMENTS WITH MEMBER TYPES");
  console.log("=".repeat(100));

  // Build member ID -> membership type lookup
  const memberTypeMap = new Map<string, string>();
  for (const m of members) {
    const memberId = String(m["Member ID"] || "");
    const type = String(m["Membership Type Name"] || "(unknown)");
    if (memberId) {
      memberTypeMap.set(memberId, type);
    }
  }

  // Categorize Gym Memberships payments by member's membership type
  const revenueByType = new Map<string, number>();
  let unmatchedRevenue = 0;
  let unmatchedCount = 0;

  for (const p of gymPayments) {
    const memberId = String(p["Member ID"] || "");
    const amount = parseFloat(String(p["Payment Amount"] || "0").replace(/[^0-9.-]/g, ""));

    const memberType = memberTypeMap.get(memberId);
    if (memberType) {
      if (!revenueByType.has(memberType)) {
        revenueByType.set(memberType, 0);
      }
      revenueByType.set(memberType, revenueByType.get(memberType)! + amount);
    } else {
      unmatchedRevenue += amount;
      unmatchedCount++;
    }
  }

  console.log("\n=== GYM MEMBERSHIPS REVENUE BY MEMBER'S MEMBERSHIP TYPE ===");
  const sortedRevenue = [...revenueByType.entries()].sort((a, b) => b[1] - a[1]);
  for (const [type, revenue] of sortedRevenue) {
    console.log(`${type}: $${revenue.toFixed(2)}`);
  }

  if (unmatchedCount > 0) {
    console.log(`\n(Unmatched - member not in current members): $${unmatchedRevenue.toFixed(2)} (${unmatchedCount} payments)`);
  }

  // Suggest categorization
  console.log("\n" + "=".repeat(100));
  console.log("SUGGESTED CATEGORIZATION");
  console.log("=".repeat(100));

  let openGymTotal = 0;
  let classesTotal = 0;

  for (const [type, revenue] of revenueByType) {
    const typeLower = type.toLowerCase();
    if (typeLower.includes("open gym") || typeLower.includes("opengym")) {
      openGymTotal += revenue;
      console.log(`OPEN GYM: ${type} → $${revenue.toFixed(2)}`);
    } else if (typeLower.includes("class") || typeLower.includes("small group") || typeLower.includes("unlimited")) {
      classesTotal += revenue;
      console.log(`CLASSES: ${type} → $${revenue.toFixed(2)}`);
    } else {
      console.log(`??? UNCLEAR: ${type} → $${revenue.toFixed(2)}`);
    }
  }

  console.log("\n─────────────────");
  console.log(`Open Gym Revenue: $${openGymTotal.toFixed(2)}`);
  console.log(`Classes Revenue: $${classesTotal.toFixed(2)}`);
  console.log(`Unmatched: $${unmatchedRevenue.toFixed(2)}`);
  console.log(`Total Gym Memberships: $${(openGymTotal + classesTotal + unmatchedRevenue).toFixed(2)}`);

  console.log("\n");
}

main().catch(console.error);
