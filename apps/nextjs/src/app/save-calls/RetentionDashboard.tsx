"use client";

/**
 * Retention dashboard: the call lists (at-risk & low frequency, new members),
 * payments and milestones. Rendered as the KPI dashboard's Retention tab.
 * Summary cards at the top double as the navigation between the four views;
 * each view loads on its own so a slow one (payments) doesn't hold up the rest.
 */

import { useState, useEffect, useCallback } from "react";
import {
  MemberList,
  PaymentsTable,
  MilestonesTable,
  needsAttention,
  milestoneGroups,
  COMING_UP_WITHIN,
} from "./components";
import { CallBlock, MemberCallItem, AtRiskTier, PaymentRow, MilestoneRow } from "./types";

export type RetentionView = "at-risk" | "new-members" | "payments" | "milestones";
export const RETENTION_VIEWS: RetentionView[] = ["at-risk", "new-members", "payments", "milestones"];

// API response types
interface WeeklyVisitsApi {
  week0: number;
  week1: number;
  week2: number;
  week3: number;
  week4: number;
}

interface AtRiskApiMember {
  memberId: string;
  name: string;
  daysGone: number;
  lastAttendance: string | null;
  lastAttendanceTime: string | null;
  statusTier: string;
  returnRate: number;
  monthlyRevenue: number;
  paidBy?: string | null;
  planPrice?: string | null;
  lastClass: string | null;
  memberSince: string | null;
  membershipType: string | null;
  phone: string | null;
  tenureMonths: number;
  weeklyVisits?: WeeklyVisitsApi;
  totalVisits?: number;
}

interface NewMemberApiMember {
  memberId: string;
  name: string;
  membershipType: string | null;
  membershipFee: number;
  memberSince: string;
  daysSinceJoin: number;
  daysSinceSignup: number;
  planPrice: string | null;
  phone: string | null;
  onboardedOn: string | null;
}

interface FrequencyAlertMember {
  memberId: string;
  name: string;
  alertType: "slowing" | "below_healthy" | "new_member_risk";
  membershipType: string | null;
  planPrice?: string | null;
  phone: string | null;
  tenureWeeks: number;
  baselineVisitsPerWeek: number | null;
  recentVisitsPerWeek: number;
  dropPercent: number | null;
  recentVisits: number;
  baselineVisits: number | null;
  weeklyVisits?: WeeklyVisitsApi;
}

// Convert API member to UI format
function apiMemberToCallItem(member: AtRiskApiMember): MemberCallItem {
  return {
    memberId: member.memberId,
    name: member.name,
    membershipType: member.membershipType || "Unknown",
    monthlyRate: member.monthlyRevenue,
    paidBy: member.paidBy ?? null,
    planPrice: member.planPrice ?? null,
    tenureMonths: member.tenureMonths,
    daysGone: member.daysGone,
    tier: member.statusTier as AtRiskTier,
    phone: member.phone,
    touchCount: 0, // No call logging yet
    lastTouchType: null,
    lastTouchDate: null,
    callDueDate: null,
    lastAttemptResult: null,
    weeklyVisits: member.weeklyVisits,
    totalVisits: member.totalVisits,
  };
}

function newMemberToCallItem(member: NewMemberApiMember): MemberCallItem {
  return {
    memberId: member.memberId,
    name: member.name,
    membershipType: member.membershipType || "Unknown",
    monthlyRate: member.membershipFee,
    tenureMonths: 0,
    daysGone: 0,
    tier: "Best odds",
    phone: member.phone,
    touchCount: 0,
    lastTouchType: null,
    lastTouchDate: null,
    callDueDate: null,
    lastAttemptResult: null,
    // No call logging yet, so days without contact = days since sign-up
    planPrice: member.planPrice,
    onboarding: { daysUncontacted: member.daysSinceSignup, onboardedOn: member.onboardedOn },
  };
}

