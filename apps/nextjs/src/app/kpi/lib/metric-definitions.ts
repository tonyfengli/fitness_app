/**
 * KPI metric definitions and the founders' judgment lines: one source for what each
 * number means and when it's good or worrying. Read by the Overview (colors, labels)
 * and the agent routes (so the Slack bot judges numbers the same way).
 *
 * Settled with Tony in the dashboard walkthrough (Overview, 2026-11-03); notes in
 * ai-crew/docs/WALKTHROUGH-NOTES.md. Change a line here, not in components or prompts.
 */

export type Band = "good" | "watch" | "act";

/** The founders' manual adjustments (exclusions, includes, manual losses, linked accounts) override the automatic rules. */
export const ADJUSTMENTS_WIN =
  "Founders' manual adjustments on the KPI dashboard (exclusions, includes, manual losses, linked accounts) override the automatic rules; numbers are reported after them.";

export const THRESHOLDS = {
  /** New members per month: 5 is healthy */
  newMembersHealthy: 5,
  /** Monthly churn %: under 7 fine, 7 to under 10 watch, 10+ (double digits) act */
  churnWatch: 7,
  churnAct: 10,
  /** ARM (Classes): $125–130 is not bad; watch for drops below it */
  armClassesLow: 125,
  armClassesGood: 130,
} as const;

export function churnBand(ratePct: number): Band {
  if (ratePct >= THRESHOLDS.churnAct) return "act";
  if (ratePct >= THRESHOLDS.churnWatch) return "watch";
  return "good";
}

/** Colors for churn bands (charts) */
export const CHURN_BAND_COLOR: Record<Band, string> = { good: "#22c55e", watch: "#f97316", act: "#dc2626" };

export function newMembersBand(count: number): Band {
  return count >= THRESHOLDS.newMembersHealthy ? "good" : "watch";
}

export function armClassesBand(arm: number): Band {
  return arm >= THRESHOLDS.armClassesLow ? "good" : "watch";
}

/** One line a person or the bot can read, e.g. "3.0%: fine (under 7%)" */
export function churnJudgment(ratePct: number): string {
  const band = churnBand(ratePct);
  if (band === "act") return `act: ${THRESHOLDS.churnAct}% or more`;
  if (band === "watch") return `watch: ${THRESHOLDS.churnWatch}–${THRESHOLDS.churnAct}%`;
  return `fine: under ${THRESHOLDS.churnWatch}%`;
}

export function newMembersJudgment(count: number): string {
  return count >= THRESHOLDS.newMembersHealthy
    ? `healthy: ${THRESHOLDS.newMembersHealthy}+ a month`
    : `below the ${THRESHOLDS.newMembersHealthy}/month healthy line`;
}

export function armClassesJudgment(arm: number): string {
  if (arm >= THRESHOLDS.armClassesGood) return `good: $${THRESHOLDS.armClassesGood}+`;
  if (arm >= THRESHOLDS.armClassesLow) return `not bad: $${THRESHOLDS.armClassesLow}–${THRESHOLDS.armClassesGood}`;
  return `below $${THRESHOLDS.armClassesLow}: a drop to look into`;
}

export const METRICS = {
  newMembers: {
    label: "New members",
    definition:
      "Net positive payment (membership or PT) this month and no payment last month: comebacks and returns from hold count as new. Then founder adjustments.",
  },
  lostMembers: {
    label: "Lost / on hold",
    definition:
      "Paid in either of the last 2 months, no payment this month, not on GymMaster's current-members list; going on hold counts as lost. Then founder adjustments (manual losses, exclusions, linked accounts).",
  },
  cameBack: {
    label: "Came back",
    definition:
      "A lost member is back only if the founders count them as a new member again (after exclusions). Payments after leaving that are admin-error charges or hold penalties are not returns; the founders exclude them.",
  },
  members: {
    label: "Members",
    definition:
      "Running total from January 2026 (never restarts): January's paying members, then + new − lost each month. PT-only clients count; free members are excluded by the founders.",
  },
  churn: {
    label: "Churn",
    definition: "Lost ÷ last month's members. Holds count as churn. No figure for the first month of a range.",
  },
  gymmasterRevenue: {
    label: "GymMaster revenue",
    definition:
      "All money collected in GymMaster in the month, by payment date (cash basis): memberships, PT, other (day passes, fees, retail), net of refunds. True total revenue, including Venmo/Zelle, comes from QuickBooks.",
  },
  revenueSources: {
    label: "Revenue by source",
    definition:
      "PT = payments GymMaster categorizes as Personal Training. Open Gym = membership payments where the member's current plan name contains 'open gym'. Classes = all other membership payments. Other (net of refunds) = everything else (day passes, fees, retail) minus uncategorized refunds; shown only when not $0. Other and refunds are also saved separately for investigations.",
  },
  arm: {
    label: "ARM (All)",
    definition: "GymMaster revenue ÷ members (the running total).",
  },
  armClasses: {
    label: "ARM (Classes)",
    definition: "Classes revenue ÷ members who paid for a class plan that month (Open Gym excluded).",
  },
} as const;
