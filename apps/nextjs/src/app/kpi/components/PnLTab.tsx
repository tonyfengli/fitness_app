"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
} from "recharts";

import { ExpenseBreakdown } from "../types";
import { MONTH_NAMES } from "../constants";
import { ReconciliationView } from "./ReconciliationView";

// Revenue reconciliation data structure (from API)
interface RevenueMonth {
  month: string; // "2026-01"
  monthName: string;
  gymMaster: { gross: number; refunds: number; net: number };
  stripe: { gross: number; fees: number; feePercent: number; refunds: number; net: number };
  quickbooks: {
    income: number;
    stripeIncome: number;
    otherIncome: number;
    expenses: ExpenseBreakdown;
    netIncome: number;
    connected: boolean;
  };
  payouts: number;
}

// Saved month status (from /api/pnl/snapshots)
interface PnlSnapshotStatus {
  month: number;
  status: "draft" | "finalized";
  finalizedAt: string | null;
  refreshedAt: string;
}

interface RevenueReconciliationData {
  year: number;
  months: RevenueMonth[];
  quickbooksConnected: boolean;
  totals: {
    gymMasterGross: number;
    gymMasterRefunds: number;
    stripeGross: number;
    stripeFees: number;
    stripeRefunds: number;
    quickbooksStripeIncome: number;
    quickbooksOtherIncome: number;
    quickbooksExpenses: ExpenseBreakdown;
    quickbooksNetIncome: number;
    payouts: number;
  };
}

// Simplified P&L month data for display
interface PnLDisplayMonth {
  month: string;
  monthNum: number;
  year: number;
  stripeRevenue: number; // Stripe charged net of refunds
  otherIncome: number; // QB other income
  allRevenue: number; // Stripe + other
  expenses: number; // QB expenses + Stripe fees
  expenseBreakdown: PnlExpenses; // by category, Stripe fees included
  netIncome: number;
}

// QuickBooks expense categories plus Stripe processing fees
type PnlExpenses = ExpenseBreakdown & { stripeFees: number };

