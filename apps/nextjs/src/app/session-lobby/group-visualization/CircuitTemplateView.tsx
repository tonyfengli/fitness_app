"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type {
  GroupContext,
  GroupWorkoutBlueprint,
} from "@acme/ai/client";

interface CircuitTemplateViewProps {
  groupContext: GroupContext;
  blueprint: GroupWorkoutBlueprint;
  summary: any;
  generateWorkout: () => void;
  isGenerating: boolean;
  router: any;
  llmDebugData: any;
  llmResult?: any;
  sessionData?: any;
  isFromSavedData?: boolean;
  isSaving?: boolean;
}

// Helper to format muscle names
function formatMuscleName(muscle: string): string {
  return muscle.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function CircuitTemplateView({
  groupContext,
  blueprint,
  summary,
  generateWorkout,
  isGenerating,
  router,
  llmDebugData,
  llmResult,
  sessionData,
  isFromSavedData,
  isSaving,
}: CircuitTemplateViewProps) {
  const [showRawData, setShowRawData] = useState(false);
  
  // Get the circuit exercises block
  const circuitBlock = blueprint.blocks?.find(b => b.blockId === 'circuit_exercises');
  
  // Get all individual exercises (deduplicated)
  const allExercises = useMemo(() => {
    if (!circuitBlock) return [];
    
    // Collect all exercises from all clients
    const exerciseMap = new Map();
    
    // Add shared exercises first (higher priority)
    circuitBlock.sharedCandidates?.exercises?.forEach((ex: any) => {
      if (!exerciseMap.has(ex.id)) {
        exerciseMap.set(ex.id, {
          ...ex,
          isShared: true,
          clientCount: ex.clientsSharing?.length || 0,
        });
      }
    });
    
    // Add individual exercises
    Object.entries(circuitBlock.individualCandidates || {}).forEach(([clientId, data]: [string, any]) => {
      data.exercises?.forEach((ex: any) => {
        if (!exerciseMap.has(ex.id)) {
          exerciseMap.set(ex.id, {
            ...ex,
            isShared: false,
            clientCount: 1,
          });
        }
      });
    });
    
    // Convert to array and sort by score
    return Array.from(exerciseMap.values()).sort((a, b) => {
      // Sort by group score if available, otherwise individual score
      const scoreA = a.groupScore || a.score || 0;
      const scoreB = b.groupScore || b.score || 0;
      return scoreB - scoreA;
    });
  }, [circuitBlock]);
  
  // Get the filtered exercises (top 20-30) - these would be marked as "Smart Bucketing Selection"
  const filteredExercises = allExercises.slice(0, 30);
  const filteredExerciseIds = new Set(filteredExercises.map(ex => ex.id));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Circuit Training Workout
            </h1>
            <p className="mt-1 text-lg text-gray-600">
              Exercise pool for {summary.totalClients} {summary.totalClients === 1 ? 'client' : 'clients'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              {isFromSavedData && (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  Using Saved Data
                </span>
              )}
              {isSaving && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                  Saving...
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!llmResult || llmResult.error ? (
              <button
                onClick={generateWorkout}
                disabled={isGenerating}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isGenerating ? "Generating..." : "Generate Circuit"}
              </button>
            ) : (
              <a
                href={`/workout-overview?sessionId=${groupContext.sessionId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg bg-green-600 px-4 py-2 text-center text-white hover:bg-green-700"
              >
                View Circuit Workout
              </a>
            )}
            {sessionData?.status !== "completed" && (
              <button
                onClick={() =>
                  router.push(
                    `/session-lobby?sessionId=${groupContext.sessionId}`,
                  )
                }
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Back to Lobby
              </button>
            )}
          </div>
        </div>

        {/* Warnings */}
        {summary.cohesionWarnings?.length > 0 && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Warnings
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc space-y-1 pl-5">
                    {summary.cohesionWarnings.map((warning: string, idx: number) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Exercise Pool Table */}
        <div className="rounded-lg bg-white shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Circuit Exercise Pool
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              All available exercises for circuit training. Exercises marked with "Smart Bucketing Selection" are in the filtered pool.
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Exercise Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Movement Pattern
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Primary Muscle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Equipment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allExercises.map((exercise, idx) => {
                  const isInFilteredPool = filteredExerciseIds.has(exercise.id);
                  const score = exercise.groupScore || exercise.score || 0;
                  
                  return (
                    <tr key={exercise.id} className={isInFilteredPool ? 'bg-blue-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {exercise.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {exercise.movementPattern ? formatMuscleName(exercise.movementPattern) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {exercise.primaryMuscle ? formatMuscleName(exercise.primaryMuscle) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Array.isArray(exercise.equipment) 
                          ? exercise.equipment.join(', ') 
                          : exercise.equipment || 'None'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {score.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isInFilteredPool ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Smart Bucketing Selection
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">Available</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* LLM Debug Section */}
        {llmDebugData && (
          <div className="mt-8 rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Circuit Generation Debug
            </h3>
            <div className="space-y-4">
              {/* System Prompt */}
              <details className="rounded-lg border border-gray-200 p-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  System Prompt
                </summary>
                <div className="mt-3 rounded-md bg-gray-50 p-4">
                  <pre className="whitespace-pre-wrap font-mono text-xs text-gray-600">
                    {llmDebugData.systemPrompt || (
                      <span className="text-gray-400">
                        Click "Generate Circuit" to see the prompt
                      </span>
                    )}
                  </pre>
                </div>
              </details>

              {/* LLM Output */}
              <details className="rounded-lg border border-gray-200 p-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  LLM Response
                </summary>
                <div className="mt-3 rounded-md bg-gray-50 p-4">
                  <pre className="whitespace-pre-wrap font-mono text-xs text-gray-600">
                    {llmDebugData.llmOutput || (
                      <span className="text-gray-400">
                        Click "Generate Circuit" to see the LLM response
                      </span>
                    )}
                  </pre>
                </div>
              </details>
            </div>
          </div>
        )}

        {/* Raw Data Toggle */}
        <div className="mt-8">
          <button
            onClick={() => setShowRawData(!showRawData)}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {showRawData ? "Hide" : "Show"} Raw Data
          </button>
          {showRawData && (
            <div className="mt-4 rounded-lg bg-gray-100 p-4">
              <pre className="text-xs text-gray-700 overflow-auto">
                {JSON.stringify({ groupContext, blueprint, summary }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}