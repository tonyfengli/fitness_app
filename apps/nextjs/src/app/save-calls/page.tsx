"use client";

import { useState, useEffect, useCallback } from "react";
import { MemberList, PaymentsTable, MilestonesTable, latestRecentMilestone } from "./components";
import { SaveCallsDayData, CallBlock, MemberCallItem, AtRiskTier, PaymentRow, MilestoneRow } from "./types";

type TabId = "retention" | "new-members" | "payments" | "milestones";

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
}

interface FrequencyAlertMember {
  memberId: string;
  name: string;
  alertType: "slowing" | "below_healthy" | "new_member_risk";
  membershipType: string | null;
  phone: string | null;
  tenureWeeks: number;
  baselineVisitsPerWeek: number | null;
  recentVisitsPerWeek: number;
  dropPercent: number | null;
  recentVisits: number;
  baselineVisits: number | null;
  weeklyVisits?: WeeklyVisitsApi;
}

// Get current day of week
const getDayOfWeek = () => {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
};

// Convert API member to UI format
function apiMemberToCallItem(member: AtRiskApiMember): MemberCallItem {
  return {
    memberId: member.memberId,
    name: member.name,
    membershipType: member.membershipType || "Unknown",
    monthlyRate: member.monthlyRevenue,
    paidBy: member.paidBy ?? null,
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
    onboarding: { planPrice: member.planPrice, daysUncontacted: member.daysSinceSignup },
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


export default function SaveCallsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SaveCallsDayData | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("retention");
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<MilestoneRow[] | null>(null);
  const [milestonesError, setMilestonesError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch all data in parallel
      const [atRiskRes, newMembersRes, frequencyRes] = await Promise.all([
        fetch("/api/agent/at-risk"),
        fetch("/api/agent/new-members"),
        fetch("/api/agent/frequency-alerts"),
      ]);

      if (!atRiskRes.ok) {
        throw new Error(`At-risk API error: ${atRiskRes.status}`);
      }

      const atRiskData = await atRiskRes.json();
      const newMembersData = newMembersRes.ok ? await newMembersRes.json() : { newMembers: [] };
      const frequencyData = frequencyRes.ok ? await frequencyRes.json() : { slowing: [], belowHealthy: [], newMemberRisk: [] };

      const atRiskMembers: AtRiskApiMember[] = atRiskData.atRiskMembers || [];
      const newMembers: NewMemberApiMember[] = newMembersData.newMembers || [];
      const slowingMembers: FrequencyAlertMember[] = frequencyData.slowing || [];
      const belowHealthyMembers: FrequencyAlertMember[] = frequencyData.belowHealthy || [];

      // Sort at-risk by days gone (most urgent first)
      atRiskMembers.sort((a, b) => b.daysGone - a.daysGone);

      // Keep at-risk and low-frequency as separate blocks (shown together in retention tab)
      const frequencyCallItems = [
        ...slowingMembers.map(frequencyAlertToCallItem),
        ...belowHealthyMembers.map(frequencyAlertToCallItem),
      ];

      // Dedupe: remove from frequency if already in at-risk
      const atRiskIds = new Set(atRiskMembers.map(m => m.memberId));
      const uniqueFrequencyItems = frequencyCallItems.filter(m => !atRiskIds.has(m.memberId));

      const blocks: CallBlock[] = [
        {
          id: "at-risk-members",
          title: "At-risk",
          timeLabel: "",
          description: "14+ days since last visit",
          count: atRiskMembers.length,
          total: atRiskMembers.length,
          doneCount: 0,
          status: atRiskMembers.length > 0 ? "to_do" : "nothing_due",
          members: atRiskMembers.map(apiMemberToCallItem),
        },
        {
          id: "low-frequency-members",
          title: "Low frequency",
          timeLabel: "",
          description: "Less than 6 visits in 4 weeks",
          count: uniqueFrequencyItems.length,
          total: uniqueFrequencyItems.length,
          doneCount: 0,
          status: uniqueFrequencyItems.length > 0 ? "to_do" : "nothing_due",
          members: uniqueFrequencyItems,
        },
        {
          id: "new-member-checks",
          title: "New members",
          timeLabel: "",
          description: "Joined since the last finalized KPI month",
          count: newMembers.length,
          total: newMembers.length,
          doneCount: 0,
          status: newMembers.length > 0 ? "to_do" : "nothing_due",
          members: newMembers.map(newMemberToCallItem),
        },
      ];

      setData({
        date: new Date().toISOString(),
        dayOfWeek: getDayOfWeek(),
        owner: "Retention Team", // Generic since no user context
        blocks,
        stats: {
          liveConversations: 0,
          liveConversationsGoal: 20,
          touches: 0,
          booked: 0,
          swipedBackIn: 0,
        },
        weeklyGoal: {
          target: 20,
          current: 0,
          deadline: "Fri 8pm",
          behindPace: null,
        },
      });

      setError(null);
    } catch (err) {
      console.error("Failed to fetch save calls data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchData().finally(() => setIsLoading(false));
  }, [fetchData]);

  // Payments load on their own so the call lists don't wait on GymMaster + Stripe lookups
  useEffect(() => {
    fetch("/api/agent/payments")
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.message || `Payments API error: ${res.status}`);
        setPayments(body.members || []);
      })
      .catch(err => {
        console.error("Failed to fetch payments:", err);
        setPaymentsError(err instanceof Error ? err.message : "Failed to load payments");
      });
  }, []);

  useEffect(() => {
    fetch("/api/agent/milestones")
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.message || `Milestones API error: ${res.status}`);
        setMilestones(body.members || []);
      })
      .catch(err => {
        console.error("Failed to fetch milestones:", err);
        setMilestonesError(err instanceof Error ? err.message : "Failed to load milestones");
      });
  }, []);

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone.replace(/[^\d]/g, ""));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <strong>Error:</strong> {error}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const atRiskBlock = data.blocks.find(b => b.id === "at-risk-members");
  const lowFrequencyBlock = data.blocks.find(b => b.id === "low-frequency-members");
  const newMembersBlock = data.blocks.find(b => b.id === "new-member-checks");

  const retentionCount = (atRiskBlock?.members?.length || 0) + (lowFrequencyBlock?.members?.length || 0);

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "retention", label: "Retention", count: retentionCount },
    { id: "new-members", label: "New members", count: newMembersBlock?.members?.length || 0 },
    { id: "payments", label: "Payments", count: payments?.length || 0 },
    { id: "milestones", label: "Milestones", count: milestones?.filter(m => latestRecentMilestone(m)).length || 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === tab.id ? "bg-gray-200" : "bg-gray-100"
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "retention" && (
          <div className="space-y-6">
            {atRiskBlock && atRiskBlock.members && atRiskBlock.members.length > 0 && (
              <MemberList block={atRiskBlock} onCopyPhone={handleCopyPhone} />
            )}
            {lowFrequencyBlock && lowFrequencyBlock.members && lowFrequencyBlock.members.length > 0 && (
              <MemberList block={lowFrequencyBlock} onCopyPhone={handleCopyPhone} />
            )}
            {(!atRiskBlock?.members?.length && !lowFrequencyBlock?.members?.length) && (
              <div className="text-center py-12 text-gray-500">
                No retention calls needed.
              </div>
            )}
          </div>
        )}
        {activeTab === "new-members" && newMembersBlock && (
          <MemberList block={newMembersBlock} onCopyPhone={handleCopyPhone} />
        )}
        {activeTab === "new-members" && !newMembersBlock?.members?.length && (
          <div className="text-center py-12 text-gray-500">
            No new members to call.
          </div>
        )}
        {activeTab === "payments" && (
          paymentsError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <strong>Error:</strong> {paymentsError}
            </div>
          ) : payments === null ? (
            <div className="text-center py-12 text-gray-500">Loading payments...</div>
          ) : payments.length ? (
            <PaymentsTable members={payments} onCopyPhone={handleCopyPhone} />
          ) : (
            <div className="text-center py-12 text-gray-500">
              No paying members in the latest finalized KPI month.
            </div>
          )
        )}
        {activeTab === "milestones" && (
          milestonesError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <strong>Error:</strong> {milestonesError}
            </div>
          ) : milestones === null ? (
            <div className="text-center py-12 text-gray-500">Loading milestones...</div>
          ) : (
            <MilestonesTable members={milestones} onCopyPhone={handleCopyPhone} />
          )
        )}
      </div>
    </div>
  );
}
