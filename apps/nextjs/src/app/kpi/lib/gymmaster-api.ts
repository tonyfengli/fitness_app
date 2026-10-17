/**
 * GymMaster Report API V2 Client
 * Server-side only - do not import in client components
 */

// Report IDs from GymMaster
export const REPORT_IDS = {
  ALL_PAYMENTS: 103,
  NEW_MEMBERS: 116, // Was STARTING_MEMBERSHIPS (12), but 116 has correct columns for parser
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
  newMembers: ReportRow[];
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
 * Includes retry logic with exponential backoff for rate limiting
 */
async function fetchReport(
  config: GymMasterConfig,
  reportId: number,
  startDate: string,
  endDate: string,
  retryCount = 0
): Promise<ReportRow[]> {
  const url = `${config.baseUrl}/api/v2/report/standard_report`;
  const MAX_RETRIES = 3;

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

  // Handle rate limiting with retry
  if (response.status === 429 && retryCount < MAX_RETRIES) {
    const waitTime = Math.pow(2, retryCount + 1) * 2000; // 4s, 8s, 16s
    console.log(`[GymMaster API] Rate limited, waiting ${waitTime / 1000}s before retry ${retryCount + 1}/${MAX_RETRIES}...`);
    await new Promise(r => setTimeout(r, waitTime));
    return fetchReport(config, reportId, startDate, endDate, retryCount + 1);
  }

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
 * Normalize date from API format ("Sep 5 2026") to ISO format ("2026-09-05")
 * Also handles dates that are already in ISO format
 */
function normalizeDate(dateStr: string): string {
  if (!dateStr) return "";

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Convert "Sep 5 2026" or "Sep 15 2026" to "2026-09-05" or "2026-09-15"
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04",
    May: "05", Jun: "06", Jul: "07", Aug: "08",
    Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };

  const match = dateStr.match(/^(\w+)\s+(\d+)\s+(\d{4})$/);
  if (match) {
    const [, monthName, day, year] = match;
    const month = months[monthName!];
    if (month) {
      return `${year}-${month}-${day!.padStart(2, "0")}`;
    }
  }

  // Return original if we can't parse it
  return dateStr;
}

/**
 * Fields that contain dates and need normalization
 */
const DATE_FIELDS = [
  "Member Joining Date",
  "Membership Start Date",
  "Payment Date",
  "Date Hold Starts",
  "Date Hold Ends",
  "Date Created",
  "Cancellation Date",
  "Date Cancelled",
];

/**
 * Normalize dates in a row for parser compatibility
 */
function normalizeDatesInRow(row: Record<string, string>): Record<string, string> {
  const result = { ...row };
  for (const field of DATE_FIELDS) {
    if (result[field]) {
      result[field] = normalizeDate(result[field]);
    }
  }
  return result;
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
    // Normalize dates to YYYY-MM-DD format for parser compatibility
    const withDates = normalizeDatesInRow(normalized);
    const values = headers.map((header) => {
      const value = withDates[header] || "";
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
 * Fetches current month, previous month (X-1), and month X-2 for new member calculation
 */
export async function fetchKpiReports(
  year: number,
  month: number
): Promise<{
  current: FetchReportsResult;
  previous: FetchReportsResult;
  previous2: { allPayments: ReportRow[]; period: { startDate: string; endDate: string } };
}> {
  const config = getConfig();

  // Calculate date ranges
  const currentPeriod = getMonthDateRange(year, month);

  // Previous month (X-1)
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  const previousPeriod = getMonthDateRange(prevYear, prevMonth);

  // Month X-2 (for new member calculation)
  let prev2Year = prevYear;
  let prev2Month = prevMonth - 1;
  if (prev2Month < 1) {
    prev2Month = 12;
    prev2Year = prevYear - 1;
  }
  const previous2Period = getMonthDateRange(prev2Year, prev2Month);

  console.log(`[GymMaster API] Fetching reports for ${year}-${month}`);
  console.log(`  Current period: ${currentPeriod.startDate} to ${currentPeriod.endDate}`);
  console.log(`  Previous period (X-1): ${previousPeriod.startDate} to ${previousPeriod.endDate}`);
  console.log(`  Previous period (X-2): ${previous2Period.startDate} to ${previous2Period.endDate}`);

  // Fetch all reports for all periods in parallel
  const [
    currentAllPayments,
    currentNewMembers,
    currentCurrentMembers,
    currentCancellations,
    currentMembersOnHold,
    previousAllPayments,
    previousCurrentMembers,
    previousMembersOnHold,
    previous2AllPayments,
  ] = await Promise.all([
    // Current month - all 5 reports
    fetchReport(config, REPORT_IDS.ALL_PAYMENTS, currentPeriod.startDate, currentPeriod.endDate),
    fetchReport(config, REPORT_IDS.NEW_MEMBERS, currentPeriod.startDate, currentPeriod.endDate),
    fetchReport(config, REPORT_IDS.CURRENT_MEMBERS, currentPeriod.startDate, currentPeriod.endDate),
    fetchReport(config, REPORT_IDS.CANCELLATIONS, currentPeriod.startDate, currentPeriod.endDate),
    fetchReport(config, REPORT_IDS.MEMBERS_ON_HOLD, currentPeriod.startDate, currentPeriod.endDate),
    // Previous month (X-1) - payments, members, and on hold for lost member calculation
    fetchReport(config, REPORT_IDS.ALL_PAYMENTS, previousPeriod.startDate, previousPeriod.endDate),
    fetchReport(config, REPORT_IDS.CURRENT_MEMBERS, previousPeriod.startDate, previousPeriod.endDate),
    fetchReport(config, REPORT_IDS.MEMBERS_ON_HOLD, previousPeriod.startDate, previousPeriod.endDate),
    // Month X-2 - only payments for new member calculation
    fetchReport(config, REPORT_IDS.ALL_PAYMENTS, previous2Period.startDate, previous2Period.endDate),
  ]);

  console.log(`[GymMaster API] Fetched successfully:`);
  console.log(`  Current: ${currentAllPayments.length} payments, ${currentNewMembers.length} new members, ${currentCurrentMembers.length} members, ${currentCancellations.length} cancellations, ${currentMembersOnHold.length} on hold`);
  console.log(`  Previous (X-1): ${previousAllPayments.length} payments, ${previousCurrentMembers.length} members, ${previousMembersOnHold.length} on hold`);
  console.log(`  Previous (X-2): ${previous2AllPayments.length} payments`);

  return {
    current: {
      allPayments: currentAllPayments,
      newMembers: currentNewMembers,
      currentMembers: currentCurrentMembers,
      cancellations: currentCancellations,
      membersOnHold: currentMembersOnHold,
      period: currentPeriod,
    },
    previous: {
      allPayments: previousAllPayments,
      newMembers: [], // Not needed for previous month
      currentMembers: previousCurrentMembers,
      cancellations: [], // Not needed for previous month
      membersOnHold: previousMembersOnHold,
      period: previousPeriod,
    },
    previous2: {
      allPayments: previous2AllPayments,
      period: previous2Period,
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
    newMembersCsv: string;
    currentMembersCsv: string;
    cancellationsCsv: string;
    membersOnHoldCsv: string;
    period: { startDate: string; endDate: string };
  };
  previous: {
    allPaymentsCsv: string;
    currentMembersCsv: string;
    membersOnHoldCsv: string;
    period: { startDate: string; endDate: string };
  };
  previous2: {
    allPaymentsCsv: string;
    period: { startDate: string; endDate: string };
  };
}> {
  const reports = await fetchKpiReports(year, month);

  return {
    current: {
      allPaymentsCsv: convertToCsv(reports.current.allPayments),
      newMembersCsv: convertToCsv(reports.current.newMembers),
      currentMembersCsv: convertToCsv(reports.current.currentMembers),
      cancellationsCsv: convertToCsv(reports.current.cancellations),
      membersOnHoldCsv: convertToCsv(reports.current.membersOnHold),
      period: reports.current.period,
    },
    previous: {
      allPaymentsCsv: convertToCsv(reports.previous.allPayments),
      currentMembersCsv: convertToCsv(reports.previous.currentMembers),
      membersOnHoldCsv: convertToCsv(reports.previous.membersOnHold),
      period: reports.previous.period,
    },
    previous2: {
      allPaymentsCsv: convertToCsv(reports.previous2.allPayments),
      period: reports.previous2.period,
    },
  };
}
