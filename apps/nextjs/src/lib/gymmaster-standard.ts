/**
 * The new GymMaster account's format is the standard for every report row the app reads
 * (decided with Tony 2026-11-05): new member numbers, names as "First Last", and payment
 * rows that carry their plan name next to the "Membership Category: ..." label so the plan
 * map (kpi/lib/plan-categories.ts) can sort them. Old-account rows are brought to this
 * shape once (the archive conversion) or, for November while the old account is still
 * live, on the way in. New-account rows pass through; they only get `_account` and, for
 * the members report, a "Member Name" built from the first and last name columns.
 *
 * A converted old row keeps its old number in `_oldMemberId`. Former members who never
 * joined the new account keep their old number (the two ranges don't overlap).
 */

export type ReportRow = Record<string, unknown>;

export interface OldRowContext {
  /** New-account member number for an old one, when the person moved over */
  newIdFor: (oldMemberId: string) => string | undefined;
  /** The member's plan in the month of a payment (from that month's members report) */
  planFor?: (oldMemberId: string, paymentDate: unknown) => string | undefined;
}

const text = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** "Last, First" -> "First Last"; anything without a comma is returned as is */
export function firstLast(name: unknown): string {
  const s = text(name).trim();
  const i = s.indexOf(",");
  if (i < 0) return s;
  const last = s.slice(0, i).trim();
  const first = s.slice(i + 1).trim();
  return [first, last].filter(Boolean).join(" ");
}

/** "Last, First" -> { first, last }; "First Last" -> last word is the last name */
export function splitName(name: unknown): { first: string; last: string } {
  const s = text(name).trim();
  const i = s.indexOf(",");
  if (i >= 0) return { last: s.slice(0, i).trim(), first: s.slice(i + 1).trim() };
  const parts = s.split(/\s+/).filter(Boolean);
  const last = parts.pop() ?? "";
  return parts.length ? { first: parts.join(" "), last } : { first: s, last: "" };
}

export const isStandardized = (row: ReportRow) => "_oldMemberId" in row;

/** Bring an old-account report row to the standard shape */
export function standardizeOldRow(reportId: number, row: ReportRow, ctx: OldRowContext): ReportRow {
  if (isStandardized(row)) return row;
  const oldId = text(row["Member ID"]);
  const newId = oldId ? ctx.newIdFor(oldId) : undefined;
  const out: ReportRow = { ...row, _account: "old", _oldMemberId: oldId || null };
  if (oldId) out["Member ID"] = Number(newId ?? oldId);

  for (const key of ["Name", "Member Name"]) {
    if (typeof row[key] === "string") out[key] = firstLast(row[key]);
  }
  if (reportId === 1 && typeof row["Member Name"] === "string") {
    const { first, last } = splitName(row["Member Name"]);
    out["Member First Name"] = first;
    out["Member Last Name"] = last;
  }
  if (reportId === 103 && text(row["Payment Details"]).startsWith("Membership Category:") && !("Membership-Type Name" in row)) {
    out["Membership-Type Name"] = ctx.planFor?.(oldId, row["Payment Date"]) ?? "";
  }
  return out;
}

/** Tag a new-account row; the members report also gets a "Member Name" */
export function standardizeNewRow(reportId: number, row: ReportRow): ReportRow {
  const out: ReportRow = { ...row, _account: "new" };
  if (reportId === 1 && !("Member Name" in row)) {
    out["Member Name"] = [text(row["Member First Name"]).trim(), text(row["Member Last Name"]).trim()].filter(Boolean).join(" ");
  }
  return out;
}
