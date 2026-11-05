import * as Papa from "papaparse";

import { paymentKind } from "./plan-categories";

// Memberships are sorted by the plan map (plan-categories.ts): Group -> small_grp, Open Gym, PT.
// Everything else (products, fees, refund entries) is unmapped here and handled by the callers.

// No exclusions - let refunds net out naturally
// "Refunded" (+$65.27) + "Payment Refund (Debit Note)" (-$65.27) = $0
const EXCLUDE_PATTERNS: string[] = [];

export type CategoryKey =
  | "open_gym"
  | "pt"
  | "sports_perf"
  | "small_grp"
  | "remote"
  | "ic"
  | "day_pass"
  | "access_pass"
  | "packs"
  | "booking_fees"
  | "nsf_fees"
  | "maintenance_fee"
  | "other_fees"
  | "retail"
  | "sign_up_fees"
  | "unmapped";

export type CategoryTotals = Record<CategoryKey, number>;

export interface AllPaymentsRow {
  "Payment Date": string;
  Name: string;
  "Payment Origin": string;
  "Payment Details": string;
  "Membership-Type Name"?: string;
  "Payment Method": string;
  "Payment Amount": string;
  "Payment Note": string;
  "Member ID": string;
}

export interface MemberPayment {
  memberId: string;
  name: string;
  totalPaid: number;
}

export interface ParseResult {
  totals: CategoryTotals;
  totalPayments: number; // Net (gross - refunds)
  grossPayments: number; // All positive amounts
  totalRefunds: number; // All negative amounts (absolute value)
  rowCount: number;
  unmappedDetails: string[];
  errors: string[];
  memberPayments: MemberPayment[];
}

export function parseAllPayments(csvContent: string): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const totals: CategoryTotals = {
      open_gym: 0,
      pt: 0,
      sports_perf: 0,
      small_grp: 0,
      remote: 0,
      ic: 0,
      day_pass: 0,
      access_pass: 0,
      packs: 0,
      booking_fees: 0,
      nsf_fees: 0,
      maintenance_fee: 0,
      other_fees: 0,
      retail: 0,
      sign_up_fees: 0,
      unmapped: 0,
    };

    const unmappedDetails = new Set<string>();
    const errors: string[] = [];
    let totalPayments = 0;
    let grossPayments = 0;
    let totalRefunds = 0;
    let rowCount = 0;

    // Track payments by member
    const memberPaymentsMap = new Map<string, { name: string; total: number }>();

    Papa.parse<AllPaymentsRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        for (const row of results.data) {
          rowCount++;

          const paymentDetails = row["Payment Details"] || "";
          const amountStr = row["Payment Amount"] || "0";
          const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, "")) || 0;
          const memberId = row["Member ID"] || "";
          const memberName = row["Name"] || "";

          // Skip excluded patterns
          if (EXCLUDE_PATTERNS.some((p) => paymentDetails.includes(p))) {
            continue;
          }

          // Track gross vs refunds
          if (amount >= 0) {
            grossPayments += amount;
          } else {
            totalRefunds += Math.abs(amount);
          }

          // Add to total (including negative amounts for refunds)
          totalPayments += amount;

          // Track member payments
          if (memberId) {
            const existing = memberPaymentsMap.get(memberId);
            if (existing) {
              existing.total += amount;
            } else {
              memberPaymentsMap.set(memberId, { name: memberName, total: amount });
            }
          }

          // Map to category
          const kind = paymentKind({ ...row });
          let mapped = false;
          if (kind.kind === "membership" && kind.member && kind.bucket !== "other") {
            totals[kind.bucket === "group" ? "small_grp" : kind.bucket] += amount;
            mapped = true;
          }

          if (!mapped && amount !== 0) {
            totals.unmapped += amount;
            if (paymentDetails) {
              unmappedDetails.add(paymentDetails);
            }
          }
        }

        // Convert member payments map to sorted array (highest payer first)
        // Only include members with positive NET payment (excludes fully refunded members)
        const memberPayments: MemberPayment[] = Array.from(memberPaymentsMap.entries())
          .filter(([_, data]) => data.total > 0)
          .map(([memberId, data]) => ({
            memberId,
            name: data.name,
            totalPaid: data.total,
          }))
          .sort((a, b) => b.totalPaid - a.totalPaid);

        resolve({
          totals,
          totalPayments,
          grossPayments,
          totalRefunds,
          rowCount,
          unmappedDetails: Array.from(unmappedDetails),
          errors,
          memberPayments,
        });
      },
      error: (error: Error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}

// Helper to format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// Category labels for display
export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  open_gym: "Open Gym Revenue",
  pt: "PT Revenue",
  sports_perf: "Sports Perf. Revenue",
  small_grp: "Small Grp Revenue",
  remote: "Remote Revenue",
  ic: "IC",
  day_pass: "Day Pass",
  access_pass: "Access Pass",
  packs: "Packs (Class/Training/OG)",
  booking_fees: "Booking Fees",
  nsf_fees: "NSF Fees",
  maintenance_fee: "Maintenance Fee",
  other_fees: "Other Fees",
  retail: "Retail Revenue",
  sign_up_fees: "Sign Up/Upfront Fees",
  unmapped: "Unmapped",
};
