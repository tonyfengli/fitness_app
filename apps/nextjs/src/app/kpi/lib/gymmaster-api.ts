/**
 * GymMaster Report API V2 Client
 * Server-side only - do not import in client components
 */

// Report IDs from GymMaster
export const REPORT_IDS = {
  ALL_PAYMENTS: 103,
  STARTING_MEMBERSHIPS: 12,
  CURRENT_MEMBERS: 1,
  CANCELLATIONS: 327,
  MEMBERS_ON_HOLD: 314,
} as const;

export interface GymMasterConfig {
  baseUrl: string;
  apiKey: string;
}

export interface ReportRow {
  [key: string]: string | number | null;
}

export interface FetchReportsResult {
  allPayments: ReportRow[];
  startingMemberships: ReportRow[];
  currentMembers: ReportRow[];
  cancellations: ReportRow[];
  membersOnHold: ReportRow[];
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface FetchError {
  report: string;
  status: number;
  message: string;
}

function getConfig(): GymMasterConfig {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Missing GymMaster configuration. Set GYMMASTER_BASE_URL and GYMMASTER_REPORT_API_KEY environment variables."
    );
  }

  return { baseUrl, apiKey };
}

/**
 * Fetch a standard report from GymMaster Report API V2
 */
async function fetchReport(
  config: GymMasterConfig,
  reportId: number,
  startDate: string,
  endDate: string
): Promise<ReportRow[]> {
  const url = `${config.baseUrl}/api/v2/report/standard_report`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-GM-API-KEY": config.apiKey,
    },
    body: JSON.stringify({
      report_id: reportId,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GymMaster API error (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`GymMaster API error: ${JSON.stringify(data.error)}`);
  }

  return data.result || [];
}

/**
 * Convert API response row to CSV-compatible format
 * The API returns data with keys like "Member ID", "Payment Amount", etc.
 * which matches our CSV column headers exactly.
 */
function normalizeRow(row: ReportRow): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(row)) {
    // Skip sorted_ prefixed fields (internal GymMaster fields)
    if (key.startsWith("sorted_")) continue;

    // Convert value to string
    if (value === null || value === undefined) {
      normalized[key] = "";
    } else {
      normalized[key] = String(value);
    }
  }

  return normalized;
}

/**
 * Convert API response to CSV string for compatibility with existing parsers
 */
export function convertToCsv(rows: ReportRow[]): string {
  if (rows.length === 0) return "";

  // Get headers from first row, excluding sorted_ fields
  const headers = Object.keys(rows[0] || {}).filter(
    (key) => !key.startsWith("sorted_")
  );

  // Build CSV
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.join(","));

  // Data rows
  for (const row of rows) {
    const normalized = normalizeRow(row);
    const values = headers.map((header) => {
      const value = normalized[header] || "";
      // Escape values with commas or quotes
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

/**
 * Get the date range for a given month
 */
function getMonthDateRange(
  year: number,
  month: number
): { startDate: string; endDate: string } {
  // Month is 1-indexed (1 = January)
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;

  // Get last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { startDate, endDate };
}

/**
 * Fetch all reports needed for KPI calculation
 * Fetches both current month and previous month for ghost churn detection
 */
export async function fetchKpiReports(
  year: number,
  month: number
): Promise<{
  current: FetchReportsResult;
  previous: FetchReportsResult;
}> {
  const config = getConfig();

  // Calculate date ranges
  const currentPeriod = getMonthDateRange(year, month);

  // Previous month
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  const previousPeriod = getMonthDateRange(prevYear, prevMonth);

  console.log(`[GymMaster API] Fetching reports for ${year}-${month}`);
  console.log(`  Current period: ${currentPeriod.startDate} to ${currentPeriod.endDate}`);
  console.log(`  Previous period: ${previousPeriod.startDate} to ${previousPeriod.endDate}`);

  // Fetch all reports for both periods in parallel
  const [
    currentAllPayments,
    currentStartingMemberships,
    currentCurrentMembers,
    currentCancellations,
    currentMembersOnHold,
    previousAllPayments,
    previousCurrentMembers,
  ] = await Promise.all([
    // Current month - all 5 reports
    fetchReport(config, REPORT_IDS.ALL_PAYMENTS, currentPeriod.startDate, currentPeriod.endDate),
    fetchReport(config, REPORT_IDS.STARTING_MEMBERSHIPS, currentPeriod.startDate, currentPeriod.endDate),
    fetchReport(config, REPORT_IDS.CURRENT_MEMBERS, currentPeriod.startDate, currentPeriod.endDate),
    fetchReport(config, REPORT_IDS.CANCELLATIONS, currentPeriod.startDate, currentPeriod.endDate),
    fetchReport(config, REPORT_IDS.MEMBERS_ON_HOLD, currentPeriod.startDate, currentPeriod.endDate),
    // Previous month - only need payments and members for ghost churn
    fetchReport(config, REPORT_IDS.ALL_PAYMENTS, previousPeriod.startDate, previousPeriod.endDate),
    fetchReport(config, REPORT_IDS.CURRENT_MEMBERS, previousPeriod.startDate, previousPeriod.endDate),
  ]);

  console.log(`[GymMaster API] Fetched successfully:`);
  console.log(`  Current: ${currentAllPayments.length} payments, ${currentStartingMemberships.length} starting, ${currentCurrentMembers.length} members, ${currentCancellations.length} cancellations, ${currentMembersOnHold.length} on hold`);
  console.log(`  Previous: ${previousAllPayments.length} payments, ${previousCurrentMembers.length} members`);

  return {
    current: {
      allPayments: currentAllPayments,
      startingMemberships: currentStartingMemberships,
      currentMembers: currentCurrentMembers,
      cancellations: currentCancellations,
      membersOnHold: currentMembersOnHold,
      period: currentPeriod,
    },
    previous: {
      allPayments: previousAllPayments,
      startingMemberships: [], // Not needed for previous month
      currentMembers: previousCurrentMembers,
      cancellations: [], // Not needed for previous month
      membersOnHold: [], // Not needed for previous month
      period: previousPeriod,
    },
  };
}

/**
 * Fetch reports and convert to CSV strings for existing parser compatibility
 */
export async function fetchKpiReportsAsCsv(
  year: number,
  month: number
): Promise<{
  current: {
    allPaymentsCsv: string;
    startingMembershipsCsv: string;
    currentMembersCsv: string;
    cancellationsCsv: string;
    membersOnHoldCsv: string;
    period: { startDate: string; endDate: string };
  };
  previous: {
    allPaymentsCsv: string;
    currentMembersCsv: string;
    period: { startDate: string; endDate: string };
  };
}> {
  const reports = await fetchKpiReports(year, month);

  return {
    current: {
      allPaymentsCsv: convertToCsv(reports.current.allPayments),
      startingMembershipsCsv: convertToCsv(reports.current.startingMemberships),
      currentMembersCsv: convertToCsv(reports.current.currentMembers),
      cancellationsCsv: convertToCsv(reports.current.cancellations),
      membersOnHoldCsv: convertToCsv(reports.current.membersOnHold),
      period: reports.current.period,
    },
    previous: {
      allPaymentsCsv: convertToCsv(reports.previous.allPayments),
      currentMembersCsv: convertToCsv(reports.previous.currentMembers),
      period: reports.previous.period,
    },
  };
}
