"use client";

import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

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

// Define which reports are needed for each analysis
const ANALYSIS_DEPENDENCIES = {
  financial_stats: ["all_payments"],
  new_members: ["all_payments", "starting_memberships", "current_members"],
  retention: ["cancellations", "all_payments", "current_members"],
  freeze: ["members_on_hold", "all_payments", "current_members"],
  membership_stats: ["current_members", "all_payments", "members_on_hold", "cancellations"],
} as const;

export default function KPIPage() {
  const [files, setFiles] = useState<UploadedFiles>({});
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [allPaymentsResult, setAllPaymentsResult] = useState<ParseResult | null>(null);
  const [newMembersResult, setNewMembersResult] = useState<NewMembersResult | null>(null);
  const [cancellationsResult, setCancellationsResult] = useState<CancellationsResult | null>(null);
  const [membersOnHoldResult, setMembersOnHoldResult] = useState<MembersOnHoldResult | null>(null);
  const [currentMembersResult, setCurrentMembersResult] = useState<CurrentMembersResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (reportId: ReportId, file: File | null) => {
    if (file) {
      setFiles((prev) => ({ ...prev, [reportId]: file }));

      // Read file content
      const content = await file.text();
      setFileContents((prev) => ({ ...prev, [reportId]: content }));
    } else {
      const { [reportId]: _, ...restFiles } = files;
      setFiles(restFiles);
      const { [reportId]: __, ...restContents } = fileContents;
      setFileContents(restContents);
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
  const [activeTab, setActiveTab] = useState<"data" | "output">("data");

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
              Output
            </button>
          </nav>
        </div>

        {/* Data Tab */}
        {activeTab === "data" && (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Upload Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Upload Reports</h2>
            <p className="text-sm text-gray-500">
              Reports are cross-referenced for accuracy. Upload all required reports to see results.
            </p>

            {REPORT_TYPES.map((report) => (
              <FileUploadSlot
                key={report.id}
                reportId={report.id}
                label={report.label}
                description={report.description}
                file={files[report.id]}
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

            {/* New Members */}
            <ResultCard
              title="New Members"
              ready={canAnalyzeNewMembers}
              requiredReports={["All Payments", "Starting Memberships", "Current Members"]}
            >
              {newMembersResult && (
                <NewMembersResults result={newMembersResult} />
              )}
            </ResultCard>

            {/* Retention (Cancellations + Freeze) */}
            <ResultCard
              title="Retention"
              ready={canAnalyzeRetention && canAnalyzeFreeze}
              requiredReports={["Cancellations", "Members on Hold", "All Payments", "Current Members"]}
            >
              {cancellationsResult && membersOnHoldResult && (
                <RetentionResults
                  cancellations={cancellationsResult}
                  freeze={membersOnHoldResult}
                />
              )}
            </ResultCard>

          </div>
        </div>
        )}

        {/* Output Tab */}
        {activeTab === "output" && (
          <OutputTemplate
            allPayments={allPaymentsResult}
            newMembers={newMembersResult}
            cancellations={cancellationsResult}
            membersOnHold={membersOnHoldResult}
            currentMembers={currentMembersResult}
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
  onFileChange,
}: {
  reportId: string;
  label: string;
  description: string;
  file?: File;
  onFileChange: (file: File | null) => void;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    onFileChange(selectedFile);
  };

  const handleRemove = () => {
    onFileChange(null);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">{label}</h3>
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

function NewMembersResults({ result }: { result: NewMembersResult }) {
  return (
    <div>
      {/* Reporting Period */}
      {result.reportingPeriod.start && (
        <div className="mb-3 text-xs text-gray-500">
          Period: {result.reportingPeriod.start} to {result.reportingPeriod.end}
        </div>
      )}

      {/* Summary for Template */}
      <div className="mb-4 rounded-md bg-green-50 p-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-green-700">New Members (count):</div>
          <div className="font-bold text-green-900">{result.confirmedNewMembers.length}</div>
          <div className="text-green-700">Front End Revenue:</div>
          <div className="font-bold text-green-900">{formatCurrency(result.totalRevenue)}</div>
        </div>
      </div>

      {/* Confirmed New Members */}
      {result.confirmedNewMembers.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700">
            Confirmed New Members ({result.confirmedNewMembers.length})
          </h4>
          <div className="space-y-1 text-sm">
            {result.confirmedNewMembers.map((m, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-gray-600">
                  {m.name}
                  <span className="ml-1 text-xs text-gray-400">({m.joiningDate})</span>
                </span>
                <span className="text-gray-900">{formatCurrency(m.paidAmount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RetentionResults({
  cancellations,
  freeze
}: {
  cancellations: CancellationsResult;
  freeze: MembersOnHoldResult;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const totalLost = cancellations.totalRevenueLost + freeze.estimatedRevenueLost;

  return (
    <div>
      {/* Summary Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg bg-red-50 p-3 text-center">
          <div className="text-2xl font-bold text-red-900">{cancellations.trueCancellationCount}</div>
          <div className="text-xs text-red-700">Cancelled</div>
          <div className="text-sm font-medium text-red-800 mt-1">{formatCurrency(cancellations.cancellationRevenueLost)}</div>
        </div>
        <div className="rounded-lg bg-blue-50 p-3 text-center">
          <div className="text-2xl font-bold text-blue-900">{freeze.freezeCount}</div>
          <div className="text-xs text-blue-700">Frozen</div>
          <div className="text-sm font-medium text-blue-800 mt-1">{formatCurrency(freeze.estimatedRevenueLost)}</div>
        </div>
        <div className="rounded-lg bg-amber-50 p-3 text-center">
          <div className="text-2xl font-bold text-amber-900">{cancellations.membershipChangeCount}</div>
          <div className="text-xs text-amber-700">Changed</div>
          <div className="text-sm font-medium text-amber-800 mt-1">{formatCurrency(cancellations.membershipChangeRevenueLost)}</div>
        </div>
      </div>

      {/* Total Lost */}
      <div className="flex justify-between items-center py-2 border-t border-b mb-4">
        <span className="text-sm font-medium text-gray-700">Total Monthly Revenue Lost</span>
        <span className="text-lg font-bold text-red-600">{formatCurrency(totalLost)}</span>
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
          {/* Cancelled Members */}
          {cancellations.trueCancellations.length > 0 && (
            <div>
              <div className="text-xs font-medium text-red-700 mb-2">Cancelled</div>
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

          {/* Frozen Members */}
          {freeze.membersOnHold.length > 0 && (
            <div>
              <div className="text-xs font-medium text-blue-700 mb-2">Frozen</div>
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

          {/* Membership Changes */}
          {cancellations.membershipChanges.length > 0 && (
            <div>
              <div className="text-xs font-medium text-amber-700 mb-2">Changed</div>
              <div className="space-y-1">
                {cancellations.membershipChanges.map((c, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600">{c.name}</span>
                    <span className={c.priceDifference && c.priceDifference > 0 ? "text-red-600" : "text-green-600"}>
                      {c.priceDifference !== undefined && c.priceDifference !== 0
                        ? (c.priceDifference > 0 ? `-$${c.priceDifference}` : `+$${Math.abs(c.priceDifference)}`)
                        : "—"
                      }
                    </span>
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

function OutputTemplate({ allPayments, newMembers, cancellations, membersOnHold, currentMembers }: OutputTemplateProps) {
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
    // Financial Stats - only smallGrp is populated for now
    quickbooksRevenue: "",
    openGymRevenue: "",
    ptRevenue: "",
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
    newMembersCount: newMembers?.confirmedNewMembers.length.toString() || "",
    lostMembers: cancellations?.trueCancellationCount.toString() || "",
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
    frontEndRevenue: newMembers?.totalRevenue.toFixed(2) || "",
    signUpFeesMarketing: "",

    // All Payments Report
    allPaymentsProcessed: allPayments?.totalPayments.toFixed(2) || "",
    taxPaid: "",

    // Numbers for Taxes
    ptMembershipSales: "",
    retailSales: "",
    tax: "",

    // Retention
    freezeCount: membersOnHold?.freezeCount.toString() || "",
    freezeLost: membersOnHold?.estimatedRevenueLost.toFixed(2) || "",
    cancelledCount: cancellations?.trueCancellationCount.toString() || "",
    cancelledLost: cancellations?.cancellationRevenueLost.toFixed(2) || "",
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
      smallGrpRevenue: allPayments?.totals.small_grp?.toFixed(2) || prev.smallGrpRevenue,
      newMembersCount: newMembers?.confirmedNewMembers.length.toString() || prev.newMembersCount,
      lostMembers: cancellations?.trueCancellationCount.toString() || prev.lostMembers,
      totalMembers: allPayments?.memberPayments.length.toString() || prev.totalMembers, // Paying members
      frontEndRevenue: newMembers?.totalRevenue.toFixed(2) || prev.frontEndRevenue,
      allPaymentsProcessed: allPayments?.totalPayments.toFixed(2) || prev.allPaymentsProcessed,
      freezeCount: membersOnHold?.freezeCount.toString() || prev.freezeCount,
      freezeLost: membersOnHold?.estimatedRevenueLost.toFixed(2) || prev.freezeLost,
      cancelledCount: cancellations?.trueCancellationCount.toString() || prev.cancelledCount,
      cancelledLost: cancellations?.cancellationRevenueLost.toFixed(2) || prev.cancelledLost,
      changesCount: cancellations?.membershipChangeCount.toString() || prev.changesCount,
      changesLost: cancellations?.membershipChangeRevenueLost.toFixed(2) || prev.changesLost,
    }));
  }, [allPayments, newMembers, cancellations, membersOnHold, currentMembers]);

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
            <TemplateRow label="PT Revenue" value={data.ptRevenue} onChange={(v) => updateField("ptRevenue", v)} disabled />
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
            <TemplateRow label="New Members" value={data.newMembersCount} onChange={(v) => updateField("newMembersCount", v)} highlight exportMode={exportMode} isCurrency={false} />
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
            <TemplateRow label="New Members" value={data.newMembersCount} readOnly isCurrency={false} />
            <TemplateRow label="Conversion Rate" value={conversionRate} readOnly />
            <TemplateRow label="Total Ad Spend" value={data.totalAdSpend} onChange={(v) => updateField("totalAdSpend", v)} prefix="$" />
            <TemplateRow label="Front End Revenue" value={data.frontEndRevenue} onChange={(v) => updateField("frontEndRevenue", v)} highlight exportMode={exportMode} />
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

