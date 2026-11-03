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
import { MobileMembershipChart } from "./MobileMembershipChart";
import { MobileArmChart } from "./MobileArmChart";
import { MobileChurnChart } from "./MobileChurnChart";
import { MobileRevenueChart } from "./MobileRevenueChart";
import { calculateNewMembers } from "../lib/calculate-new-members";
import { calculateLostMembers } from "../lib/calculate-lost-members";
import {
  deriveMonths,
  KPI_START_MONTH,
  KPI_START_YEAR,
  type BillingLink,
  type DerivedMonthData,
  type ManualLost,
} from "../lib/derive-months";
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

interface SnapshotStatus {
  month: number;
  year: number;
  status: "draft" | "finalized";
  finalizedAt: string | null;
}

export function ReportingTab() {
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [focusSection, setFocusSection] = useState<"new" | "lost" | "members" | null>(null);
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [showChurnDetails, setShowChurnDetails] = useState(false);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(9);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [overrides, setOverrides] = useState<AllOverrides>({});
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [snapshotStatuses, setSnapshotStatuses] = useState<Map<string, SnapshotStatus>>(new Map());
  const [billingLinks, setBillingLinks] = useState<BillingLink[]>([]);
  const [manualLost, setManualLost] = useState<ManualLost[]>([]);
  const [linkForm, setLinkForm] = useState({ memberId: "", paidByMemberId: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load overrides from Supabase for a given year
  const loadOverridesFromSupabase = async (year: number): Promise<AllOverrides> => {
    const supabaseOverrides: AllOverrides = {};

    // Query all 12 months for the year
    for (let month = 1; month <= 12; month++) {
      try {
        const response = await fetch(`/api/kpi/snapshot?month=${month}&year=${year}`);
        if (response.ok) {
          const data = await response.json();
          // Load overrides regardless of whether snapshot exists
          if (data.overrides && data.overrides.length > 0) {
            const monthKey = `${year}-${String(month).padStart(2, "0")}`;
            const excludeFromNew: string[] = [];
            const excludeFromLost: string[] = [];

            for (const override of data.overrides) {
              if (override.overrideType === "exclude_from_new") {
                excludeFromNew.push(override.memberId);
              } else if (override.overrideType === "exclude_from_lost") {
                excludeFromLost.push(override.memberId);
              }
            }

            if (excludeFromNew.length > 0 || excludeFromLost.length > 0) {
              supabaseOverrides[monthKey] = { excludeFromNew, excludeFromLost };
            }
          }
        }
      } catch (err) {
        console.error(`Failed to load overrides for ${year}-${month}:`, err);
      }
    }

    return supabaseOverrides;
  };

  // Load overrides and report data from localStorage on mount, then sync with Supabase
  useEffect(() => {
    const loadData = async () => {
      let localOverrides: AllOverrides = {};
      let loadedYear = new Date().getFullYear();

      try {
        // First load from localStorage (fast)
        const storedOverrides = localStorage.getItem(OVERRIDES_STORAGE_KEY);
        if (storedOverrides) {
          localOverrides = JSON.parse(storedOverrides);
          setOverrides(localOverrides);
        }

        const storedReport = localStorage.getItem(REPORT_DATA_STORAGE_KEY);
        if (storedReport) {
          const parsed: PersistedReportData = JSON.parse(storedReport);
          setMonthsData(parsed.monthsData);
          setStartMonth(parsed.startMonth);
          setEndMonth(parsed.endMonth);
          setReportYear(parsed.year);
          setLastSavedAt(parsed.savedAt);
          loadedYear = parsed.year;
        }
      } catch (e) {
        console.error("Failed to load from localStorage:", e);
      }

      // Then load from Supabase (source of truth) and merge
      try {
        const supabaseOverrides = await loadOverridesFromSupabase(loadedYear);

        // Merge: Supabase takes precedence, but keep localStorage entries for months not in Supabase
        const mergedOverrides: AllOverrides = { ...localOverrides };
        for (const [monthKey, data] of Object.entries(supabaseOverrides)) {
          mergedOverrides[monthKey] = data;
        }

        // Update state and localStorage with merged data
        setOverrides(mergedOverrides);
        localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(mergedOverrides));

        if (Object.keys(supabaseOverrides).length > 0) {
          console.log(`Loaded ${Object.keys(supabaseOverrides).length} months of overrides from Supabase`);
        }
      } catch (e) {
        console.error("Failed to load overrides from Supabase:", e);
      }
    };

    loadData();
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

  // Save a single month's data to Supabase
  const saveToSupabase = async (monthData: MonthData) => {
    const monthNum = MONTH_NAMES.indexOf(monthData.month) + 1;
    if (monthNum === 0) return;

    const snapshotData = {
      month: monthData.month,
      year: monthData.year,
      monthKey: monthData.monthKey,
      totalRevenue: Math.round(monthData.totalRevenue * 100) / 100,
      ptRevenue: Math.round(monthData.ptRevenue * 100) / 100,
      smallGroupRevenue: Math.round(monthData.smallGroupRevenue * 100) / 100,
      openGymRevenue: Math.round(monthData.openGymRevenue * 100) / 100,
      arm: Math.round(monthData.arm * 100) / 100,
      armGroups: Math.round(monthData.armGroups * 100) / 100,
      totalMembers: monthData.totalMembers,
      groupMembers: monthData.groupMembers,
      payingMembers: monthData.payingMembers.map(m => ({
        memberId: m.memberId,
        name: m.name,
        revenue: Math.round(m.amount * 100) / 100,
      })),
      newMembers: monthData.newMembers.map(m => ({
        memberId: m.memberId,
        name: m.name,
        revenue: Math.round(m.amount * 100) / 100,
      })),
      lostMembers: [
        ...monthData.lostMembers.map(m => ({
          memberId: m.memberId,
          name: m.name,
          revenue: Math.round(m.amount * 100) / 100,
          type: m.type as "loss" | "hold",
        })),
        ...monthData.onHoldMembers.map(m => ({
          memberId: m.memberId,
          name: m.name,
          revenue: Math.round(m.amount * 100) / 100,
          type: "hold" as const,
        })),
      ],
      onHoldMembers: monthData.onHoldMembers.map(m => ({
        memberId: m.memberId,
        name: m.name,
        revenue: Math.round(m.amount * 100) / 100,
      })),
      newMembersCount: monthData.newMembersCount,
      newMembersRevenue: Math.round(monthData.newMembersRevenue * 100) / 100,
      lostMembersCount: monthData.lostMembersCount,
      lostMembersRevenue: Math.round(monthData.lostMembersRevenue * 100) / 100,
      onHoldCount: monthData.onHoldCount,
      onHoldRevenue: Math.round(monthData.onHoldRevenue * 100) / 100,
    };

    try {
      const response = await fetch("/api/kpi/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: monthNum,
          year: monthData.year,
          data: snapshotData,
          overrides,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save to Supabase");
      }

      return true;
    } catch (err) {
      console.error("Failed to save to Supabase:", err);
      return false;
    }
  };

  // Save all months to Supabase. Finalized months are skipped: to change one, reopen it first.
  const saveAllToSupabase = async () => {
    setIsSaving(true);
    setSaveMessage("Saving to database...");

    const toSave = monthsData.filter((monthData) => {
      const key = `${monthData.year}-${String(MONTH_NAMES.indexOf(monthData.month) + 1).padStart(2, "0")}`;
      return snapshotStatuses.get(key)?.status !== "finalized";
    });
    const skipped = monthsData.length - toSave.length;

    let successCount = 0;
    for (const monthData of toSave) {
      const success = await saveToSupabase(monthData);
      if (success) successCount++;
    }
    await loadSnapshotStatuses();

    const skippedNote = skipped ? ` (${skipped} finalized skipped)` : "";
    if (successCount === toSave.length) {
      setSaveMessage(`Saved ${successCount} months to database${skippedNote}`);
    } else {
      setSaveMessage(`Saved ${successCount}/${toSave.length} months (some failed)${skippedNote}`);
    }

    setIsSaving(false);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Toggle finalization status for a month
  const toggleFinalization = async (month: string, year: number) => {
    const monthNum = MONTH_NAMES.indexOf(month) + 1;
    if (monthNum === 0) return;

    const key = `${year}-${String(monthNum).padStart(2, "0")}`;
    const currentStatus = snapshotStatuses.get(key);
    const newStatus = currentStatus?.status === "finalized" ? "draft" : "finalized";

    setIsSaving(true);
    setSaveMessage(newStatus === "finalized" ? "Finalizing month..." : "Reopening month...");

    try {
      // Finalizing: save the month as shown (data + exclusions) first, then lock it with the
      // numbers on screen, which the KPI parity check holds the Slack bot to
      let approved: Record<string, number | null> | undefined;
      if (newStatus === "finalized") {
        const monthData = monthsData.find((x) => x.month === month && x.year === year);
        if (monthData && !(await saveToSupabase(monthData))) throw new Error("Failed to save month");
        const i = derivedData.findIndex((x) => x.month === month && x.year === year);
        const d = derivedData[i];
        // The running total only matches the dashboard's when the range starts at January 2026
        if (d && derivedData[0]?.monthKey === `${KPI_START_YEAR}-${String(KPI_START_MONTH).padStart(2, "0")}`) {
          const prevTotal = derivedData[i - 1]?.derivedTotalMembers;
          approved = {
            newMembers: d.filteredNewCount,
            lostMembers: d.filteredLostCount,
            totalMembers: d.derivedTotalMembers,
            totalRevenue: Math.round(d.totalRevenue * 100) / 100,
            arm: d.derivedTotalMembers > 0 ? Math.round((d.totalRevenue / d.derivedTotalMembers) * 100) / 100 : 0,
            churnRate: prevTotal ? Math.round((d.filteredLostCount / prevTotal) * 10000) / 100 : null,
          };
        }
      }

      const response = await fetch("/api/kpi/snapshot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: monthNum,
          year,
          status: newStatus,
          approved,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      // Update local state
      const newStatuses = new Map(snapshotStatuses);
      newStatuses.set(key, {
        month: monthNum,
        year,
        status: newStatus,
        finalizedAt: newStatus === "finalized" ? new Date().toISOString() : null,
      });
      setSnapshotStatuses(newStatuses);

      setSaveMessage(newStatus === "finalized" ? "Month finalized!" : "Month reopened for editing");
    } catch (err) {
      console.error("Failed to update status:", err);
      setSaveMessage("Failed to update status");
    }

    setIsSaving(false);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Load snapshot statuses from Supabase
  const loadSnapshotStatuses = async () => {
    const newStatuses = new Map<string, SnapshotStatus>();

    for (const monthData of monthsData) {
      const monthNum = MONTH_NAMES.indexOf(monthData.month) + 1;
      if (monthNum === 0) continue;

      try {
        const response = await fetch(`/api/kpi/snapshot?month=${monthNum}&year=${monthData.year}`);
        if (response.ok) {
          const data = await response.json();
          if (data.exists && data.snapshot) {
            const key = `${monthData.year}-${String(monthNum).padStart(2, "0")}`;
            newStatuses.set(key, {
              month: monthNum,
              year: monthData.year,
              status: data.snapshot.status,
              finalizedAt: data.snapshot.finalizedAt,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load snapshot status:", err);
      }
    }

    setSnapshotStatuses(newStatuses);
  };

  const loadBillingLinks = async () => {
    try {
      const response = await fetch("/api/kpi/billing-links");
      if (response.ok) setBillingLinks((await response.json()).links || []);
    } catch (err) {
      console.error("Failed to load billing links:", err);
    }
  };

  useEffect(() => {
    loadBillingLinks();
  }, []);

  // Manual losses are saved straight to the database (not with the month's save)
  const loadManualLost = async () => {
    try {
      const response = await fetch("/api/kpi/manual-lost");
      if (response.ok) setManualLost((await response.json()).manualLost || []);
    } catch (err) {
      console.error("Failed to load manual losses:", err);
    }
  };

  useEffect(() => {
    loadManualLost();
  }, []);

  const setMemberLost = async (member: { memberId: string; name: string }, m: MonthData, lost: boolean) => {
    if (blockIfFinalized(m.monthKey)) return;
    const month = MONTH_NAMES.indexOf(m.month) + 1;
    if (lost && !confirm(`Mark ${member.name} as lost in ${m.month}? They leave Total Members from ${m.month} on.`)) return;
    setIsSaving(true);
    try {
      const response = lost
        ? await fetch("/api/kpi/manual-lost", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberId: member.memberId, memberName: member.name, month, year: m.year }),
          })
        : await fetch(`/api/kpi/manual-lost?memberId=${encodeURIComponent(member.memberId)}&month=${month}&year=${m.year}`, {
            method: "DELETE",
          });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error);
      await loadManualLost();
    } catch (err) {
      console.error("Failed to update manual loss:", err);
      setSaveMessage(err instanceof Error && err.message ? err.message : "Failed to update member");
      setTimeout(() => setSaveMessage(null), 3000);
    }
    setIsSaving(false);
  };

  const addBillingLink = async (m: MonthData) => {
    const payer = m.payingMembers.find((p) => p.memberId === linkForm.paidByMemberId);
    if (!linkForm.memberId.trim() || !payer) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/kpi/billing-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: linkForm.memberId.trim(), // name is looked up in GymMaster
          paidByMemberId: payer.memberId,
          paidByName: payer.name,
          startMonth: MONTH_NAMES.indexOf(m.month) + 1,
          startYear: m.year,
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      setLinkForm({ memberId: "", paidByMemberId: "" });
      await loadBillingLinks();
    } catch (err) {
      console.error("Failed to save billing link:", err);
      setSaveMessage(err instanceof Error && err.message ? err.message : "Failed to include member");
      setTimeout(() => setSaveMessage(null), 3000);
    }
    setIsSaving(false);
  };

  const removeBillingLink = async (memberId: string) => {
    setIsSaving(true);
    try {
      await fetch(`/api/kpi/billing-links?memberId=${encodeURIComponent(memberId)}`, { method: "DELETE" });
      await loadBillingLinks();
    } catch (err) {
      console.error("Failed to remove billing link:", err);
    }
    setIsSaving(false);
  };

  // Load snapshot statuses when monthsData changes
  useEffect(() => {
    if (monthsData.length > 0) {
      loadSnapshotStatuses();
    }
  }, [monthsData.length]);

  // Toggle a member's exclusion from new or lost
  // A finalized month is locked (its saved numbers are what was approved); reopen to change it
  const blockIfFinalized = (monthKey: string) => {
    if (snapshotStatuses.get(monthKey)?.status !== "finalized") return false;
    setSaveMessage("This month is finalized. Reopen it for editing to change it.");
    setTimeout(() => setSaveMessage(null), 3000);
    return true;
  };

  const toggleExclusion = (monthKey: string, memberId: string, type: "new" | "lost") => {
    if (blockIfFinalized(monthKey)) return;
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

  const derivedData: DerivedMonthData[] = useMemo(
    () => deriveMonths(monthsData, overrides, billingLinks, manualLost),
    [monthsData, overrides, billingLinks, manualLost]
  );

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
    setFocusSection(null);
  };

  // A number in the Member Details table opens that month's panel at its section
  const openMonthSection = (month: string, section: "new" | "lost" | "members") => {
    setExpandedMonth(month);
    setFocusSection(section);
  };

  useEffect(() => {
    if (!expandedMonth || !focusSection) return;
    document.getElementById(`month-${expandedMonth}-${focusSection}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [expandedMonth, focusSection]);

  // Member Details starts open on desktop, closed on phones
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setShowMemberDetails(true);
  }, []);

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
    // Top of the Revenue Breakdown stack: the three sources it draws
    sourceTotal: m.openGymRevenue + m.smallGroupRevenue + m.ptRevenue,
    arm: m.derivedTotalMembers > 0 ? Math.round(m.totalRevenue / m.derivedTotalMembers) : 0,
    armGroups: Math.round(m.armGroups),
  }));

  // Churn per month for the phone chart (the desktop churn section computes the same inline)
  const churnPoints = derivedData.map((m, i) => {
    const prevTotal = i > 0 ? derivedData[i - 1]?.derivedTotalMembers || 0 : 0;
    const rate = prevTotal > 0 ? (m.filteredLostCount / prevTotal) * 100 : 0;
    return { name: `${m.month} ${m.year}`, churn: i === 0 ? null : Math.round(rate * 10) / 10, rate, lostCount: m.filteredLostCount, prevTotal };
  });
  const avgChurnRate =
    churnPoints.length > 1 ? churnPoints.slice(1).reduce((sum, p) => sum + p.rate, 0) / (churnPoints.length - 1) : 0;

  const firstPt = derivedData[0]?.ptRevenue ?? 0;
  const lastPt = derivedData[derivedData.length - 1]?.ptRevenue ?? 0;

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex flex-wrap items-center gap-3">
          {saveMessage && (
            <span className="text-sm text-green-600">{saveMessage}</span>
          )}
          <button
            onClick={saveAllToSupabase}
            disabled={isSaving || monthsData.length === 0}
            className="text-sm text-green-600 hover:text-green-700 disabled:text-gray-400"
          >
            {isSaving ? "Saving..." : "Save to Database"}
          </button>
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
        <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2 justify-between items-start">
          <h3 className="font-bold text-gray-900">Membership Overview</h3>
          {/* Desktop stat chips; on phones these move into the mobile chart's headline */}
          <div className="hidden md:flex gap-2">
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
        {/* Phones: number-first chart with a total line and a new/lost strip */}
        <div className="md:hidden">
          <MobileMembershipChart
            data={chartData}
            avgNewMembersPerMonth={avgNewMembersPerMonth}
            memberGrowth={memberGrowth}
          />
        </div>

        {/* Desktop chart */}
        <div className="hidden md:block p-4">
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
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-2 text-sm">
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
            <span className="hidden md:inline text-xs text-blue-500 font-medium">↓ Click a month below to see members</span>
          </button>
          {showMemberDetails && (
            <div className="p-4 pt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
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
                        <button
                          onClick={() => openMonthSection(m.month, "new")}
                          className={`px-3 py-1 rounded-full font-medium hover:bg-green-100 ${expandedMonth === m.month ? "bg-green-100" : ""} text-green-600`}
                        >
                          +{m.filteredNewCount}
                        </button>
                      </td>
                    ))}
                  </tr>

                  {/* Lost/On Hold Row */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-red-600 font-medium">Lost / On Hold</td>
                    {derivedData.map((m) => (
                      <td key={m.month} className="text-center py-2">
                        <button
                          onClick={() => openMonthSection(m.month, "lost")}
                          className={`px-3 py-1 rounded-full font-medium hover:bg-red-100 ${expandedMonth === m.month ? "bg-red-100" : ""} text-red-600`}
                        >
                          {m.filteredLostCount > 0 ? `-${m.filteredLostCount}` : "0"}
                        </button>
                      </td>
                    ))}
                  </tr>

                  {/* Members Row: running total, same as the chart's Total Members */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-900 font-medium">Members</td>
                    {derivedData.map((m) => (
                      <td key={m.month} className="text-center py-2">
                        <button
                          onClick={() => openMonthSection(m.month, "members")}
                          className={`px-3 py-1 rounded-full font-semibold text-gray-900 hover:bg-gray-200 ${expandedMonth === m.month ? "bg-gray-200" : ""}`}
                        >
                          {m.derivedTotalMembers}
                        </button>
                      </td>
                    ))}
                  </tr>

                  {/* Expanded Details */}
                  {derivedData.map((m) => {
                    if (expandedMonth !== m.month) return null;
                    const manualIds = new Set(m.manualLost.map((x) => x.memberId));
                    const allLostWithHold = [
                      ...m.lostMembers,
                      ...m.onHoldMembers.map((oh) => ({ ...oh, type: "hold" as const })),
                    ].filter((member) => !manualIds.has(member.memberId));
                    // Ring around the section a clicked number pointed to
                    const focusClass = (section: "new" | "lost" | "members") =>
                      focusSection === section ? "rounded-lg ring-2 ring-blue-300 ring-offset-4 ring-offset-gray-50" : "";
                    const derivedArm = m.derivedTotalMembers > 0 ? Math.round(m.totalRevenue / m.derivedTotalMembers) : 0;

                    return (
                      <tr key={`detail-${m.month}`} className="bg-gray-50">
                        <td colSpan={derivedData.length + 1} className="p-4">
                          {/* Month Status & Finalization */}
                          {(() => {
                            const monthNum = MONTH_NAMES.indexOf(m.month) + 1;
                            const key = `${m.year}-${String(monthNum).padStart(2, "0")}`;
                            const status = snapshotStatuses.get(key);
                            const isFinalized = status?.status === "finalized";
                            const hasSavedData = !!status;

                            return (
                              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-gray-900">{m.month} {m.year}</span>
                                  {hasSavedData ? (
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      isFinalized
                                        ? "bg-green-100 text-green-700"
                                        : "bg-yellow-100 text-yellow-700"
                                    }`}>
                                      {isFinalized ? "Finalized" : "Draft"}
                                    </span>
                                  ) : (
                                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                                      Not saved
                                    </span>
                                  )}
                                  {isFinalized && status?.finalizedAt && (
                                    <span className="text-xs text-gray-500">
                                      {new Date(status.finalizedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {!isFinalized && (
                                    <button
                                      onClick={async () => {
                                        setIsSaving(true);
                                        setSaveMessage(`Saving ${m.month}...`);
                                        const success = await saveToSupabase(m);
                                        if (success) {
                                          setSaveMessage(`${m.month} saved!`);
                                          await loadSnapshotStatuses();
                                        } else {
                                          setSaveMessage(`Failed to save ${m.month}`);
                                        }
                                        setIsSaving(false);
                                        setTimeout(() => setSaveMessage(null), 3000);
                                      }}
                                      disabled={isSaving}
                                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
                                    >
                                      Save to Database
                                    </button>
                                  )}
                                  {hasSavedData && (
                                    <button
                                      onClick={() => toggleFinalization(m.month, m.year)}
                                      disabled={isSaving}
                                      className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                                        isFinalized
                                          ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                          : "bg-green-600 text-white hover:bg-green-700"
                                      } disabled:opacity-50`}
                                    >
                                      {isFinalized ? "Reopen for Editing" : "Mark as Final"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                          {/* Month stats, kept small */}
                          <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 text-xs text-gray-500">
                            <span>
                              Revenue <span className="font-medium text-gray-700">{formatCurrency(m.totalRevenue)}</span>
                            </span>
                            <span>
                              ARM <span className="font-medium text-gray-700">${derivedArm}</span>
                            </span>
                            <span>
                              ARM groups <span className="font-medium text-gray-700">${Math.round(m.armGroups)}</span>
                            </span>
                            <span>
                              Group members <span className="font-medium text-gray-700">{m.groupMembers}</span>
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Click a member name to exclude/include them from calculations
                          </div>
                          <div className="grid md:grid-cols-2 gap-6">
                            {/* New Members */}
                            <div id={`month-${m.month}-new`} className={focusClass("new")}>
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
                              {m.newMembers.length + m.linkedAdded.length > 0 ? (
                                <div className="grid gap-2">
                                  {m.linkedAdded.map((l) => (
                                    <div
                                      key={`include-${l.memberId}`}
                                      className="flex items-center justify-between rounded-lg px-3 py-2 shadow-sm border-l-4 bg-white border-green-400"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-medium text-gray-700">{l.memberName}</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">INCLUDED</span>
                                        <span className="text-xs text-gray-500 truncate">paid by {l.paidByName}</span>
                                      </div>
                                      <button
                                        onClick={() => removeBillingLink(l.memberId)}
                                        disabled={isSaving}
                                        className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
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
                            <div id={`month-${m.month}-lost`} className={focusClass("lost")}>
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
                              {allLostWithHold.length + m.linkedLost.length + m.manualLost.length > 0 ? (
                                <div className="grid gap-2">
                                  {m.manualLost.map((x) => (
                                    <div
                                      key={`manual-lost-${x.memberId}`}
                                      className="flex items-center justify-between rounded-lg px-3 py-2 shadow-sm border-l-4 bg-white border-red-400"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-medium text-gray-700">{x.name}</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">MANUAL</span>
                                      </div>
                                      <button
                                        onClick={() => setMemberLost(x, m, false)}
                                        disabled={isSaving}
                                        className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50"
                                      >
                                        Undo
                                      </button>
                                    </div>
                                  ))}
                                  {m.linkedLost.map((l) => (
                                    <div
                                      key={`include-lost-${l.memberId}`}
                                      className="flex items-center gap-2 rounded-lg px-3 py-2 shadow-sm border-l-4 bg-white border-red-400"
                                    >
                                      <span className="font-medium text-gray-700">{l.memberName}</span>
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">LOST</span>
                                      <span className="text-xs text-gray-500">payer {l.paidByName} lost</span>
                                    </div>
                                  ))}
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

                          {/* Members: the running total and exactly who's in it */}
                          <div id={`month-${m.month}-members`} className={`mt-6 ${focusClass("members")}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 rounded-full bg-gray-500" />
                              <span className="text-sm font-semibold text-gray-900">Members</span>
                              <span className="text-xs text-gray-700 bg-gray-200 px-2 py-0.5 rounded-full">
                                {m.derivedTotalMembers}
                              </span>
                              <span className="text-xs text-gray-500 ml-auto">
                                {m.rosterMembers.filter((r) => r.amount !== null).length} paid in {m.month}
                                {m.rosterMembers.length !== m.derivedTotalMembers && ` · ${m.rosterMembers.length} listed`}
                              </span>
                            </div>
                            <div className="bg-white rounded-lg shadow-sm max-h-64 overflow-y-auto divide-y divide-gray-100">
                              {m.rosterMembers.map((member) => (
                                <div key={member.memberId} className="flex items-center justify-between px-3 py-2 text-sm">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-gray-700">{member.name}</span>
                                    {member.isNew && (
                                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">NEW</span>
                                    )}
                                    {member.paidBy && <span className="text-xs text-gray-500 truncate">paid by {member.paidBy}</span>}
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    {member.amount !== null ? (
                                      <span className="text-gray-900 font-medium">{formatCurrency(member.amount)}</span>
                                    ) : (
                                      <span className="text-xs text-gray-400">{member.paidBy ? "—" : "no payment"}</span>
                                    )}
                                    <button
                                      onClick={() => setMemberLost(member, m, true)}
                                      disabled={isSaving}
                                      title={`Count ${member.name} as lost from ${m.month}`}
                                      className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                                    >
                                      Mark lost
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Include a member paid for by someone else */}
                          <div className="mt-6 pt-4 border-t border-gray-200">
                            <div className="text-sm font-semibold text-gray-900 mb-1">Include a member</div>
                            <div className="text-xs text-gray-500 mb-3">
                              For members paid for through someone else&apos;s account. They count as new in {m.month} and stay
                              in Total Members while their payer pays.
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                value={linkForm.memberId}
                                onChange={(e) => setLinkForm({ ...linkForm, memberId: e.target.value })}
                                placeholder="GymMaster ID"
                                className="w-32 text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
                              />
                              <select
                                value={linkForm.paidByMemberId}
                                onChange={(e) => setLinkForm({ ...linkForm, paidByMemberId: e.target.value })}
                                className="w-56 text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
                              >
                                <option value="">Paid by…</option>
                                {[...m.payingMembers]
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map((p) => (
                                    <option key={p.memberId} value={p.memberId}>
                                      {p.name}
                                    </option>
                                  ))}
                              </select>
                              <button
                                onClick={() => addBillingLink(m)}
                                disabled={isSaving || !linkForm.memberId.trim() || !linkForm.paidByMemberId}
                                className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-40"
                              >
                                Include from {m.month}
                              </button>
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
                <div className="hidden md:block bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-right">
                  <div className="text-orange-700 font-semibold">{avgChurn.toFixed(1)}% avg</div>
                  <div className="text-orange-600 text-xs">monthly churn</div>
                </div>
              );
            })()}
          </div>
          {/* Phones: rate-first chart with an average line */}
          <div className="md:hidden">
            <MobileChurnChart data={churnPoints} avgChurn={avgChurnRate} />
          </div>

          {/* Desktop chart */}
          <div className="hidden md:block p-4">
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
            <div className="px-4 pb-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
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
            <div className="hidden md:block bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-right">
              <div className="text-purple-700 font-semibold">PT Revenue</div>
              <div className="text-purple-600">
                ${firstPt.toLocaleString()} → ${lastPt.toLocaleString()}
              </div>
            </div>
          )}
        </div>
        {/* Phones: total-first chart, sources in their bar colors */}
        <div className="md:hidden">
          <MobileRevenueChart data={chartData} />
        </div>

        {/* Desktop chart */}
        <div className="hidden md:block p-4">
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
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]!.payload as (typeof chartData)[number];
                  // Top of the stack first, then the month's total
                  const sources = [
                    { name: "PT", value: row.ptRevenue, color: "#a855f7" },
                    { name: "Classes", value: row.classesRevenue, color: "#3b82f6" },
                    { name: "Open Gym", value: row.openGymRevenue, color: "#22c55e" },
                  ];
                  return (
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
                      <div className="mb-1 font-medium text-gray-900">{label}</div>
                      {sources.map((src) => (
                        <div key={src.name} className="flex items-center justify-between gap-6">
                          <span className="flex items-center gap-1.5 text-gray-600">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: src.color }} />
                            {src.name}
                          </span>
                          <span className="tabular-nums text-gray-900">${Math.round(src.value).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="mt-1 flex justify-between gap-6 border-t border-gray-100 pt-1 font-semibold text-gray-900">
                        <span>Total</span>
                        <span className="tabular-nums">${Math.round(row.sourceTotal).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="openGymRevenue" stackId="a" fill="#22c55e" name="openGymRevenue" />
              <Bar dataKey="classesRevenue" stackId="a" fill="#3b82f6" name="classesRevenue" />
              <Bar dataKey="ptRevenue" stackId="a" fill="#a855f7" name="ptRevenue" radius={[4, 4, 0, 0]}>
                {/* Month total above each stack */}
                <LabelList
                  dataKey="sourceTotal"
                  position="top"
                  fill="#374151"
                  fontSize={12}
                  fontWeight="bold"
                  formatter={(value: number) => (value > 0 ? `$${(value / 1000).toFixed(1)}k` : "")}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-2 text-sm">
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
        {/* Phones: values-first chart, unlabeled lines */}
        <div className="md:hidden">
          <MobileArmChart data={chartData} />
        </div>

        {/* Desktop chart */}
        <div className="hidden md:block p-4">
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
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-2">
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
