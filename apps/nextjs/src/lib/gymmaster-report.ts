/**
 * GymMaster standard reports (server-side). Report 1 fetched over a date range includes
 * members who have since left, with plan, start/end dates and last visit.
 */

import { readGymMasterRows } from "./gymmaster-sources";

export type GymMasterRow = Record<string, unknown>;

export const GYMMASTER_REPORTS = {
  MEMBERS: 1, // "Membership Type Name", "Membership Start Date", "Membership End Date", "Last Visit Date", ...
  ON_HOLD: 314,
  BOOKINGS: 9,
  PAYMENTS: 103, // "Payment Date", "Payment Amount", "Payment Details", "Member ID", ...
} as const;

/**
 * Rows of a GymMaster standard report for a date range (end inclusive), across both
 * accounts of the Nov 2026 move: see gymmaster-sources.ts for which account serves which
 * dates. Rows keep the old account's columns; `_account` says where each came from.
 */
export async function fetchGymMasterReport(reportId: number, startDate: string, endDate: string): Promise<GymMasterRow[]> {
  return readGymMasterRows(reportId, startDate, endDate);
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