function frequencyAlertToCallItem(member: FrequencyAlertMember): MemberCallItem & { frequencyInfo: string } {
  // Build frequency info string for display
  let frequencyInfo = "";
  if (member.alertType === "slowing") {
    // "Was 3x/wk → now 1x/wk (67% drop)"
    const wasPerWeek = Math.round(member.baselineVisitsPerWeek || 0);
    const nowPerWeek = Math.round(member.recentVisitsPerWeek);
    frequencyInfo = `Was ${wasPerWeek}x/wk → now ${nowPerWeek}x/wk`;
  } else if (member.alertType === "below_healthy") {
    // "3 visits in 4 weeks"
    const visits = member.recentVisits;
    if (visits === 0) {
      frequencyInfo = "No visits in 4 weeks";
    } else if (visits === 1) {
      frequencyInfo = "Only 1 visit in 4 weeks";
    } else {
      frequencyInfo = `Only ${visits} visits in 4 weeks`;
    }
  } else {
    frequencyInfo = `${member.recentVisits} visits in ${Math.min(member.tenureWeeks, 4)} wks`;
  }

  return {
    memberId: member.memberId,
    name: member.name,
    membershipType: member.membershipType || "Unknown",
    planPrice: member.planPrice ?? null,
    monthlyRate: 0,
    tenureMonths: Math.floor(member.tenureWeeks / 4),
    daysGone: 0,
    tier: member.alertType === "slowing" ? "Fading" : "Best odds",
    phone: member.phone,
    touchCount: 0,
    lastTouchType: null,
    lastTouchDate: null,
    callDueDate: null,
    lastAttemptResult: null,
    frequencyInfo,
    weeklyVisits: member.weeklyVisits,
    totalVisits: member.recentVisits,
  };
}


interface CallLists {
  atRisk: CallBlock;
  lowFrequency: CallBlock;
  newMembers: MemberCallItem[]; // onboarding queue; split into Overdue / Due / Recently onboarded
}

function callBlock(id: string, title: string, description: string, members: MemberCallItem[]): CallBlock {
  return {
    id,
    title,
    timeLabel: "",
    description,
    count: members.length,
    total: members.length,
    doneCount: 0,
    status: members.length > 0 ? "to_do" : "nothing_due",
    members,
  };
}

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || body.error || `${label} API error: ${res.status}`);
  return body as T;
}

async function fetchCallLists(): Promise<CallLists> {
  const [atRiskData, newMembersData, frequencyData] = await Promise.all([
    fetchJson<{ atRiskMembers?: AtRiskApiMember[] }>("/api/agent/at-risk", "At-risk"),
    fetchJson<{ newMembers?: NewMemberApiMember[] }>("/api/agent/new-members", "New members").catch(
      () => ({ newMembers: [] as NewMemberApiMember[] })
    ),
    fetchJson<{ slowing?: FrequencyAlertMember[]; belowHealthy?: FrequencyAlertMember[] }>("/api/agent/frequency-alerts", "Frequency").catch(
      () => ({ slowing: [] as FrequencyAlertMember[], belowHealthy: [] as FrequencyAlertMember[] })
    ),
  ]);

  // Most days gone first
  const atRiskMembers = [...(atRiskData.atRiskMembers || [])].sort((a, b) => b.daysGone - a.daysGone);
  const atRiskIds = new Set(atRiskMembers.map(m => m.memberId));
  // Low frequency, minus anyone already at-risk
  const frequencyItems = [...(frequencyData.slowing || []), ...(frequencyData.belowHealthy || [])]
    .map(frequencyAlertToCallItem)
    .filter(m => !atRiskIds.has(m.memberId));

  return {
    atRisk: callBlock("at-risk-members", "At-risk", "14+ days since last visit", atRiskMembers.map(apiMemberToCallItem)),
    lowFrequency: callBlock("low-frequency-members", "Low frequency", "Less than 6 visits in 4 weeks", frequencyItems),
    newMembers: (newMembersData.newMembers || []).map(newMemberToCallItem),
  };
}

