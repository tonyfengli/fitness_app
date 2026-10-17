"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
} from "recharts";

import { formatCurrency } from "../lib/parse-all-payments";
import { calculateNewMembers } from "../lib/calculate-new-members";
import { calculateLostMembers } from "../lib/calculate-lost-members";
import {
  MonthData,
  MemberRecord,
  LostMemberRecord,
  AllOverrides,
  PersistedReportData,
} from "../types";
import {
  OVERRIDES_STORAGE_KEY,
  REPORT_DATA_STORAGE_KEY,
  MONTH_NAMES,
  FULL_MONTH_NAMES,
} from "../constants";

interface DerivedMonthData extends MonthData {
  derivedTotalMembers: number;
  filteredNewMembers: MemberRecord[];
  filteredLostMembers: LostMemberRecord[];
  filteredNewCount: number;
  filteredLostCount: number;
  filteredNewRevenue: number;
  filteredLostRevenue: number;
}

export function ReportingTab() {
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [membersViewMonth, setMembersViewMonth] = useState<string | null>(null);
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [showChurnDetails, setShowChurnDetails] = useState(false);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(9);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [overrides, setOverrides] = useState<AllOverrides>({});
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Load overrides and report data from localStorage on mount
  useEffect(() => {
    try {
      const storedOverrides = localStorage.getItem(OVERRIDES_STORAGE_KEY);
      if (storedOverrides) {
        setOverrides(JSON.parse(storedOverrides));
      }

      const storedReport = localStorage.getItem(REPORT_DATA_STORAGE_KEY);
      if (storedReport) {
        const parsed: PersistedReportData = JSON.parse(storedReport);
        setMonthsData(parsed.monthsData);
        setStartMonth(parsed.startMonth);
        setEndMonth(parsed.endMonth);
        setReportYear(parsed.year);
        setLastSavedAt(parsed.savedAt);
      }
    } catch (e) {
      console.error("Failed to load from localStorage:", e);
    }
  }, []);

  // Save overrides to localStorage when they change
  const saveOverrides = (newOverrides: AllOverrides) => {
    setOverrides(newOverrides);
    try {
      localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(newOverrides));
    } catch (e) {
      console.error("Failed to save overrides to localStorage:", e);
    }
  };

  // Toggle a member's exclusion from new or lost
  const toggleExclusion = (monthKey: string, memberId: string, type: "new" | "lost") => {
    const current = overrides[monthKey] || { excludeFromNew: [], excludeFromLost: [] };
    const field = type === "new" ? "excludeFromNew" : "excludeFromLost";
    const currentList = current[field];

    const newList = currentList.includes(memberId)
      ? currentList.filter((id) => id !== memberId)
      : [...currentList, memberId];

    saveOverrides({
      ...overrides,
      [monthKey]: {
        ...current,
        [field]: newList,
      },
    });
  };

  // Check if a member is excluded
  const isExcluded = (monthKey: string, memberId: string, type: "new" | "lost"): boolean => {
    const monthOverrides = overrides[monthKey];
    if (!monthOverrides) return false;
    const field = type === "new" ? "excludeFromNew" : "excludeFromLost";
    return monthOverrides[field].includes(memberId);
  };

  // Compute derived data with overrides applied
  const derivedData: DerivedMonthData[] = useMemo(() => {
    if (monthsData.length === 0) return [];

    const result: DerivedMonthData[] = [];

    for (let i = 0; i < monthsData.length; i++) {
      const m = monthsData[i]!;
      const monthOverrides = overrides[m.monthKey] || { excludeFromNew: [], excludeFromLost: [] };

      // Filter new members (exclude those in override list)
      const filteredNew = m.newMembers.filter(
        (member) => !monthOverrides.excludeFromNew.includes(member.memberId)
      );

      // Filter lost members (exclude those in override list) - includes on hold
      const allLostWithHold = [
        ...m.lostMembers,
        ...m.onHoldMembers.map((oh) => ({ ...oh, type: "hold" as const })),
      ];
      const filteredLost = allLostWithHold.filter(
        (member) => !monthOverrides.excludeFromLost.includes(member.memberId)
      );

      const filteredNewCount = filteredNew.length;
      const filteredLostCount = filteredLost.length;
      const filteredNewRevenue = filteredNew.reduce((sum, x) => sum + x.amount, 0);
      const filteredLostRevenue = filteredLost.reduce((sum, x) => sum + x.amount, 0);

      // Calculate derived total
      let derivedTotal: number;
      if (i === 0) {
        derivedTotal = m.totalMembers;
      } else {
        const prevDerived = result[i - 1]!.derivedTotalMembers;
        derivedTotal = prevDerived + filteredNewCount - filteredLostCount;
      }

      result.push({
        ...m,
        derivedTotalMembers: derivedTotal,
        filteredNewMembers: filteredNew,
        filteredLostMembers: filteredLost,
        filteredNewCount,
        filteredLostCount,
        filteredNewRevenue,
        filteredLostRevenue,
      });
    }

    return result;
  }, [monthsData, overrides]);

  // Simple CSV parser
  const parseCsvSimple = (csv: string): Record<string, string>[] => {
    if (!csv.trim()) return [];
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0]!.split(",").map((h) => h.trim());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!;
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else current += char;
      }
      values.push(current.trim());
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) row[headers[j]!] = values[j] || "";
      rows.push(row);
    }
    return rows;
  };

  const loadReportData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const months: number[] = [];
      const monthNames: string[] = [];
      for (let m = startMonth; m <= endMonth; m++) {
        months.push(m);
        monthNames.push(MONTH_NAMES[m - 1]!);
      }
      const results: MonthData[] = [];

      for (let i = 0; i < months.length; i++) {
        const month = months[i];
        setLoadingProgress(`Loading ${monthNames[i]} (${i + 1}/${months.length})...`);

        if (i > 0) await new Promise((r) => setTimeout(r, 3000));

        const response = await fetch(`/api/kpi/fetch-reports?month=${month}&year=${reportYear}`);
        if (!response.ok) throw new Error(`Failed to fetch ${monthNames[i]}`);

        const { data } = await response.json();

        const paymentRows = parseCsvSimple(data.current.allPaymentsCsv);
        const currentMembersRows = parseCsvSimple(data.current.currentMembersCsv);

        // Build membership type lookup: Member ID -> Membership Type Name
        const membershipTypeLookup = new Map<string, string>();
        for (const row of currentMembersRows) {
          const memberId = row["Member ID"] || "";
          const membershipType = row["Membership Type Name"] || "";
          if (memberId && membershipType) {
            membershipTypeLookup.set(memberId, membershipType);
          }
        }

        // Helper to check if membership type is "Open Gym"
        const isOpenGymType = (membershipType: string): boolean => {
          const typeLower = membershipType.toLowerCase();
          return typeLower.includes("open gym") || typeLower.includes("opengym");
        };

        let ptRevenue = 0,
          smallGroupRevenue = 0,
          openGymRevenue = 0,
          totalRevenue = 0,
          groupRevenue = 0;

        const memberTotals = new Map<string, { name: string; total: number; group: number }>();

        for (const row of paymentRows) {
          const memberId = row["Member ID"] || "";
          const memberName = row["Name"] || "";
          const amount = parseFloat((row["Payment Amount"] || "0").replace(/[$,]/g, "")) || 0;
          const details = row["Payment Details"] || "";

          totalRevenue += amount;

          if (!memberTotals.has(memberId)) {
            memberTotals.set(memberId, { name: memberName, total: 0, group: 0 });
          }
          const memberData = memberTotals.get(memberId)!;
          memberData.total += amount;
          if (memberName && !memberData.name) memberData.name = memberName;

          if (details.includes("Personal Training")) {
            ptRevenue += amount;
          } else if (details.includes("Gym Memberships")) {
            // Cross-reference with membership type to separate Open Gym from Classes
            const membershipType = membershipTypeLookup.get(memberId) || "";
            if (isOpenGymType(membershipType)) {
              openGymRevenue += amount;
            } else {
              // All other Gym Memberships = Classes (including "unclear" types)
              smallGroupRevenue += amount;
            }
            memberData.group += amount;
            groupRevenue += amount;
          }
        }

        let totalMembers = 0;
        let groupMembers = 0;
        const payingMembersList: MemberRecord[] = [];
        for (const [memberId, mData] of memberTotals) {
          if (memberId && mData.total > 0) {
            totalMembers++;
            payingMembersList.push({ memberId, name: mData.name || `Member ${memberId}`, amount: mData.total });
          }
          if (memberId && mData.group > 0) groupMembers++;
        }
        payingMembersList.sort((a, b) => b.amount - a.amount);

        const monthKey = `${reportYear}-${String(month).padStart(2, "0")}`;

        const newMembersResult = calculateNewMembers(
          data.current.allPaymentsCsv,
          data.previous.allPaymentsCsv,
          data.previous2.allPaymentsCsv
        );

        const lostMembersResult = calculateLostMembers(
          data.current.allPaymentsCsv,
          data.previous.allPaymentsCsv,
          data.previous2.allPaymentsCsv,
          data.current.currentMembersCsv,
          data.previous.currentMembersCsv,
          data.current.membersOnHoldCsv,
          data.previous.membersOnHoldCsv
        );

        const arm = totalMembers > 0 ? totalRevenue / totalMembers : 0;
        const armGroups = groupMembers > 0 ? groupRevenue / groupMembers : 0;

        const allNewMembers: MemberRecord[] = [
          ...newMembersResult.newGroupMembers.map((m) => ({ memberId: m.memberId, name: m.name, amount: m.amount })),
          ...newMembersResult.newPtClients.map((m) => ({ memberId: m.memberId, name: m.name, amount: m.amount })),
        ];

        const allLostMembers: LostMemberRecord[] = [
          ...lostMembersResult.lostGroupMembers.map((m) => ({
            memberId: m.memberId,
            name: m.name,
            amount: m.amount,
            type: m.type,
          })),
          ...lostMembersResult.lostPtClients.map((m) => ({
            memberId: m.memberId,
            name: m.name,
            amount: m.amount,
            type: m.type,
          })),
        ];

        const onHoldMembersList: MemberRecord[] = lostMembersResult.newlyOnHold.map((m) => ({
          memberId: m.memberId,
          name: m.name,
          amount: m.amount,
        }));

        const totalLostCount =
          lostMembersResult.lostGroupCount + lostMembersResult.lostPtCount + lostMembersResult.newlyOnHoldCount;
        const totalLostRevenue =
          lostMembersResult.lostGroupRevenue + lostMembersResult.lostPtRevenue + lostMembersResult.newlyOnHoldRevenue;

        results.push({
          month: monthNames[i]!,
          year: reportYear,
          monthKey,
          ptRevenue,
          smallGroupRevenue,
          openGymRevenue,
          totalRevenue,
          totalMembers,
          arm,
          groupRevenue,
          groupMembers,
          armGroups,
          newMembers: allNewMembers,
          newMembersCount: newMembersResult.groupMemberCount + newMembersResult.ptClientCount,
          newMembersRevenue: newMembersResult.groupMemberRevenue + newMembersResult.ptClientRevenue,
          newGroupMembersCount: newMembersResult.groupMemberCount,
          newGroupMembersRevenue: newMembersResult.groupMemberRevenue,
          newPtClientsCount: newMembersResult.ptClientCount,
          newPtClientsRevenue: newMembersResult.ptClientRevenue,
          lostMembers: allLostMembers,
          lostMembersCount: totalLostCount,
          lostMembersRevenue: totalLostRevenue,
          lostGroupCount: lostMembersResult.lostGroupCount,
          lostGroupRevenue: lostMembersResult.lostGroupRevenue,
          lostPtCount: lostMembersResult.lostPtCount,
          lostPtRevenue: lostMembersResult.lostPtRevenue,
          onHoldMembers: onHoldMembersList,
          onHoldCount: lostMembersResult.newlyOnHoldCount,
          onHoldRevenue: lostMembersResult.newlyOnHoldRevenue,
          payingMembers: payingMembersList,
        });
      }

      setMonthsData(results);

      const savedAt = new Date().toISOString();
      const persistedData: PersistedReportData = {
        monthsData: results,
        startMonth,
        endMonth,
        year: reportYear,
        savedAt,
      };
      try {
        localStorage.setItem(REPORT_DATA_STORAGE_KEY, JSON.stringify(persistedData));
        setLastSavedAt(savedAt);
      } catch (e) {
        console.error("Failed to save report data to localStorage:", e);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMonth = (month: string) => {
    setExpandedMonth(expandedMonth === month ? null : month);
    setMembersViewMonth(null);
  };

  const toggleMembersView = (month: string) => {
    setMembersViewMonth(membersViewMonth === month ? null : month);
    setExpandedMonth(null);
  };

  if (monthsData.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8">
        <div className="text-center mb-6">
          <p className="text-gray-700 font-medium mb-4">Select date range for report</p>
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(parseInt(e.target.value))}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                {FULL_MONTH_NAMES.map((name, i) => (
                  <option key={i} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <select
                value={endMonth}
                onChange={(e) => setEndMonth(parseInt(e.target.value))}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                {FULL_MONTH_NAMES.map((name, i) => (
                  <option key={i} value={i + 1} disabled={i + 1 < startMonth}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Year:</label>
              <select
                value={reportYear}
                onChange={(e) => setReportYear(parseInt(e.target.value))}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </select>
            </div>
          </div>
        </div>
        <div className="text-center">
          <button
            onClick={loadReportData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {loadingProgress || "Loading..."}
              </>
            ) : (
              `Load Report Data (${FULL_MONTH_NAMES[startMonth - 1]} – ${FULL_MONTH_NAMES[endMonth - 1]} ${reportYear})`
            )}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Calculate growth percentages using derived totals
  const firstMembers = derivedData[0]?.derivedTotalMembers ?? 0;
  const lastMembers = derivedData[derivedData.length - 1]?.derivedTotalMembers ?? 0;
  const memberGrowth = firstMembers > 0 ? Math.round(((lastMembers - firstMembers) / firstMembers) * 100) : 0;

  // Calculate average new members per month (exclude first month - founding members)
  const ongoingMonths = derivedData.slice(1);
  const totalNewMembers = ongoingMonths.reduce((sum, m) => sum + m.filteredNewCount, 0);
  const avgNewMembersPerMonth = ongoingMonths.length > 0 ? Math.round((totalNewMembers / ongoingMonths.length) * 10) / 10 : 0;

  const firstMonth = derivedData[0]?.month ?? "";
  const lastMonth = derivedData[derivedData.length - 1]?.month ?? "";
  const dataYear = derivedData[0]?.year ?? reportYear;

  const clearCache = () => {
    try {
      localStorage.removeItem(REPORT_DATA_STORAGE_KEY);
      localStorage.removeItem(OVERRIDES_STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear cache:", e);
    }
    setMonthsData([]);
    setOverrides({});
    setLastSavedAt(null);
  };

  const formatSavedAt = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Prepare chart data
  const chartData = derivedData.map((m) => ({
    name: `${m.month} ${m.year}`,
    totalMembers: m.derivedTotalMembers,
    newMembers: m.filteredNewCount,
    lostMembers: -m.filteredLostCount,
    netChange: m.filteredNewCount - m.filteredLostCount,
    ptRevenue: m.ptRevenue,
    openGymRevenue: m.openGymRevenue,
    classesRevenue: m.smallGroupRevenue, // Classes revenue
    groupRevenue: m.groupRevenue,
    totalRevenue: m.totalRevenue,
    arm: m.derivedTotalMembers > 0 ? Math.round(m.totalRevenue / m.derivedTotalMembers) : 0,
    armGroups: Math.round(m.armGroups),
  }));

  const firstPt = derivedData[0]?.ptRevenue ?? 0;
  const lastPt = derivedData[derivedData.length - 1]?.ptRevenue ?? 0;

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">
              Performance Report: {firstMonth}–{lastMonth} {dataYear}
            </h2>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="text-gray-400 hover:text-gray-600"
              title="Change date range"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
          </div>
          {lastSavedAt && <p className="text-xs text-gray-500 mt-0.5">Cached: {formatSavedAt(lastSavedAt)}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={clearCache} className="text-sm text-gray-500 hover:text-gray-700">
            Clear Cache
          </button>
          <button onClick={loadReportData} disabled={isLoading} className="text-sm text-blue-600 hover:text-blue-700">
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Inline Date Picker */}
      {showDatePicker && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">From:</label>
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(parseInt(e.target.value))}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              {FULL_MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">To:</label>
            <select
              value={endMonth}
              onChange={(e) => setEndMonth(parseInt(e.target.value))}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              {FULL_MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1} disabled={i + 1 < startMonth}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Year:</label>
            <select
              value={reportYear}
              onChange={(e) => setReportYear(parseInt(e.target.value))}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </div>
          <button
            onClick={() => {
              setShowDatePicker(false);
              loadReportData();
            }}
            disabled={isLoading}
            className="ml-auto px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isLoading ? "Loading..." : "Load Data"}
          </button>
          <button onClick={() => setShowDatePicker(false)} className="text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      )}

      {/* Chart 1: Membership Overview */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-start">
          <h3 className="font-bold text-gray-900">Membership Overview</h3>
          <div className="flex gap-2">
            {avgNewMembersPerMonth > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-right">
                <div className="text-blue-700 font-semibold">{avgNewMembersPerMonth} avg</div>
                <div className="text-blue-600">new/month</div>
              </div>
            )}
            {memberGrowth > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-right">
                <div className="text-green-700 font-semibold">{memberGrowth}% growth</div>
                <div className="text-green-600">
                  {firstMembers} → {lastMembers} members
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#666" }} axisLine={{ stroke: "#e0e0e0" }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12, fill: "#666" }}
                axisLine={{ stroke: "#e0e0e0" }}
                label={{ value: "Member Change", angle: -90, position: "insideLeft", fontSize: 11, fill: "#999" }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: "#666" }}
                axisLine={{ stroke: "#e0e0e0" }}
                domain={[0, "auto"]}
                label={{ value: "Total Members", angle: 90, position: "insideRight", fontSize: 11, fill: "#999" }}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    newMembers: "New Members",
                    lostMembers: "Lost Members",
                    totalMembers: "Total Members",
                  };
                  const displayValue = name === "lostMembers" ? Math.abs(value) : value;
                  return [displayValue, labels[name] || name];
                }}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}
              />
              <ReferenceLine yAxisId="left" y={0} stroke="#e0e0e0" />
              <Bar yAxisId="left" dataKey="newMembers" fill="#22c55e" name="newMembers" radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="newMembers"
                  position="top"
                  fill="#16a34a"
                  fontWeight="bold"
                  fontSize={12}
                  formatter={(value: number) => `+${value}`}
                />
              </Bar>
              <Bar yAxisId="left" dataKey="lostMembers" fill="#ef4444" name="lostMembers" radius={[0, 0, 4, 4]}>
                <LabelList
                  dataKey="lostMembers"
                  position="bottom"
                  fill="#dc2626"
                  fontWeight="bold"
                  fontSize={12}
                  formatter={(value: number) => (value < 0 ? `${value}` : "")}
                />
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="totalMembers"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: "#3b82f6", strokeWidth: 2, r: 6 }}
                name="totalMembers"
              >
                <LabelList dataKey="totalMembers" position="top" fill="#2563eb" fontWeight="bold" fontSize={14} offset={10} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-green-500 rounded-sm" />
              <span className="text-gray-600">New Members</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-red-500 rounded-sm" />
              <span className="text-gray-600">Lost Members</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 bg-blue-500" style={{ height: "3px" }} />
              <span className="text-gray-600">Total Members</span>
            </div>
          </div>
        </div>

        {/* Member Details - Collapsible */}
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowMemberDetails(!showMemberDetails)}
            className="w-full px-4 py-2 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${showMemberDetails ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Member Details</span>
            </div>
            <span className="text-xs text-blue-500 font-medium">↓ Click a month below to see members</span>
          </button>
          {showMemberDetails && (
            <div className="p-4 pt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-600 w-32"></th>
                    {derivedData.map((m) => (
                      <th key={m.month} className="text-center py-2">
                        <button
                          onClick={() => toggleMonth(m.month)}
                          className={`group px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 mx-auto ${
                            expandedMonth === m.month
                              ? "bg-blue-600 text-white"
                              : "text-gray-600 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-200"
                          }`}
                        >
                          {m.month}
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${
                              expandedMonth === m.month ? "rotate-180" : "group-hover:translate-y-0.5"
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* New Members Row */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-green-600 font-medium">New Members</td>
                    {derivedData.map((m) => (
                      <td key={m.month} className="text-center py-2">
                        <span
                          className={`px-3 py-1 rounded-full font-medium ${expandedMonth === m.month ? "bg-green-100" : ""} text-green-600`}
                        >
                          +{m.filteredNewCount}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Lost/On Hold Row */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-red-600 font-medium">Lost / On Hold</td>
                    {derivedData.map((m) => (
                      <td key={m.month} className="text-center py-2">
                        <span
                          className={`px-3 py-1 rounded-full font-medium ${expandedMonth === m.month ? "bg-red-100" : ""} text-red-600`}
                        >
                          {m.filteredLostCount > 0 ? `-${m.filteredLostCount}` : "0"}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Expanded Details */}
                  {derivedData.map((m) => {
                    if (expandedMonth !== m.month) return null;
                    const allLostWithHold = [
                      ...m.lostMembers,
                      ...m.onHoldMembers.map((oh) => ({ ...oh, type: "hold" as const })),
                    ];

                    return (
                      <tr key={`detail-${m.month}`} className="bg-gray-50">
                        <td colSpan={derivedData.length + 1} className="p-4">
                          <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Click a member name to exclude/include them from calculations
                          </div>
                          <div className="grid md:grid-cols-2 gap-6">
                            {/* New Members */}
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-sm font-semibold text-green-700">New Members</span>
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                  {m.filteredNewCount}
                                </span>
                                <span className="text-xs text-green-600 ml-auto">
                                  +{formatCurrency(m.filteredNewRevenue)}/mo
                                </span>
                              </div>
                              {m.newMembers.length > 0 ? (
                                <div className="grid gap-2">
                                  {m.newMembers.map((member) => {
                                    const excluded = isExcluded(m.monthKey, member.memberId, "new");
                                    return (
                                      <button
                                        key={member.memberId}
                                        onClick={() => toggleExclusion(m.monthKey, member.memberId, "new")}
                                        className={`flex items-center justify-between rounded-lg px-3 py-2 shadow-sm border-l-4 text-left transition-all ${
                                          excluded
                                            ? "bg-gray-100 border-gray-300 opacity-50"
                                            : "bg-white border-green-400 hover:bg-green-50"
                                        }`}
                                      >
                                        <span
                                          className={`font-medium ${excluded ? "text-gray-400 line-through" : "text-gray-700"}`}
                                        >
                                          {member.name}
                                          {excluded && (
                                            <span className="ml-2 text-xs text-gray-500 no-underline">(excluded)</span>
                                          )}
                                        </span>
                                        <span className={`font-semibold ${excluded ? "text-gray-400" : "text-green-600"}`}>
                                          {formatCurrency(member.amount)}/mo
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-gray-400 text-sm bg-white rounded-lg px-3 py-2">
                                  No new members this month
                                </div>
                              )}
                            </div>

                            {/* Lost / On Hold */}
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-sm font-semibold text-red-700">Lost / On Hold</span>
                                <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                  {m.filteredLostCount}
                                </span>
                                <span className="text-xs text-red-600 ml-auto">
                                  -{formatCurrency(m.filteredLostRevenue)}/mo
                                </span>
                              </div>
                              {allLostWithHold.length > 0 ? (
                                <div className="grid gap-2">
                                  {allLostWithHold.map((member) => {
                                    const excluded = isExcluded(m.monthKey, member.memberId, "lost");
                                    const isHold = member.type === "hold";
                                    return (
                                      <button
                                        key={member.memberId}
                                        onClick={() => toggleExclusion(m.monthKey, member.memberId, "lost")}
                                        className={`flex items-center justify-between rounded-lg px-3 py-2 shadow-sm border-l-4 text-left transition-all ${
                                          excluded
                                            ? "bg-gray-100 border-gray-300 opacity-50"
                                            : isHold
                                              ? "bg-white border-amber-400 hover:bg-amber-50"
                                              : "bg-white border-red-400 hover:bg-red-50"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`font-medium ${excluded ? "text-gray-400 line-through" : "text-gray-700"}`}
                                          >
                                            {member.name}
                                          </span>
                                          {!excluded && (
                                            <span
                                              className={`text-xs px-1.5 py-0.5 rounded ${isHold ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
                                            >
                                              {isHold ? "HOLD" : "LOST"}
                                            </span>
                                          )}
                                          {excluded && <span className="text-xs text-gray-500">(excluded)</span>}
                                        </div>
                                        <span
                                          className={`font-semibold ${excluded ? "text-gray-400" : isHold ? "text-amber-600" : "text-red-600"}`}
                                        >
                                          {formatCurrency(member.amount)}/mo
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-gray-400 text-sm bg-white rounded-lg px-3 py-2">
                                  No lost members this month
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Net Change Row */}
                  <tr className="bg-gray-50 font-medium">
                    <td className="py-2 text-gray-900">Net Change</td>
                    {derivedData.map((m) => {
                      const net = m.filteredNewCount - m.filteredLostCount;
                      return (
                        <td key={m.month} className="text-center py-2">
                          <button
                            onClick={() => toggleMembersView(m.month)}
                            className={`px-3 py-1 rounded-lg font-bold transition-all ${
                              membersViewMonth === m.month
                                ? "bg-blue-600 text-white"
                                : net >= 0
                                  ? "text-green-600 hover:bg-green-100"
                                  : "text-red-600 hover:bg-red-100"
                            }`}
                          >
                            {net >= 0 ? "+" : ""}
                            {net}
                          </button>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Expanded Paying Members View */}
                  {derivedData.map((m, idx) => {
                    if (membersViewMonth !== m.month) return null;
                    const net = m.filteredNewCount - m.filteredLostCount;
                    const prevMonth = idx > 0 ? derivedData[idx - 1] : null;
                    const derivedArm = m.derivedTotalMembers > 0 ? Math.round(m.totalRevenue / m.derivedTotalMembers) : 0;

                    return (
                      <tr key={`members-${m.month}`} className="bg-blue-50">
                        <td colSpan={derivedData.length + 1} className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                                  <span className="text-white font-bold text-lg">{m.derivedTotalMembers}</span>
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-gray-900">Paying Members</div>
                                  <div className="text-xs text-gray-500">
                                    {m.month} {m.year}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                {prevMonth && (
                                  <>
                                    <span className="text-gray-500">{prevMonth.derivedTotalMembers}</span>
                                    <span className="text-gray-400">→</span>
                                  </>
                                )}
                                <span className="text-green-600 font-medium">+{m.filteredNewCount}</span>
                                <span className="text-gray-400">/</span>
                                <span className="text-red-600 font-medium">-{m.filteredLostCount}</span>
                                <span className="text-gray-400">=</span>
                                <span className={`font-bold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {net >= 0 ? "+" : ""}
                                  {net} net
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-900">{formatCurrency(m.totalRevenue)}</div>
                              <div className="text-xs text-gray-500">Total Revenue</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <div className="text-2xl font-bold text-blue-600">${derivedArm}</div>
                              <div className="text-xs text-gray-500">ARM (All)</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <div className="text-2xl font-bold text-purple-600">${Math.round(m.armGroups)}</div>
                              <div className="text-xs text-gray-500">ARM (Groups)</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <div className="text-2xl font-bold text-gray-700">{m.groupMembers}</div>
                              <div className="text-xs text-gray-500">Group Members</div>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">All Paying Members</span>
                              <span className="text-xs text-gray-500">{m.payingMembers.length} members</span>
                            </div>
                            <div className="bg-white rounded-lg shadow-sm max-h-64 overflow-y-auto">
                              <div className="divide-y divide-gray-100">
                                {m.payingMembers.map((member) => {
                                  const isNew = m.filteredNewMembers.some((n) => n.memberId === member.memberId);
                                  return (
                                    <div
                                      key={member.memberId}
                                      className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-700">{member.name}</span>
                                        {isNew && (
                                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">NEW</span>
                                        )}
                                      </div>
                                      <span className="text-gray-900 font-medium">{formatCurrency(member.amount)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Churn Rate Section */}
        <div className="border-t border-gray-100">
          <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
            <div className="text-left">
              <h4 className="font-semibold text-gray-900">Monthly Churn Rate</h4>
              <p className="text-xs text-gray-500">Lost members ÷ previous month's total</p>
            </div>
            {(() => {
              const churnRates = derivedData.slice(1).map((m, i) => {
                const prevTotal = derivedData[i]?.derivedTotalMembers || 0;
                return prevTotal > 0 ? (m.filteredLostCount / prevTotal) * 100 : 0;
              });
              const avgChurn = churnRates.length > 0 ? churnRates.reduce((a, b) => a + b, 0) / churnRates.length : 0;
              return (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-right">
                  <div className="text-orange-700 font-semibold">{avgChurn.toFixed(1)}% avg</div>
                  <div className="text-orange-600 text-xs">monthly churn</div>
                </div>
              );
            })()}
          </div>
          <div className="p-4">
            {(() => {
              const churnData = derivedData.map((m, i) => {
                if (i === 0) {
                  return { name: `${m.month} ${m.year}`, churn: null, lostCount: m.filteredLostCount };
                }
                const prevTotal = derivedData[i - 1]?.derivedTotalMembers || 0;
                const churnRate = prevTotal > 0 ? (m.filteredLostCount / prevTotal) * 100 : 0;
                return { name: `${m.month} ${m.year}`, churn: Math.round(churnRate * 10) / 10, lostCount: m.filteredLostCount };
              });

              return (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={churnData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#666" }} axisLine={{ stroke: "#e0e0e0" }} />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#666" }}
                      axisLine={{ stroke: "#e0e0e0" }}
                      tickFormatter={(value) => `${value}%`}
                      domain={[0, "auto"]}
                    />
                    <Tooltip
                      formatter={(value: number | null, name: string) => {
                        if (value === null) return ["N/A", "Churn Rate"];
                        if (name === "churn") return [`${value}%`, "Churn Rate"];
                        return [value, name];
                      }}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}
                    />
                    <Bar dataKey="churn" fill="#f97316" radius={[4, 4, 0, 0]} name="churn">
                      <LabelList
                        dataKey="churn"
                        position="top"
                        fill="#ea580c"
                        fontWeight="bold"
                        fontSize={12}
                        formatter={(value: number | null) => (value !== null ? `${value}%` : "")}
                      />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              );
            })()}
          </div>

          {/* Churn Details Table - Collapsible */}
          <button
            onClick={() => setShowChurnDetails(!showChurnDetails)}
            className="w-full px-4 py-2 bg-gray-50 flex items-center gap-2 hover:bg-gray-100 transition-colors border-t border-gray-100"
          >
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${showChurnDetails ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Churn Details</span>
          </button>
          {showChurnDetails && (
            <div className="px-4 pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-600 w-32"></th>
                    {derivedData.map((m) => (
                      <th key={m.month} className="text-center py-2 font-medium text-gray-600">
                        {m.month}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Churn %</td>
                    {derivedData.map((m, i) => {
                      if (i === 0) {
                        return (
                          <td key={m.month} className="text-center py-2 text-gray-400">
                            —
                          </td>
                        );
                      }
                      const prevTotal = derivedData[i - 1]?.derivedTotalMembers || 0;
                      const churnRate = prevTotal > 0 ? (m.filteredLostCount / prevTotal) * 100 : 0;
                      const churnColor =
                        churnRate > 20 ? "text-red-600" : churnRate > 10 ? "text-orange-600" : "text-green-600";
                      return (
                        <td key={m.month} className={`text-center py-2 font-semibold ${churnColor}`}>
                          {churnRate.toFixed(1)}%
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Lost</td>
                    {derivedData.map((m) => (
                      <td key={m.month} className="text-center py-2 text-red-600">
                        {m.filteredLostCount}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-600">Prev Total</td>
                    {derivedData.map((m, i) => (
                      <td key={m.month} className="text-center py-2 text-gray-500">
                        {i === 0 ? "—" : derivedData[i - 1]?.derivedTotalMembers}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Chart 2: Revenue Breakdown */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-start">
          <h3 className="font-bold text-gray-900">Revenue Breakdown by Source</h3>
          {lastPt > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-right">
              <div className="text-purple-700 font-semibold">PT Revenue</div>
              <div className="text-purple-600">
                ${firstPt.toLocaleString()} → ${lastPt.toLocaleString()}
              </div>
            </div>
          )}
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#666" }} axisLine={{ stroke: "#e0e0e0" }} />
              <YAxis
                tick={{ fontSize: 12, fill: "#666" }}
                axisLine={{ stroke: "#e0e0e0" }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    openGymRevenue: "Open Gym",
                    classesRevenue: "Classes",
                    ptRevenue: "PT",
                  };
                  return [`$${value.toLocaleString()}`, labels[name] || name];
                }}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}
              />
              <Bar dataKey="openGymRevenue" stackId="a" fill="#22c55e" name="openGymRevenue" />
              <Bar dataKey="classesRevenue" stackId="a" fill="#3b82f6" name="classesRevenue" />
              <Bar dataKey="ptRevenue" stackId="a" fill="#a855f7" name="ptRevenue" radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="ptRevenue"
                  position="top"
                  fill="#7c3aed"
                  fontSize={12}
                  fontWeight="bold"
                  formatter={(value: number) => (value > 0 ? `$${(value / 1000).toFixed(1)}k` : "")}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-green-500 rounded-sm" />
              <span className="text-gray-600">Open Gym</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-blue-500 rounded-sm" />
              <span className="text-gray-600">Classes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-purple-500 rounded-sm" />
              <span className="text-gray-600">PT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart 3: ARM */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Average Revenue per Member (ARM)</h3>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 30, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#666" }} axisLine={{ stroke: "#e0e0e0" }} />
              <YAxis
                tick={{ fontSize: 12, fill: "#666" }}
                axisLine={{ stroke: "#e0e0e0" }}
                tickFormatter={(value) => `$${value}`}
                domain={[0, "auto"]}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = { arm: "ARM (All)", armGroups: "ARM (Groups)" };
                  return [`$${value}`, labels[name] || name];
                }}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}
              />
              <Line
                type="monotone"
                dataKey="arm"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: "#3b82f6", strokeWidth: 2, r: 6 }}
                name="arm"
              >
                <LabelList
                  dataKey="arm"
                  position="top"
                  fill="#2563eb"
                  fontWeight="bold"
                  fontSize={14}
                  formatter={(value: number) => `$${value}`}
                />
              </Line>
              <Line
                type="monotone"
                dataKey="armGroups"
                stroke="#22c55e"
                strokeWidth={3}
                dot={{ fill: "#22c55e", strokeWidth: 2, r: 6 }}
                name="armGroups"
              >
                <LabelList
                  dataKey="armGroups"
                  position="bottom"
                  fill="#16a34a"
                  fontWeight="bold"
                  fontSize={14}
                  formatter={(value: number) => `$${value}`}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              ARM (All Members)
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              ARM (Groups Only)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
