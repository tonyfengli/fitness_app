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

import {
  PnLMonthData,
  MonthData,
  StripeMonthData,
  PersistedPnLData,
  PersistedReportData,
} from "../types";
import {
  PNL_DATA_STORAGE_KEY,
  STRIPE_DATA_STORAGE_KEY,
  REPORT_DATA_STORAGE_KEY,
  MONTH_NAMES,
} from "../constants";

export function PnLTab() {
  const [monthsData, setMonthsData] = useState<PnLMonthData[]>([]);
  const [gymMasterData, setGymMasterData] = useState<MonthData[]>([]);
  const [stripeData, setStripeData] = useState<StripeMonthData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [startMonth, setStartMonth] = useState(1); // January
  const [endMonth, setEndMonth] = useState(9); // September
  const [reportYear, setReportYear] = useState(2026);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showVarianceBreakdown, setShowVarianceBreakdown] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      // Load P&L data
      const stored = localStorage.getItem(PNL_DATA_STORAGE_KEY);
      if (stored) {
        const parsed: PersistedPnLData = JSON.parse(stored);
        setMonthsData(parsed.monthsData);
        setStartMonth(parsed.startMonth);
        setEndMonth(parsed.endMonth);
        setReportYear(parsed.year);
        setLastSavedAt(parsed.savedAt);
      }

      // Load Stripe data
      const stripeStored = localStorage.getItem(STRIPE_DATA_STORAGE_KEY);
      if (stripeStored) {
        const stripeParsed = JSON.parse(stripeStored);
        setStripeData(stripeParsed.months || []);
      }

      // Load GymMaster data for comparison
      const gmStored = localStorage.getItem(REPORT_DATA_STORAGE_KEY);
      if (gmStored) {
        const gmParsed: PersistedReportData = JSON.parse(gmStored);
        setGymMasterData(gmParsed.monthsData);
      }
    } catch (e) {
      console.error("Failed to load from localStorage:", e);
    }

    // Check QuickBooks connection status
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

  // Get GymMaster revenue for a given month
  const getGymMasterRevenue = (month: string, year: number): number => {
    const gmMonth = gymMasterData.find((m) => m.month === month && m.year === year);
    return gmMonth?.totalRevenue || 0;
  };

  // Save to localStorage after fetching
  const saveToLocalStorage = (data: PnLMonthData[]) => {
    try {
      const toSave: PersistedPnLData = {
        monthsData: data,
        startMonth,
        endMonth,
        year: reportYear,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(PNL_DATA_STORAGE_KEY, JSON.stringify(toSave));
      setLastSavedAt(toSave.savedAt);
    } catch (e) {
      console.error("Failed to save P&L to localStorage:", e);
    }
  };

  const clearCache = () => {
    localStorage.removeItem(PNL_DATA_STORAGE_KEY);
    localStorage.removeItem(STRIPE_DATA_STORAGE_KEY);
    setMonthsData([]);
    setStripeData([]);
    setLastSavedAt(null);
  };

  const fetchMonthlyPnL = async () => {
    setIsLoading(true);
    setError(null);
    setNeedsAuth(false);
    setMonthsData([]);
    setStripeData([]);

    const results: PnLMonthData[] = [];

    try {
      // Fetch QuickBooks data month by month
      for (let m = startMonth; m <= endMonth; m++) {
        setLoadingProgress(`Loading QuickBooks ${MONTH_NAMES[m - 1]} ${reportYear}...`);

        const startDate = `${reportYear}-${String(m).padStart(2, "0")}-01`;
        const lastDay = new Date(reportYear, m, 0).getDate();
        const endDate = `${reportYear}-${String(m).padStart(2, "0")}-${lastDay}`;

        const res = await fetch(`/api/quickbooks/pnl?start_date=${startDate}&end_date=${endDate}`);
        const data = await res.json();

        if (!res.ok) {
          if (data.needsAuth) {
            setNeedsAuth(true);
            return;
          }
          throw new Error(data.error || `Failed to fetch ${MONTH_NAMES[m - 1]}`);
        }

        results.push({
          month: MONTH_NAMES[m - 1]!,
          year: reportYear,
          monthNum: m,
          income: data.totalIncome || 0,
          expenses: data.totalExpenses || 0,
          netIncome: data.netIncome || 0,
        });
      }

      setMonthsData(results);
      saveToLocalStorage(results);

      // Fetch Stripe data
      setLoadingProgress("Loading Stripe data...");
      const stripeRes = await fetch(
        `/api/stripe/monthly?start_month=${startMonth}&end_month=${endMonth}&year=${reportYear}`
      );
      const stripeJson = await stripeRes.json();

      if (stripeRes.ok && stripeJson.months) {
        setStripeData(stripeJson.months);
        // Save Stripe data to localStorage
        localStorage.setItem(
          STRIPE_DATA_STORAGE_KEY,
          JSON.stringify({
            months: stripeJson.months,
            startMonth,
            endMonth,
            year: reportYear,
            savedAt: new Date().toISOString(),
          })
        );
      }

      setLoadingProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch P&L");
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
            Connect your QuickBooks account to pull P&L data directly into your dashboard.
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

  // Helper to get Stripe data for a month
  const getStripeMonth = (month: string, year: number): StripeMonthData | undefined => {
    return stripeData.find((s) => s.month === month && s.year === year);
  };

  // Calculate totals and stats
  const totalIncome = monthsData.reduce((sum, m) => sum + m.income, 0);
  const totalExpenses = monthsData.reduce((sum, m) => sum + m.expenses, 0);
  const totalNetIncome = monthsData.reduce((sum, m) => sum + m.netIncome, 0);
  const avgMonthlyProfit = monthsData.length > 0 ? totalNetIncome / monthsData.length : 0;
  const profitMargin = totalIncome > 0 ? (totalNetIncome / totalIncome) * 100 : 0;

  // Calculate GymMaster totals
  const totalGymMasterRevenue = monthsData.reduce((sum, m) => sum + getGymMasterRevenue(m.month, m.year), 0);

  // Calculate Stripe totals
  const totalStripeGross = stripeData.reduce((sum, s) => sum + s.grossAmount, 0);
  const totalStripeFees = stripeData.reduce((sum, s) => sum + s.fees, 0);
  const totalStripeNet = stripeData.reduce((sum, s) => sum + s.netAmount, 0);
  const totalStripeRefunds = stripeData.reduce((sum, s) => sum + s.refunds, 0);
  const avgStripeFeePercentage = totalStripeGross > 0 ? (totalStripeFees / totalStripeGross) * 100 : 0;

  // Variance: Stripe - GymMaster (positive = non-membership income like drop-ins)
  const totalVariance = totalStripeGross - totalGymMasterRevenue;

  // Chart data
  const chartData = monthsData.map((m) => ({
    name: `${m.month} ${m.year}`,
    income: m.income,
    expenses: -m.expenses, // Negative for display below axis
    netIncome: m.netIncome,
  }));

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
          onClick={fetchMonthlyPnL}
          disabled={isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? loadingProgress || "Loading..." : "Load Data"}
        </button>
        {monthsData.length > 0 && (
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

      {monthsData.length > 0 && (
        <>
          {/* Monthly P&L Table - Primary */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-start">
              <h3 className="font-bold text-gray-900">Monthly P&L with Reconciliation</h3>
              <div className="flex gap-2">
                {stripeData.length > 0 && (
                  <div className="bg-purple-50 border-purple-200 border rounded-lg px-3 py-2 text-xs text-right">
                    <div className="text-purple-700 font-semibold">{avgStripeFeePercentage.toFixed(2)}%</div>
                    <div className="text-purple-600">Stripe fees</div>
                  </div>
                )}
                {avgMonthlyProfit !== 0 && (
                  <div
                    className={`${avgMonthlyProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"} border rounded-lg px-3 py-2 text-xs text-right`}
                  >
                    <div className={`${avgMonthlyProfit >= 0 ? "text-green-700" : "text-red-700"} font-semibold`}>
                      ${Math.abs(avgMonthlyProfit).toLocaleString(undefined, { maximumFractionDigits: 0 })} avg
                    </div>
                    <div className={avgMonthlyProfit >= 0 ? "text-green-600" : "text-red-600"}>profit/month</div>
                  </div>
                )}
                {profitMargin !== 0 && (
                  <div
                    className={`${profitMargin >= 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"} border rounded-lg px-3 py-2 text-xs text-right`}
                  >
                    <div className={`${profitMargin >= 0 ? "text-blue-700" : "text-red-700"} font-semibold`}>
                      {profitMargin.toFixed(1)}% margin
                    </div>
                    <div className={profitMargin >= 0 ? "text-blue-600" : "text-red-600"}>profit margin</div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-600 w-32"></th>
                    {monthsData.map((m) => (
                      <th key={m.month} className="text-center py-2 font-medium text-gray-600">
                        {m.month}
                      </th>
                    ))}
                    <th className="text-center py-2 font-medium text-gray-900 bg-gray-50">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* GymMaster Revenue */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">GymMaster</td>
                    {monthsData.map((m) => {
                      const gmRev = getGymMasterRevenue(m.month, m.year);
                      return (
                        <td key={m.month} className="text-center py-2 text-gray-700 font-medium">
                          {gmRev > 0 ? `$${(gmRev / 1000).toFixed(1)}k` : "-"}
                        </td>
                      );
                    })}
                    <td className="text-center py-2 text-gray-700 font-bold bg-gray-50">
                      {totalGymMasterRevenue > 0 ? `$${(totalGymMasterRevenue / 1000).toFixed(1)}k` : "-"}
                    </td>
                  </tr>
                  {/* Stripe Gross */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Stripe Gross</td>
                    {monthsData.map((m) => {
                      const stripe = getStripeMonth(m.month, m.year);
                      return (
                        <td key={m.month} className="text-center py-2 text-purple-600 font-medium">
                          {stripe ? `$${(stripe.grossAmount / 1000).toFixed(1)}k` : "-"}
                        </td>
                      );
                    })}
                    <td className="text-center py-2 text-purple-700 font-bold bg-gray-50">
                      {stripeData.length > 0 ? `$${(totalStripeGross / 1000).toFixed(1)}k` : "-"}
                    </td>
                  </tr>
                  {/* Variance Row - Expandable */}
                  <tr
                    className="border-b border-gray-100 bg-amber-50/50 cursor-pointer hover:bg-amber-100/50 transition-colors"
                    onClick={() => setShowVarianceBreakdown(!showVarianceBreakdown)}
                  >
                    <td className="py-2 text-amber-700 font-medium">
                      <span className="flex items-center gap-1">
                        <svg
                          className={`w-4 h-4 transition-transform ${showVarianceBreakdown ? "rotate-90" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Variance
                      </span>
                    </td>
                    {monthsData.map((m) => {
                      const gmRev = getGymMasterRevenue(m.month, m.year);
                      const stripe = getStripeMonth(m.month, m.year);
                      const variance = stripe ? stripe.grossAmount - gmRev : 0;
                      const isPositive = variance >= 0;
                      return (
                        <td
                          key={m.month}
                          className={`text-center py-2 font-medium ${isPositive ? "text-amber-600" : "text-red-600"}`}
                        >
                          {stripe && gmRev > 0 ? (
                            <span>
                              {isPositive ? "+" : ""}${(variance / 1000).toFixed(1)}k
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                      );
                    })}
                    <td
                      className={`text-center py-2 font-bold bg-amber-100/50 ${totalVariance >= 0 ? "text-amber-700" : "text-red-700"}`}
                    >
                      {stripeData.length > 0 && totalGymMasterRevenue > 0 ? (
                        <span>
                          {totalVariance >= 0 ? "+" : ""}${(totalVariance / 1000).toFixed(1)}k
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                  {/* Variance Breakdown - Expandable */}
                  {showVarianceBreakdown && (
                    <>
                      <tr className="border-b border-gray-100 bg-amber-50/30">
                        <td className="py-1.5 pl-6 text-xs text-amber-600">Non-membership</td>
                        {monthsData.map((m) => {
                          const gmRev = getGymMasterRevenue(m.month, m.year);
                          const stripe = getStripeMonth(m.month, m.year);
                          const variance = stripe ? stripe.grossAmount - gmRev : 0;
                          return (
                            <td key={m.month} className="text-center py-1.5 text-xs text-amber-600">
                              {stripe && gmRev > 0 && variance > 0 ? `$${variance.toFixed(0)}` : "-"}
                            </td>
                          );
                        })}
                        <td className="text-center py-1.5 text-xs text-amber-700 font-medium bg-amber-50/50">
                          {totalVariance > 0 ? `$${totalVariance.toFixed(0)}` : "-"}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-amber-50/30">
                        <td className="py-1.5 pl-6 text-xs text-gray-500">Refunds</td>
                        {monthsData.map((m) => {
                          const stripe = getStripeMonth(m.month, m.year);
                          return (
                            <td key={m.month} className="text-center py-1.5 text-xs text-red-500">
                              {stripe && stripe.refunds > 0 ? `-$${stripe.refunds.toFixed(0)}` : "-"}
                            </td>
                          );
                        })}
                        <td className="text-center py-1.5 text-xs text-red-600 font-medium bg-amber-50/50">
                          {totalStripeRefunds > 0 ? `-$${totalStripeRefunds.toFixed(0)}` : "-"}
                        </td>
                      </tr>
                    </>
                  )}
                  {/* Stripe Fees */}
                  <tr className="border-b border-gray-100 bg-purple-50/30">
                    <td className="py-2 text-purple-700 font-medium">Stripe Fees</td>
                    {monthsData.map((m) => {
                      const stripe = getStripeMonth(m.month, m.year);
                      const pct = stripe && stripe.grossAmount > 0 ? (stripe.fees / stripe.grossAmount) * 100 : 0;
                      return (
                        <td key={m.month} className="text-center py-2 text-purple-600 font-medium">
                          {stripe ? (
                            <span>
                              ${(stripe.fees / 1000).toFixed(2)}k
                              <span className="text-purple-400 text-xs ml-1">({pct.toFixed(1)}%)</span>
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center py-2 text-purple-700 font-bold bg-purple-100/50">
                      {stripeData.length > 0 ? (
                        <span>
                          ${(totalStripeFees / 1000).toFixed(2)}k
                          <span className="text-purple-500 text-xs ml-1">({avgStripeFeePercentage.toFixed(2)}%)</span>
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                  {/* Stripe Net */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Stripe Net</td>
                    {monthsData.map((m) => {
                      const stripe = getStripeMonth(m.month, m.year);
                      return (
                        <td key={m.month} className="text-center py-2 text-green-600 font-medium">
                          {stripe ? `$${(stripe.netAmount / 1000).toFixed(1)}k` : "-"}
                        </td>
                      );
                    })}
                    <td className="text-center py-2 text-green-700 font-bold bg-gray-50">
                      {stripeData.length > 0 ? `$${(totalStripeNet / 1000).toFixed(1)}k` : "-"}
                    </td>
                  </tr>
                  {/* Expenses */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Expenses</td>
                    {monthsData.map((m) => (
                      <td key={m.month} className="text-center py-2 text-red-600 font-medium">
                        ${(m.expenses / 1000).toFixed(1)}k
                      </td>
                    ))}
                    <td className="text-center py-2 text-red-700 font-bold bg-gray-50">
                      ${(totalExpenses / 1000).toFixed(1)}k
                    </td>
                  </tr>
                  {/* Net Income */}
                  <tr className="bg-blue-50">
                    <td className="py-2 font-semibold text-gray-900">Net Income</td>
                    {monthsData.map((m) => (
                      <td
                        key={m.month}
                        className={`text-center py-2 font-bold ${m.netIncome >= 0 ? "text-green-700" : "text-red-700"}`}
                      >
                        ${(m.netIncome / 1000).toFixed(1)}k
                      </td>
                    ))}
                    <td
                      className={`text-center py-2 font-bold bg-blue-100 ${totalNetIncome >= 0 ? "text-green-700" : "text-red-700"}`}
                    >
                      ${(totalNetIncome / 1000).toFixed(1)}k
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Net Income Chart */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Net Income Trend</h3>
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
                        income: "Revenue",
                        expenses: "Expenses",
                        netIncome: "Net Income",
                      };
                      const displayValue = `$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                      return [displayValue, labels[name] || name];
                    }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}
                  />
                  <ReferenceLine yAxisId="left" y={0} stroke="#e0e0e0" />
                  {/* Revenue - Green bars going up */}
                  <Bar yAxisId="left" dataKey="income" fill="#22c55e" name="income" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="income"
                      position="top"
                      fill="#16a34a"
                      fontWeight="bold"
                      fontSize={11}
                      formatter={(value: number) => `$${(value / 1000).toFixed(1)}k`}
                    />
                  </Bar>
                  {/* Expenses - Red bars going down */}
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
                  {/* Net Income - Line */}
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
                  <span className="text-gray-600">Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-red-500 rounded-sm" />
                  <span className="text-gray-600">Expenses</span>
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

      {monthsData.length === 0 && !isLoading && !error && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          Select a date range and click "Load Data" to fetch P&L from QuickBooks.
        </div>
      )}
    </div>
  );
}
