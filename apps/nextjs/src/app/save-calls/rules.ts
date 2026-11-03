// Rules shared by the Retention dashboard and the /api/agent routes, so the
// dashboard and the Slack bot flag the same members.

import type { MilestoneRow, PaymentRow } from "./types";

// Who to celebrate now, and who to get ready for
export const JUST_HIT_DAYS = 14;
export const COMING_UP_WITHIN = 3;

function daysAgo(s: string) {
  return Math.round((Date.now() - new Date(s + "T12:00:00").getTime()) / 864e5);
}

// Most recent milestone, if it was reached within the celebration window
export function latestRecentMilestone(m: MilestoneRow) {
  const last = m.reached[m.reached.length - 1];
  return last && daysAgo(last.date) <= JUST_HIT_DAYS ? last : null;
}

export function milestoneGroups(members: MilestoneRow[]) {
  const recentDate = (m: MilestoneRow) => latestRecentMilestone(m)?.date ?? "";
  const justHit = members
    .filter(m => latestRecentMilestone(m))
    .sort((a, b) => recentDate(b).localeCompare(recentDate(a)) || a.name.localeCompare(b.name));
  const comingUp = members
    .filter(m => !latestRecentMilestone(m) && m.classes > 0 && m.toGo <= COMING_UP_WITHIN)
    .sort((a, b) => a.toGo - b.toGo || b.classes - a.classes);
  return { justHit, comingUp };
}

// An expired card alone isn't a problem while the member is paid up; no card at all is
export const hasNoCard = (m: PaymentRow) => m.cardStatus === "none";
export const hasUnrecoveredFailure = (m: PaymentRow) => m.ledger.some(l => l.failed.some(f => !f.recovered));
export const needsAttention = (m: PaymentRow) => m.owed > 0 || hasNoCard(m) || hasUnrecoveredFailure(m) || m.billingGaps.length > 0;
