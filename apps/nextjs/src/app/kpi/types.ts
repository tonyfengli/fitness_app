// KPI Dashboard Types

export interface TemplateData {
  // Financial Stats
  quickbooksRevenue: string;
  openGymRevenue: string;
  ptRevenue: string;
  sportsPerfRevenue: string;
  smallGrpRevenue: string;
  remoteRevenue: string;
  icRevenue: string;
  dayPass: string;
  accessPass: string;
  packs: string;
  bookingFees: string;
  nsfFees: string;
  maintenanceFee: string;
  otherFees: string;
  retailRevenue: string;
  signUpFees: string;
  classPass: string;

  // Membership Stats
  newMembersCount: string;
  newPtClientsCount: string;
  newPtClientsRevenue: string;
  lostMembers: string;
  totalMembers: string;
  // Revenue by category (for membership stats section)
  msOpenGymRevenue: string;
  msPtRevenue: string;
  msSportsPerfRevenue: string;
  msRemoteRevenue: string;
  msAmbassador: string;
  msIc: string;
  // ARM calculations
  totalArm: string;
  armOpenGym: string;
  armPt: string;
  armSport: string;
  armSmallGrp: string;
  armRemote: string;
  armIc: string;
  // Other metrics
  averageChurn: string;
  retention: string;
  leg: string;
  ltv: string;

  // Sales & Marketing
  totalLeads: string;
  totalAdSpend: string;
  frontEndRevenue: string;
  signUpFeesMarketing: string;

  // All Payments Report
  allPaymentsProcessed: string;
  taxPaid: string;

  // Numbers for Taxes
  ptMembershipSales: string;
  retailSales: string;
  tax: string;

  // Retention
  freezeCount: string;
  freezeLost: string;
  cancelledCount: string;
  cancelledLost: string;
  changesCount: string;
  changesLost: string;

  // Discount Codes
  discountTimesUsed: string;
  discountStaffMember: string;
}

export interface MemberRecord {
  memberId: string;
  name: string;
  amount: number;
}

export interface LostMemberRecord extends MemberRecord {
  type: "loss" | "hold";
}

export interface MonthData {
  month: string;
  year: number;
  monthKey: string; // e.g., "2026-04" for localStorage keys
  ptRevenue: number;
  smallGroupRevenue: number;
  totalRevenue: number;
  totalMembers: number; // Raw count from payments (used as anchor for month 1)
  arm: number;
  groupRevenue: number;
  groupMembers: number;
  armGroups: number;
  newMembers: MemberRecord[];
  newMembersCount: number;
  newMembersRevenue: number;
  // Separate group/PT new member counts for Elev8 HQ
  newGroupMembersCount: number;
  newGroupMembersRevenue: number;
  newPtClientsCount: number;
  newPtClientsRevenue: number;
  lostMembers: LostMemberRecord[];
  lostMembersCount: number;
  lostMembersRevenue: number;
  // Separate group/PT lost member counts for Elev8 HQ
  lostGroupCount: number;
  lostGroupRevenue: number;
  lostPtCount: number;
  lostPtRevenue: number;
  onHoldMembers: MemberRecord[];
  onHoldCount: number;
  onHoldRevenue: number;
  payingMembers: MemberRecord[];
}

// Override structure for localStorage
export interface MonthOverrides {
  excludeFromNew: string[]; // member IDs
  excludeFromLost: string[]; // member IDs
}

export interface AllOverrides {
  [monthKey: string]: MonthOverrides;
}

// Structure for persisted report data
export interface PersistedReportData {
  monthsData: MonthData[];
  startMonth: number;
  endMonth: number;
  year: number;
  savedAt: string; // ISO timestamp
}

// Structure for persisted P&L data
export interface PersistedPnLData {
  monthsData: PnLMonthData[];
  startMonth: number;
  endMonth: number;
  year: number;
  savedAt: string; // ISO timestamp
}

// P&L Tab types
export interface PnLMonthData {
  month: string;
  year: number;
  monthNum: number;
  income: number;
  expenses: number;
  netIncome: number;
}

export interface StripeMonthData {
  month: string;
  year: number;
  grossAmount: number;
  fees: number;
  netAmount: number;
  chargeCount: number;
  refunds: number;
}

// Administrative Tab types
export interface RefundPaymentHistory {
  month: string;
  monthKey: string;
  expected: number;
  paid: number;      // Gross amount paid (before refunds)
  refunded: number;  // Refund amount for this month (0 if none)
  actual: number;    // Net amount (paid - refunded)
}

export interface GymMasterRefund {
  memberId: string;
  memberName: string;
  refundDate: string;
  refundAmount: number;
  reason: string;
  status: "on_track" | "needs_review";
  paymentMethod: string;
  isNonStripeAdjustment: boolean; // True if "No Payment / Adjustment" - not an actual Stripe refund
  paymentHistory: RefundPaymentHistory[];
}

export interface UnmatchedRefund {
  source: "gymmaster" | "stripe";
  date: string;
  amount: number;
  name: string;
  paymentMethod?: string;
  isAdjustment?: boolean;
  reason?: string;
}

export interface MonthlyReconciliation {
  month: string;
  monthKey: string; // "YYYY-MM" format for filtering
  gymMasterTotal: number; // Excludes "No Payment / Adjustment" entries
  gymMasterCount: number;
  stripeTotal: number;
  stripeCount: number;
  variance: number;
  status: "reconciled" | "variance";
  unmatchedRefunds: UnmatchedRefund[];
  // "No Payment / Adjustment" entries (not actual Stripe refunds)
  adjustmentsTotal: number;
  adjustmentsCount: number;
}

export interface UnmatchedStripeRefund {
  refundId: string;
  date: string;
  amount: number;
  customerEmail: string | null;
  billingName: string | null;
}

export interface AdminRefundsData {
  year: number;
  summary: {
    totalRefunds: number;
    totalGymMasterAmount: number;
    totalStripeAmount: number;
    totalVariance: number;
    needsReviewCount: number;
    onTrackCount: number;
    reconciledMonths: number;
    totalMonths: number;
    // Adjustment stats ("No Payment / Adjustment" entries)
    adjustmentsCount: number;
    adjustmentsAmount: number;
    // Regular GymMaster total (for reconciliation)
    regularGymMasterAmount: number;
  };
  monthlyReconciliation: MonthlyReconciliation[];
  refunds: GymMasterRefund[];
  unmatchedStripeRefunds: UnmatchedStripeRefund[];
}
