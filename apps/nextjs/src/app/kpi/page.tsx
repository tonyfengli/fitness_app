"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { OutputTemplate, PnLTab, ReportingTab } from "./components";
import { RetentionDashboard, RETENTION_VIEWS, type RetentionView } from "../save-calls/RetentionDashboard";

const TABS = ["overview", "retention", "pnl", "elev8"] as const;
type TabId = (typeof TABS)[number];

export default function KPIPage() {
  // useSearchParams needs a Suspense boundary in the app router
  return (
    <Suspense>
      <KPIDashboard />
    </Suspense>
  );
}

function KPIDashboard() {
  // Tab and Retention view live in the URL (?tab=retention&view=payments) so links and /save-calls land on them
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const viewParam = searchParams.get("view");
  const activeTab: TabId = TABS.includes(tabParam as TabId) ? (tabParam as TabId) : "overview";
  const retentionView: RetentionView = RETENTION_VIEWS.includes(viewParam as RetentionView)
    ? (viewParam as RetentionView)
    : "at-risk";

  const navigate = (tab: TabId, view?: RetentionView) => {
    const params = new URLSearchParams();
    if (tab !== "overview") params.set("tab", tab);
    if (tab === "retention" && view && view !== "at-risk") params.set("view", view);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const setActiveTab = (tab: TabId) => navigate(tab);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Back to the app home (not "/", which sends KPI-landing founders straight back here) */}
        <Link
          href="/trainer-home"
          className="inline-flex items-center gap-1 mb-3 py-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Home
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">KPI Dashboard</h1>
        <p className="mt-2 text-gray-600">Track performance metrics and generate reports for Elev8 HQ.</p>

        {/* Tab Navigation */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="flex gap-4 overflow-x-auto whitespace-nowrap">
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
              onClick={() => setActiveTab("retention")}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "retention"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Retention
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
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "elev8" && <OutputTemplate />}
        {activeTab === "pnl" && <PnLTab />}
        {activeTab === "overview" && <ReportingTab />}
        {activeTab === "retention" && (
          <RetentionDashboard view={retentionView} onViewChange={(view) => navigate("retention", view)} />
        )}
      </div>
    </div>
  );
}
