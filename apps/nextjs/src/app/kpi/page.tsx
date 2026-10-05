"use client";

import { useState, useEffect, useRef } from "react";
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

import {
  parseAllPayments,
  formatCurrency,
  CATEGORY_LABELS,
  type ParseResult,
  type CategoryKey,
  type MemberPayment,
} from "./lib/parse-all-payments";

import {
  parseNewMembers,
  type NewMembersResult,
} from "./lib/parse-new-members";

import {
  calculateNewMembers,
  type NewMembersResult as PaymentBasedNewMembersResult,
} from "./lib/calculate-new-members";

import {
  calculateLostMembers,
  type LostMembersResult,
} from "./lib/calculate-lost-members";

import {
  parseCancellations,
  type CancellationsResult,
} from "./lib/parse-cancellations";

import {
  parseMembersOnHold,
  type MembersOnHoldResult,
} from "./lib/parse-members-on-hold";

import {
  parseCurrentMembers,
  type CurrentMembersResult,
} from "./lib/parse-current-members";

const REPORT_TYPES = [
  { id: "all_payments", label: "All Payments", description: "Revenue by category" },
  { id: "starting_memberships", label: "New Members", description: "Use 'Starting Memberships' report" },
  { id: "current_members", label: "Current Members", description: "Membership history for validation" },
  { id: "cancellations", label: "Cancellations Occurring in Period", description: "Select 'all memberships' + 'all cancellations'" },
  { id: "members_on_hold", label: "Members on Hold", description: "Frozen members" },
] as const;

type ReportId = (typeof REPORT_TYPES)[number]["id"];

type UploadedFiles = {
  [K in ReportId]?: File;
};

// Track data source for each report
type DataSource = "csv" | "api";
type DataSources = {
  [K in ReportId]?: DataSource;
};

