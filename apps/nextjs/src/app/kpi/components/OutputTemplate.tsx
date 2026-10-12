"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { TemplateRow, TemplateRowDouble } from "./TemplateRows";
import {
  TemplateData,
  MonthData,
  AllOverrides,
  PersistedReportData,
} from "../types";
import {
  REPORT_DATA_STORAGE_KEY,
  OVERRIDES_STORAGE_KEY,
  ELEV8_MANUAL_STORAGE_PREFIX,
  FULL_MONTH_NAMES,
} from "../constants";

export function OutputTemplate() {
  const templateRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMode, setExportMode] = useState(false);

  // Load data from localStorage (same as Reporting tab)
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [overrides, setOverrides] = useState<AllOverrides>({});
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("");

  // Load monthsData and overrides from localStorage on mount
  useEffect(() => {
    try {
      const storedReport = localStorage.getItem(REPORT_DATA_STORAGE_KEY);
      if (storedReport) {
        const parsed: PersistedReportData = JSON.parse(storedReport);
        setMonthsData(parsed.monthsData);
        // Default to last month in range
        if (parsed.monthsData.length > 0) {
          setSelectedMonthKey(parsed.monthsData[parsed.monthsData.length - 1]!.monthKey);
        }
      }

      const storedOverrides = localStorage.getItem(OVERRIDES_STORAGE_KEY);
      if (storedOverrides) {
        setOverrides(JSON.parse(storedOverrides));
      }
    } catch (e) {
      console.error("Failed to load from localStorage:", e);
    }
  }, []);

  // Compute derived data for selected month (same logic as ReportingTab)
  const selectedMonthData = useMemo(() => {
    if (!selectedMonthKey || monthsData.length === 0) return null;

    const monthIndex = monthsData.findIndex((m) => m.monthKey === selectedMonthKey);
    if (monthIndex === -1) return null;

    // Apply overrides and compute derived totals (same as ReportingTab)
    let derivedTotal = 0;
    for (let i = 0; i <= monthIndex; i++) {
      const m = monthsData[i]!;
      const monthOverrides = overrides[m.monthKey] || { excludeFromNew: [], excludeFromLost: [] };

      // Filter new members
      const filteredNew = m.newMembers.filter(
        (member) => !monthOverrides.excludeFromNew.includes(member.memberId)
      );

      // Filter lost members (includes on hold)
      const allLostWithHold = [
        ...m.lostMembers,
        ...m.onHoldMembers.map((oh) => ({ ...oh, type: "hold" as const })),
      ];
      const filteredLost = allLostWithHold.filter(
        (member) => !monthOverrides.excludeFromLost.includes(member.memberId)
      );

      if (i === 0) {
        derivedTotal = m.totalMembers;
      } else {
        derivedTotal = derivedTotal + filteredNew.length - filteredLost.length;
      }
    }

    const m = monthsData[monthIndex]!;
    const monthOverrides = overrides[m.monthKey] || { excludeFromNew: [], excludeFromLost: [] };

    // Calculate filtered counts for this month
    const filteredNewMembers = m.newMembers.filter(
      (member) => !monthOverrides.excludeFromNew.includes(member.memberId)
    );
    const allLostWithHold = [
      ...m.lostMembers,
      ...m.onHoldMembers.map((oh) => ({ ...oh, type: "hold" as const })),
    ];
    const filteredLostMembers = allLostWithHold.filter(
      (member) => !monthOverrides.excludeFromLost.includes(member.memberId)
    );

    return {
      ...m,
      derivedTotalMembers: derivedTotal,
      filteredNewCount: filteredNewMembers.length,
      filteredLostCount: filteredLostMembers.length,
      filteredNewRevenue: filteredNewMembers.reduce((sum, x) => sum + x.amount, 0),
      filteredLostRevenue: filteredLostMembers.reduce((sum, x) => sum + x.amount, 0),
    };
  }, [monthsData, overrides, selectedMonthKey]);

  // Default template data (all empty)
  const emptyTemplateData: TemplateData = {
    quickbooksRevenue: "",
    openGymRevenue: "",
    ptRevenue: "",
    sportsPerfRevenue: "",
    smallGrpRevenue: "",
    remoteRevenue: "",
    icRevenue: "",
    dayPass: "",
    accessPass: "",
    packs: "",
    bookingFees: "",
    nsfFees: "",
    maintenanceFee: "",
    otherFees: "",
    retailRevenue: "",
    signUpFees: "",
    classPass: "",
    newMembersCount: "",
    newPtClientsCount: "",
    newPtClientsRevenue: "",
    lostMembers: "",
    totalMembers: "",
    msOpenGymRevenue: "",
    msPtRevenue: "",
    msSportsPerfRevenue: "",
    msRemoteRevenue: "",
    msAmbassador: "",
    msIc: "",
    totalArm: "",
    armOpenGym: "",
    armPt: "",
    armSport: "",
    armSmallGrp: "",
    armRemote: "",
    armIc: "",
    averageChurn: "",
    retention: "",
    leg: "",
    ltv: "",
    totalLeads: "",
    totalAdSpend: "",
    frontEndRevenue: "",
    signUpFeesMarketing: "",
    allPaymentsProcessed: "",
    taxPaid: "",
    ptMembershipSales: "",
    retailSales: "",
    tax: "",
    freezeCount: "",
    freezeLost: "",
    cancelledCount: "",
    cancelledLost: "",
    changesCount: "",
    changesLost: "",
    discountTimesUsed: "",
    discountStaffMember: "",
  };

  const [data, setData] = useState<TemplateData>(emptyTemplateData);

  // Load manual entries for selected month from localStorage
  useEffect(() => {
    if (!selectedMonthKey) return;

    try {
      const stored = localStorage.getItem(`${ELEV8_MANUAL_STORAGE_PREFIX}${selectedMonthKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setData(() => ({ ...emptyTemplateData, ...parsed }));
      } else {
        setData(emptyTemplateData);
      }
    } catch (e) {
      console.error("Failed to load manual entries:", e);
      setData(emptyTemplateData);
    }
  }, [selectedMonthKey]);

  // Update auto-populated fields when selectedMonthData changes
  useEffect(() => {
    if (!selectedMonthData) return;

    setData((prev) => ({
      ...prev,
      // Auto-populated from Reporting derived data
      ptRevenue: selectedMonthData.ptRevenue.toFixed(2),
      smallGrpRevenue: selectedMonthData.smallGroupRevenue.toFixed(2),
      newMembersCount: (selectedMonthData.newGroupMembersCount ?? selectedMonthData.filteredNewCount).toString(),
      newPtClientsCount: (selectedMonthData.newPtClientsCount ?? 0).toString(),
      newPtClientsRevenue: (selectedMonthData.newPtClientsRevenue ?? 0).toFixed(2),
      lostMembers: selectedMonthData.filteredLostCount.toString(),
      totalMembers: selectedMonthData.derivedTotalMembers.toString(),
      frontEndRevenue: selectedMonthData.filteredNewRevenue.toFixed(2),
      allPaymentsProcessed: selectedMonthData.totalRevenue.toFixed(2),
      freezeCount: selectedMonthData.onHoldCount.toString(),
      freezeLost: selectedMonthData.onHoldRevenue.toFixed(2),
      cancelledCount: ((selectedMonthData.lostGroupCount ?? 0) + (selectedMonthData.lostPtCount ?? 0)).toString(),
      cancelledLost: ((selectedMonthData.lostGroupRevenue ?? 0) + (selectedMonthData.lostPtRevenue ?? 0)).toFixed(2),
    }));
  }, [selectedMonthData]);

  // Save manual entries to localStorage when data changes
  const saveManualEntries = (newData: TemplateData) => {
    if (!selectedMonthKey) return;
    try {
      localStorage.setItem(`${ELEV8_MANUAL_STORAGE_PREFIX}${selectedMonthKey}`, JSON.stringify(newData));
    } catch (e) {
      console.error("Failed to save manual entries:", e);
    }
  };

  const exportToPDF = async () => {
    if (!templateRef.current) return;

    setIsExporting(true);
    setExportMode(true);

    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const canvas = await html2canvas(templateRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#f9fafb",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let finalWidth = imgWidth;
      let finalHeight = imgHeight;
      if (imgHeight > pageHeight - 20) {
        const ratio = (pageHeight - 20) / imgHeight;
        finalWidth = imgWidth * ratio;
        finalHeight = imgHeight * ratio;
      }

      const x = (pageWidth - finalWidth) / 2;
      const y = 10;

      pdf.addImage(imgData, "PNG", x, y, finalWidth, finalHeight);

      // Use selected month for filename
      const monthNum = parseInt(selectedMonthKey.split("-")[1] || "1") - 1;
      const year = selectedMonthKey.split("-")[0] || new Date().getFullYear();
      const monthName = FULL_MONTH_NAMES[monthNum] || "Unknown";
      pdf.save(`KPI_Report_${monthName}_${year}.pdf`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setExportMode(false);
      setIsExporting(false);
    }
  };

  const updateField = (field: keyof TemplateData, value: string) => {
    setData((prev) => {
      const newData = { ...prev, [field]: value };
      saveManualEntries(newData);
      return newData;
    });
  };

  // Calculate totals
  const addedTotal = [
    data.openGymRevenue,
    data.ptRevenue,
    data.sportsPerfRevenue,
    data.smallGrpRevenue,
    data.remoteRevenue,
    data.icRevenue,
    data.dayPass,
    data.accessPass,
    data.packs,
    data.bookingFees,
    data.nsfFees,
    data.maintenanceFee,
    data.otherFees,
    data.retailRevenue,
    data.signUpFees,
    data.classPass,
  ].reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

  const netMembers = (parseInt(data.newMembersCount) || 0) - (parseInt(data.lostMembers) || 0);

  const totalFrontEndRevenue = (parseFloat(data.frontEndRevenue) || 0) + (parseFloat(data.signUpFeesMarketing) || 0);

  const conversionRate =
    (parseInt(data.totalLeads) || 0) > 0
      ? ((parseInt(data.newMembersCount) || 0) / (parseInt(data.totalLeads) || 1)) * 100 + "%"
      : "";

  const cac =
    (parseInt(data.newMembersCount) || 0) > 0
      ? ((parseFloat(data.totalAdSpend) || 0) / (parseInt(data.newMembersCount) || 1)).toFixed(2)
      : "";

  const totalRetentionLost =
    (parseFloat(data.freezeLost) || 0) + (parseFloat(data.cancelledLost) || 0) + (parseFloat(data.changesLost) || 0);
  const totalRetentionCount =
    (parseInt(data.freezeCount) || 0) + (parseInt(data.cancelledCount) || 0) + (parseInt(data.changesCount) || 0);

  // TOTAL ARM = Total Revenue / Total Paying Members
  const totalArm =
    (parseInt(data.totalMembers) || 0) > 0
      ? ((parseFloat(data.allPaymentsProcessed) || 0) / (parseInt(data.totalMembers) || 1)).toFixed(2)
      : "";

  // No data loaded - prompt user to load in Reporting tab
  if (monthsData.length === 0) {
    return (
      <div className="mt-8 text-center py-12">
        <div className="text-gray-500 mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Report Data Loaded</h3>
        <p className="text-gray-500 mb-4">Load data in the Reporting tab first, then come back here.</p>
      </div>
    );
  }

  // Get month display name
  const getMonthDisplayName = (monthKey: string) => {
    const [year, monthNum] = monthKey.split("-");
    const monthIndex = parseInt(monthNum || "1") - 1;
    return `${FULL_MONTH_NAMES[monthIndex]} ${year}`;
  };

  return (
    <div className="mt-8">
      {/* Month Selector and Export Button */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Month:</label>
          <select
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {monthsData.map((m) => (
              <option key={m.monthKey} value={m.monthKey}>
                {getMonthDisplayName(m.monthKey)}
              </option>
            ))}
          </select>
          {selectedMonthData && (
            <span className="text-xs text-gray-500">(Data from Reporting tab with overrides applied)</span>
          )}
        </div>
        <button
          onClick={exportToPDF}
          disabled={isExporting}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export PDF
            </>
          )}
        </button>
      </div>

      {/* Template Content */}
      <div ref={templateRef} className="grid gap-6 lg:grid-cols-2 bg-gray-50 p-4 rounded-lg">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Financial Stats */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="bg-yellow-100 px-4 py-2 font-semibold text-gray-900 border-b">Financial Stats</div>
            <div className="divide-y divide-gray-100">
              <TemplateRow
                label="Quickbooks Total Revenue"
                value={data.quickbooksRevenue}
                onChange={(v) => updateField("quickbooksRevenue", v)}
              />
              <TemplateRow
                label="Open Gym Revenue"
                value={data.openGymRevenue}
                onChange={(v) => updateField("openGymRevenue", v)}
                disabled
              />
              <TemplateRow
                label="PT Revenue"
                value={data.ptRevenue}
                onChange={(v) => updateField("ptRevenue", v)}
                highlight
                exportMode={exportMode}
              />
              <TemplateRow
                label="Sports Perf. Revenue"
                value={data.sportsPerfRevenue}
                onChange={(v) => updateField("sportsPerfRevenue", v)}
                disabled
              />
              <TemplateRow
                label="Small Grp Revenue"
                value={data.smallGrpRevenue}
                onChange={(v) => updateField("smallGrpRevenue", v)}
                highlight
                exportMode={exportMode}
              />
              <TemplateRow
                label="Remote Revenue"
                value={data.remoteRevenue}
                onChange={(v) => updateField("remoteRevenue", v)}
                disabled
              />
              <TemplateRow label="IC" value={data.icRevenue} onChange={(v) => updateField("icRevenue", v)} disabled />
              <TemplateRow label="Day Pass" value={data.dayPass} onChange={(v) => updateField("dayPass", v)} disabled />
              <TemplateRow
                label="Access Pass"
                value={data.accessPass}
                onChange={(v) => updateField("accessPass", v)}
                disabled
              />
              <TemplateRow
                label="Packs (Class/Training/OG)"
                value={data.packs}
                onChange={(v) => updateField("packs", v)}
                disabled
              />
              <TemplateRow
                label="Booking Fees"
                value={data.bookingFees}
                onChange={(v) => updateField("bookingFees", v)}
                disabled
              />
              <TemplateRow
                label="NSF Fees"
                value={data.nsfFees}
                onChange={(v) => updateField("nsfFees", v)}
                disabled
              />
              <TemplateRow
                label="Maintenance Fee"
                value={data.maintenanceFee}
                onChange={(v) => updateField("maintenanceFee", v)}
                disabled
              />
              <TemplateRow
                label="Other Fees"
                value={data.otherFees}
                onChange={(v) => updateField("otherFees", v)}
                disabled
              />
              <TemplateRow
                label="Retail Revenue"
                value={data.retailRevenue}
                onChange={(v) => updateField("retailRevenue", v)}
                disabled
              />
              <TemplateRow
                label="Sign Up/Upfront Fees"
                value={data.signUpFees}
                onChange={(v) => updateField("signUpFees", v)}
                disabled
              />
              <TemplateRow
                label="ClassPass"
                value={data.classPass}
                onChange={(v) => updateField("classPass", v)}
                disabled
              />
              <TemplateRow label="Added Total" value={addedTotal.toFixed(2)} readOnly bold />
            </div>
          </div>

          {/* Membership Stats */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="bg-yellow-100 px-4 py-2 font-semibold text-gray-900 border-b">Membership Stats</div>
            <div className="divide-y divide-gray-100">
              <TemplateRow
                label="New Group Members"
                value={data.newMembersCount}
                onChange={(v) => updateField("newMembersCount", v)}
                highlight
                exportMode={exportMode}
                isCurrency={false}
              />
              <TemplateRowDouble
                label="New PT Clients"
                value1={data.newPtClientsCount}
                value2={data.newPtClientsRevenue}
                onChange1={(v) => updateField("newPtClientsCount", v)}
                onChange2={(v) => updateField("newPtClientsRevenue", v)}
                header1="Count"
                header2="Revenue"
                highlight
                exportMode={exportMode}
              />
              <TemplateRow
                label="Lost Members"
                value={data.lostMembers}
                onChange={(v) => updateField("lostMembers", v)}
                highlight
                exportMode={exportMode}
                isCurrency={false}
              />
              <TemplateRow label="Net Members" value={netMembers.toString()} readOnly bold isCurrency={false} />
              <TemplateRow
                label="Total Members"
                value={data.totalMembers}
                onChange={(v) => updateField("totalMembers", v)}
                highlight
                exportMode={exportMode}
                isCurrency={false}
              />
              <TemplateRow
                label="Open Gym Revenue"
                value={data.msOpenGymRevenue}
                onChange={(v) => updateField("msOpenGymRevenue", v)}
                disabled
              />
              <TemplateRow
                label="PT Revenue"
                value={data.msPtRevenue}
                onChange={(v) => updateField("msPtRevenue", v)}
                disabled
              />
              <TemplateRow
                label="Sports Perf. Revenue"
                value={data.msSportsPerfRevenue}
                onChange={(v) => updateField("msSportsPerfRevenue", v)}
                disabled
              />
              <TemplateRow
                label="Remote Revenue"
                value={data.msRemoteRevenue}
                onChange={(v) => updateField("msRemoteRevenue", v)}
                disabled
              />
              <TemplateRow
                label="Ambassador"
                value={data.msAmbassador}
                onChange={(v) => updateField("msAmbassador", v)}
                disabled
              />
              <TemplateRow label="IC" value={data.msIc} onChange={(v) => updateField("msIc", v)} disabled />
              <TemplateRow label="TOTAL ARM" value={totalArm} readOnly bold />
              <TemplateRow
                label="ARM Open Gym"
                value={data.armOpenGym}
                onChange={(v) => updateField("armOpenGym", v)}
                disabled
              />
              <TemplateRow
                label="ARM PT"
                value={data.armPt}
                onChange={(v) => updateField("armPt", v)}
                disabled
              />
              <TemplateRow
                label="ARM Sport"
                value={data.armSport}
                onChange={(v) => updateField("armSport", v)}
                disabled
              />
              <TemplateRow
                label="ARM Small Grp"
                value={data.armSmallGrp}
                onChange={(v) => updateField("armSmallGrp", v)}
                disabled
              />
              <TemplateRow
                label="ARM Remote"
                value={data.armRemote}
                onChange={(v) => updateField("armRemote", v)}
                disabled
              />
              <TemplateRow
                label="ARM IC"
                value={data.armIc}
                onChange={(v) => updateField("armIc", v)}
                disabled
              />
              <TemplateRow
                label="Average Churn"
                value={data.averageChurn}
                onChange={(v) => updateField("averageChurn", v)}
              />
              <TemplateRow label="Retention" value={data.retention} onChange={(v) => updateField("retention", v)} />
              <TemplateRow label="LEG (Estimated)" value={data.leg} onChange={(v) => updateField("leg", v)} />
              <TemplateRow label="LTV (Average)" value={data.ltv} onChange={(v) => updateField("ltv", v)} />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Sales & Marketing */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="bg-green-100 px-4 py-2 font-semibold text-gray-900 border-b">Sales & Marketing</div>
            <div className="divide-y divide-gray-100">
              <TemplateRow
                label="Total Leads"
                value={data.totalLeads}
                onChange={(v) => updateField("totalLeads", v)}
              />
              <TemplateRow label="New Group Members" value={data.newMembersCount} readOnly isCurrency={false} />
              <TemplateRow label="New PT Clients" value={data.newPtClientsCount} readOnly isCurrency={false} />
              <TemplateRow label="Conversion Rate" value={conversionRate} readOnly />
              <TemplateRow
                label="Total Ad Spend"
                value={data.totalAdSpend}
                onChange={(v) => updateField("totalAdSpend", v)}
                prefix="$"
              />
              <TemplateRow
                label="Front End Revenue (Group)"
                value={selectedMonthData?.newGroupMembersRevenue?.toFixed(2) || ""}
                readOnly
                highlight
                exportMode={exportMode}
              />
              <TemplateRow
                label="Front End Revenue (PT)"
                value={data.newPtClientsRevenue}
                readOnly
                highlight
                exportMode={exportMode}
              />
              <TemplateRow
                label="Sign Up Fees"
                value={data.signUpFeesMarketing}
                onChange={(v) => updateField("signUpFeesMarketing", v)}
              />
              <TemplateRow label="Total Front End Revenue" value={totalFrontEndRevenue.toFixed(2)} readOnly bold />
              <TemplateRow label="Customer Acquisition Cost" value={cac ? `$${cac}` : ""} readOnly />
            </div>
          </div>

          {/* All Payments Report */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="bg-green-100 px-4 py-2 font-semibold text-gray-900 border-b">All Payments Report</div>
            <div className="divide-y divide-gray-100">
              <TemplateRow
                label="All Payments Processed"
                value={data.allPaymentsProcessed}
                onChange={(v) => updateField("allPaymentsProcessed", v)}
                highlight
                exportMode={exportMode}
              />
              <TemplateRow label="Tax Paid" value={data.taxPaid} onChange={(v) => updateField("taxPaid", v)} />
            </div>
          </div>

          {/* Numbers for Taxes */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="bg-green-100 px-4 py-2 font-semibold text-gray-900 border-b">Numbers for Taxes</div>
            <div className="divide-y divide-gray-100">
              <TemplateRow
                label="PT/membership sales"
                value={data.ptMembershipSales}
                onChange={(v) => updateField("ptMembershipSales", v)}
              />
              <TemplateRow
                label="Retail sales"
                value={data.retailSales}
                onChange={(v) => updateField("retailSales", v)}
              />
              <TemplateRow label="Tax" value={data.tax} onChange={(v) => updateField("tax", v)} />
            </div>
          </div>

          {/* Retention */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="bg-red-100 px-4 py-2 font-semibold text-gray-900 border-b">Retention</div>
            <div className="divide-y divide-gray-100">
              <TemplateRowDouble
                label="Members on Freeze"
                value1={data.freezeCount}
                value2={data.freezeLost}
                onChange1={(v) => updateField("freezeCount", v)}
                onChange2={(v) => updateField("freezeLost", v)}
                header1="# Loss/Freeze"
                header2="$$ Lost"
                highlight
                exportMode={exportMode}
              />
              <TemplateRowDouble
                label="Members Cancelled"
                value1={data.cancelledCount}
                value2={data.cancelledLost}
                onChange1={(v) => updateField("cancelledCount", v)}
                onChange2={(v) => updateField("cancelledLost", v)}
                highlight
                exportMode={exportMode}
              />
              <TemplateRowDouble
                label="Membership Changes"
                value1={data.changesCount}
                value2={data.changesLost}
                onChange1={(v) => updateField("changesCount", v)}
                onChange2={(v) => updateField("changesLost", v)}
                highlight
                exportMode={exportMode}
              />
              <TemplateRowDouble
                label="Total Loss in Membership Revenue"
                value1={totalRetentionCount.toString()}
                value2={totalRetentionLost.toFixed(2)}
                readOnly
                bold
              />
            </div>
          </div>

          {/* Discount Codes Used */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="bg-gray-200 px-4 py-2 font-semibold text-gray-900 border-b">Discount Codes Used</div>
            <div className="divide-y divide-gray-100">
              <TemplateRowDouble
                label=""
                value1={data.discountTimesUsed}
                value2={data.discountStaffMember}
                onChange1={(v) => updateField("discountTimesUsed", v)}
                onChange2={(v) => updateField("discountStaffMember", v)}
                header1="# Times Used"
                header2="Staff/Member"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
