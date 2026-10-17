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
  grossRevenue: number;
  stripeFees: number;
  netRevenue: number;
  expenses: number; // QB total expenses
  expenseBreakdown: ExpenseBreakdown; // QB expenses by category
  netIncome: number;
}

export function PnLTab() {
  const [revenueData, setRevenueData] = useState<RevenueReconciliationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(10);
  const [reportYear, setReportYear] = useState(2026);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false);

  // Check QuickBooks connection status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/quickbooks/status");
        const data = await res.json();
        if (!data.connected) {
          setNeedsAuth(true);
        }
      } catch {
        setNeedsAuth(true);
      }
    };
    checkStatus();
  }, []);

  const clearCache = () => {
    setRevenueData(null);
    setLastSavedAt(null);
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    setNeedsAuth(false);

    try {
      // Fetch all data from reconciliation API (now includes expense breakdown)
      setLoadingProgress("Loading P&L data from Stripe & QuickBooks...");
      const revenueRes = await fetch(
        `/api/admin/revenue-reconciliation?year=${reportYear}&startMonth=${startMonth}&endMonth=${endMonth}`
      );
      const revenueJson = await revenueRes.json();

      if (!revenueRes.ok) {
        if (revenueJson.needsAuth) {
          setNeedsAuth(true);
          return;
        }
        throw new Error(revenueJson.error || "Failed to fetch P&L data");
      }

      setRevenueData(revenueJson);
      setLastSavedAt(new Date().toISOString());
      setLoadingProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch P&L data");
    } finally {
      setIsLoading(false);
      setLoadingProgress("");
    }
  };

  const handleConnect = () => {
    window.location.href = "/api/auth/quickbooks";
  };

  if (needsAuth) {
    return (
      <div className="mt-8">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect QuickBooks</h3>
          <p className="text-gray-600 mb-6">
            Connect your QuickBooks account to pull expense data for P&L calculations.
          </p>
          <button
            onClick={handleConnect}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            Connect to QuickBooks
          </button>
        </div>
      </div>
    );
  }

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
      const monthName = MONTH_NAMES[monthNum - 1]!;

      // Get expenses from the API response (now includes breakdown)
      const expenseBreakdown = revMonth.quickbooks.expenses || emptyExpenses;
      const expenses = expenseBreakdown.total;

      // Stripe revenue = charged net of refunds (gross of fees)
      const stripeRevenue = revMonth.stripe.gross - revMonth.stripe.refunds;
      const otherIncome = revMonth.quickbooks.otherIncome;
      const grossRevenue = stripeRevenue + otherIncome;
      const stripeFees = revMonth.stripe.fees;
      const netRevenue = grossRevenue - stripeFees;
      const netIncome = netRevenue - expenses;

      pnlData.push({
        month: monthName,
        monthNum,
        year: reportYear,
        stripeRevenue,
        otherIncome,
        grossRevenue,
        stripeFees,
        netRevenue,
        expenses,
        expenseBreakdown,
        netIncome,
      });
    }
  }

  // Check if we have data
  const hasData = revenueData !== null && revenueData.months.length > 0;

  // Calculate totals
  const totalStripeRevenue = pnlData.reduce((sum, m) => sum + m.stripeRevenue, 0);
  const totalOtherIncome = pnlData.reduce((sum, m) => sum + m.otherIncome, 0);
  const totalGrossRevenue = pnlData.reduce((sum, m) => sum + m.grossRevenue, 0);
  const totalStripeFees = pnlData.reduce((sum, m) => sum + m.stripeFees, 0);
  const totalNetRevenue = pnlData.reduce((sum, m) => sum + m.netRevenue, 0);
  const totalExpenses = pnlData.reduce((sum, m) => sum + m.expenses, 0);
  const totalNetIncome = pnlData.reduce((sum, m) => sum + m.netIncome, 0);

  // Calculate expense breakdown totals
  const totalExpenseBreakdown: ExpenseBreakdown = pnlData.reduce(
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
      total: acc.total + m.expenseBreakdown.total,
    }),
    { ...emptyExpenses }
  );

  const avgMonthlyProfit = pnlData.length > 0 ? totalNetIncome / pnlData.length : 0;
  const profitMargin = totalGrossRevenue > 0 ? (totalNetIncome / totalGrossRevenue) * 100 : 0;
  const feePercent = totalStripeRevenue > 0 ? (totalStripeFees / totalStripeRevenue) * 100 : 0;

  // Expense category labels for display
  const expenseCategories: { key: keyof Omit<ExpenseBreakdown, "total">; label: string; color: string }[] = [
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
    revenue: m.grossRevenue,
    expenses: -m.expenses,
    netIncome: m.netIncome,
  }));

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatK = (value: number) => {
    return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : formatCurrency(value);
  };

  return (
    <div className="mt-8 space-y-6">
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
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? loadingProgress || "Loading..." : "Load P&L Data"}
        </button>
        {hasData && (
          <button onClick={clearCache} className="text-sm text-gray-500 hover:text-red-600 transition-colors">
            Clear Cache
          </button>
        )}
        {lastSavedAt && (
          <span className="text-xs text-gray-400 ml-auto">
            Last synced: {new Date(lastSavedAt).toLocaleDateString()}{" "}
            {new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      {hasData && (
        <>
          {/* Monthly P&L Table */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Monthly P&L</h3>
              <p className="text-xs text-gray-500 mt-1">
                Revenue from Stripe (source of truth) + QB Other Income | Expenses from QuickBooks
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
                  {/* Other Income */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Other Income</td>
                    {pnlData.map((m) => (
                      <td key={m.month} className="text-right py-2 px-3 text-gray-600 font-mono">
                        {m.otherIncome > 0 ? formatCurrency(m.otherIncome) : "—"}
                      </td>
                    ))}
                    <td className="text-right py-2 px-3 text-gray-600 font-bold bg-gray-50 font-mono">
                      {formatCurrency(totalOtherIncome)}
                    </td>
                  </tr>
                  {/* Gross Revenue */}
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="py-2 font-semibold text-gray-900">Gross Revenue</td>
                    {pnlData.map((m) => (
                      <td key={m.month} className="text-right py-2 px-3 text-gray-900 font-bold font-mono">
                        {formatCurrency(m.grossRevenue)}
                      </td>
                    ))}
                    <td className="text-right py-2 px-3 text-gray-900 font-bold bg-gray-100 font-mono">
                      {formatCurrency(totalGrossRevenue)}
                    </td>
                  </tr>
                  {/* Stripe Fees */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Stripe Fees</td>
                    {pnlData.map((m) => (
                      <td key={m.month} className="text-right py-2 px-3 text-red-600 font-mono">
                        ({formatCurrency(m.stripeFees)})
                      </td>
                    ))}
                    <td className="text-right py-2 px-3 text-red-600 font-bold bg-gray-50 font-mono">
                      ({formatCurrency(totalStripeFees)})
                    </td>
                  </tr>
                  {/* Net Revenue */}
                  <tr className="border-b border-gray-200 bg-blue-50">
                    <td className="py-2 font-semibold text-gray-900">Net Revenue</td>
                    {pnlData.map((m) => (
                      <td key={m.month} className="text-right py-2 px-3 text-blue-700 font-bold font-mono">
                        {formatCurrency(m.netRevenue)}
                      </td>
                    ))}
                    <td className="text-right py-2 px-3 text-blue-700 font-bold bg-blue-100 font-mono">
                      {formatCurrency(totalNetRevenue)}
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
                        revenue: "Gross Revenue",
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
                  <span className="text-gray-600">Gross Revenue (Stripe + Other)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-red-500 rounded-sm" />
                  <span className="text-gray-600">Expenses (QuickBooks)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-blue-500" style={{ height: "3px" }} />
                  <span className="text-gray-600">Net Income</span>
                </div>
              </div>
            </div>
          </div>

          {/* Data Sources */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Data Sources</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
              <div>
                <span className="font-medium">Stripe Revenue:</span> Charged net of refunds (Stripe API)
              </div>
              <div>
                <span className="font-medium">Other Income:</span> Non-Stripe income (QuickBooks)
              </div>
              <div>
                <span className="font-medium">Stripe Fees:</span> Processing fees (Stripe API)
              </div>
              <div>
                <span className="font-medium">Expenses:</span> Operating expenses (QuickBooks)
              </div>
            </div>
          </div>
        </>
      )}

      {!hasData && !isLoading && !error && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          Click "Load P&L Data" to fetch revenue from Stripe and expenses from QuickBooks.
        </div>
      )}
    </div>
  );
}