// Define which reports are needed for each analysis
const ANALYSIS_DEPENDENCIES = {
  financial_stats: ["all_payments"],
  new_members: ["all_payments", "starting_memberships", "current_members"],
  retention: ["cancellations", "all_payments", "current_members"],
  freeze: ["members_on_hold", "all_payments", "current_members"],
  membership_stats: ["current_members", "all_payments", "members_on_hold", "cancellations"],
} as const;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function KPIPage() {
  const [files, setFiles] = useState<UploadedFiles>({});
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [dataSources, setDataSources] = useState<DataSources>({});
  const [allPaymentsResult, setAllPaymentsResult] = useState<ParseResult | null>(null);
  const [newMembersResult, setNewMembersResult] = useState<NewMembersResult | null>(null);
  const [cancellationsResult, setCancellationsResult] = useState<CancellationsResult | null>(null);
  const [membersOnHoldResult, setMembersOnHoldResult] = useState<MembersOnHoldResult | null>(null);
  const [currentMembersResult, setCurrentMembersResult] = useState<CurrentMembersResult | null>(null);
  const [paymentBasedNewMembers, setPaymentBasedNewMembers] = useState<PaymentBasedNewMembersResult | null>(null);
  const [lostMembersResult, setLostMembersResult] = useState<LostMembersResult | null>(null);
  const [prevMonthPayments, setPrevMonthPayments] = useState<string>("");
  const [prev2MonthPayments, setPrev2MonthPayments] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // API sync state
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const handleApiSync = async () => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const response = await fetch(
        `/api/kpi/fetch-reports?month=${selectedMonth}&year=${selectedYear}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const { data } = await response.json();

      // Populate file contents from API response
      setFileContents((prev) => ({
        ...prev,
        all_payments: data.current.allPaymentsCsv,
        starting_memberships: data.current.newMembersCsv, // API returns New Members (ID 116)
        current_members: data.current.currentMembersCsv,
        cancellations: data.current.cancellationsCsv,
        members_on_hold: data.current.membersOnHoldCsv,
      }));

      // Store previous month payment data for new member calculation
      setPrevMonthPayments(data.previous.allPaymentsCsv);
      setPrev2MonthPayments(data.previous2.allPaymentsCsv);

      // Calculate payment-based new members (requires 3 months of payment data)
      const paymentBasedResult = calculateNewMembers(
        data.current.allPaymentsCsv,
        data.previous.allPaymentsCsv,
        data.previous2.allPaymentsCsv
      );
      setPaymentBasedNewMembers(paymentBasedResult);

      // Calculate payment-based lost members
      const lostResult = calculateLostMembers(
        data.current.allPaymentsCsv,
        data.previous.allPaymentsCsv,
        data.previous2.allPaymentsCsv,
        data.current.currentMembersCsv,
        data.previous.currentMembersCsv,
        data.current.membersOnHoldCsv,
        data.previous.membersOnHoldCsv
      );
      setLostMembersResult(lostResult);

      // Mark all as API-sourced
      setDataSources({
        all_payments: "api",
        starting_memberships: "api",
        current_members: "api",
        cancellations: "api",
        members_on_hold: "api",
      });

      // Clear any manually uploaded files (API takes precedence visually)
      setFiles({});

      setLastSyncTime(new Date());
    } catch (error) {
      console.error("API sync error:", error);
      setSyncError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileChange = async (reportId: ReportId, file: File | null) => {
    if (file) {
      setFiles((prev) => ({ ...prev, [reportId]: file }));

      // Read file content
      const content = await file.text();
      setFileContents((prev) => ({ ...prev, [reportId]: content }));

      // Mark as CSV-sourced (overrides API)
      setDataSources((prev) => ({ ...prev, [reportId]: "csv" }));
    } else {
      const { [reportId]: _, ...restFiles } = files;
      setFiles(restFiles);
      const { [reportId]: __, ...restContents } = fileContents;
      setFileContents(restContents);
      const { [reportId]: ___, ...restSources } = dataSources;
      setDataSources(restSources);
    }
  };

  // Check if dependencies are met for each analysis
  const canAnalyzeFinancialStats = ANALYSIS_DEPENDENCIES.financial_stats.every(
    (dep) => fileContents[dep]
  );
  const canAnalyzeNewMembers = ANALYSIS_DEPENDENCIES.new_members.every(
    (dep) => fileContents[dep]
  );
  const canAnalyzeRetention = ANALYSIS_DEPENDENCIES.retention.every(
    (dep) => fileContents[dep]
  );
  const canAnalyzeFreeze = ANALYSIS_DEPENDENCIES.freeze.every(
    (dep) => fileContents[dep]
  );
  const canAnalyzeMembershipStats = ANALYSIS_DEPENDENCIES.membership_stats.every(
    (dep) => fileContents[dep]
  );

  // Run analysis when dependencies are met
  useEffect(() => {
    if (canAnalyzeFinancialStats && fileContents.all_payments) {
      parseAllPayments(fileContents.all_payments).then(setAllPaymentsResult);
    } else {
      setAllPaymentsResult(null);
    }
  }, [canAnalyzeFinancialStats, fileContents.all_payments]);

  useEffect(() => {
    if (canAnalyzeNewMembers) {
      parseNewMembers(
        fileContents.starting_memberships!,
        fileContents.all_payments!,
        fileContents.current_members!
      ).then(setNewMembersResult);
    } else {
      setNewMembersResult(null);
    }
  }, [canAnalyzeNewMembers, fileContents]);

  useEffect(() => {
    if (canAnalyzeRetention) {
      parseCancellations(
        fileContents.cancellations!,
        fileContents.all_payments!,
        fileContents.current_members!
      ).then(setCancellationsResult);
    } else {
      setCancellationsResult(null);
    }
  }, [canAnalyzeRetention, fileContents]);

  useEffect(() => {
    if (canAnalyzeFreeze) {
      parseMembersOnHold(
        fileContents.members_on_hold!,
        fileContents.all_payments!,
        fileContents.current_members!
      ).then(setMembersOnHoldResult);
    } else {
      setMembersOnHoldResult(null);
    }
  }, [canAnalyzeFreeze, fileContents]);

  useEffect(() => {
    if (canAnalyzeMembershipStats) {
      parseCurrentMembers(
        fileContents.current_members!,
        fileContents.all_payments!,
        fileContents.members_on_hold!,
        fileContents.cancellations!
      ).then(setCurrentMembersResult);
    } else {
      setCurrentMembersResult(null);
    }
  }, [canAnalyzeMembershipStats, fileContents]);

  const uploadedCount = Object.keys(files).length;
  const allUploaded = uploadedCount === REPORT_TYPES.length;
  const [activeTab, setActiveTab] = useState<"data" | "output" | "reporting">("data");

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-gray-900">KPI Report Generator</h1>
        <p className="mt-2 text-gray-600">
          Upload your Gym Master reports to generate the monthly KPI template.
        </p>

        {/* Tab Navigation */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab("data")}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "data"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Data
            </button>
            <button
              onClick={() => setActiveTab("output")}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "output"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              For Elev8 HQ
            </button>
            <button
              onClick={() => setActiveTab("reporting")}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "reporting"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Reporting
            </button>
          </nav>
        </div>

        {/* Data Tab */}
        {activeTab === "data" && (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Upload Section */}
          <div className="space-y-4">
            {/* API Sync Header */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {MONTHS.map((month, idx) => (
                      <option key={month} value={idx + 1}>{month}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {[2025, 2026, 2027].map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleApiSync}
                  disabled={isSyncing}
                  className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isSyncing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sync from GymMaster
                    </>
                  )}
                </button>
                {lastSyncTime && (
                  <span className="text-xs text-blue-600">
                    Last synced: {lastSyncTime.toLocaleTimeString()}
                  </span>
                )}
              </div>
              {syncError && (
                <div className="mt-2 text-sm text-red-600">
                  Error: {syncError}
                </div>
              )}
            </div>

            <h2 className="text-lg font-semibold text-gray-900">Upload Reports</h2>
            <p className="text-sm text-gray-500">
              Sync from GymMaster above, or upload CSVs manually to override specific reports.
            </p>

            {REPORT_TYPES.map((report) => (
              <FileUploadSlot
                key={report.id}
                reportId={report.id}
                label={report.label}
                description={report.description}
                file={files[report.id]}
                dataSource={dataSources[report.id]}
                hasContent={!!fileContents[report.id]}
                onFileChange={(file) => handleFileChange(report.id, file)}
              />
            ))}
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Parsed Results</h2>

            {/* Financial Stats */}
            <ResultCard
              title="Financial Stats"
              ready={canAnalyzeMembershipStats}
              requiredReports={["All Payments", "Current Members", "Members on Hold", "Cancellations"]}
            >
              {allPaymentsResult && currentMembersResult && (
                <AllPaymentsResults result={allPaymentsResult} memberStats={currentMembersResult} />
              )}
            </ResultCard>

            {/* New Members (Payment-Based) */}
            <ResultCard
              title="New Members"
              ready={!!paymentBasedNewMembers}
              requiredReports={["All Payments (current + 2 prior months)"]}
            >
              {paymentBasedNewMembers && (
                <NewMembersResults paymentBased={paymentBasedNewMembers} legacy={newMembersResult} />
              )}
            </ResultCard>

            {/* Retention (Cancellations + Freeze) */}
            <ResultCard
              title="Retention"
              ready={!!lostMembersResult || (canAnalyzeRetention && canAnalyzeFreeze)}
              requiredReports={["All Payments (current + 2 prior months)", "Current Members", "Members on Hold"]}
            >
              {lostMembersResult ? (
                <RetentionResults
                  lostMembers={lostMembersResult}
                  cancellations={cancellationsResult}
                  freeze={membersOnHoldResult}
                />
              ) : cancellationsResult && membersOnHoldResult ? (
                <RetentionResults
                  cancellations={cancellationsResult}
                  freeze={membersOnHoldResult}
                />
              ) : null}
            </ResultCard>

          </div>
        </div>
        )}

        {/* Output Tab */}
        {activeTab === "output" && (
          <OutputTemplate
            allPayments={allPaymentsResult}
            newMembers={newMembersResult}
            paymentBasedNewMembers={paymentBasedNewMembers}
            lostMembers={lostMembersResult}
            cancellations={cancellationsResult}
            membersOnHold={membersOnHoldResult}
            currentMembers={currentMembersResult}
          />
        )}

        {/* Reporting Tab */}
        {activeTab === "reporting" && (
          <ReportingTab
            allPayments={allPaymentsResult}
            paymentBasedNewMembers={paymentBasedNewMembers}
            lostMembers={lostMembersResult}
            membersOnHold={membersOnHoldResult}
            currentMembers={currentMembersResult}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        )}
      </div>
    </div>
  );
}

function StatusDot({ ready }: { ready: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        ready ? "bg-green-500" : "bg-gray-300"
      }`}
    />
  );
}

