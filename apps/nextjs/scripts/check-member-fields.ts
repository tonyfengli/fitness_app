/**
 * Debug script to discover all available fields in GymMaster reports
 * Run: npx tsx scripts/check-member-fields.ts
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

const REPORT_IDS = {
  ALL_PAYMENTS: 103,
  CURRENT_MEMBERS: 1,
  NEW_MEMBERS: 116,
  CANCELLATIONS: 327,
  MEMBERS_ON_HOLD: 314,
};

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
  const startDate = "2026-10-01";
  const endDate = "2026-10-31";

  console.log("=".repeat(80));
  console.log("GYMMASTER REPORT FIELD DISCOVERY");
  console.log("=".repeat(80));

  for (const [reportName, reportId] of Object.entries(REPORT_IDS)) {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`REPORT: ${reportName} (ID: ${reportId})`);
    console.log("─".repeat(80));

    try {
      const rows = await fetchReport(reportId, startDate, endDate);

      if (rows.length === 0) {
        console.log("  (No data returned)");
        continue;
      }

      // Get all unique field names from first few rows
      const allFields = new Set<string>();
      const sampleRow = rows[0];

      for (const key of Object.keys(sampleRow)) {
        if (!key.startsWith("sorted_")) {
          allFields.add(key);
        }
      }

      console.log(`\nFields (${allFields.size} total):`);
      const sortedFields = [...allFields].sort();
      for (const field of sortedFields) {
        const sampleValue = sampleRow[field];
        const valuePreview = String(sampleValue || "").substring(0, 40);
        console.log(`  • ${field}: ${valuePreview}${String(sampleValue || "").length > 40 ? "..." : ""}`);
      }

      // Look for billing/payment/schedule related fields
      const billingFields = sortedFields.filter(f =>
        f.toLowerCase().includes("bill") ||
        f.toLowerCase().includes("payment") ||
        f.toLowerCase().includes("schedule") ||
        f.toLowerCase().includes("next") ||
        f.toLowerCase().includes("due") ||
        f.toLowerCase().includes("recurring") ||
        f.toLowerCase().includes("cycle") ||
        f.toLowerCase().includes("fee")
      );

      if (billingFields.length > 0) {
        console.log(`\n⭐ BILLING-RELATED FIELDS:`);
        for (const field of billingFields) {
          console.log(`  → ${field}: ${String(sampleRow[field] || "(empty)")}`);
        }
      }

      console.log(`\nTotal rows: ${rows.length}`);
    } catch (err) {
      console.log(`  Error: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("Done!");
}

main().catch(console.error);
