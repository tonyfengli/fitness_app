/**
 * Shared wording for the snapshot-based agent routes (monthly-summary, churned-members),
 * so every answer the bot gives says how final its numbers are.
 */

const TIME_ZONE = "America/Los_Angeles";

/** How lost/new counts are derived until the metric definitions are settled with the dashboard. */
export const SNAPSHOT_COUNT_CAVEAT =
  "Lost and new counts exclude members the founders marked as excluded. Manual losses and linked accounts are not applied yet, so the dashboard Overview can differ.";

/** One line on how final a month's snapshot is: finalized, the open month, or a closed month not yet reviewed. */
export function monthStatusNote(status: string, month: number, year: number, now = new Date()): string {
  if (status === "finalized") return "Finalized: month closed and reviewed by the founders.";

  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  if (get("year") === year && get("month") === month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    return `Open month: data through day ${get("day")} of ${daysInMonth}, before founder review. Counts can change at close, when exclusions are applied.`;
  }
  return "Not finalized: the month has ended but the founders haven't reviewed it yet. Numbers may change.";
}
