"use client";

import { useState, useEffect, Fragment } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { formatCurrency } from "../lib/parse-all-payments";
import { GymMasterRefund, AdminRefundsData, ClientNeedingReview, ClientsNeedingReviewData, ReviewStatusFlag, VerifyMemberResponse } from "../types";

// Local storage key for lost member overrides (shared with ReportingTab)
const OVERRIDES_STORAGE_KEY = "kpi-member-overrides";

// Monthly reconciliation data from new API
interface MonthlyReconciliation {
  month: string; // "2026-01"
  monthName: string; // "Jan 2026"
  gymMaster: {
    gross: number;
    refunds: number;
    net: number;
  };
  stripe: {
    gross: number;
    fees: number;
    feePercent: number;
    refunds: number;
    net: number;
  };
  quickbooks: {
    income: number;
    stripeIncome: number;
    otherIncome: number;
    connected: boolean;
  };
  payouts: number;
  variance: number;
  variancePercent: number;
  isReconciled: boolean;
}

interface RevenueReconciliationData {
  year: number;
  months: MonthlyReconciliation[];
  quickbooksConnected: boolean;
  totals: {
    gymMasterGross: number;
    gymMasterRefunds: number;
    gymMasterNet: number;
    stripeGross: number;
    stripeFees: number;
    stripeFeePercent: number;
    stripeRefunds: number;
    stripeNet: number;
    quickbooksIncome: number;
    quickbooksStripeIncome: number;
    quickbooksOtherIncome: number;
    payouts: number;
    variance: number;
    variancePercent: number;
    isReconciled: boolean;
  };
}