function FileUploadSlot({
  reportId,
  label,
  description,
  file,
  dataSource,
  hasContent,
  onFileChange,
}: {
  reportId: string;
  label: string;
  description: string;
  file?: File;
  dataSource?: "csv" | "api";
  hasContent?: boolean;
  onFileChange: (file: File | null) => void;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    onFileChange(selectedFile);
  };

  const handleRemove = () => {
    onFileChange(null);
  };

  // Determine display state
  const isFromApi = dataSource === "api" && hasContent && !file;
  const isFromCsv = file !== undefined;

  return (
    <div className={`rounded-lg border p-4 ${
      isFromApi ? "border-blue-200 bg-blue-50" :
      isFromCsv ? "border-green-200 bg-green-50" :
      "border-gray-200 bg-white"
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{label}</h3>
            {isFromApi && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                API
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        {file ? (
          <div className="flex items-center gap-2">
            <span className="max-w-32 truncate text-sm text-green-600">{file.name}</span>
            <button
              onClick={handleRemove}
              className="text-sm text-red-600 hover:text-red-500"
            >
              Remove
            </button>
          </div>
        ) : isFromApi ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-600">Synced</span>
            <label className="cursor-pointer rounded-md bg-white border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Override
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleChange}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <label className="cursor-pointer rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
            Upload CSV
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleChange}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>
  );
}

function ResultCard({
  title,
  ready,
  requiredReports,
  children,
}: {
  title: string;
  ready: boolean;
  requiredReports: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-gray-900">{title}</h3>
        <StatusDot ready={ready} />
      </div>

      {ready ? (
        children
      ) : (
        <div className="text-sm text-gray-500">
          Waiting for: {requiredReports.join(", ")}
        </div>
      )}
    </div>
  );
}

function AllPaymentsResults({ result, memberStats }: { result: ParseResult; memberStats: CurrentMembersResult }) {
  const [showMembers, setShowMembers] = useState(false);
  const [showUnexplained, setShowUnexplained] = useState(false);

  const nonZeroCategories = (Object.entries(result.totals) as [CategoryKey, number][])
    .filter(([key, amount]) => amount !== 0 && key !== "unmapped");

  return (
    <div>
      {/* Revenue Summary */}
      <div className="mb-4 rounded-md bg-green-50 p-3">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-green-700">Gross Payments:</span>
            <span className="font-medium text-green-900">{formatCurrency(result.grossPayments)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-red-600">Refunds:</span>
            <span className="font-medium text-red-600">-{formatCurrency(result.totalRefunds)}</span>
          </div>
          <div className="flex justify-between border-t border-green-200 pt-1 mt-1">
            <span className="text-green-800 font-medium">Net Revenue:</span>
            <span className="font-bold text-green-900">{formatCurrency(result.totalPayments)}</span>
          </div>
        </div>
      </div>

      {/* Member Counts */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-green-50 p-3 text-center">
          <div className="text-2xl font-bold text-green-900">{result.memberPayments.length}</div>
          <div className="text-xs text-green-700">Paid</div>
        </div>
        <div className="rounded-lg bg-gray-100 p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{memberStats.freeMembers}</div>
          <div className="text-xs text-gray-600">Free/Comp</div>
        </div>
      </div>

      {/* Needs Investigation */}
      {memberStats.missingUnexplained.length > 0 && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
          <button
            onClick={() => setShowUnexplained(!showUnexplained)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-red-800">Needs Investigation</span>
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                {memberStats.missingUnexplained.length}
              </span>
            </div>
            <span className="text-red-400">{showUnexplained ? "▲" : "▼"}</span>
          </button>
          <p className="mt-1 text-xs text-red-600">
            Members with fee &gt; $0 who didn't pay and aren't on hold or cancelled
          </p>

          {showUnexplained && (
            <div className="mt-3 space-y-1">
              {memberStats.missingUnexplained.map((m, i) => (
                <div key={i} className="flex justify-between rounded bg-white p-2 text-xs">
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{m.name}</span>
                    <div className="text-gray-500 truncate">{m.membershipType}</div>
                  </div>
                  <div className="text-right text-red-600 font-medium">
                    {formatCurrency(m.expectedFee)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* By Category - Expandable */}
      {nonZeroCategories.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="mb-2 text-sm font-medium text-gray-700">By Category</h4>
          <div className="space-y-1">
            {nonZeroCategories.map(([category, amount]) => (
              <div key={category} className="flex justify-between text-sm">
                <span className="text-gray-600">{CATEGORY_LABELS[category]}</span>
                <span className={amount < 0 ? "text-red-600" : "text-gray-900"}>
                  {formatCurrency(amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paying Members List - Expandable */}
      <div className="mt-4 border-t pt-4">
        <button
          onClick={() => setShowMembers(!showMembers)}
          className="flex w-full items-center justify-between text-sm text-gray-500 hover:text-gray-700"
        >
          <span>View paying members list</span>
          <span>{showMembers ? "▲" : "▼"}</span>
        </button>

        {showMembers && (
          <div className="mt-2 max-h-64 overflow-y-auto">
            <div className="space-y-1">
              {result.memberPayments.map((member) => (
                <div key={member.memberId} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate max-w-48">{member.name}</span>
                  <span className={member.totalPaid < 0 ? "text-red-600" : "text-gray-900"}>
                    {formatCurrency(member.totalPaid)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NewMembersResults({
  paymentBased,
  legacy
}: {
  paymentBased: PaymentBasedNewMembersResult;
  legacy: NewMembersResult | null;
}) {
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [showPtClients, setShowPtClients] = useState(false);

  return (
    <div>
      {/* Summary Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-green-50 p-3 text-center">
          <div className="text-2xl font-bold text-green-900">{paymentBased.groupMemberCount}</div>
          <div className="text-xs text-green-700">New Group Members</div>
          <div className="text-sm font-medium text-green-800 mt-1">{formatCurrency(paymentBased.groupMemberRevenue)}</div>
        </div>
        <div className="rounded-lg bg-purple-50 p-3 text-center">
          <div className="text-2xl font-bold text-purple-900">{paymentBased.ptClientCount}</div>
          <div className="text-xs text-purple-700">New PT Clients</div>
          <div className="text-sm font-medium text-purple-800 mt-1">{formatCurrency(paymentBased.ptClientRevenue)}</div>
        </div>
      </div>

      {/* Total Front End Revenue */}
      <div className="flex justify-between items-center py-2 border-t border-b mb-4">
        <span className="text-sm font-medium text-gray-700">Total Front End Revenue</span>
        <span className="text-lg font-bold text-green-600">
          {formatCurrency(paymentBased.groupMemberRevenue + paymentBased.ptClientRevenue)}
        </span>
      </div>

      {/* New Group Members List */}
      {paymentBased.newGroupMembers.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowGroupMembers(!showGroupMembers)}
            className="flex w-full items-center justify-between text-sm text-gray-500 hover:text-gray-700"
          >
            <span>New Group Members ({paymentBased.groupMemberCount})</span>
            <span>{showGroupMembers ? "▲" : "▼"}</span>
          </button>
          {showGroupMembers && (
            <div className="mt-2 space-y-1 text-sm">
              {paymentBased.newGroupMembers.map((m, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-600">
                    {m.name}
                    {m.isReactivation && (
                      <span className="ml-1 text-xs text-amber-600">(reactivation)</span>
                    )}
                  </span>
                  <span className="text-gray-900">{formatCurrency(m.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New PT Clients List */}
      {paymentBased.newPtClients.length > 0 && (
        <div>
          <button
            onClick={() => setShowPtClients(!showPtClients)}
            className="flex w-full items-center justify-between text-sm text-gray-500 hover:text-gray-700"
          >
            <span>New PT Clients ({paymentBased.ptClientCount})</span>
            <span>{showPtClients ? "▲" : "▼"}</span>
          </button>
          {showPtClients && (
            <div className="mt-2 space-y-1 text-sm">
              {paymentBased.newPtClients.map((m, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-600">
                    {m.name}
                    {m.isReactivation && (
                      <span className="ml-1 text-xs text-amber-600">(reactivation)</span>
                    )}
                  </span>
                  <span className="text-gray-900">{formatCurrency(m.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RetentionResults({
  lostMembers,
  cancellations,
  freeze
}: {
  lostMembers?: LostMembersResult;
  cancellations?: CancellationsResult;
  freeze?: MembersOnHoldResult;
}) {
  const [showDetails, setShowDetails] = useState(false);

  // Use payment-based lost members if available, otherwise fall back to cancellation-based
  const lostGroupCount = lostMembers?.lostGroupCount ?? 0;
  const lostGroupRevenue = lostMembers?.lostGroupRevenue ?? 0;
  const lostPtCount = lostMembers?.lostPtCount ?? 0;
  const lostPtRevenue = lostMembers?.lostPtRevenue ?? 0;
  const newlyOnHoldCount = lostMembers?.newlyOnHoldCount ?? freeze?.freezeCount ?? 0;
  const newlyOnHoldRevenue = lostMembers?.newlyOnHoldRevenue ?? freeze?.estimatedRevenueLost ?? 0;

  const totalLostCount = lostGroupCount + lostPtCount;
  const totalLostRevenue = lostGroupRevenue + lostPtRevenue;
  const totalRevenueLost = totalLostRevenue + newlyOnHoldRevenue;

  return (
    <div>
      {/* Summary Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg bg-red-50 p-3 text-center">
          <div className="text-2xl font-bold text-red-900">{lostGroupCount}</div>
          <div className="text-xs text-red-700">Lost Group</div>
          <div className="text-sm font-medium text-red-800 mt-1">{formatCurrency(lostGroupRevenue)}</div>
        </div>
        <div className="rounded-lg bg-purple-50 p-3 text-center">
          <div className="text-2xl font-bold text-purple-900">{lostPtCount}</div>
          <div className="text-xs text-purple-700">Lost PT</div>
          <div className="text-sm font-medium text-purple-800 mt-1">{formatCurrency(lostPtRevenue)}</div>
        </div>
        <div className="rounded-lg bg-blue-50 p-3 text-center">
          <div className="text-2xl font-bold text-blue-900">{newlyOnHoldCount}</div>
          <div className="text-xs text-blue-700">Newly On Hold</div>
          <div className="text-sm font-medium text-blue-800 mt-1">{formatCurrency(newlyOnHoldRevenue)}</div>
        </div>
      </div>

      {/* Total Lost */}
      <div className="flex justify-between items-center py-2 border-t border-b mb-4">
        <span className="text-sm font-medium text-gray-700">Total Monthly Revenue Lost</span>
        <span className="text-lg font-bold text-red-600">{formatCurrency(totalRevenueLost)}</span>
      </div>

      {/* Expandable Details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex w-full items-center justify-between text-sm text-gray-500 hover:text-gray-700"
      >
        <span>View details</span>
        <span>{showDetails ? "▲" : "▼"}</span>
      </button>

      {showDetails && (
        <div className="mt-4 space-y-4">
          {/* Lost Group Members */}
          {lostMembers && lostMembers.lostGroupMembers.length > 0 && (
            <div>
              <div className="text-xs font-medium text-red-700 mb-2">Lost Group Members</div>
              <div className="space-y-1">
                {lostMembers.lostGroupMembers.map((m, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600">{m.name}</span>
                    <span className="text-red-600">{formatCurrency(m.amount)}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lost PT Clients */}
          {lostMembers && lostMembers.lostPtClients.length > 0 && (
            <div>
              <div className="text-xs font-medium text-purple-700 mb-2">Lost PT Clients</div>
              <div className="space-y-1">
                {lostMembers.lostPtClients.map((m, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600">{m.name}</span>
                    <span className="text-purple-600">{formatCurrency(m.amount)}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Newly On Hold */}
          {lostMembers && lostMembers.newlyOnHold.length > 0 && (
            <div>
              <div className="text-xs font-medium text-blue-700 mb-2">Newly On Hold</div>
              <div className="space-y-1">
                {lostMembers.newlyOnHold.map((m, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600">{m.name}</span>
                    <span className="text-blue-600">{formatCurrency(m.amount)}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback to legacy cancellations if no payment-based data */}
          {!lostMembers && cancellations && cancellations.trueCancellations.length > 0 && (
            <div>
              <div className="text-xs font-medium text-red-700 mb-2">Cancelled (from report)</div>
              <div className="space-y-1">
                {cancellations.trueCancellations.map((c, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600">{c.name}</span>
                    <span className="text-red-600">{formatCurrency(c.estimatedMonthlyLoss)}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback to legacy freeze if no payment-based data */}
          {!lostMembers && freeze && freeze.membersOnHold.length > 0 && (
            <div>
              <div className="text-xs font-medium text-blue-700 mb-2">Frozen (from report)</div>
              <div className="space-y-1">
                {freeze.membersOnHold.map((m, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600">{m.name}</span>
                    <span className="text-blue-600">{formatCurrency(m.revenueLost)}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Output Template Component
interface OutputTemplateProps {
  allPayments: ParseResult | null;
  newMembers: NewMembersResult | null;
  paymentBasedNewMembers: PaymentBasedNewMembersResult | null;
  lostMembers: LostMembersResult | null;
  cancellations: CancellationsResult | null;
  membersOnHold: MembersOnHoldResult | null;
  currentMembers: CurrentMembersResult | null;
}

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

function OutputTemplate({ allPayments, newMembers, paymentBasedNewMembers, lostMembers, cancellations, membersOnHold, currentMembers }: OutputTemplateProps) {
  const templateRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMode, setExportMode] = useState(false);

  const exportToPDF = async () => {
    if (!templateRef.current) return;

    setIsExporting(true);
    setExportMode(true);

    // Wait for React to re-render with export mode (inputs become static text)
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
      const imgWidth = pageWidth - 20; // 10mm margin on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // If content is taller than one page, scale it down
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

      // Generate filename with current date
      const date = new Date();
      const monthYear = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      pdf.save(`KPI_Report_${monthYear.replace(" ", "_")}.pdf`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setExportMode(false);
      setIsExporting(false);
    }
  };

  // Initialize template data with parsed values where available
  const [data, setData] = useState<TemplateData>(() => ({
    // Financial Stats
    quickbooksRevenue: "",
    openGymRevenue: "",
    ptRevenue: allPayments?.totals.pt?.toFixed(2) || "",
    sportsPerfRevenue: "",
    smallGrpRevenue: allPayments?.totals.small_grp?.toFixed(2) || "",
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

    // Membership Stats
    newMembersCount: paymentBasedNewMembers?.groupMemberCount.toString() || "",
    newPtClientsCount: paymentBasedNewMembers?.ptClientCount.toString() || "",
    newPtClientsRevenue: paymentBasedNewMembers?.ptClientRevenue.toFixed(2) || "",
    lostMembers: lostMembers
      ? (lostMembers.lostGroupCount + lostMembers.lostPtCount).toString()
      : cancellations?.lostMemberCount.toString() || "",
    totalMembers: allPayments?.memberPayments.length.toString() || "", // Paying members from All Payments
    // Revenue by category (disabled for now)
    msOpenGymRevenue: "",
    msPtRevenue: "",
    msSportsPerfRevenue: "",
    msRemoteRevenue: "",
    msAmbassador: "",
    msIc: "",
    // ARM calculations (manual for now)
    totalArm: "",
    armOpenGym: "",
    armPt: "",
    armSport: "",
    armSmallGrp: "",
    armRemote: "",
    armIc: "",
    // Other metrics
    averageChurn: "",
    retention: "",
    leg: "",
    ltv: "",

    // Sales & Marketing
    totalLeads: "",
    totalAdSpend: "",
    frontEndRevenue: paymentBasedNewMembers ? (paymentBasedNewMembers.groupMemberRevenue + paymentBasedNewMembers.ptClientRevenue).toFixed(2) : "",
    signUpFeesMarketing: "",

    // All Payments Report
    allPaymentsProcessed: allPayments?.totalPayments.toFixed(2) || "",
    taxPaid: "",

    // Numbers for Taxes
    ptMembershipSales: "",
    retailSales: "",
    tax: "",

    // Retention (use payment-based lost members if available)
    freezeCount: lostMembers?.newlyOnHoldCount.toString() || membersOnHold?.freezeCount.toString() || "",
    freezeLost: lostMembers?.newlyOnHoldRevenue.toFixed(2) || membersOnHold?.estimatedRevenueLost.toFixed(2) || "",
    cancelledCount: lostMembers
      ? (lostMembers.lostGroupCount + lostMembers.lostPtCount).toString()
      : cancellations?.trueCancellationCount.toString() || "",
    cancelledLost: lostMembers
      ? (lostMembers.lostGroupRevenue + lostMembers.lostPtRevenue).toFixed(2)
      : cancellations?.cancellationRevenueLost.toFixed(2) || "",
    changesCount: cancellations?.membershipChangeCount.toString() || "",
    changesLost: cancellations?.membershipChangeRevenueLost.toFixed(2) || "",

    // Discount Codes
    discountTimesUsed: "",
    discountStaffMember: "",
  }));

  // Update data when parsed results change
  useEffect(() => {
    setData(prev => ({
      ...prev,
      ptRevenue: allPayments?.totals.pt?.toFixed(2) || prev.ptRevenue,
      smallGrpRevenue: allPayments?.totals.small_grp?.toFixed(2) || prev.smallGrpRevenue,
      newMembersCount: paymentBasedNewMembers?.groupMemberCount.toString() || prev.newMembersCount,
      newPtClientsCount: paymentBasedNewMembers?.ptClientCount.toString() || prev.newPtClientsCount,
      newPtClientsRevenue: paymentBasedNewMembers?.ptClientRevenue.toFixed(2) || prev.newPtClientsRevenue,
      lostMembers: lostMembers
        ? (lostMembers.lostGroupCount + lostMembers.lostPtCount).toString()
        : cancellations?.lostMemberCount.toString() || prev.lostMembers,
      totalMembers: allPayments?.memberPayments.length.toString() || prev.totalMembers, // Paying members
      frontEndRevenue: paymentBasedNewMembers
        ? (paymentBasedNewMembers.groupMemberRevenue + paymentBasedNewMembers.ptClientRevenue).toFixed(2)
        : prev.frontEndRevenue,
      allPaymentsProcessed: allPayments?.totalPayments.toFixed(2) || prev.allPaymentsProcessed,
      freezeCount: lostMembers?.newlyOnHoldCount.toString() || membersOnHold?.freezeCount.toString() || prev.freezeCount,
      freezeLost: lostMembers?.newlyOnHoldRevenue.toFixed(2) || membersOnHold?.estimatedRevenueLost.toFixed(2) || prev.freezeLost,
      cancelledCount: lostMembers
        ? (lostMembers.lostGroupCount + lostMembers.lostPtCount).toString()
        : cancellations?.trueCancellationCount.toString() || prev.cancelledCount,
      cancelledLost: lostMembers
        ? (lostMembers.lostGroupRevenue + lostMembers.lostPtRevenue).toFixed(2)
        : cancellations?.cancellationRevenueLost.toFixed(2) || prev.cancelledLost,
      changesCount: cancellations?.membershipChangeCount.toString() || prev.changesCount,
      changesLost: cancellations?.membershipChangeRevenueLost.toFixed(2) || prev.changesLost,
    }));
  }, [allPayments, paymentBasedNewMembers, lostMembers, cancellations, membersOnHold, currentMembers]);

  const updateField = (field: keyof TemplateData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
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

  return (
    <div className="mt-8">
      {/* Export Button */}
      <div className="mb-4 flex justify-end">
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
            <TemplateRow label="Front End Revenue (Group)" value={paymentBasedNewMembers?.groupMemberRevenue.toFixed(2) || ""} readOnly highlight exportMode={exportMode} />
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
interface ReportingTabProps {
  allPayments: ParseResult | null;
  paymentBasedNewMembers: PaymentBasedNewMembersResult | null;
  lostMembers: LostMembersResult | null;
  membersOnHold: MembersOnHoldResult | null;
  currentMembers: CurrentMembersResult | null;
  selectedMonth: number;
  selectedYear: number;
}

interface MonthData {
  month: string;
  year: number;
  ptRevenue: number;
  smallGroupRevenue: number;
  totalRevenue: number;
  totalMembers: number;
  arm: number;
  groupRevenue: number;
  groupMembers: number;
  armGroups: number;
  newMembers: { name: string; amount: number }[];
  newMembersCount: number;
  newMembersRevenue: number;
  lostMembers: { name: string; amount: number; type: "loss" | "hold" }[];
  lostMembersCount: number;
  lostMembersRevenue: number;
  onHoldMembers: { name: string; amount: number }[];
  onHoldCount: number;
  onHoldRevenue: number;
}

function ReportingTab({
  selectedMonth,
  selectedYear,
}: ReportingTabProps) {
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedCell, setExpandedCell] = useState<string | null>(null); // e.g., "new-Aug" or "lost-Jul"
  const [startMonth, setStartMonth] = useState(1); // January
  const [endMonth, setEndMonth] = useState(9); // September
  const [reportYear, setReportYear] = useState(selectedYear);

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const FULL_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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
        const memberTotals = new Map<string, { total: number; group: number }>();

        for (const row of paymentRows) {
          const memberId = row["Member ID"] || "";
          const amount = parseFloat((row["Payment Amount"] || "0").replace(/[$,]/g, "")) || 0;
          const details = row["Payment Details"] || "";

          totalRevenue += amount;

          if (!memberTotals.has(memberId)) {
            memberTotals.set(memberId, { total: 0, group: 0 });
          }
          const memberData = memberTotals.get(memberId)!;
          memberData.total += amount;

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

        // Second pass: count only members with positive NET payments
        let totalMembers = 0;
        let groupMembers = 0;
        for (const [memberId, data] of memberTotals) {
          if (memberId && data.total > 0) totalMembers++;
          if (memberId && data.group > 0) groupMembers++;
        }

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
        const allNewMembers = [
          ...newMembersResult.newGroupMembers.map(m => ({ name: m.name, amount: m.amount })),
          ...newMembersResult.newPtClients.map(m => ({ name: m.name, amount: m.amount })),
        ];

        // Lost members with type info (excluding newly on hold)
        const allLostMembers: { name: string; amount: number; type: "loss" | "hold" }[] = [
          ...lostMembersResult.lostGroupMembers.map(m => ({ name: m.name, amount: m.amount, type: m.type })),
          ...lostMembersResult.lostPtClients.map(m => ({ name: m.name, amount: m.amount, type: m.type })),
        ];

        // Newly on hold members (separate)
        const onHoldMembers = lostMembersResult.newlyOnHold.map(m => ({ name: m.name, amount: m.amount }));

        // Total lost = actual losses + newly on hold (for chart purposes)
        const totalLostCount = lostMembersResult.lostGroupCount + lostMembersResult.lostPtCount + lostMembersResult.newlyOnHoldCount;
        const totalLostRevenue = lostMembersResult.lostGroupRevenue + lostMembersResult.lostPtRevenue + lostMembersResult.newlyOnHoldRevenue;

        results.push({
          month: monthNames[i]!,
          year: reportYear,
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
          lostMembers: allLostMembers,
          lostMembersCount: totalLostCount,
          lostMembersRevenue: totalLostRevenue,
          onHoldMembers,
          onHoldCount: lostMembersResult.newlyOnHoldCount,
          onHoldRevenue: lostMembersResult.newlyOnHoldRevenue,
        });
      }

      setMonthsData(results);
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

  const toggleCell = (type: string, month: string) => {
    const key = `${type}-${month}`;
    setExpandedCell(expandedCell === key ? null : key);
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

  // Calculate growth percentages
  const firstMembers = monthsData[0]?.totalMembers ?? 0;
  const lastMembers = monthsData[monthsData.length - 1]?.totalMembers ?? 0;
  const memberGrowth = firstMembers > 0 ? Math.round(((lastMembers - firstMembers) / firstMembers) * 100) : 0;

  const firstMonth = monthsData[0]?.month ?? "";
  const lastMonth = monthsData[monthsData.length - 1]?.month ?? "";
  const dataYear = monthsData[0]?.year ?? reportYear;

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Performance Report: {firstMonth}–{lastMonth} {dataYear}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMonthsData([])}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Change Range
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

      {/* Prepare chart data for Recharts */}
      {(() => {
        const chartData = monthsData.map(m => ({
          name: `${m.month} ${m.year}`,
          totalMembers: m.totalMembers,
          newMembers: m.newMembersCount,
          lostMembers: -m.lostMembersCount, // Negative for display below axis
          netChange: m.newMembersCount - m.lostMembersCount,
          ptRevenue: m.ptRevenue,
          smallGroupRevenue: m.smallGroupRevenue,
          otherRevenue: m.totalRevenue - m.ptRevenue - m.smallGroupRevenue,
          totalRevenue: m.totalRevenue,
          arm: Math.round(m.arm),
          armGroups: Math.round(m.armGroups),
        }));

        const firstPt = monthsData[0]?.ptRevenue ?? 0;
        const lastPt = monthsData[monthsData.length - 1]?.ptRevenue ?? 0;

        return (
          <>
            {/* Chart 1: Membership Overview - Combo Chart */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-start">
                <h3 className="font-bold text-gray-900">Membership Overview</h3>
                {memberGrowth > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs">
                    <div className="text-green-700 font-semibold">{memberGrowth}% growth</div>
                    <div className="text-green-600">{firstMembers} → {lastMembers} members</div>
                  </div>
                )}
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

              {/* Member Details - Click on individual cells to expand */}
              <div className="border-t border-gray-100">
                <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Member Details</span>
                  <span className="text-xs text-gray-500">Click on any number to see details</span>
                </div>
                <div className="p-4 pt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 font-medium text-gray-600 w-32"></th>
                        {monthsData.map(m => (
                          <th key={m.month} className="text-center py-2 font-medium text-gray-600">{m.month}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* New Members Row */}
                      <tr className="border-b border-gray-100">
                        <td className="py-2 text-green-600 font-medium">New Members</td>
                        {monthsData.map(m => (
                          <td key={m.month} className="text-center py-2">
                            <button
                              onClick={() => toggleCell("new", m.month)}
                              className={`px-3 py-1 rounded-full font-medium transition-all ${
                                expandedCell === `new-${m.month}`
                                  ? "bg-green-500 text-white"
                                  : "text-green-600 hover:bg-green-100"
                              }`}
                            >
                              +{m.newMembersCount}
                            </button>
                          </td>
                        ))}
                      </tr>

                      {/* Expanded New Members Details */}
                      {monthsData.map(m => expandedCell === `new-${m.month}` && (
                        <tr key={`new-detail-${m.month}`} className="bg-green-50">
                          <td colSpan={monthsData.length + 1} className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-sm font-semibold text-green-700">New Members in {m.month}</span>
                              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                {m.newMembersCount} member{m.newMembersCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                            {m.newMembers.length > 0 ? (
                              <div className="grid gap-2">
                                {m.newMembers.map((member, i) => (
                                  <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 shadow-sm">
                                    <span className="text-gray-700 font-medium">{member.name}</span>
                                    <span className="text-green-600 font-semibold">{formatCurrency(member.amount)}/mo</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-gray-400 text-sm">No new members this month</div>
                            )}
                          </td>
                        </tr>
                      ))}

                      {/* Lost/On Hold Row */}
                      <tr className="border-b border-gray-100">
                        <td className="py-2 text-red-600 font-medium">Lost / On Hold</td>
                        {monthsData.map(m => {
                          const lostCount = m.lostMembers.filter(x => x.type === "loss").length;
                          const holdCount = m.onHoldCount + m.lostMembers.filter(x => x.type === "hold").length;
                          const totalCount = m.lostMembersCount;
                          return (
                            <td key={m.month} className="text-center py-2">
                              <button
                                onClick={() => toggleCell("lost", m.month)}
                                className={`px-3 py-1 rounded-full font-medium transition-all ${
                                  expandedCell === `lost-${m.month}`
                                    ? "bg-red-500 text-white"
                                    : "text-red-600 hover:bg-red-100"
                                }`}
                              >
                                {totalCount > 0 ? `-${totalCount}` : "0"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Expanded Lost/Hold Details */}
                      {monthsData.map(m => {
                        if (expandedCell !== `lost-${m.month}`) return null;

                        const actualLosses = m.lostMembers.filter(x => x.type === "loss");
                        const onHolds = [
                          ...m.lostMembers.filter(x => x.type === "hold"),
                          ...m.onHoldMembers.map(x => ({ ...x, type: "hold" as const }))
                        ];

                        return (
                          <tr key={`lost-detail-${m.month}`} className="bg-gray-50">
                            <td colSpan={monthsData.length + 1} className="p-4">
                              <div className="grid md:grid-cols-2 gap-6">
                                {/* Actual Losses */}
                                <div>
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <span className="text-sm font-semibold text-red-700">Cancelled / Lost</span>
                                    <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                      {actualLosses.length}
                                    </span>
                                  </div>
                                  {actualLosses.length > 0 ? (
                                    <div className="grid gap-2">
                                      {actualLosses.map((member, i) => (
                                        <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 shadow-sm border-l-4 border-red-400">
                                          <span className="text-gray-700 font-medium">{member.name}</span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-red-600 font-semibold">{formatCurrency(member.amount)}/mo</span>
                                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">LOST</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-gray-400 text-sm bg-white rounded-lg px-3 py-2">No cancellations</div>
                                  )}
                                </div>

                                {/* On Hold */}
                                <div>
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span className="text-sm font-semibold text-amber-700">On Hold</span>
                                    <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                                      {onHolds.length}
                                    </span>
                                  </div>
                                  {onHolds.length > 0 ? (
                                    <div className="grid gap-2">
                                      {onHolds.map((member, i) => (
                                        <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 shadow-sm border-l-4 border-amber-400">
                                          <span className="text-gray-700 font-medium">{member.name}</span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-amber-600 font-semibold">{formatCurrency(member.amount)}/mo</span>
                                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">HOLD</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-gray-400 text-sm bg-white rounded-lg px-3 py-2">No members on hold</div>
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
                        {monthsData.map(m => {
                          const net = m.newMembersCount - m.lostMembersCount;
                          return (
                            <td key={m.month} className={`text-center py-2 font-bold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {net >= 0 ? "+" : ""}{net}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Chart 2: Revenue Breakdown - Stacked Bar */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-start">
                <h3 className="font-bold text-gray-900">Revenue Breakdown by Source</h3>
                {lastPt > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-right">
                    <div className="text-red-600 font-semibold">PT revenue grew</div>
                    <div className="text-red-600">from ${firstPt.toLocaleString()} to ${lastPt.toLocaleString()}</div>
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
                          otherRevenue: 'Other Membership',
                          smallGroupRevenue: 'Small Group',
                          ptRevenue: 'PT'
                        };
                        return [`$${value.toLocaleString()}`, labels[name] || name];
                      }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e0e0e0' }}
                    />
                    <Bar dataKey="otherRevenue" stackId="a" fill="#d1d5db" name="otherRevenue">
                      <LabelList
                        dataKey="otherRevenue"
                        position="center"
                        fill="#374151"
                        fontSize={11}
                        formatter={(value: number) => value > 500 ? `$${(value/1000).toFixed(1)}k` : ''}
                      />
                    </Bar>
                    <Bar dataKey="smallGroupRevenue" stackId="a" fill="#fca5a5" name="smallGroupRevenue">
                      <LabelList
                        dataKey="smallGroupRevenue"
                        position="center"
                        fill="#991b1b"
                        fontSize={11}
                        formatter={(value: number) => value > 500 ? `$${(value/1000).toFixed(1)}k` : ''}
                      />
                    </Bar>
                    <Bar dataKey="ptRevenue" stackId="a" fill="#ef4444" name="ptRevenue" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="ptRevenue"
                        position="top"
                        fill="#dc2626"
                        fontSize={12}
                        fontWeight="bold"
                        formatter={(value: number) => value > 0 ? `$${(value/1000).toFixed(1)}k` : ''}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-red-500 rounded-sm" />
                    <span className="text-gray-600">PT Revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-red-300 rounded-sm" />
                    <span className="text-gray-600">Small Group</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-gray-300 rounded-sm" />
                    <span className="text-gray-600">Other</span>
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