export function PnLTab() {
  const [revenueData, setRevenueData] = useState<RevenueReconciliationData | null>(null);
  const [snapshots, setSnapshots] = useState<PnlSnapshotStatus[]>([]);
  const [quickbooksConnected, setQuickbooksConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(10);
  const [reportYear, setReportYear] = useState(2026);
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false);
  // Results vs the bookkeeping checks behind them
  const [view, setView] = useState<"pnl" | "reconciliation">("pnl");

  // Default load: the saved P&L from the database (no QuickBooks needed)
  const loadSaved = async (year: number) => {
    try {
      const res = await fetch(`/api/pnl/snapshots?year=${year}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load saved P&L data");
      setRevenueData(json);
      setSnapshots(json.snapshots || []);
      setQuickbooksConnected(!!json.quickbooksConnected);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load saved P&L data");
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadSaved(reportYear).finally(() => setIsLoading(false));
  }, [reportYear]);

  // QuickBooks is only for pulling new data into the saved months (finalized months are skipped)
  const refreshFromQuickBooks = async () => {
    setIsRefreshing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/pnl/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: reportYear, startMonth, endMonth }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.needsAuth) setQuickbooksConnected(false);
        throw new Error(json.error || "Failed to refresh P&L data");
      }
      const names = (months: number[]) => months.map((m) => MONTH_NAMES[m - 1]).join(", ");
      setMessage(
        [
          json.refreshed.length ? `Refreshed ${json.refreshed.length} month${json.refreshed.length === 1 ? "" : "s"}` : "Nothing refreshed",
          json.skippedFinalized.length ? `${names(json.skippedFinalized)} finalized, skipped` : "",
          json.failed.length ? `${names(json.failed)} failed, try again` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      );
      await loadSaved(reportYear);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh P&L data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleFinalized = async (snapshot: PnlSnapshotStatus) => {
    const finalize = snapshot.status !== "finalized";
    const monthName = MONTH_NAMES[snapshot.month - 1];
    if (!confirm(finalize ? `Finalize ${monthName}? Refreshes will skip it until it's reopened.` : `Reopen ${monthName} for refreshing?`)) return;
    const res = await fetch("/api/pnl/snapshots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: snapshot.month, year: reportYear, status: finalize ? "finalized" : "draft" }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || "Failed to update month");
      return;
    }
    await loadSaved(reportYear);
  };

  const handleConnect = () => {
    window.location.href = "/api/auth/quickbooks";
  };

  const lastRefreshedAt = snapshots.reduce<string | null>((latest, s) => (!latest || s.refreshedAt > latest ? s.refreshedAt : latest), null);

  // Empty expense breakdown helper
  const emptyExpenses: ExpenseBreakdown = {
    advertisingMarketing: 0,
    contractLabor: 0,
    appsSoftware: 0,
    materialsSupplies: 0,
    liabilityInsurance: 0,
    utilities: 0,
    repairsMaintenance: 0,
    businessLicenses: 0,
    clientCompensation: 0,
    other: 0,
    total: 0,
  };

  // Build P&L display data
  const pnlData: PnLDisplayMonth[] = [];
  if (revenueData) {
    for (const revMonth of revenueData.months) {
      const monthNum = parseInt(revMonth.month.split("-")[1]!);
      if (monthNum < startMonth || monthNum > endMonth) continue;
      const monthName = MONTH_NAMES[monthNum - 1]!;

      // Stripe revenue = charged net of refunds (gross of fees)
      const stripeRevenue = revMonth.stripe.gross - revMonth.stripe.refunds;
      const otherIncome = revMonth.quickbooks.otherIncome;
      const allRevenue = stripeRevenue + otherIncome;

      // Operating expenses = QuickBooks expenses + Stripe processing fees
      const qbExpenses = revMonth.quickbooks.expenses || emptyExpenses;
      const stripeFees = revMonth.stripe.fees;
      const expenseBreakdown: PnlExpenses = { ...qbExpenses, stripeFees, total: qbExpenses.total + stripeFees };
      const expenses = expenseBreakdown.total;
      const netIncome = allRevenue - expenses;

      pnlData.push({
        month: monthName,
        monthNum,
        year: reportYear,
        stripeRevenue,
        otherIncome,
        allRevenue,
        expenses,
        expenseBreakdown,
        netIncome,
      });
    }
  }

  // Check if we have data
  const hasData = pnlData.length > 0;
  const snapshotsInRange = snapshots.filter((s) => s.month >= startMonth && s.month <= endMonth);

  // Calculate totals
  const totalStripeRevenue = pnlData.reduce((sum, m) => sum + m.stripeRevenue, 0);
  const totalOtherIncome = pnlData.reduce((sum, m) => sum + m.otherIncome, 0);
  const totalAllRevenue = pnlData.reduce((sum, m) => sum + m.allRevenue, 0);
  const totalExpenses = pnlData.reduce((sum, m) => sum + m.expenses, 0);
  const totalNetIncome = pnlData.reduce((sum, m) => sum + m.netIncome, 0);

  // Calculate expense breakdown totals
  const totalExpenseBreakdown: PnlExpenses = pnlData.reduce(
    (acc, m) => ({
      advertisingMarketing: acc.advertisingMarketing + m.expenseBreakdown.advertisingMarketing,
      contractLabor: acc.contractLabor + m.expenseBreakdown.contractLabor,
      appsSoftware: acc.appsSoftware + m.expenseBreakdown.appsSoftware,
      materialsSupplies: acc.materialsSupplies + m.expenseBreakdown.materialsSupplies,
      liabilityInsurance: acc.liabilityInsurance + m.expenseBreakdown.liabilityInsurance,
      utilities: acc.utilities + m.expenseBreakdown.utilities,
      repairsMaintenance: acc.repairsMaintenance + m.expenseBreakdown.repairsMaintenance,
      businessLicenses: acc.businessLicenses + m.expenseBreakdown.businessLicenses,
      clientCompensation: acc.clientCompensation + m.expenseBreakdown.clientCompensation,
      other: acc.other + m.expenseBreakdown.other,
      stripeFees: acc.stripeFees + m.expenseBreakdown.stripeFees,
      total: acc.total + m.expenseBreakdown.total,
    }),
    { ...emptyExpenses, stripeFees: 0 }
  );

  const avgMonthlyProfit = pnlData.length > 0 ? totalNetIncome / pnlData.length : 0;
  const profitMargin = totalAllRevenue > 0 ? (totalNetIncome / totalAllRevenue) * 100 : 0;

  // Expense category labels for display
  const expenseCategories: { key: keyof Omit<PnlExpenses, "total">; label: string; color: string }[] = [
    { key: "stripeFees", label: "Stripe Fees", color: "bg-slate-500" },
    { key: "advertisingMarketing", label: "Advertising & Marketing", color: "bg-purple-500" },
    { key: "contractLabor", label: "Contract Labor", color: "bg-blue-500" },
    { key: "appsSoftware", label: "Apps & Software", color: "bg-cyan-500" },
    { key: "materialsSupplies", label: "Materials & Supplies", color: "bg-green-500" },
    { key: "liabilityInsurance", label: "Liability Insurance", color: "bg-yellow-500" },
    { key: "utilities", label: "Utilities", color: "bg-orange-500" },
    { key: "repairsMaintenance", label: "Repairs & Maintenance", color: "bg-red-500" },
    { key: "businessLicenses", label: "Business Licenses", color: "bg-pink-500" },
    { key: "clientCompensation", label: "Client Compensation", color: "bg-indigo-500" },
    { key: "other", label: "Other", color: "bg-gray-500" },
  ];

  // Chart data
  const chartData = pnlData.map((m) => ({
    name: m.month,
    revenue: m.allRevenue,
    expenses: -m.expenses,
    netIncome: m.netIncome,
  }));

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatK = (value: number) => {
    return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : formatCurrency(value);
  };

  const yearSelect = (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700">Year:</label>
      <select
        value={reportYear}
        onChange={(e) => setReportYear(Number(e.target.value))}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
      >
        <option value={2026}>2026</option>
        <option value={2025}>2025</option>
      </select>
    </div>
  );

  return (
    <div className="mt-8 space-y-6">
      {/* Sub-view switch: Profit & loss | Reconciliation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm font-medium" role="tablist">
          {(
            [
              ["pnl", "Profit & loss"],
              ["reconciliation", "Reconciliation"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                view === id ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {view === "reconciliation" && yearSelect}
      </div>

      {view === "reconciliation" ? (
        <ReconciliationView year={reportYear} />
      ) : (
      <>
      {/* Date Range Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">From:</label>
          <select
            value={startMonth}
            onChange={(e) => setStartMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">To:</label>
          <select
            value={endMonth}
            onChange={(e) => setEndMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {yearSelect}
        {quickbooksConnected ? (
          <button
            onClick={refreshFromQuickBooks}
            disabled={isRefreshing}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {isRefreshing ? "Refreshing from QuickBooks & Stripe..." : "Refresh from QuickBooks"}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Connect QuickBooks to refresh
          </button>
        )}
        <span className="text-xs text-gray-500 md:ml-auto">
          {lastRefreshedAt
            ? `Saved data · last refreshed ${new Date(lastRefreshedAt).toLocaleDateString()} ${new Date(lastRefreshedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : "No saved data yet"}
        </span>
      </div>

      {/* Month status: finalized months are locked from refreshes, like the KPI snapshots */}
      {snapshotsInRange.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">Months:</span>
          {snapshotsInRange.map((snap) => (
            <button
              key={snap.month}
              onClick={() => toggleFinalized(snap)}
              title={snap.status === "finalized" ? "Finalized: click to reopen" : "Draft: click to finalize"}
              className={`px-2 py-1 rounded-full border transition-colors ${
                snap.status === "finalized"
                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {MONTH_NAMES[snap.month - 1]?.slice(0, 3)} · {snap.status === "finalized" ? "Finalized" : "Draft"}
            </button>
          ))}
        </div>
      )}

      {message && <div className="text-sm text-gray-600">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      {hasData && (
        <>
          {/* Monthly P&L Table */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Monthly P&L</h3>
              <p className="text-xs text-gray-500 mt-1">
                Revenue from Stripe (source of truth) + QB other revenue | Expenses from QuickBooks + Stripe fees
              </p>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-600 w-40"></th>
                    {pnlData.map((m) => (
                      <th key={m.month} className="text-right py-2 px-3 font-medium text-gray-600 min-w-[80px]">
                        {m.month}
                      </th>
                    ))}
                    <th className="text-right py-2 px-3 font-bold text-gray-900 bg-gray-50 min-w-[90px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Stripe Revenue */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Stripe Revenue</td>
                    {pnlData.map((m) => (
                      <td key={m.month} className="text-right py-2 px-3 text-gray-900 font-mono">
                        {formatCurrency(m.stripeRevenue)}
                      </td>
                    ))}
                    <td className="text-right py-2 px-3 text-gray-900 font-bold bg-gray-50 font-mono">
                      {formatCurrency(totalStripeRevenue)}
                    </td>
                  </tr>
                  {/* Other Revenue */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Other Revenue</td>
                    {pnlData.map((m) => (
                      <td key={m.month} className="text-right py-2 px-3 text-gray-600 font-mono">
                        {m.otherIncome > 0 ? formatCurrency(m.otherIncome) : "—"}
                      </td>
                    ))}
                    <td className="text-right py-2 px-3 text-gray-600 font-bold bg-gray-50 font-mono">
                      {formatCurrency(totalOtherIncome)}
                    </td>
                  </tr>
                  {/* All Revenue */}
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="py-2 font-semibold text-gray-900">All Revenue</td>
                    {pnlData.map((m) => (
                      <td key={m.month} className="text-right py-2 px-3 text-gray-900 font-bold font-mono">
                        {formatCurrency(m.allRevenue)}
                      </td>
                    ))}
                    <td className="text-right py-2 px-3 text-gray-900 font-bold bg-gray-100 font-mono">
                      {formatCurrency(totalAllRevenue)}
                    </td>
                  </tr>
                  {/* Expenses */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Operating Expenses</td>
                    {pnlData.map((m) => (
                      <td key={m.month} className="text-right py-2 px-3 text-red-600 font-mono">
                        {m.expenses > 0 ? `(${formatCurrency(m.expenses)})` : "—"}
                      </td>
                    ))}
                    <td className="text-right py-2 px-3 text-red-600 font-bold bg-gray-50 font-mono">
                      ({formatCurrency(totalExpenses)})
                    </td>
                  </tr>
                  {/* Net Income */}
                  <tr className="bg-green-50">
                    <td className="py-3 font-bold text-gray-900">Net Income</td>
                    {pnlData.map((m) => (
                      <td
                        key={m.month}
                        className={`text-right py-3 px-3 font-bold font-mono ${
                          m.netIncome >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(m.netIncome)}
                      </td>
                    ))}
                    <td
                      className={`text-right py-3 px-3 font-bold bg-green-100 font-mono ${
                        totalNetIncome >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {formatCurrency(totalNetIncome)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Expense Breakdown Toggle */}
            <div className="border-t border-gray-100">
              <button
                onClick={() => setShowExpenseBreakdown(!showExpenseBreakdown)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${showExpenseBreakdown ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-700">Expense Breakdown by Category</span>
                </div>
                <span className="text-xs text-gray-500">{formatCurrency(totalExpenses)} total</span>
              </button>

              {showExpenseBreakdown && (
                <div className="p-4 pt-2">
                  {/* Monthly Expense Breakdown Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 font-medium text-gray-600 w-48">Category</th>
                          {pnlData.map((m) => (
                            <th key={m.month} className="text-right py-2 px-3 font-medium text-gray-600 min-w-[80px]">
                              {m.month}
                            </th>
                          ))}
                          <th className="text-right py-2 px-3 font-bold text-gray-900 bg-gray-50 min-w-[90px]">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseCategories
                          .filter((cat) => totalExpenseBreakdown[cat.key] > 0)
                          .sort((a, b) => totalExpenseBreakdown[b.key] - totalExpenseBreakdown[a.key])
                          .map((cat) => (
                            <tr key={cat.key} className="border-b border-gray-100">
                              <td className="py-2 text-gray-700">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${cat.color}`} />
                                  {cat.label}
                                </div>
                              </td>
                              {pnlData.map((m) => (
                                <td key={m.month} className="text-right py-2 px-3 text-gray-600 font-mono">
                                  {m.expenseBreakdown[cat.key] > 0
                                    ? formatCurrency(m.expenseBreakdown[cat.key])
                                    : "—"}
                                </td>
                              ))}
                              <td className="text-right py-2 px-3 text-gray-900 font-bold bg-gray-50 font-mono">
                                {formatCurrency(totalExpenseBreakdown[cat.key])}
                              </td>
                            </tr>
                          ))}
                        <tr className="bg-red-50 font-semibold">
                          <td className="py-2 text-gray-900">Total Expenses</td>
                          {pnlData.map((m) => (
                            <td key={m.month} className="text-right py-2 px-3 text-red-700 font-mono">
                              {formatCurrency(m.expenses)}
                            </td>
                          ))}
                          <td className="text-right py-2 px-3 text-red-700 font-bold bg-red-100 font-mono">
                            {formatCurrency(totalExpenses)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Net Income Chart */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Revenue vs Expenses Trend</h3>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#666" }} axisLine={{ stroke: "#e0e0e0" }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 12, fill: "#666" }}
                    axisLine={{ stroke: "#e0e0e0" }}
                    tickFormatter={(value) => `$${(Math.abs(value) / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12, fill: "#666" }}
                    axisLine={{ stroke: "#e0e0e0" }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        revenue: "All Revenue",
                        expenses: "Expenses",
                        netIncome: "Net Income",
                      };
                      const displayValue = `$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                      return [displayValue, labels[name] || name];
                    }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}
                  />
                  <ReferenceLine yAxisId="left" y={0} stroke="#e0e0e0" />
                  <Bar yAxisId="left" dataKey="revenue" fill="#22c55e" name="revenue" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="revenue"
                      position="top"
                      fill="#16a34a"
                      fontWeight="bold"
                      fontSize={11}
                      formatter={(value: number) => `$${(value / 1000).toFixed(1)}k`}
                    />
                  </Bar>
                  <Bar yAxisId="left" dataKey="expenses" fill="#ef4444" name="expenses" radius={[0, 0, 4, 4]}>
                    <LabelList
                      dataKey="expenses"
                      position="bottom"
                      fill="#dc2626"
                      fontWeight="bold"
                      fontSize={11}
                      formatter={(value: number) => (value < 0 ? `$${(Math.abs(value) / 1000).toFixed(1)}k` : "")}
                    />
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="netIncome"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: "#3b82f6", strokeWidth: 2, r: 6 }}
                    name="netIncome"
                  >
                    <LabelList
                      dataKey="netIncome"
                      position="top"
                      fill="#2563eb"
                      fontWeight="bold"
                      fontSize={12}
                      offset={10}
                      formatter={(value: number) => `$${(value / 1000).toFixed(1)}k`}
                    />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-green-500 rounded-sm" />
                  <span className="text-gray-600">All Revenue (Stripe + Other)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-red-500 rounded-sm" />
                  <span className="text-gray-600">Operating Expenses (incl. Stripe fees)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-blue-500" style={{ height: "3px" }} />
                  <span className="text-gray-600">Net Income</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {isLoading && <div className="text-center py-12 text-gray-500">Loading saved P&L...</div>}

      {!hasData && !isLoading && !error && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No saved P&L data for this range yet.{" "}
          {quickbooksConnected
            ? 'Click "Refresh from QuickBooks" to pull it in.'
            : "Someone with QuickBooks access needs to connect it and refresh once."}
        </div>
      )}
      </>
      )}
    </div>
  );
}
