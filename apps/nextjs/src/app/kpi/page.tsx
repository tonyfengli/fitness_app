"use client";

import { useState } from "react";

import { OutputTemplate, PnLTab, ReportingTab, AdministrativeTab } from "./components";

export default function KPIPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "elev8" | "pnl" | "administrative">("overview");

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-gray-900">KPI Dashboard</h1>
        <p className="mt-2 text-gray-600">Track performance metrics and generate reports for Elev8 HQ.</p>

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

        {/* Tab Content */}
        {activeTab === "elev8" && <OutputTemplate />}
        {activeTab === "pnl" && <PnLTab />}
        {activeTab === "overview" && <ReportingTab />}
        {activeTab === "administrative" && <AdministrativeTab />}
      </div>
    </div>
  );
}
