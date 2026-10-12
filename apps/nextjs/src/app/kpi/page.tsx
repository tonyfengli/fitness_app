"use client";

import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  AreaChart,
  Area,
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
  Legend,
  ReferenceLine,
} from "recharts";

import { formatCurrency } from "./lib/parse-all-payments";
import { calculateNewMembers } from "./lib/calculate-new-members";
import { calculateLostMembers } from "./lib/calculate-lost-members";

export default function KPIPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "elev8" | "pnl" | "administrative">("overview");

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-gray-900">KPI Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Track performance metrics and generate reports for Elev8 HQ.
        </p>

        {/* Tab Navigation */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "overview"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("pnl")}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "pnl"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              P&L
            </button>
            <button
              onClick={() => setActiveTab("elev8")}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "elev8"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              For Elev8 HQ
            </button>
            <button
              onClick={() => setActiveTab("administrative")}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "administrative"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Administrative
            </button>
          </nav>
        </div>

        {/* Elev8 HQ Tab */}
        {activeTab === "elev8" && (
          <OutputTemplate />
        )}

        {/* P&L Tab */}
        {activeTab === "pnl" && (
          <PnLTab />
        )}

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <ReportingTab />
        )}

        {/* Administrative Tab */}
        {activeTab === "administrative" && (
          <AdministrativeTab />
        )}
      </div>
    </div>
  );
}

// Output Template Component - reads from localStorage, connected to Reporting data
interface TemplateData {
  // Financial Stats
  quickbooksRevenue: string;
  openGymRevenue: string;
  ptRevenue: string;
  sportsPerfRevenue: string;
  smallGrpRevenue: string;
  remoteRevenue: string;
  icRevenue: string;
  dayPass: string;
  accessPass: string;
  packs: string;
  bookingFees: string;
  nsfFees: string;
  maintenanceFee: string;
  otherFees: string;
  retailRevenue: string;
  signUpFees: string;
  classPass: string;

  // Membership Stats
  newMembersCount: string;
  newPtClientsCount: string;
  newPtClientsRevenue: string;
  lostMembers: string;
  totalMembers: string;
  // Revenue by category (for membership stats section)
  msOpenGymRevenue: string;
  msPtRevenue: string;
  msSportsPerfRevenue: string;
  msRemoteRevenue: string;
  msAmbassador: string;
  msIc: string;
  // ARM calculations
  totalArm: string;
  armOpenGym: string;
  armPt: string;
  armSport: string;
  armSmallGrp: string;
  armRemote: string;
  armIc: string;
  // Other metrics
  averageChurn: string;
  retention: string;
  leg: string;
  ltv: string;

  // Sales & Marketing
  totalLeads: string;
  totalAdSpend: string;
  frontEndRevenue: string;
  signUpFeesMarketing: string;

  // All Payments Report
  allPaymentsProcessed: string;
  taxPaid: string;

  // Numbers for Taxes
  ptMembershipSales: string;
  retailSales: string;
  tax: string;

  // Retention
  freezeCount: string;
  freezeLost: string;
  cancelledCount: string;
  cancelledLost: string;
  changesCount: string;
  changesLost: string;

  // Discount Codes
  discountTimesUsed: string;
  discountStaffMember: string;
}

