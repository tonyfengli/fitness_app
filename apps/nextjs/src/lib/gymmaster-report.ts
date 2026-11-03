/**
 * GymMaster standard reports (server-side). Report 1 fetched over a date range includes
 * members who have since left, with plan, start/end dates and last visit.
 */

export type GymMasterRow = Record<string, unknown>;

export const GYMMASTER_REPORTS = {
  MEMBERS: 1, // "Membership Type Name", "Membership Start Date", "Membership End Date", "Last Visit Date", ...
  ON_HOLD: 314,
  BOOKINGS: 9,
  PAYMENTS: 103, // "Payment Date", "Payment Amount", "Payment Details", "Member ID", ...
} as const;

export async function fetchGymMasterReport(reportId: number, startDate: string, endDate: string): Promise<GymMasterRow[]> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing GymMaster configuration");

  const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": apiKey },
    body: JSON.stringify({ report_id: reportId, start_date: startDate, end_date: endDate }),
  });
  if (!response.ok) throw new Error(`GymMaster API error: ${response.status}`);
  const data = (await response.json()) as { result?: GymMasterRow[] };
  return data.result ?? [];
}

/** GymMaster dates look like "Jun 5 2026"; returns null when missing or unreadable */
export function parseGymMasterDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d;
  const parts = /(\w+)\s+(\d+)\s+(\d+)/.exec(value);
  if (!parts) return null;
  const d2 = new Date(`${parts[1]} ${parts[2]}, ${parts[3]}`);
  return isNaN(d2.getTime()) ? null : d2;
}

export const gymMasterAmount = (value: unknown) =>
  parseFloat(String(value ?? "0").replace(/[$,]/g, "")) || 0;
