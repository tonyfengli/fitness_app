"use client";

import React from "react";
import Link from "next/link";
import type { StandardGroupWorkoutBlueprint } from "@acme/ai";
import type { GroupContext } from "@acme/ai";

interface StandardTemplateViewProps {
  groupContext: GroupContext;
  blueprint: StandardGroupWorkoutBlueprint;
  summary: any;
  generateWorkout: () => void;
  isGenerating: boolean;
  router: any;
  activeTab: 'overview' | 'stage1' | 'stage2';
  setActiveTab: (tab: 'overview' | 'stage1' | 'stage2') => void;
  llmDebugData: any;
}

// Helper to format muscle names
function formatMuscleName(muscle: string): string {
  return muscle.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Blueprint Metadata</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm font-medium text-gray-700">Template Type</p>
                      <p className="text-lg">{blueprint.metadata.templateType}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm font-medium text-gray-700">Workout Flow</p>
                      <p className="text-lg">{blueprint.metadata.workoutFlow}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm font-medium text-gray-700">Total Exercises/Client</p>
                      <p className="text-lg">{blueprint.metadata.totalExercisesPerClient}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm font-medium text-gray-700">Pre-assigned Count</p>
                      <p className="text-lg">{blueprint.metadata.preAssignedCount}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Client Exercise Pools</h3>
                  <div className="space-y-4">
                    {groupContext.clients.map((client) => {
                      const pool = blueprint.clientExercisePools[client.user_id];
                      if (!pool) return null;

                      return (
                        <div key={client.user_id} className="border rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <img
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.user_id}`}
                              alt={client.name}
                              className="w-10 h-10 rounded-full"
                            />
                            <div>
                              <h4 className="font-medium">{client.name}</h4>
                              <p className="text-sm text-gray-600">
                                {pool.preAssigned.length} pre-assigned, {pool.additionalNeeded} to select
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h5 className="text-sm font-medium mb-2">Pre-assigned Exercises</h5>
                              <ul className="text-sm space-y-1">
                                {pool.preAssigned.map((pre, idx) => (
                                  <li key={idx} className="text-gray-700">
                                    • {pre.exercise.name} ({pre.source})
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h5 className="text-sm font-medium mb-2">Available Candidates ({pool.availableCandidates.length})</h5>
                              <p className="text-sm text-gray-600">
                                Top scoring: {pool.availableCandidates[0]?.name} ({pool.availableCandidates[0]?.score.toFixed(1)})
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Shared Exercise Pool ({blueprint.sharedExercisePool.length} exercises)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {blueprint.sharedExercisePool.slice(0, 6).map((exercise, idx) => (
                      <div key={exercise.id} className="bg-gray-50 p-3 rounded">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-sm">{exercise.name}</h4>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {exercise.clientsSharing.length} clients
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Score: {exercise.groupScore.toFixed(1)} | {exercise.movementPattern}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'stage1' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Stage 1: Exercise Selection</h3>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Phase 1 Purpose</h4>
                  <p className="text-sm text-blue-800">
                    Select {blueprint.metadata.totalExercisesPerClient - blueprint.metadata.preAssignedCount} additional exercises 
                    for each client from their available candidate pool. The LLM will consider:
                  </p>
                  <ul className="text-sm text-blue-800 mt-2 list-disc list-inside">
                    <li>Muscle targets and avoidances</li>
                    <li>Exercise variety and movement patterns</li>
                    <li>Shared exercise opportunities</li>
                    <li>Individual fitness goals</li>
                  </ul>
                </div>

                {llmDebugData?.systemPrompt && (
                  <details className="border rounded-lg p-3">
                    <summary className="cursor-pointer font-medium">View Phase 1 Prompt</summary>
                    <pre className="mt-3 text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                      {llmDebugData.systemPrompt}
                    </pre>
                  </details>
                )}

                {llmDebugData?.llmOutput && (
                  <details className="border rounded-lg p-3">
                    <summary className="cursor-pointer font-medium">View Phase 1 Output</summary>
                    <pre className="mt-3 text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                      {llmDebugData.llmOutput}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {activeTab === 'stage2' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Stage 2: Workout Programming</h3>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">Phase 2 Purpose</h4>
                  <p className="text-sm text-green-800">
                    Organize the selected exercises into rounds with appropriate programming. The LLM will determine:
                  </p>
                  <ul className="text-sm text-green-800 mt-2 list-disc list-inside">
                    <li>Exercise order and round assignment</li>
                    <li>Sets, reps, and tempo for each exercise</li>
                    <li>Equipment management and flow</li>
                    <li>Rest periods and timing</li>
                  </ul>
                </div>

                <div className="bg-gray-100 p-4 rounded">
                  <p className="text-gray-600">
                    Phase 2 will execute after Phase 1 completes successfully.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}