function OutputTemplate() {
  const templateRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMode, setExportMode] = useState(false);

  // Load data from localStorage (same as Reporting tab)
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [overrides, setOverrides] = useState<AllOverrides>({});
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("");

  const FULL_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

    const monthIndex = monthsData.findIndex(m => m.monthKey === selectedMonthKey);
    if (monthIndex === -1) return null;

    // Apply overrides and compute derived totals (same as ReportingTab)
    let derivedTotal = 0;
    for (let i = 0; i <= monthIndex; i++) {
      const m = monthsData[i]!;
      const monthOverrides = overrides[m.monthKey] || { excludeFromNew: [], excludeFromLost: [] };

      // Filter new members
      const filteredNew = m.newMembers.filter(
        member => !monthOverrides.excludeFromNew.includes(member.memberId)
      );

      // Filter lost members (includes on hold)
      const allLostWithHold = [
        ...m.lostMembers,
        ...m.onHoldMembers.map(oh => ({ ...oh, type: "hold" as const })),
      ];
      const filteredLost = allLostWithHold.filter(
        member => !monthOverrides.excludeFromLost.includes(member.memberId)
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
      member => !monthOverrides.excludeFromNew.includes(member.memberId)
    );
    const allLostWithHold = [
      ...m.lostMembers,
      ...m.onHoldMembers.map(oh => ({ ...oh, type: "hold" as const })),
    ];
    const filteredLostMembers = allLostWithHold.filter(
      member => !monthOverrides.excludeFromLost.includes(member.memberId)
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
    quickbooksRevenue: "", openGymRevenue: "", ptRevenue: "", sportsPerfRevenue: "",
    smallGrpRevenue: "", remoteRevenue: "", icRevenue: "", dayPass: "", accessPass: "",
    packs: "", bookingFees: "", nsfFees: "", maintenanceFee: "", otherFees: "",
    retailRevenue: "", signUpFees: "", classPass: "",
    newMembersCount: "", newPtClientsCount: "", newPtClientsRevenue: "", lostMembers: "",
    totalMembers: "", msOpenGymRevenue: "", msPtRevenue: "", msSportsPerfRevenue: "",
    msRemoteRevenue: "", msAmbassador: "", msIc: "", totalArm: "", armOpenGym: "",
    armPt: "", armSport: "", armSmallGrp: "", armRemote: "", armIc: "",
    averageChurn: "", retention: "", leg: "", ltv: "",
    totalLeads: "", totalAdSpend: "", frontEndRevenue: "", signUpFeesMarketing: "",
    allPaymentsProcessed: "", taxPaid: "", ptMembershipSales: "", retailSales: "", tax: "",
    freezeCount: "", freezeLost: "", cancelledCount: "", cancelledLost: "",
    changesCount: "", changesLost: "", discountTimesUsed: "", discountStaffMember: "",
  };

  const [data, setData] = useState<TemplateData>(emptyTemplateData);

  // Load manual entries for selected month from localStorage
  useEffect(() => {
    if (!selectedMonthKey) return;

    try {
      const stored = localStorage.getItem(`${ELEV8_MANUAL_STORAGE_PREFIX}${selectedMonthKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setData(prev => ({ ...emptyTemplateData, ...parsed }));
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

    setData(prev => ({
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

    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const canvas = await html2canvas(templateRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#f9fafb"
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
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
    setData(prev => {
      const newData = { ...prev, [field]: value };
      saveManualEntries(newData);
      return newData;
    });
  };

  // Calculate totals
  const addedTotal = [
    data.openGymRevenue, data.ptRevenue, data.sportsPerfRevenue, data.smallGrpRevenue,
    data.remoteRevenue, data.icRevenue, data.dayPass, data.accessPass, data.packs,
    data.bookingFees, data.nsfFees, data.maintenanceFee, data.otherFees,
    data.retailRevenue, data.signUpFees, data.classPass
  ].reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

  const netMembers = (parseInt(data.newMembersCount) || 0) - (parseInt(data.lostMembers) || 0);

  const totalFrontEndRevenue = (parseFloat(data.frontEndRevenue) || 0) + (parseFloat(data.signUpFeesMarketing) || 0);

  const conversionRate = (parseInt(data.totalLeads) || 0) > 0
    ? ((parseInt(data.newMembersCount) || 0) / (parseInt(data.totalLeads) || 1) * 100).toFixed(1) + "%"
    : "";

  const cac = (parseInt(data.newMembersCount) || 0) > 0
    ? ((parseFloat(data.totalAdSpend) || 0) / (parseInt(data.newMembersCount) || 1)).toFixed(2)
    : "";

  const totalRetentionLost = (parseFloat(data.freezeLost) || 0) + (parseFloat(data.cancelledLost) || 0) + (parseFloat(data.changesLost) || 0);
  const totalRetentionCount = (parseInt(data.freezeCount) || 0) + (parseInt(data.cancelledCount) || 0) + (parseInt(data.changesCount) || 0);

  // TOTAL ARM = Total Revenue / Total Paying Members
  const totalArm = (parseInt(data.totalMembers) || 0) > 0
    ? ((parseFloat(data.allPaymentsProcessed) || 0) / (parseInt(data.totalMembers) || 1)).toFixed(2)
    : "";

  // No data loaded - prompt user to load in Reporting tab
  if (monthsData.length === 0) {
    return (
      <div className="mt-8 text-center py-12">
        <div className="text-gray-500 mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
            <span className="text-xs text-gray-500">
              (Data from Reporting tab with overrides applied)
            </span>
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
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
          <div className="bg-yellow-100 px-4 py-2 font-semibold text-gray-900 border-b">
            Financial Stats
          </div>
          <div className="divide-y divide-gray-100">
            <TemplateRow label="Quickbooks Total Revenue" value={data.quickbooksRevenue} onChange={(v) => updateField("quickbooksRevenue", v)} />
            <TemplateRow label="Open Gym Revenue" value={data.openGymRevenue} onChange={(v) => updateField("openGymRevenue", v)} disabled />
            <TemplateRow label="PT Revenue" value={data.ptRevenue} onChange={(v) => updateField("ptRevenue", v)} highlight exportMode={exportMode} />
            <TemplateRow label="Sports Perf. Revenue" value={data.sportsPerfRevenue} onChange={(v) => updateField("sportsPerfRevenue", v)} disabled />
            <TemplateRow label="Small Grp Revenue" value={data.smallGrpRevenue} onChange={(v) => updateField("smallGrpRevenue", v)} highlight exportMode={exportMode} />
            <TemplateRow label="Remote Revenue" value={data.remoteRevenue} onChange={(v) => updateField("remoteRevenue", v)} disabled />
            <TemplateRow label="IC" value={data.icRevenue} onChange={(v) => updateField("icRevenue", v)} disabled />
            <TemplateRow label="Day Pass" value={data.dayPass} onChange={(v) => updateField("dayPass", v)} disabled />
            <TemplateRow label="Access Pass" value={data.accessPass} onChange={(v) => updateField("accessPass", v)} disabled />
            <TemplateRow label="Packs (Class/Training/OG)" value={data.packs} onChange={(v) => updateField("packs", v)} disabled />
            <TemplateRow label="Booking Fees" value={data.bookingFees} onChange={(v) => updateField("bookingFees", v)} disabled />
            <TemplateRow label="NSF Fees" value={data.nsfFees} onChange={(v) => updateField("nsfFees", v)} disabled />
            <TemplateRow label="Maintenance Fee" value={data.maintenanceFee} onChange={(v) => updateField("maintenanceFee", v)} disabled />
            <TemplateRow label="Other Fees" value={data.otherFees} onChange={(v) => updateField("otherFees", v)} disabled />
            <TemplateRow label="Retail Revenue" value={data.retailRevenue} onChange={(v) => updateField("retailRevenue", v)} disabled />
            <TemplateRow label="Sign Up/Upfront Fees" value={data.signUpFees} onChange={(v) => updateField("signUpFees", v)} disabled />
            <TemplateRow label="ClassPass" value={data.classPass} onChange={(v) => updateField("classPass", v)} disabled />
            <TemplateRow label="Added Total" value={addedTotal.toFixed(2)} readOnly bold />
          </div>
        </div>

        {/* Membership Stats */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="bg-yellow-100 px-4 py-2 font-semibold text-gray-900 border-b">
            Membership Stats
          </div>
          <div className="divide-y divide-gray-100">
            <TemplateRow label="New Group Members" value={data.newMembersCount} onChange={(v) => updateField("newMembersCount", v)} highlight exportMode={exportMode} isCurrency={false} />
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
            <TemplateRow label="Lost Members" value={data.lostMembers} onChange={(v) => updateField("lostMembers", v)} highlight exportMode={exportMode} isCurrency={false} />
            <TemplateRow label="Net Members" value={netMembers.toString()} readOnly bold isCurrency={false} />
            <TemplateRow label="Total Members" value={data.totalMembers} onChange={(v) => updateField("totalMembers", v)} highlight exportMode={exportMode} isCurrency={false} />
            <TemplateRow label="Open Gym Revenue" value={data.msOpenGymRevenue} onChange={(v) => updateField("msOpenGymRevenue", v)} disabled />
            <TemplateRow label="PT Revenue" value={data.msPtRevenue} onChange={(v) => updateField("msPtRevenue", v)} disabled />
            <TemplateRow label="Sports Perf. Revenue" value={data.msSportsPerfRevenue} onChange={(v) => updateField("msSportsPerfRevenue", v)} disabled />
            <TemplateRow label="Remote Revenue" value={data.msRemoteRevenue} onChange={(v) => updateField("msRemoteRevenue", v)} disabled />
            <TemplateRow label="Ambassador" value={data.msAmbassador} onChange={(v) => updateField("msAmbassador", v)} disabled />
            <TemplateRow label="IC" value={data.msIc} onChange={(v) => updateField("msIc", v)} disabled />
            <TemplateRow label="TOTAL ARM" value={totalArm} readOnly bold />
            <TemplateRow label="ARM Open Gym" value={data.armOpenGym} onChange={(v) => updateField("armOpenGym", v)} disabled />
            <TemplateRow label="ARM PT" value={data.armPt} onChange={(v) => updateField("armPt", v)} disabled />
            <TemplateRow label="ARM Sport" value={data.armSport} onChange={(v) => updateField("armSport", v)} disabled />
            <TemplateRow label="ARM Small Grp" value={data.armSmallGrp} onChange={(v) => updateField("armSmallGrp", v)} disabled />
            <TemplateRow label="ARM Remote" value={data.armRemote} onChange={(v) => updateField("armRemote", v)} disabled />
            <TemplateRow label="ARM IC" value={data.armIc} onChange={(v) => updateField("armIc", v)} disabled />
            <TemplateRow label="Average Churn" value={data.averageChurn} onChange={(v) => updateField("averageChurn", v)} />
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
          <div className="bg-green-100 px-4 py-2 font-semibold text-gray-900 border-b">
            Sales & Marketing
          </div>
          <div className="divide-y divide-gray-100">
            <TemplateRow label="Total Leads" value={data.totalLeads} onChange={(v) => updateField("totalLeads", v)} />
            <TemplateRow label="New Group Members" value={data.newMembersCount} readOnly isCurrency={false} />
            <TemplateRow label="New PT Clients" value={data.newPtClientsCount} readOnly isCurrency={false} />
            <TemplateRow label="Conversion Rate" value={conversionRate} readOnly />
            <TemplateRow label="Total Ad Spend" value={data.totalAdSpend} onChange={(v) => updateField("totalAdSpend", v)} prefix="$" />
            <TemplateRow label="Front End Revenue (Group)" value={selectedMonthData?.newGroupMembersRevenue?.toFixed(2) || ""} readOnly highlight exportMode={exportMode} />
            <TemplateRow label="Front End Revenue (PT)" value={data.newPtClientsRevenue} readOnly highlight exportMode={exportMode} />
            <TemplateRow label="Sign Up Fees" value={data.signUpFeesMarketing} onChange={(v) => updateField("signUpFeesMarketing", v)} />
            <TemplateRow label="Total Front End Revenue" value={totalFrontEndRevenue.toFixed(2)} readOnly bold />
            <TemplateRow label="Customer Acquisition Cost" value={cac ? `$${cac}` : ""} readOnly />
          </div>
        </div>

        {/* All Payments Report */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="bg-green-100 px-4 py-2 font-semibold text-gray-900 border-b">
            All Payments Report
          </div>
          <div className="divide-y divide-gray-100">
            <TemplateRow label="All Payments Processed" value={data.allPaymentsProcessed} onChange={(v) => updateField("allPaymentsProcessed", v)} highlight exportMode={exportMode} />
            <TemplateRow label="Tax Paid" value={data.taxPaid} onChange={(v) => updateField("taxPaid", v)} />
          </div>
        </div>

        {/* Numbers for Taxes */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="bg-green-100 px-4 py-2 font-semibold text-gray-900 border-b">
            Numbers for Taxes
          </div>
          <div className="divide-y divide-gray-100">
            <TemplateRow label="PT/membership sales" value={data.ptMembershipSales} onChange={(v) => updateField("ptMembershipSales", v)} />
            <TemplateRow label="Retail sales" value={data.retailSales} onChange={(v) => updateField("retailSales", v)} />
            <TemplateRow label="Tax" value={data.tax} onChange={(v) => updateField("tax", v)} />
          </div>
        </div>

        {/* Retention */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="bg-red-100 px-4 py-2 font-semibold text-gray-900 border-b">
            Retention
          </div>
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
          <div className="bg-gray-200 px-4 py-2 font-semibold text-gray-900 border-b">
            Discount Codes Used
          </div>
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

// Single value row
function TemplateRow({
  label,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  bold = false,
  highlight = false,
  prefix = "",
  isCurrency = true,
  exportMode = false
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  bold?: boolean;
  highlight?: boolean;
  prefix?: string;
  isCurrency?: boolean;
  exportMode?: boolean;
}) {
  // In export mode, highlighted fields render as static text
  const showAsStatic = readOnly || (exportMode && highlight);

  return (
    <div className={`flex items-center justify-between px-4 py-2 ${disabled ? "bg-gray-50" : ""}`}>
      <span className={`text-sm ${disabled ? "text-gray-400" : "text-gray-700"} ${bold ? "font-semibold" : ""}`}>
        {label}
      </span>
      <div className="flex items-center">
        {prefix && <span className="text-sm text-gray-500 mr-1">{prefix}</span>}
        {showAsStatic ? (
          <span className={`text-sm ${bold ? "font-semibold" : ""} text-gray-900 min-w-24 text-right`}>
            {value ? (prefix ? value : (isCurrency ? `$${value}` : value)) : "—"}
          </span>
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            className={`w-28 px-2 py-1 text-sm text-right border rounded
              ${disabled
                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                : highlight
                  ? "bg-green-50 border-green-300 text-gray-900"
                  : "bg-white border-gray-300 text-gray-900"
              }
              focus:outline-none focus:ring-1 focus:ring-blue-500`}
            placeholder={disabled ? "—" : ""}
          />
        )}
      </div>
    </div>
  );
}

// Double value row (for retention section)
function TemplateRowDouble({
  label,
  value1,
  value2,
  onChange1,
  onChange2,
  header1,
  header2,
  readOnly = false,
  bold = false,
  highlight = false,
  exportMode = false
}: {
  label: string;
  value1: string;
  value2: string;
  onChange1?: (value: string) => void;
  onChange2?: (value: string) => void;
  header1?: string;
  header2?: string;
  readOnly?: boolean;
  bold?: boolean;
  highlight?: boolean;
  exportMode?: boolean;
}) {
  // In export mode, highlighted fields render as static text
  const showAsStatic = readOnly || (exportMode && highlight);

  return (
    <div className="px-4 py-2">
      {header1 && header2 && (
        <div className="flex justify-end gap-2 mb-1">
          <span className="w-20 text-xs text-gray-500 text-center">{header1}</span>
          <span className="w-20 text-xs text-gray-500 text-center">{header2}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className={`text-sm text-gray-700 ${bold ? "font-semibold" : ""}`}>{label}</span>
        <div className="flex gap-2">
          {showAsStatic ? (
            <>
              <span className={`w-20 text-sm text-center ${bold ? "font-semibold" : ""}`}>{value1 || "—"}</span>
              <span className={`w-20 text-sm text-center ${bold ? "font-semibold" : ""}`}>{value2 ? `$${value2}` : "—"}</span>
            </>
          ) : (
            <>
              <input
                type="text"
                value={value1}
                onChange={(e) => onChange1?.(e.target.value)}
                className={`w-20 px-2 py-1 text-sm text-center border rounded
                  ${highlight ? "bg-green-50 border-green-300" : "bg-white border-gray-300"}
                  focus:outline-none focus:ring-1 focus:ring-blue-500`}
              />
              <input
                type="text"
                value={value2}
                onChange={(e) => onChange2?.(e.target.value)}
                className={`w-20 px-2 py-1 text-sm text-center border rounded
                  ${highlight ? "bg-green-50 border-green-300" : "bg-white border-gray-300"}
                  focus:outline-none focus:ring-1 focus:ring-blue-500`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Reporting Tab Component - Multi-month view with charts

interface MemberRecord {
  memberId: string;
  name: string;
  amount: number;
}

interface LostMemberRecord extends MemberRecord {
  type: "loss" | "hold";
}

interface MonthData {
  month: string;
  year: number;
  monthKey: string; // e.g., "2026-04" for localStorage keys
  ptRevenue: number;
  smallGroupRevenue: number;
  totalRevenue: number;
  totalMembers: number; // Raw count from payments (used as anchor for month 1)
  arm: number;
  groupRevenue: number;
  groupMembers: number;
  armGroups: number;
  newMembers: MemberRecord[];
  newMembersCount: number;
  newMembersRevenue: number;
  // Separate group/PT new member counts for Elev8 HQ
  newGroupMembersCount: number;
  newGroupMembersRevenue: number;
  newPtClientsCount: number;
  newPtClientsRevenue: number;
  lostMembers: LostMemberRecord[];
  lostMembersCount: number;
  lostMembersRevenue: number;
  // Separate group/PT lost member counts for Elev8 HQ
  lostGroupCount: number;
  lostGroupRevenue: number;
  lostPtCount: number;
  lostPtRevenue: number;
  onHoldMembers: MemberRecord[];
  onHoldCount: number;
  onHoldRevenue: number;
  payingMembers: MemberRecord[];
}

// Override structure for localStorage
interface MonthOverrides {
  excludeFromNew: string[]; // member IDs
  excludeFromLost: string[]; // member IDs
}

interface AllOverrides {
  [monthKey: string]: MonthOverrides;
}

const OVERRIDES_STORAGE_KEY = "kpi-member-overrides";
const REPORT_DATA_STORAGE_KEY = "kpi-report-data";
const ELEV8_MANUAL_STORAGE_PREFIX = "kpi-elev8-manual-"; // + monthKey
const PNL_DATA_STORAGE_KEY = "kpi-pnl-data";
const STRIPE_DATA_STORAGE_KEY = "kpi-stripe-data";

// Structure for persisted report data
interface PersistedReportData {
  monthsData: MonthData[];
  startMonth: number;
  endMonth: number;
  year: number;
  savedAt: string; // ISO timestamp
}

// Structure for persisted P&L data
interface PersistedPnLData {
  monthsData: PnLMonthData[];
  startMonth: number;
  endMonth: number;
  year: number;
  savedAt: string; // ISO timestamp
}

// P&L Tab Component - fetches from QuickBooks API
interface PnLMonthData {
  month: string;
  year: number;
  monthNum: number;
  income: number;
  expenses: number;
  netIncome: number;
}

interface StripeMonthData {
  month: string;
  year: number;
  grossAmount: number;
  fees: number;
  netAmount: number;
  chargeCount: number;
  refunds: number;
}

function PnLTab() {
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

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
    const gmMonth = gymMasterData.find(m => m.month === month && m.year === year);
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
        localStorage.setItem(STRIPE_DATA_STORAGE_KEY, JSON.stringify({
          months: stripeJson.months,
          startMonth,
          endMonth,
          year: reportYear,
          savedAt: new Date().toISOString(),
        }));
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
    return stripeData.find(s => s.month === month && s.year === year);
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
  const chartData = monthsData.map(m => ({
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
              <option key={i} value={i + 1}>{name}</option>
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
              <option key={i} value={i + 1}>{name}</option>
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
          <button
            onClick={clearCache}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Clear Cache
          </button>
        )}
        {lastSavedAt && (
          <span className="text-xs text-gray-400 ml-auto">
            Last synced: {new Date(lastSavedAt).toLocaleDateString()} {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {monthsData.length > 0 && (
        <>
          {/* Monthly P&L Table - Primary */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-start">
              <h3 className="font-bold text-gray-900">Monthly P&L with Reconciliation</h3>
              <div className="flex gap-2">
                {stripeData.length > 0 && (
                  <div className="bg-purple-50 border-purple-200 border rounded-lg px-3 py-2 text-xs text-right">
                    <div className="text-purple-700 font-semibold">
                      {avgStripeFeePercentage.toFixed(2)}%
                    </div>
                    <div className="text-purple-600">Stripe fees</div>
                  </div>
                )}
                {avgMonthlyProfit !== 0 && (
                  <div className={`${avgMonthlyProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-lg px-3 py-2 text-xs text-right`}>
                    <div className={`${avgMonthlyProfit >= 0 ? 'text-green-700' : 'text-red-700'} font-semibold`}>
                      ${Math.abs(avgMonthlyProfit).toLocaleString(undefined, { maximumFractionDigits: 0 })} avg
                    </div>
                    <div className={avgMonthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}>profit/month</div>
                  </div>
                )}
                {profitMargin !== 0 && (
                  <div className={`${profitMargin >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'} border rounded-lg px-3 py-2 text-xs text-right`}>
                    <div className={`${profitMargin >= 0 ? 'text-blue-700' : 'text-red-700'} font-semibold`}>
                      {profitMargin.toFixed(1)}% margin
                    </div>
                    <div className={profitMargin >= 0 ? 'text-blue-600' : 'text-red-600'}>profit margin</div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-600 w-32"></th>
                    {monthsData.map(m => (
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
                    {monthsData.map(m => {
                      const gmRev = getGymMasterRevenue(m.month, m.year);
                      return (
                        <td key={m.month} className="text-center py-2 text-gray-700 font-medium">
                          {gmRev > 0 ? `$${(gmRev / 1000).toFixed(1)}k` : '-'}
                        </td>
                      );
                    })}
                    <td className="text-center py-2 text-gray-700 font-bold bg-gray-50">
                      {totalGymMasterRevenue > 0 ? `$${(totalGymMasterRevenue / 1000).toFixed(1)}k` : '-'}
                    </td>
                  </tr>
                  {/* Stripe Gross */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Stripe Gross</td>
                    {monthsData.map(m => {
                      const stripe = getStripeMonth(m.month, m.year);
                      return (
                        <td key={m.month} className="text-center py-2 text-purple-600 font-medium">
                          {stripe ? `$${(stripe.grossAmount / 1000).toFixed(1)}k` : '-'}
                        </td>
                      );
                    })}
                    <td className="text-center py-2 text-purple-700 font-bold bg-gray-50">
                      {stripeData.length > 0 ? `$${(totalStripeGross / 1000).toFixed(1)}k` : '-'}
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
                          className={`w-4 h-4 transition-transform ${showVarianceBreakdown ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Variance
                      </span>
                    </td>
                    {monthsData.map(m => {
                      const gmRev = getGymMasterRevenue(m.month, m.year);
                      const stripe = getStripeMonth(m.month, m.year);
                      const variance = stripe ? stripe.grossAmount - gmRev : 0;
                      const isPositive = variance >= 0;
                      return (
                        <td key={m.month} className={`text-center py-2 font-medium ${isPositive ? 'text-amber-600' : 'text-red-600'}`}>
                          {stripe && gmRev > 0 ? (
                            <span>{isPositive ? '+' : ''}${(variance / 1000).toFixed(1)}k</span>
                          ) : '-'}
                        </td>
                      );
                    })}
                    <td className={`text-center py-2 font-bold bg-amber-100/50 ${totalVariance >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
                      {stripeData.length > 0 && totalGymMasterRevenue > 0 ? (
                        <span>{totalVariance >= 0 ? '+' : ''}${(totalVariance / 1000).toFixed(1)}k</span>
                      ) : '-'}
                    </td>
                  </tr>
                  {/* Variance Breakdown - Expandable */}
                  {showVarianceBreakdown && (
                    <>
                      <tr className="border-b border-gray-100 bg-amber-50/30">
                        <td className="py-1.5 pl-6 text-xs text-amber-600">Non-membership</td>
                        {monthsData.map(m => {
                          const gmRev = getGymMasterRevenue(m.month, m.year);
                          const stripe = getStripeMonth(m.month, m.year);
                          const variance = stripe ? stripe.grossAmount - gmRev : 0;
                          return (
                            <td key={m.month} className="text-center py-1.5 text-xs text-amber-600">
                              {stripe && gmRev > 0 && variance > 0 ? `$${variance.toFixed(0)}` : '-'}
                            </td>
                          );
                        })}
                        <td className="text-center py-1.5 text-xs text-amber-700 font-medium bg-amber-50/50">
                          {totalVariance > 0 ? `$${totalVariance.toFixed(0)}` : '-'}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-amber-50/30">
                        <td className="py-1.5 pl-6 text-xs text-gray-500">Refunds</td>
                        {monthsData.map(m => {
                          const stripe = getStripeMonth(m.month, m.year);
                          return (
                            <td key={m.month} className="text-center py-1.5 text-xs text-red-500">
                              {stripe && stripe.refunds > 0 ? `-$${stripe.refunds.toFixed(0)}` : '-'}
                            </td>
                          );
                        })}
                        <td className="text-center py-1.5 text-xs text-red-600 font-medium bg-amber-50/50">
                          {totalStripeRefunds > 0 ? `-$${totalStripeRefunds.toFixed(0)}` : '-'}
                        </td>
                      </tr>
                    </>
                  )}
                  {/* Stripe Fees */}
                  <tr className="border-b border-gray-100 bg-purple-50/30">
                    <td className="py-2 text-purple-700 font-medium">Stripe Fees</td>
                    {monthsData.map(m => {
                      const stripe = getStripeMonth(m.month, m.year);
                      const pct = stripe && stripe.grossAmount > 0 ? (stripe.fees / stripe.grossAmount) * 100 : 0;
                      return (
                        <td key={m.month} className="text-center py-2 text-purple-600 font-medium">
                          {stripe ? (
                            <span>
                              ${(stripe.fees / 1000).toFixed(2)}k
                              <span className="text-purple-400 text-xs ml-1">({pct.toFixed(1)}%)</span>
                            </span>
                          ) : '-'}
                        </td>
                      );
                    })}
                    <td className="text-center py-2 text-purple-700 font-bold bg-purple-100/50">
                      {stripeData.length > 0 ? (
                        <span>
                          ${(totalStripeFees / 1000).toFixed(2)}k
                          <span className="text-purple-500 text-xs ml-1">({avgStripeFeePercentage.toFixed(2)}%)</span>
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                  {/* Stripe Net */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Stripe Net</td>
                    {monthsData.map(m => {
                      const stripe = getStripeMonth(m.month, m.year);
                      return (
                        <td key={m.month} className="text-center py-2 text-green-600 font-medium">
                          {stripe ? `$${(stripe.netAmount / 1000).toFixed(1)}k` : '-'}
                        </td>
                      );
                    })}
                    <td className="text-center py-2 text-green-700 font-bold bg-gray-50">
                      {stripeData.length > 0 ? `$${(totalStripeNet / 1000).toFixed(1)}k` : '-'}
                    </td>
                  </tr>
                  {/* Expenses */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Expenses</td>
                    {monthsData.map(m => (
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
                    {monthsData.map(m => (
                      <td key={m.month} className={`text-center py-2 font-bold ${m.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${(m.netIncome / 1000).toFixed(1)}k
                      </td>
                    ))}
                    <td className={`text-center py-2 font-bold bg-blue-100 ${totalNetIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
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
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    tickFormatter={(value) => `$${(Math.abs(value) / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        income: 'Revenue',
                        expenses: 'Expenses',
                        netIncome: 'Net Income',
                      };
                      const displayValue = `$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                      return [displayValue, labels[name] || name];
                    }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e0e0e0' }}
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
                      formatter={(value: number) => value < 0 ? `$${(Math.abs(value) / 1000).toFixed(1)}k` : ''}
                    />
                  </Bar>
                  {/* Net Income - Line */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="netIncome"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 6 }}
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
                  <span className="w-4 h-0.5 bg-blue-500" style={{ height: '3px' }} />
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

function ReportingTab() {
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null); // e.g., "Aug" - expands both new and lost
  const [membersViewMonth, setMembersViewMonth] = useState<string | null>(null); // e.g., "Aug" - shows paying members
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [showChurnDetails, setShowChurnDetails] = useState(false);
  const [startMonth, setStartMonth] = useState(1); // January
  const [endMonth, setEndMonth] = useState(9); // September
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [overrides, setOverrides] = useState<AllOverrides>({});
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const FULL_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Load overrides and report data from localStorage on mount
  useEffect(() => {
    try {
      // Load overrides
      const storedOverrides = localStorage.getItem(OVERRIDES_STORAGE_KEY);
      if (storedOverrides) {
        setOverrides(JSON.parse(storedOverrides));
      }

      // Load report data
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
      ? currentList.filter(id => id !== memberId)
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
  // - Filters out excluded members from new/lost lists
  // - Calculates derived totals: month1 = anchor, month2+ = prev + new - lost
  interface DerivedMonthData extends MonthData {
    derivedTotalMembers: number;
    filteredNewMembers: MemberRecord[];
    filteredLostMembers: LostMemberRecord[];
    filteredNewCount: number;
    filteredLostCount: number;
    filteredNewRevenue: number;
    filteredLostRevenue: number;
  }

  const derivedData: DerivedMonthData[] = useMemo(() => {
    if (monthsData.length === 0) return [];

    const result: DerivedMonthData[] = [];

    for (let i = 0; i < monthsData.length; i++) {
      const m = monthsData[i]!;
      const monthOverrides = overrides[m.monthKey] || { excludeFromNew: [], excludeFromLost: [] };

      // Filter new members (exclude those in override list)
      const filteredNew = m.newMembers.filter(
        member => !monthOverrides.excludeFromNew.includes(member.memberId)
      );

      // Filter lost members (exclude those in override list) - includes on hold
      const allLostWithHold = [
        ...m.lostMembers,
        ...m.onHoldMembers.map(oh => ({ ...oh, type: "hold" as const })),
      ];
      const filteredLost = allLostWithHold.filter(
        member => !monthOverrides.excludeFromLost.includes(member.memberId)
      );

      const filteredNewCount = filteredNew.length;
      const filteredLostCount = filteredLost.length;
      const filteredNewRevenue = filteredNew.reduce((sum, x) => sum + x.amount, 0);
      const filteredLostRevenue = filteredLost.reduce((sum, x) => sum + x.amount, 0);

      // Calculate derived total
      let derivedTotal: number;
      if (i === 0) {
        // First month: anchor = raw totalMembers from payments
        derivedTotal = m.totalMembers;
      } else {
        // Subsequent months: prev + new - lost
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

  const loadReportData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build array of months to fetch
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

        // Add delay between requests to avoid rate limiting
        if (i > 0) await new Promise(r => setTimeout(r, 3000));

        const response = await fetch(`/api/kpi/fetch-reports?month=${month}&year=${reportYear}`);
        if (!response.ok) throw new Error(`Failed to fetch ${monthNames[i]}`);

        const { data } = await response.json();

        // Parse payments - aggregate by member first to handle refunds
        const paymentRows = parseCsvSimple(data.current.allPaymentsCsv);
        let ptRevenue = 0, smallGroupRevenue = 0, totalRevenue = 0, groupRevenue = 0;

        // First pass: aggregate payments by member
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
          } else if (details.includes("Small Group")) {
            smallGroupRevenue += amount;
            memberData.group += amount;
            groupRevenue += amount;
          } else if (details.includes("Gym Memberships")) {
            memberData.group += amount;
            groupRevenue += amount;
          }
        }

        // Second pass: count only members with positive NET payments and build paying members list
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
        // Sort by amount descending
        payingMembersList.sort((a, b) => b.amount - a.amount);

        // Create monthKey for this month (e.g., "2026-04")
        const monthKey = `${reportYear}-${String(month).padStart(2, "0")}`;

        // Calculate new members
        const newMembersResult = calculateNewMembers(
          data.current.allPaymentsCsv,
          data.previous.allPaymentsCsv,
          data.previous2.allPaymentsCsv
        );

        // Calculate lost members
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

        // Combine new members (group + PT)
        const allNewMembers: MemberRecord[] = [
          ...newMembersResult.newGroupMembers.map(m => ({ memberId: m.memberId, name: m.name, amount: m.amount })),
          ...newMembersResult.newPtClients.map(m => ({ memberId: m.memberId, name: m.name, amount: m.amount })),
        ];

        // Lost members with type info (excluding newly on hold)
        const allLostMembers: LostMemberRecord[] = [
          ...lostMembersResult.lostGroupMembers.map(m => ({ memberId: m.memberId, name: m.name, amount: m.amount, type: m.type })),
          ...lostMembersResult.lostPtClients.map(m => ({ memberId: m.memberId, name: m.name, amount: m.amount, type: m.type })),
        ];

        // Newly on hold members (separate) - include in lost members list
        const onHoldMembersList: MemberRecord[] = lostMembersResult.newlyOnHold.map(m => ({ memberId: m.memberId, name: m.name, amount: m.amount }));

        // Total lost = actual losses + newly on hold (for chart purposes)
        const totalLostCount = lostMembersResult.lostGroupCount + lostMembersResult.lostPtCount + lostMembersResult.newlyOnHoldCount;
        const totalLostRevenue = lostMembersResult.lostGroupRevenue + lostMembersResult.lostPtRevenue + lostMembersResult.newlyOnHoldRevenue;

        results.push({
          month: monthNames[i]!,
          year: reportYear,
          monthKey,
          ptRevenue,
          smallGroupRevenue,
          totalRevenue,
          totalMembers,
          arm,
          groupRevenue,
          groupMembers,
          armGroups,
          newMembers: allNewMembers,
          newMembersCount: newMembersResult.groupMemberCount + newMembersResult.ptClientCount,
          newMembersRevenue: newMembersResult.groupMemberRevenue + newMembersResult.ptClientRevenue,
          // Separate group/PT counts for Elev8 HQ
          newGroupMembersCount: newMembersResult.groupMemberCount,
          newGroupMembersRevenue: newMembersResult.groupMemberRevenue,
          newPtClientsCount: newMembersResult.ptClientCount,
          newPtClientsRevenue: newMembersResult.ptClientRevenue,
          lostMembers: allLostMembers,
          lostMembersCount: totalLostCount,
          lostMembersRevenue: totalLostRevenue,
          // Separate group/PT lost counts for Elev8 HQ
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

      // Save to localStorage
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

  // Simple CSV parser for this component
  const parseCsvSimple = (csv: string): Record<string, string>[] => {
    if (!csv.trim()) return [];
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0]!.split(",").map(h => h.trim());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!;
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
        else current += char;
      }
      values.push(current.trim());
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) row[headers[j]!] = values[j] || "";
      rows.push(row);
    }
    return rows;
  };

  const toggleMonth = (month: string) => {
    setExpandedMonth(expandedMonth === month ? null : month);
    setMembersViewMonth(null); // Close members view when toggling month
  };

  const toggleMembersView = (month: string) => {
    setMembersViewMonth(membersViewMonth === month ? null : month);
    setExpandedMonth(null); // Close month details when toggling members view
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
                  <option key={i} value={i + 1}>{name}</option>
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
                  <option key={i} value={i + 1} disabled={i + 1 < startMonth}>{name}</option>
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
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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
  const ongoingMonths = derivedData.slice(1); // Skip January (founding month)
  const totalNewMembers = ongoingMonths.reduce((sum, m) => sum + m.filteredNewCount, 0);
  const avgNewMembersPerMonth = ongoingMonths.length > 0 ? Math.round(totalNewMembers / ongoingMonths.length * 10) / 10 : 0;

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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
          {lastSavedAt && (
            <p className="text-xs text-gray-500 mt-0.5">
              Cached: {formatSavedAt(lastSavedAt)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={clearCache}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear Cache
          </button>
          <button
            onClick={loadReportData}
            disabled={isLoading}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
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
                <option key={i} value={i + 1}>{name}</option>
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
                <option key={i} value={i + 1} disabled={i + 1 < startMonth}>{name}</option>
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
          <button
            onClick={() => setShowDatePicker(false)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Prepare chart data for Recharts */}
      {(() => {
        const chartData = derivedData.map(m => ({
          name: `${m.month} ${m.year}`,
          totalMembers: m.derivedTotalMembers,
          newMembers: m.filteredNewCount,
          lostMembers: -m.filteredLostCount, // Negative for display below axis
          netChange: m.filteredNewCount - m.filteredLostCount,
          ptRevenue: m.ptRevenue,
          groupRevenue: m.groupRevenue, // Group Memberships (includes Small Group + Gym Memberships)
          totalRevenue: m.totalRevenue,
          arm: m.derivedTotalMembers > 0 ? Math.round(m.totalRevenue / m.derivedTotalMembers) : 0,
          armGroups: Math.round(m.armGroups),
        }));

        const firstPt = derivedData[0]?.ptRevenue ?? 0;
        const lastPt = derivedData[derivedData.length - 1]?.ptRevenue ?? 0;

        return (
          <>
            {/* Chart 1: Membership Overview - Combo Chart */}
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
                      <div className="text-green-600">{firstMembers} → {lastMembers} members</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ value: 'Member Change', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#999' }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      domain={[0, 'auto']}
                      label={{ value: 'Total Members', angle: 90, position: 'insideRight', fontSize: 11, fill: '#999' }}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          newMembers: 'New Members',
                          lostMembers: 'Lost Members',
                          totalMembers: 'Total Members',
                        };
                        const displayValue = name === 'lostMembers' ? Math.abs(value) : value;
                        return [displayValue, labels[name] || name];
                      }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e0e0e0' }}
                    />
                    <ReferenceLine yAxisId="left" y={0} stroke="#e0e0e0" />
                    {/* New Members - Green bars going up */}
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
                    {/* Lost Members - Red bars going down */}
                    <Bar yAxisId="left" dataKey="lostMembers" fill="#ef4444" name="lostMembers" radius={[0, 0, 4, 4]}>
                      <LabelList
                        dataKey="lostMembers"
                        position="bottom"
                        fill="#dc2626"
                        fontWeight="bold"
                        fontSize={12}
                        formatter={(value: number) => value < 0 ? `${value}` : ''}
                      />
                    </Bar>
                    {/* Total Members - Line */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="totalMembers"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 6 }}
                      name="totalMembers"
                    >
                      <LabelList
                        dataKey="totalMembers"
                        position="top"
                        fill="#2563eb"
                        fontWeight="bold"
                        fontSize={14}
                        offset={10}
                      />
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
                    <span className="w-4 h-0.5 bg-blue-500" style={{ height: '3px' }} />
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
                  <span className="text-xs text-gray-500">Click month to expand, click member to exclude</span>
                </button>
                {showMemberDetails && (
                <div className="p-4 pt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 font-medium text-gray-600 w-32"></th>
                        {derivedData.map(m => (
                          <th key={m.month} className="text-center py-2">
                            <button
                              onClick={() => toggleMonth(m.month)}
                              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                                expandedMonth === m.month
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-600 hover:bg-gray-100"
                              }`}
                            >
                              {m.month}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* New Members Row */}
                      <tr className="border-b border-gray-100">
                        <td className="py-2 text-green-600 font-medium">New Members</td>
                        {derivedData.map(m => (
                          <td key={m.month} className="text-center py-2">
                            <span className={`px-3 py-1 rounded-full font-medium ${
                              expandedMonth === m.month ? "bg-green-100" : ""
                            } text-green-600`}>
                              +{m.filteredNewCount}
                            </span>
                          </td>
                        ))}
                      </tr>

                      {/* Lost/On Hold Row */}
                      <tr className="border-b border-gray-100">
                        <td className="py-2 text-red-600 font-medium">Lost / On Hold</td>
                        {derivedData.map(m => (
                          <td key={m.month} className="text-center py-2">
                            <span className={`px-3 py-1 rounded-full font-medium ${
                              expandedMonth === m.month ? "bg-red-100" : ""
                            } text-red-600`}>
                              {m.filteredLostCount > 0 ? `-${m.filteredLostCount}` : "0"}
                            </span>
                          </td>
                        ))}
                      </tr>

                      {/* Expanded Details for Selected Month */}
                      {derivedData.map(m => {
                        if (expandedMonth !== m.month) return null;

                        // Get all members (including excluded) for display
                        const allLostWithHold = [
                          ...m.lostMembers,
                          ...m.onHoldMembers.map(oh => ({ ...oh, type: "hold" as const })),
                        ];

                        return (
                          <tr key={`detail-${m.month}`} className="bg-gray-50">
                            <td colSpan={derivedData.length + 1} className="p-4">
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
                                            <span className={`font-medium ${excluded ? "text-gray-400 line-through" : "text-gray-700"}`}>
                                              {member.name}
                                              {excluded && <span className="ml-2 text-xs text-gray-500 no-underline">(excluded)</span>}
                                            </span>
                                            <span className={`font-semibold ${excluded ? "text-gray-400" : "text-green-600"}`}>
                                              {formatCurrency(member.amount)}/mo
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-gray-400 text-sm bg-white rounded-lg px-3 py-2">No new members this month</div>
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
                                              <span className={`font-medium ${excluded ? "text-gray-400 line-through" : "text-gray-700"}`}>
                                                {member.name}
                                              </span>
                                              {!excluded && (
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                  isHold ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                                }`}>
                                                  {isHold ? "HOLD" : "LOST"}
                                                </span>
                                              )}
                                              {excluded && <span className="text-xs text-gray-500">(excluded)</span>}
                                            </div>
                                            <span className={`font-semibold ${
                                              excluded ? "text-gray-400" : isHold ? "text-amber-600" : "text-red-600"
                                            }`}>
                                              {formatCurrency(member.amount)}/mo
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-gray-400 text-sm bg-white rounded-lg px-3 py-2">No lost members this month</div>
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
                        {derivedData.map(m => {
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
                                {net >= 0 ? "+" : ""}{net}
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
                              {/* Summary Header */}
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                                      <span className="text-white font-bold text-lg">{m.derivedTotalMembers}</span>
                                    </div>
                                    <div>
                                      <div className="text-sm font-semibold text-gray-900">Paying Members</div>
                                      <div className="text-xs text-gray-500">{m.month} {m.year}</div>
                                    </div>
                                  </div>

                                  {/* Flow visualization */}
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
                                      {net >= 0 ? "+" : ""}{net} net
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="text-lg font-bold text-gray-900">{formatCurrency(m.totalRevenue)}</div>
                                  <div className="text-xs text-gray-500">Total Revenue</div>
                                </div>
                              </div>

                              {/* Stats Cards */}
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

                              {/* Members List */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-700">All Paying Members</span>
                                  <span className="text-xs text-gray-500">{m.payingMembers.length} members</span>
                                </div>
                                <div className="bg-white rounded-lg shadow-sm max-h-64 overflow-y-auto">
                                  <div className="divide-y divide-gray-100">
                                    {m.payingMembers.map((member) => {
                                      const isNew = m.filteredNewMembers.some(n => n.memberId === member.memberId);
                                      return (
                                        <div key={member.memberId} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
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
                    // Calculate average churn (excluding first month which has no previous)
                    const churnRates = derivedData.slice(1).map((m, i) => {
                      const prevTotal = derivedData[i]?.derivedTotalMembers || 0;
                      return prevTotal > 0 ? (m.filteredLostCount / prevTotal) * 100 : 0;
                    });
                    const avgChurn = churnRates.length > 0
                      ? churnRates.reduce((a, b) => a + b, 0) / churnRates.length
                      : 0;
                    return (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-right">
                        <div className="text-orange-700 font-semibold">{avgChurn.toFixed(1)}% avg</div>
                        <div className="text-orange-600 text-xs">monthly churn</div>
                      </div>
                    );
                  })()}
                </div>
                {/* Churn Graph - Always visible */}
                <div className="p-4">
                  {(() => {
                    // Build churn data - first month has no churn (no previous month)
                    const churnData = derivedData.map((m, i) => {
                      if (i === 0) {
                        return {
                          name: `${m.month} ${m.year}`,
                          churn: null, // No churn for first month
                          lostCount: m.filteredLostCount,
                        };
                      }
                      const prevTotal = derivedData[i - 1]?.derivedTotalMembers || 0;
                      const churnRate = prevTotal > 0 ? (m.filteredLostCount / prevTotal) * 100 : 0;
                      return {
                        name: `${m.month} ${m.year}`,
                        churn: Math.round(churnRate * 10) / 10, // Round to 1 decimal
                        lostCount: m.filteredLostCount,
                      };
                    });

                    return (
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={churnData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12, fill: '#666' }}
                            axisLine={{ stroke: '#e0e0e0' }}
                          />
                          <YAxis
                            tick={{ fontSize: 12, fill: '#666' }}
                            axisLine={{ stroke: '#e0e0e0' }}
                            tickFormatter={(value) => `${value}%`}
                            domain={[0, 'auto']}
                          />
                          <Tooltip
                            formatter={(value: number | null, name: string) => {
                              if (value === null) return ['N/A', 'Churn Rate'];
                              if (name === 'churn') return [`${value}%`, 'Churn Rate'];
                              return [value, name];
                            }}
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e0e0e0' }}
                          />
                          <Bar
                            dataKey="churn"
                            fill="#f97316"
                            radius={[4, 4, 0, 0]}
                            name="churn"
                          >
                            <LabelList
                              dataKey="churn"
                              position="top"
                              fill="#ea580c"
                              fontWeight="bold"
                              fontSize={12}
                              formatter={(value: number | null) => value !== null ? `${value}%` : ''}
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
                        {derivedData.map(m => (
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
                          const churnColor = churnRate > 20 ? "text-red-600" : churnRate > 10 ? "text-orange-600" : "text-green-600";
                          return (
                            <td key={m.month} className={`text-center py-2 font-semibold ${churnColor}`}>
                              {churnRate.toFixed(1)}%
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 text-gray-600">Lost</td>
                        {derivedData.map(m => (
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

            {/* Chart 2: Revenue Breakdown - Stacked Bar */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-start">
                <h3 className="font-bold text-gray-900">Revenue Breakdown by Source</h3>
                {lastPt > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-right">
                    <div className="text-purple-700 font-semibold">PT Revenue</div>
                    <div className="text-purple-600">${firstPt.toLocaleString()} → ${lastPt.toLocaleString()}</div>
                  </div>
                )}
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          groupRevenue: 'Group Membership',
                          ptRevenue: 'PT'
                        };
                        return [`$${value.toLocaleString()}`, labels[name] || name];
                      }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e0e0e0' }}
                    />
                    <Bar dataKey="groupRevenue" stackId="a" fill="#3b82f6" name="groupRevenue">
                      <LabelList
                        dataKey="groupRevenue"
                        position="center"
                        fill="#ffffff"
                        fontWeight="bold"
                        fontSize={11}
                        formatter={(value: number) => value > 500 ? `$${(value/1000).toFixed(1)}k` : ''}
                      />
                    </Bar>
                    <Bar dataKey="ptRevenue" stackId="a" fill="#a855f7" name="ptRevenue" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="ptRevenue"
                        position="top"
                        fill="#7c3aed"
                        fontSize={12}
                        fontWeight="bold"
                        formatter={(value: number) => value > 0 ? `$${(value/1000).toFixed(1)}k` : ''}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-blue-500 rounded-sm" />
                    <span className="text-gray-600">Group Membership</span>
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
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      tickFormatter={(value) => `$${value}`}
                      domain={[0, 'auto']}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          arm: 'ARM (All)',
                          armGroups: 'ARM (Groups)',
                        };
                        return [`$${value}`, labels[name] || name];
                      }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e0e0e0' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="arm"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 6 }}
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
                      dot={{ fill: '#22c55e', strokeWidth: 2, r: 6 }}
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
          </>
        );
      })()}
    </div>
  );
}

// Administrative Tab Component
interface RefundPaymentHistory {
  month: string;
  expected: number;
  actual: number;
}

interface GymMasterRefund {
  memberId: string;
  memberName: string;
  refundDate: string;
  refundAmount: number;
  reason: string;
  status: "on_track" | "needs_review";
  paymentHistory: RefundPaymentHistory[];
}

interface MonthlyReconciliation {
  month: string;
  gymMasterTotal: number;
  gymMasterCount: number;
  stripeTotal: number;
  stripeCount: number;
  variance: number;
  status: "reconciled" | "variance";
}

interface UnmatchedStripeRefund {
  refundId: string;
  date: string;
  amount: number;
  customerEmail: string | null;
  billingName: string | null;
}

interface AdminRefundsData {
  year: number;
  summary: {
    totalRefunds: number;
    totalGymMasterAmount: number;
    totalStripeAmount: number;
    totalVariance: number;
    needsReviewCount: number;
    onTrackCount: number;
    reconciledMonths: number;
    totalMonths: number;
  };
  monthlyReconciliation: MonthlyReconciliation[];
  refunds: GymMasterRefund[];
  unmatchedStripeRefunds: UnmatchedStripeRefund[];
}

function AdministrativeTab() {
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

  const filteredRefunds = data?.refunds.filter((r) => {
    if (filterStatus === "all") return true;
    return r.status === filterStatus;
  }) || [];

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Refund Reconciliation</h2>
          <p className="text-sm text-gray-500 mt-1">
            Review refunds and verify member payment history
          </p>
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

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

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
              <div className={`text-2xl font-semibold ${data.summary.totalVariance < 1 ? "text-green-600" : "text-yellow-600"}`}>
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
                filterStatus === "all"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                              <div className="text-xs text-gray-500 uppercase mb-2">
                                6-Month Payment History
                              </div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full bg-white border border-gray-200 rounded">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                                        Month
                                      </th>
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
                              <div className="text-xs text-gray-400">
                                Member ID: {refund.memberId}
                              </div>
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
              <div className="py-8 text-center text-gray-500">
                No refunds found matching the selected filter
              </div>
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
