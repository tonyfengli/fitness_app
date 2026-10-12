"use client";

import { useState, useEffect, Fragment } from "react";

import { formatCurrency } from "../lib/parse-all-payments";
import { GymMasterRefund, AdminRefundsData } from "../types";

export function AdministrativeTab() {
  const [data, setData] = useState<AdminRefundsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportYear, setReportYear] = useState(2026);
  const [expandedRefunds, setExpandedRefunds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<"all" | "on_track" | "needs_review">("all");

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

  useEffect(() => {
    fetchData();
  }, [reportYear]);

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

  // Create unique key for each refund (memberId + date)
  const getRefundKey = (refund: GymMasterRefund) => `${refund.memberId}-${refund.refundDate}`;

  const filteredRefunds =
    data?.refunds.filter((r) => {
      if (filterStatus === "all") return true;
      return r.status === filterStatus;
    }) || [];

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Refund Reconciliation</h2>
          <p className="text-sm text-gray-500 mt-1">Review refunds and verify member payment history</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={reportYear}
            onChange={(e) => setReportYear(parseInt(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-4">
            <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
              <div className="text-sm text-gray-500">Total Refunds</div>
              <div className="text-2xl font-semibold text-gray-900">{data.summary.totalRefunds}</div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
              <div className="text-sm text-gray-500">GymMaster</div>
              <div className="text-2xl font-semibold text-gray-900">
                {formatCurrency(data.summary.totalGymMasterAmount)}
              </div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
              <div className="text-sm text-gray-500">Stripe</div>
              <div className="text-2xl font-semibold text-gray-900">
                {formatCurrency(data.summary.totalStripeAmount)}
              </div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
              <div className="text-sm text-gray-500">Reconciled</div>
              <div className="text-2xl font-semibold text-green-600">
                {data.summary.reconciledMonths}/{data.summary.totalMonths}
              </div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
              <div className="text-sm text-gray-500">Variance</div>
              <div
                className={`text-2xl font-semibold ${data.summary.totalVariance < 1 ? "text-green-600" : "text-yellow-600"}`}
              >
                {formatCurrency(data.summary.totalVariance)}
              </div>
            </div>
          </div>

          {/* Monthly Reconciliation Table */}
          <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Reconciliation</h3>
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-sm font-medium text-gray-500">Month</th>
                  <th className="text-right py-2 text-sm font-medium text-gray-500">GymMaster</th>
                  <th className="text-right py-2 text-sm font-medium text-gray-500">Stripe</th>
                  <th className="text-right py-2 text-sm font-medium text-gray-500">Variance</th>
                  <th className="text-center py-2 text-sm font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.monthlyReconciliation.map((m) => (
                  <tr key={m.month} className="border-b border-gray-100">
                    <td className="py-2 text-sm text-gray-900">{m.month}</td>
                    <td className="py-2 text-sm text-gray-900 text-right">
                      {formatCurrency(m.gymMasterTotal)} <span className="text-gray-400">({m.gymMasterCount})</span>
                    </td>
                    <td className="py-2 text-sm text-gray-900 text-right">
                      {formatCurrency(m.stripeTotal)} <span className="text-gray-400">({m.stripeCount})</span>
                    </td>
                    <td className="py-2 text-sm text-right">
                      <span className={m.variance < 1 ? "text-green-600" : "text-yellow-600"}>
                        {formatCurrency(m.variance)}
                      </span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Filter:</span>
            <button
              onClick={() => setFilterStatus("all")}
              className={`rounded-md px-3 py-1 text-sm ${
                filterStatus === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All ({data.refunds.length})
            </button>
            <button
              onClick={() => setFilterStatus("on_track")}
              className={`rounded-md px-3 py-1 text-sm ${
                filterStatus === "on_track"
                  ? "bg-green-600 text-white"
                  : "bg-green-50 text-green-700 hover:bg-green-100"
              }`}
            >
              On Track ({data.summary.onTrackCount})
            </button>
            <button
              onClick={() => setFilterStatus("needs_review")}
              className={`rounded-md px-3 py-1 text-sm ${
                filterStatus === "needs_review"
                  ? "bg-yellow-600 text-white"
                  : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
              }`}
            >
              Needs Review ({data.summary.needsReviewCount})
            </button>
          </div>

          {/* Refunds Table */}
          <div className="rounded-lg bg-white shadow-sm border border-gray-200 overflow-hidden">
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
                          {refund.memberName}
                          <span className="text-gray-400 text-xs ml-2">#{refund.memberId}</span>
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
                        <tr key={`${key}-expanded`}>
                          <td colSpan={5} className="bg-gray-50 px-4 py-4">
                            <div className="space-y-4">
                              {/* Reason */}
                              <div>
                                <div className="text-xs text-gray-500 uppercase mb-1">Reason</div>
                                <div className="text-sm text-gray-700 bg-white rounded p-2 border border-gray-200">
                                  {refund.reason}
                                </div>
                              </div>

                              {/* Payment History */}
                              <div>
                                <div className="text-xs text-gray-500 uppercase mb-2">6-Month Payment History</div>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full bg-white border border-gray-200 rounded">
                                    <thead>
                                      <tr className="bg-gray-100">
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Month</th>
                                        {refund.paymentHistory.map((h) => (
                                          <th
                                            key={h.month}
                                            className="px-3 py-2 text-center text-xs font-medium text-gray-500"
                                          >
                                            {h.month}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td className="px-3 py-2 text-xs text-gray-500">Expected</td>
                                        {refund.paymentHistory.map((h) => (
                                          <td
                                            key={`exp-${h.month}`}
                                            className="px-3 py-2 text-center text-xs text-gray-700"
                                          >
                                            {formatCurrency(h.expected)}
                                          </td>
                                        ))}
                                      </tr>
                                      <tr>
                                        <td className="px-3 py-2 text-xs text-gray-500">Actually Paid</td>
                                        {refund.paymentHistory.map((h) => (
                                          <td
                                            key={`act-${h.month}`}
                                            className={`px-3 py-2 text-center text-xs font-medium ${
                                              h.actual < h.expected && h.expected > 0
                                                ? "text-red-600 bg-red-50"
                                                : "text-green-600"
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

                              {/* Member ID */}
                              {refund.memberId && (
                                <div className="text-xs text-gray-400">Member ID: {refund.memberId}</div>
                              )}
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
              <div className="py-8 text-center text-gray-500">No refunds found matching the selected filter</div>
            )}
          </div>
        </>
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
