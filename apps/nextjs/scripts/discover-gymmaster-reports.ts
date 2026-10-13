/**
 * Discover available GymMaster report IDs
 * Run: npx tsx scripts/discover-gymmaster-reports.ts
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

async function tryReport(reportId: number, startDate: string, endDate: string): Promise<{
  id: number;
  success: boolean;
  rowCount?: number;
  fields?: string[];
  billingFields?: string[];
  sampleData?: Record<string, unknown>;
  error?: string;
}> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  try {
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

    if (!response.ok) {
      return { id: reportId, success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (data.error) {
      return { id: reportId, success: false, error: JSON.stringify(data.error) };
    }

    const rows = data.result || [];
    if (rows.length === 0) {
      return { id: reportId, success: true, rowCount: 0, fields: [] };
    }

    const fields = Object.keys(rows[0]).filter(k => !k.startsWith("sorted_")).sort();

    // Look for billing/payment/schedule related fields
    const billingFields = fields.filter(f => {
      const lower = f.toLowerCase();
      return lower.includes("bill") ||
        lower.includes("payment") ||
        lower.includes("schedule") ||
        lower.includes("next") ||
        lower.includes("due") ||
        lower.includes("recurring") ||
        lower.includes("cycle") ||
        lower.includes("fee") ||
        lower.includes("amount") ||
        lower.includes("charge") ||
        lower.includes("invoice");
    });

    return {
      id: reportId,
      success: true,
      rowCount: rows.length,
      fields,
      billingFields,
      sampleData: rows[0],
    };
  } catch (err) {
    return { id: reportId, success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const startDate = "2026-01-01";
  const endDate = "2026-12-31";

  console.log("=".repeat(80));
  console.log("GYMMASTER REPORT ID DISCOVERY");
  console.log("Scanning report IDs 1-500...");
  console.log("=".repeat(80));

  const knownReports: Record<number, string> = {
    1: "CURRENT_MEMBERS",
    103: "ALL_PAYMENTS",
    116: "NEW_MEMBERS",
    314: "MEMBERS_ON_HOLD",
    327: "CANCELLATIONS",
  };

  const validReports: Array<{
    id: number;
    name?: string;
    rowCount: number;
    fields: string[];
    billingFields: string[];
  }> = [];

  // Scan ranges - focus on likely report ID ranges
  const ranges = [
    [1, 50],      // Low IDs
    [100, 150],   // Around ALL_PAYMENTS (103)
    [200, 250],   // Mid range
    [300, 350],   // Around ON_HOLD (314) and CANCELLATIONS (327)
    [400, 450],   // Higher range
  ];

  for (const [start, end] of ranges) {
    console.log(`\nScanning IDs ${start}-${end}...`);

    for (let id = start; id <= end; id++) {
      const result = await tryReport(id, startDate, endDate);

      if (result.success && result.rowCount !== undefined && result.rowCount > 0) {
        validReports.push({
          id: result.id,
          name: knownReports[result.id],
          rowCount: result.rowCount,
          fields: result.fields || [],
          billingFields: result.billingFields || [],
        });

        const marker = result.billingFields && result.billingFields.length > 0 ? "⭐" : "✓";
        const name = knownReports[result.id] ? ` (${knownReports[result.id]})` : "";
        console.log(`  ${marker} ID ${result.id}${name}: ${result.rowCount} rows, ${result.fields?.length} fields`);

        if (result.billingFields && result.billingFields.length > 0) {
          console.log(`    → Billing fields: ${result.billingFields.join(", ")}`);
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY: Valid Reports Found");
  console.log("=".repeat(80));

  // Sort by ID
  validReports.sort((a, b) => a.id - b.id);

  for (const report of validReports) {
    const name = report.name ? ` (${report.name})` : "";
    console.log(`\n📋 Report ID ${report.id}${name}`);
    console.log(`   Rows: ${report.rowCount}`);
    console.log(`   Fields (${report.fields.length}):`);
    for (const field of report.fields) {
      const isBilling = report.billingFields.includes(field);
      console.log(`     ${isBilling ? "⭐" : "•"} ${field}`);
    }
  }

  // Highlight reports with billing-related fields
  const billingReports = validReports.filter(r => r.billingFields.length > 0);
  if (billingReports.length > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("⭐ REPORTS WITH BILLING/PAYMENT FIELDS");
    console.log("=".repeat(80));

    for (const report of billingReports) {
      const name = report.name ? ` (${report.name})` : " (UNKNOWN)";
      console.log(`\nReport ID ${report.id}${name}:`);
      console.log(`  Billing fields: ${report.billingFields.join(", ")}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("Done! Found " + validReports.length + " valid reports.");
}

main().catch(console.error);
