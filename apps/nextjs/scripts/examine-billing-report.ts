/**
 * Examine promising billing reports in detail
 * Run: npx tsx scripts/examine-billing-report.ts
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
  // Look at current and future dates
  const startDate = "2026-10-01";
  const endDate = "2026-12-31";

  console.log("=".repeat(80));
  console.log("EXAMINING BILLING-RELATED REPORTS");
  console.log(`Date range: ${startDate} to ${endDate}`);
  console.log("=".repeat(80));

  // Report 130 - Has Billing Date, Billing Status, Amount
  console.log("\n📋 REPORT 130 - Billing Schedule Report");
  console.log("─".repeat(80));
  const report130 = await fetchReport(130, startDate, endDate);
  console.log(`Rows: ${report130.length}`);
  if (report130.length > 0) {
    console.log("\nSample rows:");
    for (const row of report130.slice(0, 10)) {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!k.startsWith("sorted_")) clean[k] = v;
      }
      console.log(JSON.stringify(clean, null, 2));
      console.log("---");
    }
  }

  // Report 127 - Has Last Payment, Member Billing Provider
  console.log("\n📋 REPORT 127 - Member Billing Info");
  console.log("─".repeat(80));
  const report127 = await fetchReport(127, startDate, endDate);
  console.log(`Rows: ${report127.length}`);
  if (report127.length > 0) {
    console.log("\nSample rows:");
    for (const row of report127.slice(0, 5)) {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!k.startsWith("sorted_")) clean[k] = v;
      }
      console.log(JSON.stringify(clean, null, 2));
      console.log("---");
    }
  }

  // Report 115 - Has Membership Daily Charge, Future Revenue
  console.log("\n📋 REPORT 115 - Membership Future Revenue");
  console.log("─".repeat(80));
  const report115 = await fetchReport(115, startDate, endDate);
  console.log(`Rows: ${report115.length}`);
  if (report115.length > 0) {
    console.log("\nSample rows:");
    for (const row of report115.slice(0, 5)) {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!k.startsWith("sorted_")) clean[k] = v;
      }
      console.log(JSON.stringify(clean, null, 2));
      console.log("---");
    }
  }

  // Report 128 - Has Membership First Payment Date
  console.log("\n📋 REPORT 128 - First Payment Date");
  console.log("─".repeat(80));
  const report128 = await fetchReport(128, startDate, endDate);
  console.log(`Rows: ${report128.length}`);
  if (report128.length > 0) {
    console.log("\nSample rows:");
    for (const row of report128.slice(0, 5)) {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!k.startsWith("sorted_")) clean[k] = v;
      }
      console.log(JSON.stringify(clean, null, 2));
      console.log("---");
    }
  }

  // Report 13 - Last Payment, Owe Start/End
  console.log("\n📋 REPORT 13 - Members Who Owe");
  console.log("─".repeat(80));
  const report13 = await fetchReport(13, startDate, endDate);
  console.log(`Rows: ${report13.length}`);
  if (report13.length > 0) {
    console.log("\nAll rows:");
    for (const row of report13) {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!k.startsWith("sorted_")) clean[k] = v;
      }
      console.log(JSON.stringify(clean, null, 2));
      console.log("---");
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("Done!");
}

main().catch(console.error);
