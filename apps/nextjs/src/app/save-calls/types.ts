/**
 * Types for the Save Calls dashboard
 * Tracks retention specialist's daily call activities
 */

export type CallBlockStatus = "past_due" | "nothing_due" | "to_do" | "deadline_soon";
export type AtRiskTier = "Best odds" | "Fading" | "Long shot" | "Critical";

export interface CallBlock {
  id: string;
  title: string;
  timeLabel: string; // "Already late", "2pm to 2:30pm", "by Fri 8pm"
  description: string;
  count: number;
  total: number;
  doneCount: number;
  status: CallBlockStatus;
  members?: MemberCallItem[];
}

export interface WeeklyVisits {
  week0: number; // current week
  week1: number;
  week2: number;
  week3: number;
  week4: number;
}

export interface MemberCallItem {
  memberId: string;
  name: string;
  membershipType: string;
  monthlyRate: number;
  paidBy?: string | null; // another member pays for their membership
  tenureMonths: number;
  daysGone: number;
  tier: AtRiskTier;
  phone: string | null;
  touchCount: number;
  lastTouchType: string | null; // "call + VM + text"
  lastTouchDate: string | null;
  callDueDate: string | null; // "1d ago", "today"
  lastAttemptResult: string | null; // "No answer, 2d ago"
  frequencyInfo?: string; // For slowing/below-healthy: "50% drop (2.5 → 1.2/wk)"
  planPrice?: string | null; // GymMaster plan price per month, e.g. "$148/mo"
  onboarding?: { daysUncontacted: number }; // New members tab: replaces days gone + tier
  weeklyVisits?: WeeklyVisits; // For expandable detail view
  totalVisits?: number; // Total visits in weeks 0-3
}

export interface DayStats {
  liveConversations: number;
  liveConversationsGoal: number;
  touches: number;
  booked: number;
  swipedBackIn: number;
}

export interface WeeklyGoal {
  target: number;
  current: number;
  deadline: string;
  behindPace: number | null; // e.g., 12 means "behind pace (12)"
}

export interface SaveCallsDayData {
  date: string;
  dayOfWeek: string; // "Thursday"
  owner: string;
  blocks: CallBlock[];
  stats: DayStats;
  weeklyGoal: WeeklyGoal;
}

// Status display config
export const STATUS_CONFIG: Record<CallBlockStatus, {
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}> = {
  past_due: {
    label: "Past due",
    textColor: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-l-red-500",
    dotColor: "bg-red-500"
  },
  nothing_due: {
    label: "Nothing due",
    textColor: "text-gray-500",
    bgColor: "bg-gray-50",
    borderColor: "border-l-gray-300",
    dotColor: "bg-gray-400"
  },
  to_do: {
    label: "To do",
    textColor: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-l-green-500",
    dotColor: "bg-green-500"
  },
  deadline_soon: {
    label: "Deadline soon",
    textColor: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-l-yellow-500",
    dotColor: "bg-yellow-500"
  },
};

export const TIER_CONFIG: Record<AtRiskTier, {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  "Best odds": {
    label: "Best odds",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
    borderColor: "border-l-green-500",
  },
  "Fading": {
    label: "Fading",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-700",
    borderColor: "border-l-yellow-500",
  },
  "Long shot": {
    label: "Long shot",
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
    borderColor: "border-l-orange-500",
  },
  "Critical": {
    label: "Critical",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
    borderColor: "border-l-red-500",
  },
};

// Payments tab: one billing row per paying member (from /api/agent/payments)
export interface PaymentCharge {
  date: string; // YYYY-MM-DD
  amount: number;
}

export interface PaymentFailure {
  date: string; // YYYY-MM-DD
  amount: number;
  reason: string; // "insufficient funds", "card declined", ...
  recovered: boolean; // a payment landed within 21 days after
}

// A billing date that came in under the member's usual charge (GymMaster doesn't count these as owed)
export interface BillingGap {
  date: string; // scheduled billing date, YYYY-MM-DD
  kind: "short" | "missed";
  expected: number; // what the member usually pays per billing
  charged: number; // what was actually charged around that date
  chargedOn: string | null; // date of that charge, null when missed
}

export interface PaymentRow {
  memberId: string;
  name: string;
  phone: string | null;
  plan: string;
  price: string;
  feeCharged: string;
  frequency: string;
  startDate: string;
  nextCharge: string;
  owed: number;
  ledger: { month: string; charges: PaymentCharge[]; failed: PaymentFailure[] }[]; // "YYYY-MM", oldest first
  billingGaps: BillingGap[];
  planPrice: string | null; // GymMaster plan price per month, e.g. "$148/mo"
  paidBy: { memberId: string; name: string } | null; // another member's card pays for this membership
  card: string;
  cardStatus: "ok" | "expired" | "none" | "wallet" | "unknown"; // unknown: Stripe lookup failed
  cardLastCharged: string;
}

// Milestones tab: attended-class count per member (from /api/agent/milestones)
export interface MilestoneRow {
  memberId: string;
  name: string;
  plan: string;
  planPrice: string | null; // GymMaster plan price per month
  phone: string | null;
  classes: number; // attended since counting started (Aug 1, 2026)
  reached: { milestone: number; date: string }[]; // oldest first; date = day of that class
  next: number;
  toGo: number;
  perWeek: number; // average classes per week since counting started
  lastClass: string | null;
}