// Summary card that doubles as the view switch
function SummaryCard({
  title,
  active,
  onClick,
  value,
  unit,
  detail,
  tone = "neutral",
  loading,
  error,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
  value: number | null;
  unit: string;
  detail: string;
  tone?: "neutral" | "bad" | "good";
  loading: boolean;
  error: string | null;
}) {
  const valueColor = tone === "bad" ? "text-red-600" : tone === "good" ? "text-green-700" : "text-gray-900";
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`text-left rounded-lg border px-4 py-3 transition-colors ${
        active ? "border-gray-900 bg-gray-100" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</div>
      {error ? (
        <div className="mt-2 text-sm text-red-600">Couldn&apos;t load</div>
      ) : loading || value === null ? (
        <>
          <div className="mt-2 h-7 w-12 rounded bg-gray-200 animate-pulse" />
          <div className="mt-2 text-xs text-gray-400">Loading…</div>
        </>
      ) : (
        <>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</span>
            <span className="text-sm text-gray-600">{unit}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500 truncate">{detail}</div>
        </>
      )}
    </button>
  );
}

function ViewState({ error, loading, label }: { error: string | null; loading: boolean; label: string }) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <strong>Error:</strong> {error}
      </div>
    );
  }
  return loading ? <div className="text-center py-12 text-gray-500">Loading {label}...</div> : null;
}

export function RetentionDashboard({
  view,
  onViewChange,
}: {
  view: RetentionView;
  onViewChange: (view: RetentionView) => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [callLists, setCallLists] = useState<CallLists | null>(null);
  const [callListsError, setCallListsError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<MilestoneRow[] | null>(null);
  const [milestonesError, setMilestonesError] = useState<string | null>(null);

  // Each source loads on its own; a refresh clears and reloads all of them
  const load = useCallback(<T,>(
    run: () => Promise<T>,
    set: (value: T | null) => void,
    setError: (error: string | null) => void,
    label: string
  ) => {
    set(null);
    setError(null);
    run()
      .then(value => {
        set(value);
        setUpdatedAt(new Date());
      })
      .catch(err => {
        console.error(`Failed to fetch ${label}:`, err);
        setError(err instanceof Error ? err.message : `Failed to load ${label}`);
      });
  }, []);

  useEffect(() => {
    load(fetchCallLists, setCallLists, setCallListsError, "call lists");
    load(
      () => fetchJson<{ members?: PaymentRow[] }>("/api/agent/payments", "Payments").then(b => b.members || []),
      setPayments,
      setPaymentsError,
      "payments"
    );
    load(
      () => fetchJson<{ members?: MilestoneRow[] }>("/api/agent/milestones", "Milestones").then(b => b.members || []),
      setMilestones,
      setMilestonesError,
      "milestones"
    );
  }, [load, refreshKey]);

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone.replace(/[^\d]/g, ""));
  };

  const atRiskCount = callLists?.atRisk.members?.length ?? 0;
  const lowFrequencyCount = callLists?.lowFrequency.members?.length ?? 0;
  // Onboarding queue: everyone waiting (longest waiting first), then recently onboarded
  const queue = callLists?.newMembers ?? [];
  const waiting = (m: MemberCallItem) => !m.onboarding?.onboardedOn;
  const daysWaiting = (m: MemberCallItem) => m.onboarding?.daysUncontacted ?? 0;
  const toOnboard = queue.filter(waiting).sort((a, b) => daysWaiting(b) - daysWaiting(a));
  const onboardedNew = queue
    .filter((m) => !waiting(m))
    .sort((a, b) => (b.onboarding?.onboardedOn ?? "").localeCompare(a.onboarding?.onboardedOn ?? ""));
  const newCount = toOnboard.length;

  // Mark onboarded / undo, then move the row between blocks
  const setOnboarded = async (member: MemberCallItem, onboarded: boolean) => {
    const res = onboarded
      ? await fetch("/api/agent/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId: member.memberId, memberName: member.name }),
        })
      : await fetch(`/api/agent/onboarding?memberId=${encodeURIComponent(member.memberId)}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(body.error || "Couldn't update onboarding. Please try again.");
      return;
    }
    const onboardedOn: string | null = onboarded ? body.onboardedOn : null;
    setCallLists((prev) =>
      prev && {
        ...prev,
        newMembers: prev.newMembers.map((m) =>
          m.memberId === member.memberId
            ? { ...m, onboarding: { daysUncontacted: daysWaiting(m), onboardedOn } }
            : m
        ),
      }
    );
  };
  const attention = payments?.filter(needsAttention).length ?? null;
  const groups = milestones ? milestoneGroups(milestones) : null;

  const descriptions: Record<RetentionView, string> = {
    "at-risk": "No visit in 14+ days, or weekly visits trending down. Today's save-call list.",
    "new-members": "",
    payments: "Billing status for every member. Owes, failed or short charges first.",
    milestones: `Class milestones (25, 50, 60, 80, 100, then every 25) counted since Aug 1. Celebrate, or get ready for the next one.`,
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-end gap-3 mb-3 text-sm">
        {updatedAt && (
          <span className="text-gray-500">
            Updated {updatedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        )}
        <button onClick={() => setRefreshKey(k => k + 1)} className="text-gray-700 hover:text-gray-900 font-medium">
          Refresh all
        </button>
      </div>

      {/* Summary cards = view navigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          title="At-risk & low frequency"
          active={view === "at-risk"}
          onClick={() => onViewChange("at-risk")}
          value={callLists ? atRiskCount + lowFrequencyCount : null}
          unit="members"
          detail={`${atRiskCount} inactive 14+ days · ${lowFrequencyCount} visits dropping`}
          loading={!callLists}
          error={callListsError}
        />
        <SummaryCard
          title="New members"
          active={view === "new-members"}
          onClick={() => onViewChange("new-members")}
          value={callLists ? newCount : null}
          unit="to onboard"
          detail="Welcome calls"
          loading={!callLists}
          error={callListsError}
        />
        <SummaryCard
          title="Payments"
          active={view === "payments"}
          onClick={() => onViewChange("payments")}
          value={attention}
          unit="need attention"
          detail={payments ? `${payments.length - (attention ?? 0)} paid up` : ""}
          tone={attention ? "bad" : "neutral"}
          loading={!payments}
          error={paymentsError}
        />
        <SummaryCard
          title="Milestones"
          active={view === "milestones"}
          onClick={() => onViewChange("milestones")}
          value={groups ? groups.justHit.length : null}
          unit="just hit"
          detail={groups ? `${groups.comingUp.length} within ${COMING_UP_WITHIN} classes` : ""}
          tone={groups?.justHit.length ? "good" : "neutral"}
          loading={!groups}
          error={milestonesError}
        />
      </div>

      {descriptions[view] ? (
        <p className="mt-5 mb-4 text-sm text-gray-500">{descriptions[view]}</p>
      ) : (
        <div className="mt-5" />
      )}

      {/* Selected view */}
      {view === "at-risk" && <ViewState error={callListsError} loading={!callLists && !callListsError} label="call lists" />}
      {view === "at-risk" && callLists && (
        <div className="space-y-6">
          {!!callLists.atRisk.members?.length && <MemberList block={callLists.atRisk} onCopyPhone={handleCopyPhone} />}
          {!!callLists.lowFrequency.members?.length && (
            <MemberList block={callLists.lowFrequency} onCopyPhone={handleCopyPhone} />
          )}
          {!callLists.atRisk.members?.length && !callLists.lowFrequency.members?.length && (
            <div className="text-center py-12 text-gray-500">No retention calls needed.</div>
          )}
        </div>
      )}

      {view === "new-members" && <ViewState error={callListsError} loading={!callLists && !callListsError} label="new members" />}
      {view === "new-members" && callLists && (
        <div className="space-y-6">
          {toOnboard.length ? (
            <MemberList
              block={callBlock("new-to-onboard", "To onboard", "", toOnboard)}
              onCopyPhone={handleCopyPhone}
              action={{ label: "Mark onboarded", onClick: (m) => setOnboarded(m, true) }}
            />
          ) : (
            <div className="text-center py-12 text-gray-500">Everyone new has been onboarded.</div>
          )}
          {!!onboardedNew.length && (
            <MemberList
              block={callBlock("new-onboarded", "Recently onboarded", "last 14 days", onboardedNew)}
              onCopyPhone={handleCopyPhone}
              action={{ label: "Undo", onClick: (m) => setOnboarded(m, false) }}
              collapsible
              defaultOpen={false}
            />
          )}
        </div>
      )}

      {view === "payments" && <ViewState error={paymentsError} loading={!payments && !paymentsError} label="payments" />}
      {view === "payments" && payments && (
        payments.length ? (
          <PaymentsTable members={payments} onCopyPhone={handleCopyPhone} />
        ) : (
          <div className="text-center py-12 text-gray-500">No paying members in the latest finalized KPI month.</div>
        )
      )}

      {view === "milestones" && <ViewState error={milestonesError} loading={!milestones && !milestonesError} label="milestones" />}
      {view === "milestones" && milestones && <MilestonesTable members={milestones} onCopyPhone={handleCopyPhone} />}
    </div>
  );
}
