"use client";

import { useState, useEffect, Fragment } from "react";

import { formatCurrency } from "../lib/parse-all-payments";
import { AdminRefundsData } from "../types";

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

/**
 * Reconciliation view inside the P&L tab: revenue reconciliation (GymMaster billed
 * vs Stripe charged vs payouts vs QuickBooks) and refund reconciliation, loaded live
 * for the selected year. Moved from the former Administrative tab; logic unchanged.
 */
export function ReconciliationView({ year: reportYear }: { year: number }) {
  const [data, setData] = useState<AdminRefundsData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueReconciliationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRevenue, setIsLoadingRevenue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [expandedVariance, setExpandedVariance] = useState<string | null>(null);
  const [expandedAdjustments, setExpandedAdjustments] = useState<string | null>(null);
  const [showRefundSection, setShowRefundSection] = useState(false);

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

  return (
    <div className="space-y-6">
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

      {isLoading && !data && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-500">Loading refunds data...</span>
        </div>
      )}
    </div>
  );
}
