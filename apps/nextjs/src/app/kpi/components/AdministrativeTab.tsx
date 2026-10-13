"use client";

import { useState, useEffect, Fragment } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { formatCurrency } from "../lib/parse-all-payments";
import { GymMasterRefund, AdminRefundsData } from "../types";

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
  payouts: number;
  variance: number;
  variancePercent: number;
  isReconciled: boolean;
}

interface RevenueReconciliationData {
  year: number;
  months: MonthlyReconciliation[];
  totals: {
    gymMasterGross: number;
    gymMasterRefunds: number;
    gymMasterNet: number;
    stripeGross: number;
    stripeFees: number;
    stripeFeePercent: number;
    stripeRefunds: number;
    stripeNet: number;
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

  useEffect(() => {
    fetchData();
    fetchRevenueReconciliation();
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

  const handleBarClick = (monthKey: string) => {
    setSelectedMonth(selectedMonth === monthKey ? null : monthKey);
    setExpandedRefunds(new Set());
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
      {revenueData && (
        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Revenue Reconciliation</h3>
              <p className="text-sm text-gray-500">
                GymMaster P&L vs Stripe Charges vs Bank Deposits ({revenueData.year})
              </p>
            </div>
            <div className="flex items-center gap-2">
              {revenueData.totals.isReconciled ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Reconciled
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Variance: {revenueData.totals.variancePercent.toFixed(1)}%
                </span>
              )}
              <button
                onClick={fetchRevenueReconciliation}
                disabled={isLoadingRevenue}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                {isLoadingRevenue ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-xs text-gray-500 uppercase">GymMaster Gross</div>
              <div className="text-xl font-semibold text-gray-900">{formatCurrency(revenueData.totals.gymMasterGross)}</div>
              <div className="text-xs text-gray-400">P&L Revenue</div>
            </div>
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-xs text-green-600 uppercase">Stripe Gross</div>
              <div className="text-xl font-semibold text-green-700">{formatCurrency(revenueData.totals.stripeGross)}</div>
              <div className="text-xs text-green-500">Actually Charged</div>
            </div>
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-xs text-blue-600 uppercase">Bank Deposits</div>
              <div className="text-xl font-semibold text-blue-700">{formatCurrency(revenueData.totals.payouts)}</div>
              <div className="text-xs text-blue-500">After fees & refunds</div>
            </div>
            <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
              <div className="text-xs text-orange-600 uppercase">Stripe Fees</div>
              <div className="text-xl font-semibold text-orange-700">{formatCurrency(revenueData.totals.stripeFees)}</div>
              <div className="text-xs text-orange-500">{revenueData.totals.stripeFeePercent.toFixed(1)}% of gross</div>
            </div>
          </div>

          {/* Monthly Reconciliation Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase">Month</th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 uppercase">GM Gross</th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 uppercase">GM Refunds</th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-green-600 uppercase">Stripe Gross</th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-orange-600 uppercase">Fees</th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-red-500 uppercase">Refunds</th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-blue-600 uppercase">Payouts</th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 uppercase">Variance</th>
                  <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {revenueData.months.map((m) => (
                  <tr key={m.month} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 text-sm font-medium text-gray-900">{m.monthName}</td>
                    <td className="py-3 px-2 text-sm text-gray-700 text-right font-mono">
                      {formatCurrency(m.gymMaster.gross)}
                    </td>
                    <td className="py-3 px-2 text-sm text-red-600 text-right font-mono">
                      {m.gymMaster.refunds > 0 ? `-${formatCurrency(m.gymMaster.refunds)}` : "—"}
                    </td>
                    <td className="py-3 px-2 text-sm text-green-700 text-right font-mono font-medium">
                      {formatCurrency(m.stripe.gross)}
                    </td>
                    <td className="py-3 px-2 text-sm text-orange-600 text-right font-mono">
                      {formatCurrency(m.stripe.fees)}
                      <span className="text-orange-400 text-xs ml-1">({m.stripe.feePercent.toFixed(1)}%)</span>
                    </td>
                    <td className="py-3 px-2 text-sm text-red-500 text-right font-mono">
                      {m.stripe.refunds > 0 ? `-${formatCurrency(m.stripe.refunds)}` : "—"}
                    </td>
                    <td className="py-3 px-2 text-sm text-blue-600 text-right font-mono font-medium">
                      {formatCurrency(m.payouts)}
                    </td>
                    <td className={`py-3 px-2 text-sm text-right font-mono ${
                      Math.abs(m.variance) < 5 ? "text-gray-400" : m.variance > 0 ? "text-yellow-600" : "text-red-600"
                    }`}>
                      {m.variance >= 0 ? "+" : ""}{formatCurrency(m.variance)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {m.isReconciled ? (
                        <svg className="w-5 h-5 text-green-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-xs text-yellow-600">{Math.abs(m.variancePercent).toFixed(1)}%</span>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="bg-gray-50 font-medium">
                  <td className="py-3 px-2 text-sm text-gray-900">Total</td>
                  <td className="py-3 px-2 text-sm text-gray-900 text-right font-mono">
                    {formatCurrency(revenueData.totals.gymMasterGross)}
                  </td>
                  <td className="py-3 px-2 text-sm text-red-600 text-right font-mono">
                    -{formatCurrency(revenueData.totals.gymMasterRefunds)}
                  </td>
                  <td className="py-3 px-2 text-sm text-green-700 text-right font-mono">
                    {formatCurrency(revenueData.totals.stripeGross)}
                  </td>
                  <td className="py-3 px-2 text-sm text-orange-600 text-right font-mono">
                    {formatCurrency(revenueData.totals.stripeFees)}
                    <span className="text-orange-400 text-xs ml-1">({revenueData.totals.stripeFeePercent.toFixed(1)}%)</span>
                  </td>
                  <td className="py-3 px-2 text-sm text-red-500 text-right font-mono">
                    -{formatCurrency(revenueData.totals.stripeRefunds)}
                  </td>
                  <td className="py-3 px-2 text-sm text-blue-600 text-right font-mono">
                    {formatCurrency(revenueData.totals.payouts)}
                  </td>
                  <td className={`py-3 px-2 text-sm text-right font-mono ${
                    Math.abs(revenueData.totals.variance) < 50 ? "text-gray-400" : revenueData.totals.variance > 0 ? "text-yellow-600" : "text-red-600"
                  }`}>
                    {revenueData.totals.variance >= 0 ? "+" : ""}{formatCurrency(revenueData.totals.variance)}
                  </td>
                  <td className="py-3 px-2 text-center">
                    {revenueData.totals.isReconciled ? (
                      <svg className="w-5 h-5 text-green-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className="text-xs text-yellow-600">{Math.abs(revenueData.totals.variancePercent).toFixed(1)}%</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Refund Reconciliation - Collapsible Section */}
          {data && (
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

      {/* Refunds Bar Chart - Separate Section */}
      {data && chartData.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Refunds by Month</h3>
            {selectedMonth && (
              <button
                onClick={() => setSelectedMonth(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear selection
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-4">Click on a bar to view refund details</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  tickFormatter={(value) => {
                    const parts = value.split("-");
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    return monthNames[parseInt(parts[1], 10) - 1] || value;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Total Refunds"]}
                  labelFormatter={(label) => {
                    if (!label || typeof label !== "string") return String(label);
                    const parts = label.split("-");
                    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                    return `${monthNames[parseInt(parts[1] || "0", 10) - 1] || ""} ${parts[0] || ""}`;
                  }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                />
                <Bar
                  dataKey="total"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(_data, index) => {
                    const monthKey = chartData[index]?.monthKey;
                    if (monthKey) handleBarClick(monthKey);
                  }}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.monthKey}
                      fill={selectedMonth === entry.monthKey ? "#dc2626" : "#ef4444"}
                      opacity={selectedMonth && selectedMonth !== entry.monthKey ? 0.4 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Refunds Detail Table - Show when month is selected */}
      {selectedMonth && (
        <div className="rounded-lg bg-white shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Refunds for {chartData.find((c) => c.monthKey === selectedMonth)?.month || selectedMonth}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {filteredRefunds.length} refund{filteredRefunds.length !== 1 ? "s" : ""}
              {adjustmentRefunds.length > 0 && (
                <span className="text-purple-500 ml-2">
                  + {adjustmentRefunds.length} adjustment{adjustmentRefunds.length !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRefunds.map((refund) => {
                const key = getRefundKey(refund);
                return (
                  <Fragment key={key}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{refund.refundDate}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          {refund.memberName}
                          <span className="text-gray-400 text-xs">#{refund.memberId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600 text-right font-medium">
                        -{formatCurrency(refund.refundAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            refund.status === "on_track"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {refund.status === "on_track" ? "On track" : "Needs review"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleExpand(key)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          {expandedRefunds.has(key) ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>
                    {expandedRefunds.has(key) && (
                      <tr>
                        <td colSpan={5} className="bg-gray-50 px-4 py-4">
                          <div className="space-y-4">
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <div className="text-xs text-gray-500 uppercase mb-1">Payment Method</div>
                                <div className="text-sm font-medium rounded px-2 py-1 inline-block bg-gray-100 text-gray-700">
                                  {refund.paymentMethod}
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="text-xs text-gray-500 uppercase mb-1">Reason</div>
                                <div className="text-sm text-gray-700 bg-white rounded p-2 border border-gray-200">
                                  {refund.reason}
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 uppercase mb-2">6-Month Payment History</div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full bg-white border border-gray-200 rounded">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Month</th>
                                      {refund.paymentHistory.map((h) => (
                                        <th key={h.month} className="px-3 py-2 text-center text-xs font-medium text-gray-500">
                                          {h.month}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td className="px-3 py-2 text-xs text-gray-500">Expected</td>
                                      {refund.paymentHistory.map((h) => (
                                        <td key={`exp-${h.month}`} className="px-3 py-2 text-center text-xs text-gray-700">
                                          {formatCurrency(h.expected)}
                                        </td>
                                      ))}
                                    </tr>
                                    <tr className="border-t border-gray-200">
                                      <td className="px-3 py-2 text-xs font-medium text-gray-700">Actually Paid</td>
                                      {refund.paymentHistory.map((h) => (
                                        <td
                                          key={`net-${h.month}`}
                                          className={`px-3 py-2 text-center text-xs font-semibold ${
                                            h.actual < h.expected && h.expected > 0 ? "text-red-600 bg-red-50" : "text-green-600"
                                          }`}
                                        >
                                          {formatCurrency(h.actual)}
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
                );
              })}
            </tbody>
          </table>
          {filteredRefunds.length === 0 && (
            <div className="py-8 text-center text-gray-500">No refunds recorded for this month</div>
          )}
        </div>
      )}

      {/* Adjustments Section */}
      {selectedMonth && adjustmentRefunds.length > 0 && (
        <div className="rounded-lg bg-purple-50 shadow-sm border border-purple-200 overflow-hidden">
          <div className="px-4 py-3 bg-purple-100 border-b border-purple-200">
            <h3 className="text-lg font-medium text-purple-900">Adjustments (Non-Stripe)</h3>
            <p className="text-sm text-purple-600 mt-1">Internal GymMaster adjustments, not actual Stripe refunds</p>
          </div>
          <table className="min-w-full divide-y divide-purple-200">
            <thead className="bg-purple-100/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase">Member</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-purple-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-100">
              {adjustmentRefunds.map((refund) => (
                <tr key={getRefundKey(refund)} className="hover:bg-purple-100/30">
                  <td className="px-4 py-3 text-sm text-purple-900">{refund.refundDate}</td>
                  <td className="px-4 py-3 text-sm text-purple-900">
                    {refund.memberName} <span className="text-purple-400 text-xs">#{refund.memberId}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-purple-700 text-right font-medium">
                    {formatCurrency(refund.refundAmount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-purple-600 max-w-xs truncate">{refund.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