export function AdministrativeTab() {
  const [data, setData] = useState<AdminRefundsData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueReconciliationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRevenue, setIsLoadingRevenue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [reportYear, setReportYear] = useState(2026);
  const [expandedVariance, setExpandedVariance] = useState<string | null>(null);
  const [expandedAdjustments, setExpandedAdjustments] = useState<string | null>(null);
  const [showRefundSection, setShowRefundSection] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [expandedRefunds, setExpandedRefunds] = useState<Set<string>>(new Set());
  const [clientsReviewData, setClientsReviewData] = useState<ClientsNeedingReviewData | null>(null);
  const [isLoadingClientsReview, setIsLoadingClientsReview] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [verificationData, setVerificationData] = useState<Map<string, VerifyMemberResponse>>(new Map());
  const [loadingVerification, setLoadingVerification] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/refunds-reconciliation?year=${reportYear}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to fetch refunds data");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRevenueReconciliation = async () => {
    setIsLoadingRevenue(true);
    setRevenueError(null);

    try {
      // Auto-detect current month (API defaults to Jan-current month)
      const res = await fetch(`/api/admin/revenue-reconciliation?year=${reportYear}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to fetch revenue reconciliation");
      }

      setRevenueData(json);
    } catch (err) {
      setRevenueError(err instanceof Error ? err.message : "Failed to fetch revenue data");
    } finally {
      setIsLoadingRevenue(false);
    }
  };

  const fetchClientsNeedingReview = async () => {
    setIsLoadingClientsReview(true);
    try {
      // Get excludeFromLost from localStorage (shared with ReportingTab)
      let excludeFromLost: string[] = [];
      try {
        const stored = localStorage.getItem(OVERRIDES_STORAGE_KEY);
        if (stored) {
          const overrides = JSON.parse(stored);
          // Collect all member IDs excluded from lost across all months
          for (const monthKey of Object.keys(overrides)) {
            const monthOverrides = overrides[monthKey];
            if (monthOverrides?.excludeFromLost) {
              excludeFromLost.push(...monthOverrides.excludeFromLost);
            }
          }
          // Remove duplicates
          excludeFromLost = Array.from(new Set(excludeFromLost));
        }
      } catch (e) {
        console.error("Failed to read overrides from localStorage:", e);
      }

      const res = await fetch(`/api/admin/clients-needing-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: reportYear, excludeFromLost }),
      });
      const json = await res.json();
      if (res.ok) {
        setClientsReviewData(json);
      }
    } catch (err) {
      console.error("Failed to fetch clients needing review:", err);
    } finally {
      setIsLoadingClientsReview(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      // Fetch refunds data
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/refunds-reconciliation?year=${reportYear}`);
        const json = await res.json();
        if (!cancelled) {
          if (!res.ok) {
            setError(json.error || "Failed to fetch refunds data");
          } else {
            setData(json);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch data");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }

      // Fetch revenue reconciliation
      setIsLoadingRevenue(true);
      setRevenueError(null);
      try {
        const res = await fetch(`/api/admin/revenue-reconciliation?year=${reportYear}`);
        const json = await res.json();
        if (!cancelled) {
          if (!res.ok) {
            setRevenueError(json.error || "Failed to fetch revenue reconciliation");
          } else {
            setRevenueData(json);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setRevenueError(err instanceof Error ? err.message : "Failed to fetch revenue data");
        }
      } finally {
        if (!cancelled) setIsLoadingRevenue(false);
      }

      // Fetch clients needing review
      setIsLoadingClientsReview(true);
      try {
        let excludeFromLost: string[] = [];
        try {
          const stored = localStorage.getItem(OVERRIDES_STORAGE_KEY);
          if (stored) {
            const overrides = JSON.parse(stored);
            for (const monthKey of Object.keys(overrides)) {
              const monthOverrides = overrides[monthKey];
              if (monthOverrides?.excludeFromLost) {
                excludeFromLost.push(...monthOverrides.excludeFromLost);
              }
            }
            excludeFromLost = Array.from(new Set(excludeFromLost));
          }
        } catch (e) {
          console.error("Failed to read overrides from localStorage:", e);
        }

        const res = await fetch(`/api/admin/clients-needing-review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year: reportYear, excludeFromLost }),
        });
        const json = await res.json();
        if (!cancelled && res.ok) {
          setClientsReviewData(json);
        }
      } catch (err) {
        console.error("Failed to fetch clients needing review:", err);
      } finally {
        if (!cancelled) setIsLoadingClientsReview(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [reportYear]);

  // Get adjustments for a specific month
  const getAdjustmentsForMonth = (monthKey: string) => {
    return data?.refunds.filter((r) => {
      const refundMonth = r.refundDate.substring(0, 7);
      return refundMonth === monthKey && r.isNonStripeAdjustment;
    }) || [];
  };

  // Prepare chart data from monthly reconciliation
  const chartData = data?.monthlyReconciliation.map((m) => ({
    month: m.month,
    monthKey: m.monthKey,
    total: m.gymMasterTotal,
    count: m.gymMasterCount,
  })) || [];

  const toggleExpand = (key: string) => {
    setExpandedRefunds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getRefundKey = (refund: GymMasterRefund) => `${refund.memberId}-${refund.refundDate}`;

  // Refresh clients needing review when overrides change
  const refreshClientsReview = () => {
    setExpandedClients(new Set());
    fetchClientsNeedingReview();
  };

  const toggleClientExpand = async (memberId: string) => {
    const isExpanding = !expandedClients.has(memberId);

    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });

    // Fetch verification data when expanding (if not already fetched)
    if (isExpanding && !verificationData.has(memberId) && selectedMonth) {
      setLoadingVerification((prev) => new Set(prev).add(memberId));
      try {
        // Get the date range for verification (6 months of history)
        const [year, month] = selectedMonth.split("-").map(Number);
        const startDate = new Date(year!, month! - 6, 1);
        const endDate = new Date(year!, month!, 0); // Last day of selected month
        const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;
        const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${endDate.getDate()}`;

        const res = await fetch(
          `/api/admin/verify-member-stripe?memberId=${memberId}&startDate=${startStr}&endDate=${endStr}`
        );
        if (res.ok) {
          const data: VerifyMemberResponse = await res.json();
          setVerificationData((prev) => new Map(prev).set(memberId, data));
        }
      } catch (err) {
        console.error("Failed to fetch verification data:", err);
      } finally {
        setLoadingVerification((prev) => {
          const next = new Set(prev);
          next.delete(memberId);
          return next;
        });
      }
    }
  };

  const getStatusBadgeColor = (flag: ReviewStatusFlag): string => {
    switch (flag) {
      case "Refund": return "bg-red-100 text-red-700";
      case "On Hold": return "bg-yellow-100 text-yellow-700";
      case "Not Paid": return "bg-orange-100 text-orange-700";
      case "Billing Failed": return "bg-purple-100 text-purple-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  // Get verification status summary for a member's transactions in a specific month
  const getMonthVerificationStatus = (memberId: string, monthKey: string): {
    hasTransactions: boolean;
    allVerified: boolean;
    hasUncertain: boolean;
    hasManual: boolean;
    isLoading: boolean;
  } => {
    if (loadingVerification.has(memberId)) {
      return { hasTransactions: false, allVerified: false, hasUncertain: false, hasManual: false, isLoading: true };
    }

    const verification = verificationData.get(memberId);
    if (!verification) {
      return { hasTransactions: false, allVerified: false, hasUncertain: false, hasManual: false, isLoading: false };
    }

    // Filter transactions to this month
    const monthTransactions = verification.transactions.filter((t) => {
      // Parse the GymMaster date format (e.g., "Oct 5 2026" or "2026-10-05")
      let txMonthKey = "";
      if (t.date.match(/^\d{4}-\d{2}-\d{2}/)) {
        txMonthKey = t.date.substring(0, 7);
      } else {
        // Parse "Oct 5 2026" format
        const months: Record<string, string> = {
          Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
          Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
        };
        const match = t.date.match(/^(\w+)\s+\d+\s+(\d{4})$/);
        if (match) {
          const [, monthName, year] = match;
          const month = months[monthName!];
          if (month && year) {
            txMonthKey = `${year}-${month}`;
          }
        }
      }
      return txMonthKey === monthKey;
    });

    if (monthTransactions.length === 0) {
      return { hasTransactions: false, allVerified: false, hasUncertain: false, hasManual: false, isLoading: false };
    }

    const allVerified = monthTransactions.every((t) => t.status === "verified");
    const hasUncertain = monthTransactions.some((t) => t.status === "uncertain" || t.status === "not_found");
    const hasManual = monthTransactions.some((t) => t.status === "manual");

    return { hasTransactions: true, allVerified, hasUncertain, hasManual, isLoading: false };
  };

  // Render verification checkmark for a month
  const renderVerificationCheckmark = (memberId: string, monthKey: string) => {
    const status = getMonthVerificationStatus(memberId, monthKey);

    if (status.isLoading) {
      return (
        <div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full" />
      );
    }

    if (!status.hasTransactions) {
      return null;
    }

    if (status.hasManual) {
      return (
        <span className="text-xs text-purple-500 cursor-help" title="Manual adjustment (not Stripe)">
          📝
        </span>
      );
    }

    if (status.allVerified) {
      return (
        <span className="cursor-help" title="Verified in Stripe">
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </span>
      );
    }

    if (status.hasUncertain) {
      return (
        <span className="cursor-help" title="Uncertain - could not verify in Stripe">
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </span>
      );
    }

    return null;
  };

  // Filter refunds by selected month
  const allMonthRefunds = data?.refunds.filter((r) => {
    if (!selectedMonth) return false;
    const refundMonth = r.refundDate.substring(0, 7);
    return refundMonth === selectedMonth;
  }) || [];

  const filteredRefunds = allMonthRefunds.filter((r) => !r.isNonStripeAdjustment);
  const adjustmentRefunds = allMonthRefunds.filter((r) => r.isNonStripeAdjustment);

  return (
    <div className="mt-8 space-y-6">
      {error && <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>}
      {revenueError && <div className="rounded-md bg-red-50 p-4 text-red-700">{revenueError}</div>}

      {/* Revenue Reconciliation Section */}
      {revenueData && (() => {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        // Calculate status for each month
        const getMonthStatus = (m: MonthlyReconciliation) => {
          const monthNum = parseInt(m.month.split("-")[1]!);
          const isCurrentMonth = monthNum === currentMonth && revenueData.year === currentYear;
          // Net of refunds, gross of fees
          const billedNet = m.gymMaster.gross - m.gymMaster.refunds;
          const chargedNet = m.stripe.gross - m.stripe.refunds;
          const billedVsCharged = chargedNet - billedNet;
          const payoutVsQb = revenueData.quickbooksConnected
            ? m.quickbooks.stripeIncome - m.payouts
            : 0;

          if (isCurrentMonth) {
            return { closed: false, reason: "month in progress" };
          }
          if (Math.abs(billedVsCharged) >= 5) {
            return { closed: false, reason: billedVsCharged > 0 ? "charged more than billed" : "billed more than charged" };
          }
          if (revenueData.quickbooksConnected && Math.abs(payoutVsQb) >= 5) {
            return { closed: false, reason: "QB short of payout" };
          }
          return { closed: true, reason: "" };
        };

        const openCount = revenueData.months.filter(m => !getMonthStatus(m).closed).length;

        return (
        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Revenue Reconciliation</h3>
            <button
              onClick={fetchRevenueReconciliation}
              disabled={isLoadingRevenue}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              {isLoadingRevenue ? "Loading..." : "Refresh"}
            </button>
          </div>

          {/* Monthly Reconciliation Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Month</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <div>Billed</div>
                    <div className="font-normal normal-case text-gray-400">GymMaster</div>
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <div>Charged</div>
                    <div className="font-normal normal-case text-gray-400">Stripe</div>
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Δ Billed→Charged</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Fees</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Fee %</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <div>Paid Out</div>
                    <div className="font-normal normal-case text-gray-400">Stripe</div>
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <div>Stripe Income</div>
                    <div className="font-normal normal-case text-gray-400">QuickBooks</div>
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Δ Payout→QB</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {revenueData.months.map((m) => {
                  const monthNum = parseInt(m.month.split("-")[1]!);
                  const isCurrentMonth = monthNum === currentMonth && revenueData.year === currentYear;
                  // Net of refunds, gross of fees
                  const billedNet = m.gymMaster.gross - m.gymMaster.refunds;
                  const chargedNet = m.stripe.gross - m.stripe.refunds;
                  const billedVsCharged = chargedNet - billedNet;
                  const payoutVsQb = revenueData.quickbooksConnected
                    ? m.quickbooks.stripeIncome - m.payouts
                    : 0;
                  const status = getMonthStatus(m);
                  const monthLabel = m.monthName.replace(` ${revenueData.year}`, "");

                  return (
                  <tr key={m.month} className="border-b border-gray-100">
                    <td className="py-4 px-3 text-sm text-gray-900">
                      <span className="font-medium">{monthLabel}</span>
                      {isCurrentMonth && <span className="text-gray-400 text-xs ml-1">· to date</span>}
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-900 text-right font-mono">
                      {formatCurrency(billedNet)}
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-900 text-right font-mono">
                      {formatCurrency(chargedNet)}
                    </td>
                    <td className={`py-4 px-3 text-sm text-right font-mono ${
                      Math.abs(billedVsCharged) < 5 ? "text-gray-400" : billedVsCharged > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {Math.abs(billedVsCharged) < 5 ? "—" : (billedVsCharged > 0 ? "+" : "") + formatCurrency(billedVsCharged)}
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-600 text-right font-mono">
                      {formatCurrency(m.stripe.fees)}
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-600 text-right font-mono">
                      {m.stripe.feePercent.toFixed(1)}%
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-900 text-right font-mono">
                      {formatCurrency(m.payouts)}
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-900 text-right font-mono font-medium">
                      {m.quickbooks.connected ? formatCurrency(m.quickbooks.stripeIncome) : "—"}
                    </td>
                    <td className={`py-4 px-3 text-sm text-right font-mono ${
                      !m.quickbooks.connected ? "text-gray-400" : Math.abs(payoutVsQb) < 5 ? "text-gray-400" : payoutVsQb > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {!m.quickbooks.connected ? "—" : Math.abs(payoutVsQb) < 5 ? "—" : (payoutVsQb > 0 ? "+" : "") + formatCurrency(payoutVsQb)}
                    </td>
                    <td className="py-4 px-3 text-sm">
                      {status.closed ? (
                        <span className="inline-flex items-center text-green-700">
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                          Closed
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-yellow-700">
                          <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                          Open
                          {status.reason && <span className="text-gray-400 ml-1">· {status.reason}</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {/* YTD Row */}
                {(() => {
                  const ytdBilledNet = revenueData.totals.gymMasterGross - revenueData.totals.gymMasterRefunds;
                  const ytdChargedNet = revenueData.totals.stripeGross - revenueData.totals.stripeRefunds;
                  const ytdVariance = ytdChargedNet - ytdBilledNet;
                  return (
                <tr className="border-t-2 border-gray-300 font-medium">
                  <td className="py-4 px-3 text-sm text-gray-900 font-semibold">YTD</td>
                  <td className="py-4 px-3 text-sm text-gray-900 text-right font-mono">
                    {formatCurrency(ytdBilledNet)}
                  </td>
                  <td className="py-4 px-3 text-sm text-gray-900 text-right font-mono">
                    {formatCurrency(ytdChargedNet)}
                  </td>
                  <td className={`py-4 px-3 text-sm text-right font-mono ${
                    Math.abs(ytdVariance) < 5 ? "text-gray-400" : ytdVariance > 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {Math.abs(ytdVariance) < 5 ? "—" : (ytdVariance > 0 ? "+" : "") + formatCurrency(ytdVariance)}
                  </td>
                  <td className="py-4 px-3 text-sm text-gray-600 text-right font-mono">
                    {formatCurrency(revenueData.totals.stripeFees)}
                  </td>
                  <td className="py-4 px-3 text-sm text-gray-600 text-right font-mono">
                    {revenueData.totals.stripeFeePercent.toFixed(1)}%
                  </td>
                  <td className="py-4 px-3 text-sm text-gray-900 text-right font-mono">
                    {formatCurrency(revenueData.totals.payouts)}
                  </td>
                  <td className="py-4 px-3 text-sm text-gray-900 text-right font-mono font-medium">
                    {revenueData.quickbooksConnected ? formatCurrency(revenueData.totals.quickbooksStripeIncome) : "—"}
                  </td>
                  <td className={`py-4 px-3 text-sm text-right font-mono ${
                    !revenueData.quickbooksConnected ? "text-gray-400" :
                    Math.abs(revenueData.totals.quickbooksStripeIncome - revenueData.totals.payouts) < 5
                      ? "text-gray-400"
                      : (revenueData.totals.quickbooksStripeIncome - revenueData.totals.payouts) > 0
                        ? "text-green-600"
                        : "text-red-600"
                  }`}>
                    {(() => {
                      if (!revenueData.quickbooksConnected) return "—";
                      const diff = revenueData.totals.quickbooksStripeIncome - revenueData.totals.payouts;
                      return Math.abs(diff) < 5 ? "—" : (diff > 0 ? "+" : "") + formatCurrency(diff);
                    })()}
                  </td>
                  <td className="py-4 px-3 text-sm text-gray-600">
                    {openCount > 0 ? `${openCount} open` : "All closed"}
                  </td>
                </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

          {/* Refund Reconciliation - Collapsible Section */}
          {data && revenueData && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowRefundSection(!showRefundSection)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <h4 className="text-md font-medium text-gray-900">Refund Reconciliation</h4>
                  <p className="text-xs text-gray-500">GymMaster refunds vs Stripe refunds</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-red-600 font-medium">
                    {formatCurrency(revenueData.totals.stripeRefunds)} total
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${showRefundSection ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {showRefundSection && (
                <div className="mt-4">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 text-sm font-medium text-gray-500">Month</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-500">GymMaster</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-500">Stripe</th>
                        <th className="text-right py-2 text-sm font-medium text-gray-500">Variance</th>
                        <th className="text-center py-2 text-sm font-medium text-gray-500">Status</th>
                        <th className="text-right py-2 text-sm font-medium text-purple-500">Adjustments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.monthlyReconciliation.map((m) => (
                        <Fragment key={m.monthKey}>
                          <tr className="border-b border-gray-100">
                            <td className="py-2 text-sm text-gray-900">{m.month}</td>
                            <td className="py-2 text-sm text-gray-900 text-right">
                              {formatCurrency(m.gymMasterTotal)} <span className="text-gray-400">({m.gymMasterCount})</span>
                            </td>
                            <td className="py-2 text-sm text-gray-900 text-right">
                              {formatCurrency(m.stripeTotal)} <span className="text-gray-400">({m.stripeCount})</span>
                            </td>
                            <td className="py-2 text-sm text-right">
                              {m.variance >= 1 && m.unmatchedRefunds.length > 0 ? (
                                <button
                                  onClick={() => setExpandedVariance(expandedVariance === m.monthKey ? null : m.monthKey)}
                                  className="inline-flex items-center gap-1 text-yellow-600 hover:text-yellow-700 font-medium"
                                >
                                  {formatCurrency(m.variance)}
                                  <svg
                                    className={`w-4 h-4 transition-transform ${expandedVariance === m.monthKey ? "rotate-180" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              ) : (
                                <span className={m.variance < 1 ? "text-green-600" : "text-yellow-600"}>
                                  {formatCurrency(m.variance)}
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-center">
                              {m.status === "reconciled" ? (
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                  Reconciled
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                                  Variance
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-sm text-right">
                              {m.adjustmentsCount > 0 ? (
                                <button
                                  onClick={() => setExpandedAdjustments(expandedAdjustments === m.monthKey ? null : m.monthKey)}
                                  className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium"
                                >
                                  {formatCurrency(m.adjustmentsTotal)}{" "}
                                  <span className="text-purple-400">({m.adjustmentsCount})</span>
                                  <svg
                                    className={`w-4 h-4 transition-transform ${expandedAdjustments === m.monthKey ? "rotate-180" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                          {/* Expanded variance details */}
                          {expandedVariance === m.monthKey && m.unmatchedRefunds.length > 0 && (
                            <tr>
                              <td colSpan={6} className="bg-yellow-50 px-4 py-3">
                                <div className="text-xs text-gray-500 uppercase mb-2">Unmatched Refunds</div>
                                <div className="space-y-2">
                                  {m.unmatchedRefunds.map((ur, idx) => (
                                    <div
                                      key={idx}
                                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                                        ur.source === "gymmaster"
                                          ? ur.isAdjustment
                                            ? "bg-purple-100 border-l-4 border-purple-400"
                                            : "bg-white border-l-4 border-blue-400"
                                          : "bg-white border-l-4 border-green-400"
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <span
                                          className={`text-xs font-medium px-2 py-0.5 rounded ${
                                            ur.source === "gymmaster"
                                              ? "bg-blue-100 text-blue-700"
                                              : "bg-green-100 text-green-700"
                                          }`}
                                        >
                                          {ur.source === "gymmaster" ? "GymMaster" : "Stripe"}
                                        </span>
                                        <span className="text-gray-700">{ur.name}</span>
                                        {ur.isAdjustment && (
                                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                                            Adjustment
                                          </span>
                                        )}
                                        {ur.paymentMethod && !ur.isAdjustment && (
                                          <span className="text-xs text-gray-400">{ur.paymentMethod}</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <span className="text-gray-500 text-xs">{ur.date}</span>
                                        <span className="font-medium text-gray-900">{formatCurrency(ur.amount)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                          {/* Expanded adjustments details */}
                          {expandedAdjustments === m.monthKey && m.adjustmentsCount > 0 && (
                            <tr>
                              <td colSpan={6} className="bg-purple-50 px-4 py-3">
                                <div className="text-xs text-purple-600 uppercase mb-2">Adjustments (No Payment / Adjustment)</div>
                                <div className="space-y-2">
                                  {getAdjustmentsForMonth(m.monthKey).map((adj, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm bg-white border-l-4 border-purple-400"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="text-gray-700">{adj.memberName}</span>
                                        <span className="text-xs text-gray-400">#{adj.memberId}</span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <span className="text-gray-500 text-xs">{adj.refundDate}</span>
                                        <span className="font-medium text-purple-700">{formatCurrency(adj.refundAmount)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

      {isLoadingRevenue && !revenueData && (
        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            <span className="ml-3 text-gray-500">Loading revenue reconciliation...</span>
          </div>
        </div>
      )}

      {/* Clients Needing Review Section */}
      {clientsReviewData && (
        <div className="rounded-lg bg-white shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Clients that Need Review - {clientsReviewData.monthName}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {clientsReviewData.summary.total} active member{clientsReviewData.summary.total !== 1 ? "s" : ""} with payment issues
                </p>
              </div>
              <button
                onClick={refreshClientsReview}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Refresh
              </button>
            </div>
            {clientsReviewData.summary.total > 0 && (
              <div className="flex gap-4 mt-2 text-xs">
                {clientsReviewData.summary.refundCount > 0 && (
                  <span className="text-red-600">{clientsReviewData.summary.refundCount} refund{clientsReviewData.summary.refundCount !== 1 ? "s" : ""}</span>
                )}
                {clientsReviewData.summary.onHoldCount > 0 && (
                  <span className="text-yellow-600">{clientsReviewData.summary.onHoldCount} on hold</span>
                )}
                {clientsReviewData.summary.notPaidCount > 0 && (
                  <span className="text-orange-600">{clientsReviewData.summary.notPaidCount} not paid</span>
                )}
                {clientsReviewData.summary.billingFailedCount > 0 && (
                  <span className="text-purple-600">{clientsReviewData.summary.billingFailedCount} billing failed</span>
                )}
              </div>
            )}
          </div>

          {clientsReviewData.clients.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No active members with payment issues this month.
            </div>
          ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Membership</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fee</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Refunded</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {clientsReviewData.clients.map((client) => (
                <Fragment key={client.memberId}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        {client.memberName}
                        <span className="text-gray-400 text-xs">#{client.memberId}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-32 truncate" title={client.membershipType}>
                      {client.membershipType || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right font-mono">
                      {formatCurrency(client.membershipFee)}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-600 text-right font-mono">
                      {formatCurrency(client.paid)}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 text-right font-mono">
                      {client.refunded > 0 ? `-${formatCurrency(client.refunded)}` : "—"}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-mono font-medium ${
                      client.net < client.membershipFee ? "text-red-600" : "text-green-600"
                    }`}>
                      {formatCurrency(client.net)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {client.statusFlags.map((flag) => (
                          <span
                            key={flag}
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeColor(flag)}`}
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleClientExpand(client.memberId)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        {expandedClients.has(client.memberId) ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {expandedClients.has(client.memberId) && (
                    <tr>
                      <td colSpan={8} className="bg-gray-50 px-4 py-4">
                        <div className="space-y-4">
                          {/* Billing Status Section */}
                          <div className="flex items-start gap-6">
                            <div>
                              <div className="text-xs text-gray-500 uppercase mb-1">Billing Status</div>
                              <div className="flex items-center gap-2">
                                {client.billingStatus === "SUCCESS" && (
                                  <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Billing Successful
                                  </span>
                                )}
                                {client.billingStatus === "REFUSED" && (
                                  <span className="inline-flex items-center gap-1 text-purple-700 font-medium">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Billing Failed
                                  </span>
                                )}
                                {client.billingStatus === "NO_ATTEMPT" && (
                                  <span className="inline-flex items-center gap-1 text-gray-500 font-medium">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                    </svg>
                                    No Billing Attempt
                                  </span>
                                )}
                                {client.billingStatus === "PENDING" && (
                                  <span className="inline-flex items-center gap-1 text-yellow-600 font-medium">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                    </svg>
                                    Pending
                                  </span>
                                )}
                              </div>
                            </div>
                            {client.billingFailReason && (
                              <div>
                                <div className="text-xs text-gray-500 uppercase mb-1">Fail Reason</div>
                                <div className="text-sm text-purple-700 bg-purple-50 px-2 py-1 rounded">
                                  {client.billingFailReason}
                                </div>
                              </div>
                            )}
                            {client.billingAttempts && client.billingAttempts.length > 0 && (
                              <div>
                                <div className="text-xs text-gray-500 uppercase mb-1">Billing Attempts</div>
                                <div className="space-y-1">
                                  {client.billingAttempts.map((attempt, idx) => (
                                    <div key={idx} className={`text-xs px-2 py-1 rounded ${
                                      attempt.status === "SUCCESS" ? "bg-green-50 text-green-700" :
                                      attempt.status === "REFUSED" ? "bg-purple-50 text-purple-700" :
                                      "bg-gray-50 text-gray-600"
                                    }`}>
                                      {attempt.date}: {formatCurrency(attempt.amount)} - {attempt.status}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs text-gray-500 uppercase">6-Month Payment History</div>
                              {loadingVerification.has(client.memberId) && (
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full" />
                                  Verifying with Stripe...
                                </div>
                              )}
                              {verificationData.has(client.memberId) && !loadingVerification.has(client.memberId) && (
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="flex items-center gap-1 text-green-600">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Verified
                                  </span>
                                  <span className="flex items-center gap-1 text-gray-400">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Uncertain
                                  </span>
                                  <span className="flex items-center gap-1 text-purple-500">
                                    📝 Manual
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full bg-white border border-gray-200 rounded">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Month</th>
                                    {client.paymentHistory.map((h) => (
                                      <th key={h.monthKey} className="px-3 py-2 text-center text-xs font-medium text-gray-500">
                                        <div className="flex items-center justify-center gap-1">
                                          {h.monthName}
                                          {renderVerificationCheckmark(client.memberId, h.monthKey)}
                                        </div>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="px-3 py-2 text-xs text-gray-500">Paid</td>
                                    {client.paymentHistory.map((h) => (
                                      <td key={`paid-${h.monthKey}`} className="px-3 py-2 text-center text-xs text-green-600">
                                        {formatCurrency(h.paid)}
                                      </td>
                                    ))}
                                  </tr>
                                  <tr>
                                    <td className="px-3 py-2 text-xs text-gray-500">Refunded</td>
                                    {client.paymentHistory.map((h) => (
                                      <td key={`ref-${h.monthKey}`} className="px-3 py-2 text-center text-xs text-red-500">
                                        {h.refunded > 0 ? `-${formatCurrency(h.refunded)}` : "—"}
                                      </td>
                                    ))}
                                  </tr>
                                  <tr className="border-t border-gray-200">
                                    <td className="px-3 py-2 text-xs font-medium text-gray-700">Net</td>
                                    {client.paymentHistory.map((h) => (
                                      <td
                                        key={`net-${h.monthKey}`}
                                        className={`px-3 py-2 text-center text-xs font-semibold ${
                                          h.net < client.membershipFee && client.membershipFee > 0 ? "text-red-600 bg-red-50" : "text-green-600"
                                        }`}
                                      >
                                        {formatCurrency(h.net)}
                                      </td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          )}
        </div>
      )}

      {isLoading && !data && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-500">Loading refunds data...</span>
        </div>
      )}
    </div>
  );
}
