/**
 * Test the GymMaster API client directly
 * This validates Step 1 and Step 2 before we modify the UI
 */

import 'dotenv/config';

// Import the functions we need to test
// Since we can't use the path alias in scripts, use relative path
const BASE_URL = process.env.GYMMASTER_BASE_URL!;
const API_KEY = process.env.GYMMASTER_REPORT_API_KEY!;

const REPORT_IDS = {
  ALL_PAYMENTS: 103,
  STARTING_MEMBERSHIPS: 12,
  CURRENT_MEMBERS: 1,
  CANCELLATIONS: 327,
  MEMBERS_ON_HOLD: 314,
} as const;

interface ReportRow {
  [key: string]: string | number | null;
}

async function fetchReport(
  reportId: number,
  startDate: string,
  endDate: string
): Promise<ReportRow[]> {
  const url = `${BASE_URL}/api/v2/report/standard_report`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-GM-API-KEY": API_KEY,
    },
    body: JSON.stringify({
      report_id: reportId,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return data.result || [];
}

function convertToCsv(rows: ReportRow[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0] || {}).filter(
    (key) => !key.startsWith("sorted_")
  );

  const csvRows: string[] = [];
  csvRows.push(headers.join(","));

  for (const row of rows) {
    const values = headers.map((header) => {
      const value = row[header];
      const str = value === null || value === undefined ? "" : String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

async function main() {
  console.log("=".repeat(60));
  console.log("Testing GymMaster API Client for KPI Reports");
  console.log("=".repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Key: ${API_KEY?.slice(0, 8)}...`);

  const year = 2026;
  const month = 8;
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

  console.log(`\nFetching reports for ${startDate} to ${endDate}`);

  // Test each report
  const reports = [
    { name: "All Payments", id: REPORT_IDS.ALL_PAYMENTS },
    { name: "Starting Memberships", id: REPORT_IDS.STARTING_MEMBERSHIPS },
    { name: "Current Members", id: REPORT_IDS.CURRENT_MEMBERS },
    { name: "Cancellations", id: REPORT_IDS.CANCELLATIONS },
    { name: "Members on Hold", id: REPORT_IDS.MEMBERS_ON_HOLD },
  ];

  for (const report of reports) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`📊 ${report.name} (ID: ${report.id})`);

    try {
      const rows = await fetchReport(report.id, startDate, endDate);
      console.log(`✅ Fetched ${rows.length} rows`);

      if (rows.length > 0) {
        // Show column headers
        const headers = Object.keys(rows[0]).filter(k => !k.startsWith("sorted_"));
        console.log(`   Columns: ${headers.join(", ")}`);

        // Show first row as sample
        console.log(`   Sample row:`, JSON.stringify(rows[0], null, 2).slice(0, 500));

        // Test CSV conversion
        const csv = convertToCsv(rows);
        const csvLines = csv.split("\n");
        console.log(`   CSV preview (first 3 lines):`);
        csvLines.slice(0, 3).forEach(line => console.log(`     ${line.slice(0, 100)}...`));
      }
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Test previous month fetch (for ghost churn)
  console.log(`\n${"─".repeat(60)}`);
  console.log("📊 Previous Month (July 2026) - For Ghost Churn");

  try {
    const prevRows = await fetchReport(REPORT_IDS.ALL_PAYMENTS, "2026-07-01", "2026-07-31");
    console.log(`✅ Previous month payments: ${prevRows.length} rows`);
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : error}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ API Client Test Complete");
  console.log("=".repeat(60));
}

main().catch(console.error);
