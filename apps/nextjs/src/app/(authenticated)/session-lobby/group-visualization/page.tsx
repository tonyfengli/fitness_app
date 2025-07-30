"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useGroupWorkoutGeneration } from "@acme/ui-shared";
import type { GroupScoredExercise } from "@acme/ai";

// Helper to format muscle names for display (convert underscore to space and capitalize)
function formatMuscleName(muscle: string): string {
  return muscle.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Helper function to determine score adjustment labels
function getScoreAdjustmentLabels(score: number, scoreBreakdown?: any): React.ReactElement | React.ReactElement[] | null {
  // If we have the actual breakdown, use it
  if (scoreBreakdown) {
    const labels: React.ReactElement[] = [];
    
    if (scoreBreakdown.includeExerciseBoost > 0) {
      labels.push(
        <span key="include" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
          Include +{scoreBreakdown.includeExerciseBoost.toFixed(1)}
        </span>
      );
    }
    
    if (scoreBreakdown.muscleTargetBonus > 0) {
      const isPrimary = scoreBreakdown.muscleTargetBonus >= 3.0;
      labels.push(
        <span key="target" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          Target {isPrimary ? '' : '(2nd)'} +{scoreBreakdown.muscleTargetBonus.toFixed(1)}
        </span>
      );
    }
    
    if (scoreBreakdown.muscleLessenPenalty < 0) {
      const isPrimary = scoreBreakdown.muscleLessenPenalty <= -3.0;
      labels.push(
        <span key="lessen" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
          Lessen {isPrimary ? '' : '(2nd)'} {scoreBreakdown.muscleLessenPenalty.toFixed(1)}
        </span>
      );
    }
    
    if (scoreBreakdown.intensityAdjustment > 0) {
      labels.push(
        <span key="intensity-pos" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          Intensity +{scoreBreakdown.intensityAdjustment.toFixed(2)}
        </span>
      );
    } else if (scoreBreakdown.intensityAdjustment < 0) {
      labels.push(
        <span key="intensity-neg" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
          Intensity {scoreBreakdown.intensityAdjustment.toFixed(2)}
        </span>
      );
    }
    
    return labels.length > 0 ? <>{labels}</> : null;
  }
  
  // Fallback to guessing from score diff (existing logic)
  const diff = score - 5.0;
  const absDiff = Math.abs(diff);
  
  // Use small epsilon for floating point comparison
  const isClose = (a: number, b: number) => Math.abs(a - b) < 0.01;
  
  if (diff > 0) {
    // Positive adjustments
    if (isClose(absDiff, 4.5)) {
      // 3.0 (target primary) + 1.5 (intensity)
      return (
        <>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Target +3.0</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Intensity +1.5</span>
        </>
      );
    } else if (isClose(absDiff, 3.75)) {
      // 3.0 (target primary) + 0.75 (intensity)
      return (
        <>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Target +3.0</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Intensity +0.75</span>
        </>
      );
    } else if (isClose(absDiff, 3.0)) {
      // Include exercise boost or target primary
      if (score >= 8.0) {
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">Include +{diff.toFixed(1)}</span>;
      }
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Target +3.0</span>;
    } else if (isClose(absDiff, 2.25)) {
      // 1.5 (target secondary) + 0.75 (intensity)
      return (
        <>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Target +1.5</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Intensity +0.75</span>
        </>
      );
    } else if (isClose(absDiff, 1.5)) {
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Target +1.5</span>;
    } else if (isClose(absDiff, 0.75)) {
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Intensity +0.75</span>;
    } else {
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">+{diff.toFixed(2)}</span>;
    }
  } else if (diff < 0) {
    // Negative adjustments
    if (isClose(absDiff, 4.5)) {
      // -3.0 (lessen primary) + -1.5 (intensity)
      return (
        <>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Lessen -3.0</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Intensity -1.5</span>
        </>
      );
    } else if (isClose(absDiff, 3.0)) {
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Lessen -3.0</span>;
    } else if (isClose(absDiff, 2.25)) {
      // -1.5 (lessen secondary) + -0.75 (intensity)
      return (
        <>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Lessen -1.5</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Intensity -0.75</span>
        </>
      );
    } else if (isClose(absDiff, 1.5)) {
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Intensity -1.5</span>;
    } else if (isClose(absDiff, 0.75)) {
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Intensity -0.75</span>;
    } else {
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{diff.toFixed(2)}</span>;
    }
  }
  
  return null;
}

export default function GroupVisualizationPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const router = useRouter();
  const trpc = useTRPC();
  
  const [selectedBlock, setSelectedBlock] = useState<string>("");
  const [showRawData, setShowRawData] = useState(false);
  const [llmDebugData, setLlmDebugData] = useState<{
    systemPrompt: string | null;
    userMessage: string | null;
    llmOutput: string | null;
  }>({ systemPrompt: null, userMessage: null, llmOutput: null });
  
  // Fetch visualization data
  const { data, isLoading, error } = useQuery({
    ...trpc.trainingSession.visualizeGroupWorkout.queryOptions({ sessionId: sessionId! }),
    enabled: !!sessionId,
  });
  
  // Use the shared hook for workout generation
  const { generate: generateWorkout, isGenerating, workoutData } = useGroupWorkoutGeneration({
    sessionId: sessionId!,
    trpc,
    onSuccess: (data) => {
      console.log('Group workout generation result:', data);
      
      // Update the debug data
      if (data.debug) {
        setLlmDebugData({
          systemPrompt: data.debug.systemPrompt,
          userMessage: data.debug.userMessage,
          llmOutput: data.debug.llmOutput
        });
      }
    }
  });
  
  // Set default selected block when data loads
  useEffect(() => {
    if (data && data.blueprint.blocks.length > 0 && !selectedBlock) {
      setSelectedBlock(data.blueprint.blocks[0].blockId);
    }
  }, [data, selectedBlock]);
  
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">No Session Selected</h1>
          <p className="mt-2 text-gray-600">Please select a session from the sessions page.</p>
        </div>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading group workout data...</p>
        </div>
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Error Loading Data</h1>
          <p className="mt-2 text-gray-600">{error?.message || "Failed to load group workout visualization"}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  const { groupContext, blueprint, summary } = data;
  const selectedBlockData = blueprint.blocks.find(b => b.blockId === selectedBlock);
  
  return (
    <div className="h-screen bg-gray-50 p-4 flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <div className="mb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Group Workout Visualization</h1>
              <p className="text-sm text-gray-600">Phase A & B Results for {summary.totalClients} clients</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => generateWorkout()}
                disabled={isGenerating}
                className="px-3 py-1 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Generating...' : 'Test LLM Generation'}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/workout-overview?sessionId=${sessionId}`)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
                >
                  View Workouts
                </button>
                <button
                  onClick={() => router.push(`/preferences?sessionId=${sessionId}`)}
                  className="px-3 py-1 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded-md transition-colors"
                >
                  View Preferences
                </button>
                <button
                  onClick={() => router.back()}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  ← Back
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Warnings */}
        {summary.cohesionWarnings.length > 0 && (
          <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs flex-shrink-0">
            <span className="font-medium text-yellow-800">Warnings:</span>
            <span className="ml-2 text-yellow-700">{summary.cohesionWarnings.join(', ')}</span>
          </div>
        )}
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Client Overview */}
          <div className="mb-1 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-bold text-gray-900">Clients</h2>
              <div className="flex items-center gap-3 text-[8px]">
                <span className="flex items-center gap-1">
                  <span className="text-green-600">✓</span>
                  <span className="text-gray-500">Client request</span>
                </span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-0.5">
            {groupContext.clients.map((client) => {
              // Get exercises for this client in the selected block
              const clientExercises = selectedBlockData?.individualCandidates[client.user_id]?.exercises || [];
              
              return (
                <div key={client.user_id} className="bg-white rounded p-2 text-[9px] border border-gray-200">
                  <div className="flex items-start gap-2">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.user_id}`}
                      alt={client.name}
                      className="w-5 h-5 rounded-full flex-shrink-0"
                    />
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      {/* Left column: Client info and preferences */}
                      <div>
                        <h4 className="font-medium text-gray-900 text-[10px] mb-1">{client.name}</h4>
                        <div className="space-y-0">
                          {client.primary_goal && (
                            <p className="text-gray-600 leading-tight">
                              <span className="font-medium">Goal:</span> {client.primary_goal}
                            </p>
                          )}
                          {client.intensity && (
                            <p className="text-gray-600 leading-tight">
                              <span className="font-medium">Intensity:</span> {client.intensity}
                            </p>
                          )}
                          {client.muscle_target && client.muscle_target.length > 0 && (
                            <p className="text-gray-600 leading-tight">
                              <span className="font-medium">Target:</span> {client.muscle_target.map(formatMuscleName).join(', ')}
                            </p>
                          )}
                          {client.muscle_lessen && client.muscle_lessen.length > 0 && (
                            <p className="text-gray-600 leading-tight">
                              <span className="font-medium">Lessen:</span> {client.muscle_lessen.map(formatMuscleName).join(', ')}
                            </p>
                          )}
                          {client.exercise_requests?.include && client.exercise_requests.include.length > 0 && (
                            <p className="text-green-600 leading-tight">
                              <span className="font-medium">Include:</span> {client.exercise_requests.include.join(', ')}
                            </p>
                          )}
                          {client.exercise_requests?.avoid && client.exercise_requests.avoid.length > 0 && (
                            <p className="text-red-600 leading-tight">
                              <span className="font-medium">Exclude:</span> {client.exercise_requests.avoid.join(', ')}
                            </p>
                          )}
                          {client.avoid_joints && client.avoid_joints.length > 0 && (
                            <p className="text-orange-600 leading-tight">
                              <span className="font-medium">Avoid Joints:</span> {client.avoid_joints.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Right column: Exercises for selected block */}
                      <div className="border-l pl-2">
                        <h5 className="font-medium text-gray-700 text-[9px] mb-1">{selectedBlock} Options:</h5>
                        <div className="space-y-0.5">
                          {clientExercises.slice(0, 5).map((exercise, idx) => {
                            const isClientRequest = exercise.scoreBreakdown?.includeExerciseBoost > 0;
                            const isTopChoice = idx === 0;
                            
                            return (
                              <p 
                                key={exercise.id} 
                                className={`leading-tight ${
                                  isTopChoice ? 'text-indigo-700 font-medium' : 
                                  isClientRequest ? 'text-green-700' : 
                                  'text-gray-600'
                                }`}
                              >
                                {idx + 1}. {exercise.name} 
                                <span className="text-gray-400 ml-1">({exercise.score.toFixed(1)})</span>
                                {isClientRequest && <span className="text-green-600 ml-1 text-[8px]">✓</span>}
                              </p>
                            );
                          })}
                          {clientExercises.length === 0 && (
                            <p className="text-gray-400 italic">No exercises available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
          
          {/* Block Tabs */}
          <div className="mb-4 flex-shrink-0">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-4">
              {blueprint.blocks.map((block) => (
                <button
                  key={block.blockId}
                  onClick={() => setSelectedBlock(block.blockId)}
                  className={`py-1 px-1 border-b-2 font-medium text-sm ${
                    selectedBlock === block.blockId
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {block.blockId}
                </button>
              ))}
              </nav>
            </div>
          </div>
          
          {/* Selected Block Details - Scrollable */}
          {selectedBlockData && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0">
              {/* LLM Debug Section */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="space-y-4">
                  {/* System Prompt */}
                  <details className="border border-gray-200 rounded-lg p-3">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                      System Prompt Step 1: Group Workout Assignment (Rounds 3 & 4)
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded-md">
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                        {llmDebugData.systemPrompt || <span className="text-gray-400">Click "Test LLM Generation" to see the dynamic prompt based on session data</span>}
                      </pre>
                    </div>
                  </details>
                  
                  {/* LLM Output */}
                  <details className="border border-gray-200 rounded-lg p-3">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                      LLM Output
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded-md">
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                        {llmDebugData.llmOutput || <span className="text-gray-400">Click "Test LLM Generation" to see the LLM response</span>}
                      </pre>
                    </div>
                  </details>
                </div>
              </div>
              
              {/* Exercise Table View */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-base font-medium text-gray-900 mb-3">{selectedBlock} Exercises</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64 min-w-[16rem]">
                          Shared ({selectedBlockData.slots.actualSharedAvailable})
                        </th>
                        {groupContext.clients.map((client) => {
                          const clientName = client.name.split(' ')[0]; // First name only
                          return (
                            <th key={client.user_id} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {clientName} (Top 6)
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Calculate max rows needed */}
                      {(() => {
                        // Calculate max rows based on all filtered exercises, not just top candidates
                        const maxRows = Math.max(
                          selectedBlockData.sharedCandidates?.exercises?.length || 0,
                          ...groupContext.clients.map(client => {
                            const clientData = selectedBlockData.individualCandidates?.[client.user_id];
                            return clientData?.allFilteredExercises?.length || clientData?.exercises?.length || 0;
                          })
                        );
                        
                        return Array.from({ length: maxRows }, (_, rowIndex) => {
                          const sharedExercise = selectedBlockData.sharedCandidates?.exercises?.[rowIndex];
                          
                          return (
                            <tr key={rowIndex}>
                              {/* Shared Exercise Column */}
                              <td className="px-3 py-2 text-sm">
                                {sharedExercise ? (
                                  <div className="border border-gray-200 rounded p-3">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                          <span className="text-sm font-medium text-gray-900">#{rowIndex + 1}</span>
                                          <h4 className="text-sm font-medium text-gray-900">{sharedExercise.name}</h4>
                                        </div>
                                        <div className="mt-1 flex items-center space-x-3 text-xs">
                                          <span className="text-gray-500">
                                            Score: <span className="font-medium text-gray-900">{sharedExercise.groupScore.toFixed(2)}</span>
                                          </span>
                                          <span className="text-blue-600">
                                            {sharedExercise.clientsSharing.length} clients
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {sharedExercise.clientScores.map((cs) => {
                                        const client = groupContext.clients.find(c => c.user_id === cs.clientId);
                                        const clientName = client?.name || cs.clientId;
                                        const firstName = clientName.split(' ')[0];
                                        return (
                                          <div
                                            key={cs.clientId}
                                            className={`text-xs px-1 py-0.5 rounded ${
                                              cs.hasExercise ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                                            }`}
                                          >
                                            {firstName}: {cs.individualScore.toFixed(2)}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-gray-300">-</div>
                                )}
                              </td>
                              
                              {/* Client Exercise Columns */}
                              {groupContext.clients.map((client) => {
                                const clientData = selectedBlockData.individualCandidates?.[client.user_id];
                                const allExercises = clientData?.allFilteredExercises || clientData?.exercises || [];
                                const clientExercise = allExercises[rowIndex];
                                const isCandidate = rowIndex < (clientData?.exercises?.length || 0);
                                
                                return (
                                  <td key={client.user_id} className="px-3 py-2 whitespace-nowrap text-sm">
                                    {clientExercise ? (
                                      <div className={`${isCandidate ? 'border-2 border-blue-500 rounded-md p-2 -m-2' : ''}`}>
                                        <div className="font-medium text-gray-900">
                                          {rowIndex + 1}. {clientExercise.name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          Score: {clientExercise.score.toFixed(2)}
                                          {/* Show score adjustments as tags */}
                                          {clientExercise.score !== 5.0 && (
                                            <div className="mt-1 flex flex-wrap gap-1">
                                              {getScoreAdjustmentLabels(clientExercise.score, clientExercise.scoreBreakdown)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-gray-300">-</div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Raw Data Toggle - Fixed at bottom */}
        <div className="mt-4 flex-shrink-0">
          <button
            onClick={() => setShowRawData(!showRawData)}
            className="text-xs text-gray-600 hover:text-gray-900"
          >
            {showRawData ? "Hide" : "Show"} Raw Data
          </button>
          {showRawData && (
            <div className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
              <pre>{JSON.stringify({ groupContext, blueprint }, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Component for displaying shared exercises
function SharedExerciseCard({ exercise, rank }: { exercise: GroupScoredExercise; rank: number }) {
  return (
    <div className="border border-gray-200 rounded p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900">#{rank}</span>
            <h4 className="text-sm font-medium text-gray-900">{exercise.name}</h4>
          </div>
          <div className="mt-1 flex items-center space-x-3 text-xs">
            <span className="text-gray-500">
              Score: <span className="font-medium text-gray-900">{exercise.groupScore.toFixed(2)}</span>
            </span>
            <span className="text-blue-600">
              {exercise.clientsSharing.length} clients
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {exercise.clientScores.map((cs) => (
          <div
            key={cs.clientId}
            className={`text-xs px-1 py-0.5 rounded ${
              cs.hasExercise ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {cs.clientId.slice(0, 6)}: {cs.individualScore.toFixed(2)}
          </div>
        ))}
      </div>
    </div>
  );
}

// CohesionTrackingCard component removed - cohesion tracking no longer used