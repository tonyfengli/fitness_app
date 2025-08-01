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
  // Create tab options: one per client + shared tab
  const clientTabs = groupContext.clients.map(client => ({
    id: client.user_id,
    name: client.name,
    type: 'client' as const
  }));
  
  const allTabs = [
    ...clientTabs,
    { id: 'shared', name: 'Shared Exercises', type: 'shared' as const }
  ];

  // Set default tab if none selected
  React.useEffect(() => {
    if (!activeTab && allTabs.length > 0) {
      setActiveTab(allTabs[0].id as any);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Standard Group Workout</h1>
            <p className="text-lg text-gray-600 mt-1">
              Exercise pools for {summary.totalClients} clients
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

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {allTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-3 text-sm font-medium ${
                    activeTab === tab.id
                      ? 'border-b-2 border-indigo-500 text-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Client Exercise Tables */}
            {clientTabs.map(clientTab => {
              if (activeTab !== clientTab.id) return null;
              
              const client = groupContext.clients.find(c => c.user_id === clientTab.id);
              const pool = blueprint.clientExercisePools[clientTab.id];
              
              if (!client || !pool) return null;

              return (
                <div key={clientTab.id}>
                  {/* Client Info Header */}
                  <div className="mb-6 flex items-start gap-4">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.user_id}`}
                      alt={client.name}
                      className="w-16 h-16 rounded-full"
                    />
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold">{client.name}</h3>
                      <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Goal:</span> {formatMuscleName(client.primary_goal || 'general_fitness')}
                        </div>
                        <div>
                          <span className="font-medium">Intensity:</span> {client.intensity}
                        </div>
                        {client.muscle_target && client.muscle_target.length > 0 && (
                          <div>
                            <span className="font-medium">Target Muscles:</span> {client.muscle_target.map(formatMuscleName).join(', ')}
                          </div>
                        )}
                        {client.muscle_lessen && client.muscle_lessen.length > 0 && (
                          <div>
                            <span className="font-medium">Avoid Muscles:</span> {client.muscle_lessen.map(formatMuscleName).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Exercise Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Exercise Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Movement Pattern
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Primary Muscle
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Secondary Muscles
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Score
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Score Breakdown
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {/* Placeholder Pre-assigned Exercises */}
                        <tr className="bg-purple-50">
                          <td className="px-4 py-2 text-sm text-gray-900">1</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">Barbell Back Squat</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Squat</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Glutes</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Quads, Hamstrings</td>
                          <td className="px-4 py-2 text-sm text-gray-900">-</td>
                          <td className="px-4 py-2 text-sm">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Pre-assigned (deterministic)
                            </span>
                          </td>
                        </tr>
                        <tr className="bg-purple-50">
                          <td className="px-4 py-2 text-sm text-gray-900">2</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">Pull-ups</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Vertical Pull</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Lats</td>
                          <td className="px-4 py-2 text-sm text-gray-600">Biceps, Middle Back</td>
                          <td className="px-4 py-2 text-sm text-gray-900">-</td>
                          <td className="px-4 py-2 text-sm">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Pre-assigned (deterministic)
                            </span>
                          </td>
                        </tr>
                        
                        {/* Available Candidates */}
                        {pool.availableCandidates.map((exercise, idx) => {
                          const scoreBreakdown = exercise.scoreBreakdown || {};
                          const isShared = blueprint.sharedExercisePool.some(
                            shared => shared.id === exercise.id
                          );
                          
                          // Build score breakdown badges
                          const breakdownBadges = [];
                          
                          if (scoreBreakdown.includeExerciseBoost > 0) {
                            breakdownBadges.push(
                              <span key="include" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                Include +{scoreBreakdown.includeExerciseBoost.toFixed(1)}
                              </span>
                            );
                          }
                          
                          if (scoreBreakdown.muscleTargetBonus > 0) {
                            const isPrimary = scoreBreakdown.muscleTargetBonus >= 3.0;
                            breakdownBadges.push(
                              <span key="target" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                Target {isPrimary ? '' : '(2nd)'} +{scoreBreakdown.muscleTargetBonus.toFixed(1)}
                              </span>
                            );
                          }
                          
                          if (scoreBreakdown.muscleLessenPenalty < 0) {
                            const isPrimary = scoreBreakdown.muscleLessenPenalty <= -3.0;
                            breakdownBadges.push(
                              <span key="lessen" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                Lessen {isPrimary ? '' : '(2nd)'} {scoreBreakdown.muscleLessenPenalty.toFixed(1)}
                              </span>
                            );
                          }
                          
                          if (scoreBreakdown.intensityAdjustment > 0) {
                            breakdownBadges.push(
                              <span key="intensity" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Intensity +{scoreBreakdown.intensityAdjustment.toFixed(2)}
                              </span>
                            );
                          }
                          
                          return (
                            <tr key={exercise.id} className={idx < 6 ? 'bg-blue-50' : ''}>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {idx + 3}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                {exercise.name}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {formatMuscleName(exercise.movementPattern || '')}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {formatMuscleName(exercise.primaryMuscle || '')}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 
                                  ? exercise.secondaryMuscles.map(formatMuscleName).join(', ')
                                  : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                                {exercise.score.toFixed(1)}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <div className="flex flex-wrap gap-1">
                                  {breakdownBadges.length > 0 ? breakdownBadges : (
                                    <span className="text-gray-400 text-xs">Base score</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-gray-500">
                    <p>* Purple rows: Pre-assigned exercises (2)</p>
                    <p>* Blue rows: Top 6 exercises to be selected by LLM</p>
                    <p>* Total workout: 8 exercises (2 pre-assigned + 6 selected)</p>
                  </div>
                </div>
              );
            })}

            {/* Shared Exercises Tab */}
            {activeTab === 'shared' && (
              <div>
                <h3 className="text-xl font-semibold mb-4">
                  Shared Exercise Pool ({blueprint.sharedExercisePool.length} exercises)
                </h3>
                <p className="text-gray-600 mb-6">
                  These exercises can be performed by multiple clients and may be selected to increase group cohesion.
                </p>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Exercise Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Movement Pattern
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Primary Muscle
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Secondary Muscles
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Group Score
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Clients
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {blueprint.sharedExercisePool.map((exercise, idx) => (
                        <tr key={exercise.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {exercise.name}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {formatMuscleName(exercise.movementPattern || '')}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {formatMuscleName(exercise.primaryMuscle || '')}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 
                              ? exercise.secondaryMuscles.map(formatMuscleName).join(', ')
                              : '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {exercise.groupScore.toFixed(1)}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <div className="flex flex-wrap gap-1">
                              {exercise.clientsSharing.map(clientId => {
                                const client = groupContext.clients.find(c => c.user_id === clientId);
                                return (
                                  <span
                                    key={clientId}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    {client?.name || clientId}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}