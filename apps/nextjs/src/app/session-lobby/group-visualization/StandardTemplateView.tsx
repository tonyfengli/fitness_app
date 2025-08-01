"use client";

import React from "react";
import Link from "next/link";

interface StandardTemplateViewProps {
  groupContext: any;
  blueprint: any;
  summary: any;
  generateWorkout: () => void;
  isGenerating: boolean;
  router: any;
  activeTab: 'overview' | 'stage1' | 'stage2';
  setActiveTab: (tab: 'overview' | 'stage1' | 'stage2') => void;
  llmDebugData: any;
}

export default function StandardTemplateView({
  groupContext,
  blueprint,
  summary,
  generateWorkout,
  isGenerating,
  router,
  activeTab,
  setActiveTab,
  llmDebugData
}: StandardTemplateViewProps) {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Standard Template (Two-Stage)</h1>
            <p className="text-lg text-gray-600 mt-1">
              Exercise selection → Workout programming for {summary.totalClients} clients
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={generateWorkout}
              disabled={isGenerating}
              className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg disabled:opacity-50"
            >
              {isGenerating ? 'Generating...' : 'Generate Workout'}
            </button>
            <button
              onClick={() => router.push(`/session-lobby?sessionId=${groupContext.sessionId}`)}
              className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              Back to Lobby
            </button>
          </div>
        </div>

        {/* Two-Stage Process Overview */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Two-Stage Generation Process</h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="border-2 border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 mb-2">Stage 1: Exercise Selection</h3>
              <p className="text-sm text-gray-600">
                Select optimal exercises for each client based on preferences and constraints.
              </p>
            </div>
            <div className="border-2 border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-800 mb-2">Stage 2: Workout Programming</h3>
              <p className="text-sm text-gray-600">
                Program the selected exercises with sets, reps, and timing.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'overview'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('stage1')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'stage1'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Stage 1: Exercise Selection
              </button>
              <button
                onClick={() => setActiveTab('stage2')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'stage2'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Stage 2: Programming
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Template Configuration</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm">
                  {JSON.stringify({
                    template: 'standard',
                    strategy: 'two-stage',
                    clients: groupContext.clients.map(c => ({
                      name: c.name,
                      intensity: c.intensity,
                      targets: c.muscle_target
                    }))
                  }, null, 2)}
                </pre>
              </div>
            )}

            {activeTab === 'stage1' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Stage 1: Exercise Selection</h3>
                <div className="bg-gray-100 p-4 rounded">
                  <p className="text-gray-600">
                    Stage 1 prompt will appear here when generated...
                  </p>
                  {llmDebugData?.stage1Prompt && (
                    <pre className="mt-4 text-sm">{llmDebugData.stage1Prompt}</pre>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'stage2' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Stage 2: Workout Programming</h3>
                <div className="bg-gray-100 p-4 rounded">
                  <p className="text-gray-600">
                    Stage 2 prompt will appear here when generated...
                  </p>
                  {llmDebugData?.stage2Prompt && (
                    <pre className="mt-4 text-sm">{llmDebugData.stage2Prompt}</pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}