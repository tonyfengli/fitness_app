"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useExerciseSelections } from "~/hooks/useExerciseSelections";

import type {
  GroupContext,
  StandardGroupWorkoutBlueprint,
} from "@acme/ai/client";
import type { ConsolidatedMuscle } from "@acme/ai/client";
import {
  BUCKET_CONFIGS,
  categorizeSharedExercises,
  getOldMusclesForConsolidated,
  mapMuscleToConsolidated,
  WorkoutType,
} from "@acme/ai/client";

interface StandardTemplateViewProps {
  groupContext: GroupContext;
  blueprint: StandardGroupWorkoutBlueprint;
  summary: any;
  generateWorkout: () => void;
  isGenerating: boolean;
  router: any;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  llmDebugData: any;
  llmResult?: any;
  isFromSavedData?: boolean;
  isSaving?: boolean;
  sessionData?: any;
}

// Helper to format muscle names
function formatMuscleName(muscle: string): string {
  return muscle.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// Phase 2 Preview Component
// Helper function to get equipment icon
function getEquipmentIcon(equipment: string): string {
  const icons: Record<string, string> = {
    dumbbells: "🏋️",
    barbell: "🏋️‍♂️",
    bench: "🪑",
    cable_machine: "🔗",
    back_machine: "🔙",
    landmine: "⚓",
    pull_up_bar: "🏃",
    bands: "🎗️",
    bosu_ball: "⚪",
    swiss_ball: "⚫",
    kettlebell: "🔔",
    ab_wheel: "☸️",
    box: "📦",
    trx: "🎯",
  };
  return icons[equipment] || "📎";
}

function Phase2PreviewContent({ sessionId }: { sessionId: string }) {
  const trpc = useTRPC();
  const [llmSelections, setLlmSelections] = useState<Array<[string, number]> | null>(null);
  const [roundNames, setRoundNames] = useState<Record<string, string> | null>(null);
  
  // Fetch preprocessed data
  const { data, isLoading, error } = useQuery({
    ...trpc.trainingSession.previewPhase2Data.queryOptions({ sessionId }),
    enabled: !!sessionId,
  });

  // If Phase 2 data exists, use it for display
  useEffect(() => {
    if (data?.hasPhase2Data && data?.savedRoundNames) {
      setRoundNames(data.savedRoundNames);
      // For saved data, we'll construct selections from the workout exercises
      // This will be used for display in the Client × Round Grid
      if (data.workouts) {
        const selections: Array<[string, number]> = [];
        data.workouts.forEach((workout: any) => {
          workout.workoutExercises?.forEach((exercise: any) => {
            if (exercise.orderIndex >= 1 && exercise.orderIndex <= 5) {
              // Create the selection ID format expected by the grid
              const selectionId = `${workout.userId}_${exercise.name?.toLowerCase().replace(/\s+/g, '_')}`;
              selections.push([selectionId, exercise.orderIndex]);
            }
          });
        });
        setLlmSelections(selections);
      }
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading preprocessed data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4">
        <p className="text-sm text-red-600">Error loading data: {error.message}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  // Calculate per-round capacity usage from fixed assignments
  const roundCapacityUsage: Record<number, Record<string, number>> = {};
  if (data.allowedSlots?.fixedAssignments) {
    data.allowedSlots.fixedAssignments.forEach(assignment => {
      if (!roundCapacityUsage[assignment.round]) {
        roundCapacityUsage[assignment.round] = {};
      }
      Object.entries(assignment.resources).forEach(([equipment, count]) => {
        roundCapacityUsage[assignment.round][equipment] = 
          (roundCapacityUsage[assignment.round][equipment] || 0) + count;
      });
    });
  }

  // Get capacity map from the backend data (tied to the business)
  const capacityMap = data.equipmentCapacity || {};

  return (
    <div className="space-y-4">
      {/* Phase 2 LLM Generation Section */}
      <Phase2LLMSection 
        sessionId={sessionId} 
        onSelectionsUpdate={setLlmSelections}
        onRoundNamesUpdate={setRoundNames}
        hasPhase2Data={data.hasPhase2Data || false}
      />

      {/* Summary Stats */}
      <div className="rounded-lg bg-gray-50 p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
        <div className="text-sm text-gray-600">
          <p>Rounds Selected: {data.roundOrganization?.majorityRounds || 'N/A'}</p>
          <p>Business ID: {data.businessId || 'N/A'}</p>
        </div>
      </div>

      {/* 1. Per-Round Capacity Strip */}
      <div className="rounded-lg bg-white border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Per-Round Capacity Usage (Fixed Only)</h4>
        <div className="space-y-2">
          {Array.from({ length: data.roundOrganization?.majorityRounds || 0 }, (_, i) => i + 1).map(round => {
            const usage = roundCapacityUsage[round] || {};
            return (
              <div key={round} className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 w-8">R{round}:</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(capacityMap).map(([equipment, capacity]) => {
                    const used = usage[equipment] || 0;
                    const isAtCapacity = used >= capacity;
                    const hasUsage = used > 0;
                    
                    if (!hasUsage && !isAtCapacity) return null;
                    
                    return (
                      <span
                        key={equipment}
                        className={`px-2 py-1 text-xs rounded ${
                          isAtCapacity 
                            ? 'bg-red-100 text-red-700 font-medium' 
                            : hasUsage 
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {equipment} {used}/{capacity}
                      </span>
                    );
                  }).filter(Boolean)}
                  {Object.keys(usage).length === 0 && (
                    <span className="text-xs text-gray-500 italic">No equipment used</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Capacity Map Reference */}
      <div className="rounded-lg bg-gray-50 p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Gym Equipment Capacity</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
          {Object.entries(capacityMap).map(([equipment, capacity]) => (
            <div key={equipment} className="flex items-center gap-1">
              <span className="text-gray-600">{getEquipmentIcon(equipment)}</span>
              <span className="text-gray-700">{equipment}:</span>
              <span className="font-medium text-gray-900">{capacity}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Shared Exercises Summary */}
      {(() => {
        // Group fixed assignments by exerciseId to find shared exercises
        const sharedExercises = new Map<string, any[]>();
        data.allowedSlots?.fixedAssignments?.forEach(assignment => {
          if (assignment.fixedReason === 'shared_exercise') {
            if (!sharedExercises.has(assignment.exerciseId)) {
              sharedExercises.set(assignment.exerciseId, []);
            }
            sharedExercises.get(assignment.exerciseId).push(assignment);
          }
        });
        
        return sharedExercises.size > 0 && (
          <div className="rounded-lg bg-blue-50 p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Shared Exercises Detected</h4>
            <div className="space-y-2 text-xs">
              {Array.from(sharedExercises.entries()).map(([exerciseId, assignments]) => {
                const exercise = data.exercisesWithTiers?.find(e => e.exerciseId === exerciseId);
                const rounds = [...new Set(assignments.map(a => a.round))].sort();
                const clients = assignments.map(a => 
                  data.clients.find(c => c.clientId === a.clientId)?.clientName || a.clientId
                );
                
                return (
                  <div key={exerciseId} className="text-gray-700">
                    <span className="font-medium">{exercise?.name || 'Unknown'}:</span>
                    <span className="ml-2">{clients.length} clients ({clients.join(', ')})</span>
                    <span className="ml-2">→ Rounds: {rounds.map(r => `R${r}`).join(', ')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 4. Fixed Assignments Ledger */}
      {data.allowedSlots?.fixedAssignments && data.allowedSlots.fixedAssignments.length > 0 && (
        <div className="rounded-lg bg-green-50 p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Fixed Assignments Ledger</h4>
          <div className="space-y-1 text-xs">
            {data.allowedSlots.fixedAssignments
              .sort((a, b) => a.round - b.round || a.clientId.localeCompare(b.clientId))
              .map((assignment, idx) => {
                const exercise = data.exercisesWithTiers?.find(e => 
                  e.exerciseId === assignment.exerciseId && e.clientId === assignment.clientId
                );
                const client = data.clients.find(c => c.clientId === assignment.clientId);
                const resourceList = Object.entries(assignment.resources)
                  .map(([eq, count]) => `${eq}:${count}`)
                  .join(', ');
                
                return (
                  <div key={idx} className="text-gray-700 flex items-center gap-2">
                    <span className="font-medium">R{assignment.round}</span> — 
                    <span className="font-medium">{client?.clientName}</span>: 
                    <span>{exercise?.name || 'Unknown'}</span>
                    {resourceList && <span className="text-gray-600">({resourceList})</span>}
                    {assignment.fixedReason && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        assignment.fixedReason === 'tier_priority' 
                          ? 'bg-green-100 text-green-700'
                          : assignment.fixedReason === 'singleton'
                          ? 'bg-orange-100 text-orange-700'
                          : assignment.fixedReason === 'shared_exercise'
                          ? 'bg-blue-100 text-blue-700'
                          : assignment.fixedReason === 'last_exercise_auto_assign'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {assignment.fixedReason === 'tier_priority' ? 'Tier' : 
                         assignment.fixedReason === 'singleton' ? 'Singleton' : 
                         assignment.fixedReason === 'shared_exercise' ? 'Shared' :
                         assignment.fixedReason === 'last_exercise_auto_assign' ? 'Auto-Assigned' :
                         `Cascade ${assignment.singletonIteration}`}
                      </span>
                    )}
                    {assignment.warning && (
                      <span className="text-xs text-red-600 italic">{assignment.warning}</span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 4. Client × Round Grid */}
      <div className="rounded-lg bg-white border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Client × Round Grid
          {data.hasPhase2Data && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              Using saved data
            </span>
          )}
        </h4>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-xs font-medium text-gray-700 text-left p-2">Client</th>
                {Array.from({ length: data.roundOrganization?.majorityRounds || 0 }, (_, i) => {
                  const roundNum = i + 1;
                  const roundName = roundNames?.[roundNum.toString()];
                  return (
                    <th key={roundNum} className="text-xs font-medium text-gray-700 text-center p-2 min-w-[120px]">
                      <div>
                        <div className="font-semibold">R{roundNum}</div>
                        {roundName && (
                          <div className="font-normal text-[10px] text-purple-600 mt-0.5">
                            {roundName}
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.clients.map(client => {
                const plan = data.roundOrganization?.perClientPlan.find(p => p.clientId === client.clientId);
                const clientFixed = data.allowedSlots?.fixedAssignments.filter(f => f.clientId === client.clientId) || [];
                const clientOptions = data.allowedSlots?.exerciseOptions.filter(e => e.clientId === client.clientId) || [];
                
                return (
                  <tr key={client.clientId} className="border-t border-gray-200">
                    <td className="text-xs font-medium text-gray-900 p-2">{client.clientName}</td>
                    {Array.from({ length: data.roundOrganization?.majorityRounds || 0 }, (_, roundIdx) => {
                      const round = roundIdx + 1;
                      const skeleton = plan?.bundleSkeleton?.[roundIdx] || 0;
                      
                      // Collect ALL exercises for this client in this round
                      const exercisesInRound: Array<{
                        exercise: any;
                        type: 'fixed' | 'llm';
                        reason?: string;
                        warning?: string;
                        resources: Record<string, number>;
                      }> = [];
                      
                      // Get all fixed assignments for this round
                      const fixedInRound = clientFixed.filter(f => f.round === round);
                      fixedInRound.forEach(fixed => {
                        const exercise = data.exercisesWithTiers?.find(e => 
                          e.exerciseId === fixed.exerciseId && e.clientId === fixed.clientId
                        );
                        if (exercise || fixed) {
                          exercisesInRound.push({
                            exercise,
                            type: 'fixed',
                            reason: fixed.fixedReason,
                            warning: fixed.warning,
                            resources: fixed.resources
                          });
                        }
                      });
                      
                      // Get all LLM selections for this round
                      if (llmSelections) {
                        const llmPicksForRound = llmSelections.filter(([id, r]) => {
                          return id.startsWith(client.clientId) && r === round;
                        });
                        
                        llmPicksForRound.forEach(llmPick => {
                          const exerciseNameFromId = llmPick[0]
                            .replace(client.clientId + '_', '')
                            .replace(/_/g, ' ')
                            .toLowerCase();
                          
                          const optionsForRound = clientOptions.filter(opt => opt.allowedRounds.includes(round));
                          const selectedOption = optionsForRound.find(opt => {
                            const exercise = data.exercisesWithTiers?.find(e => 
                              e.exerciseId === opt.exerciseId && e.clientId === opt.clientId
                            );
                            return exercise?.name?.toLowerCase() === exerciseNameFromId;
                          });
                          
                          if (selectedOption) {
                            const exercise = data.exercisesWithTiers?.find(e => 
                              e.exerciseId === selectedOption.exerciseId && e.clientId === selectedOption.clientId
                            );
                            exercisesInRound.push({
                              exercise,
                              type: 'llm',
                              resources: selectedOption.resources
                            });
                          }
                        });
                      }
                      
                      if (skeleton === 0 || exercisesInRound.length === 0) {
                        return <td key={round} className="text-xs text-gray-400 text-center p-2">-</td>;
                      }
                      
                      // Display all exercises for this round (including supersets)
                      return (
                        <td key={round} className="p-2">
                          <div className="space-y-2">
                            {exercisesInRound.map((item, idx) => (
                              <div key={idx} className="text-xs">
                                <div className={`px-2 py-1 rounded text-center font-medium mb-1 ${
                                  item.type === 'llm'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : item.reason === 'tier_priority'
                                    ? 'bg-green-100 text-green-800'
                                    : item.reason === 'singleton'
                                    ? 'bg-orange-100 text-orange-800'
                                    : item.reason === 'shared_exercise'
                                    ? 'bg-blue-100 text-blue-800'
                                    : item.reason === 'last_exercise_auto_assign'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {item.type === 'llm' 
                                    ? 'LLM Selected'
                                    : item.reason === 'tier_priority' ? 'Tier Fixed' : 
                                      item.reason === 'singleton' ? 'Singleton' : 
                                      item.reason === 'shared_exercise' ? 'Shared' :
                                      item.reason === 'last_exercise_auto_assign' ? 'Auto-Assigned' :
                                      `Cascade ${item.reason}`}
                                </div>
                                <div className="text-gray-700 text-center font-medium">
                                  {item.exercise?.name || 'Unknown'}
                                </div>
                                {item.warning && (
                                  <div className="text-xs text-red-600 text-center mt-1" title={item.warning}>⚠️</div>
                                )}
                                <div className="flex justify-center gap-1 mt-1">
                                  {Object.keys(item.resources || {}).map(eq => (
                                    <span key={eq} className="text-gray-500" title={eq}>
                                      {getEquipmentIcon(eq)}
                                    </span>
                                  ))}
                                </div>
                                {/* Add superset indicator if this is not the last exercise */}
                                {idx < exercisesInRound.length - 1 && (
                                  <div className="text-center text-gray-400 mt-1">+</div>
                                )}
                              </div>
                            ))}
                            
                            {/* Show options if no exercises were selected/fixed */}
                            {exercisesInRound.length === 0 && skeleton > 0 && (
                              <div className="text-xs">
                                <div className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-center mb-1">
                                  Option
                                </div>
                                <div className="text-gray-600 text-center">
                                  {clientOptions.filter(opt => opt.allowedRounds.includes(round)).length} available
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Round Plans */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Client Round Plans</h4>
        {data.roundOrganization?.perClientPlan.map((plan) => {
          const clientInfo = data.clients.find(c => c.clientId === plan.clientId);
          const clientExercises = data.exercisesWithTiers?.filter(e => e.clientId === plan.clientId) || [];
          
          return (
            <div key={plan.clientId} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-900">{clientInfo?.clientName || 'Unknown'}</div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Total Exercises: {plan.totalExercises}</p>
                  <p>Rounds Participating: {plan.roundsParticipating}</p>
                  <p>Rounds with Superset: {plan.supersetsNeeded}</p>
                  <p>Drop Off At: {plan.dropOffAfterRound || 'N/A'}</p>
                  
                  {/* Bundle Skeleton Display */}
                  {plan.bundleSkeleton && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="font-medium text-gray-700 mb-1">Round Structure:</p>
                      <div className="flex gap-1 flex-wrap">
                        {plan.bundleSkeleton.map((bundle, idx) => (
                          <span 
                            key={idx} 
                            className={`px-2 py-1 text-xs rounded ${
                              bundle === 0 ? 'bg-gray-200 text-gray-500' :
                              bundle === 2 ? 'bg-blue-100 text-blue-700' :
                              'bg-green-100 text-green-700'
                            }`}
                          >
                            R{idx + 1}: {bundle === 0 ? '-' : bundle}
                          </span>
                        ))}
                      </div>
                      {plan.supersetRounds && plan.supersetRounds.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Superset rounds: {plan.supersetRounds.join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Exercise Details with Tiers */}
                  {clientExercises.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="font-medium text-gray-700 mb-2">Exercises:</p>
                      <div className="space-y-1">
                        {clientExercises
                          .sort((a, b) => a.tier - b.tier)
                          .map((exercise, idx) => {
                            // Find if this exercise is fixed
                            const fixedAssignment = data.allowedSlots?.fixedAssignments.find(
                              f => f.exerciseId === exercise.exerciseId && f.clientId === exercise.clientId
                            );
                            // Find allowed rounds for this exercise
                            const exerciseOption = data.allowedSlots?.exerciseOptions.find(
                              e => e.exerciseId === exercise.exerciseId && e.clientId === exercise.clientId
                            );
                            
                            // Debug logging for exercises without placement info
                            if (!fixedAssignment && !exerciseOption) {
                              console.warn(`Exercise without placement info:`, {
                                exerciseId: exercise.exerciseId,
                                clientId: exercise.clientId,
                                name: exercise.name,
                                tier: exercise.tier,
                                hasAllowedSlots: !!data.allowedSlots,
                                fixedAssignmentsCount: data.allowedSlots?.fixedAssignments.length,
                                exerciseOptionsCount: data.allowedSlots?.exerciseOptions.length
                              });
                            }
                            
                            return (
                              <div key={idx} className="flex items-start gap-2 text-xs">
                                <span className={`px-2 py-0.5 rounded font-medium shrink-0 ${
                                  exercise.tier === 1 ? 'bg-red-100 text-red-700' :
                                  exercise.tier === 1.5 ? 'bg-orange-100 text-orange-700' :
                                  exercise.tier === 2 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  T{exercise.tier}
                                </span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="font-medium text-gray-900">{exercise.name || 'Unknown Exercise'}</div>
                                    {/* Equipment Resource Badges */}
                                    {exercise.equipment && exercise.equipment.length > 0 && (
                                      <div className="flex gap-1">
                                        {exercise.equipment.map((eq, eqIdx) => (
                                          <span 
                                            key={eqIdx} 
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-xs"
                                            title={eq}
                                          >
                                            {getEquipmentIcon(eq)}
                                            <span className="text-gray-600">{eq}</span>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-gray-600 mt-0.5">
                                    {exercise.movementPattern && <span>{exercise.movementPattern}</span>}
                                    {exercise.primaryMuscle && (
                                      <span> • {exercise.primaryMuscle}</span>
                                    )}
                                  </div>
                                  {/* Show placement info */}
                                  {fixedAssignment && (
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className={`${
                                        fixedAssignment.fixedReason === 'tier_priority' ? 'text-green-600' :
                                        fixedAssignment.fixedReason === 'singleton' ? 'text-orange-600' :
                                        fixedAssignment.fixedReason === 'last_exercise_auto_assign' ? 'text-purple-600' :
                                        'text-amber-600'
                                      }`}>
                                        Fixed → Round {fixedAssignment.round}
                                      </span>
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                        fixedAssignment.fixedReason === 'tier_priority' 
                                          ? 'bg-green-100 text-green-700'
                                          : fixedAssignment.fixedReason === 'singleton'
                                          ? 'bg-orange-100 text-orange-700'
                                          : fixedAssignment.fixedReason === 'shared_exercise'
                                          ? 'bg-blue-100 text-blue-700'
                                          : fixedAssignment.fixedReason === 'last_exercise_auto_assign'
                                          ? 'bg-purple-100 text-purple-700'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}>
                                        {fixedAssignment.fixedReason === 'tier_priority' ? 'Tier' : 
                                         fixedAssignment.fixedReason === 'singleton' ? 'Singleton' : 
                                         fixedAssignment.fixedReason === 'shared_exercise' ? 'Shared' :
                                         fixedAssignment.fixedReason === 'last_exercise_auto_assign' ? 'Auto-Assigned' :
                                         `Cascade ${fixedAssignment.singletonIteration}`}
                                      </span>
                                    </div>
                                  )}
                                  {exerciseOption && exerciseOption.allowedRounds.length > 0 && (
                                    <div className="text-blue-600 mt-0.5">
                                      Allowed rounds: {exerciseOption.allowedRounds.join(', ')}
                                      {exerciseOption.placementIssue && (
                                        <span className="ml-2 text-xs text-orange-600 italic">
                                          {exerciseOption.placementIssue === 'singleton_no_slots' 
                                            ? '(singleton equipment - no slots available)'
                                            : '(shared exercise - insufficient slots)'}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {!fixedAssignment && !exerciseOption && (
                                    <div className="text-red-600 mt-0.5">
                                      ⚠️ No placement information available
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Phase2LLMSection({ 
  sessionId, 
  onSelectionsUpdate,
  onRoundNamesUpdate,
  hasPhase2Data
}: { 
  sessionId: string;
  onSelectionsUpdate: (selections: Array<[string, number]> | null) => void;
  onRoundNamesUpdate: (names: Record<string, string> | null) => void;
  hasPhase2Data: boolean;
}) {
  const trpc = useTRPC();
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Fetch preprocessed data to get fixed assignments
  const { data: preprocessData } = useQuery({
    ...trpc.trainingSession.previewPhase2Data.queryOptions({ sessionId }),
    enabled: !!sessionId,
  });
  const [expandedSections, setExpandedSections] = useState<{
    input: boolean;
    output: boolean;
  }>({ input: true, output: true });
  const [timestamps, setTimestamps] = useState<{
    startedAt?: string;
    completedAt?: string;
    durationSeconds?: number;
  }>({});
  const [llmData, setLlmData] = useState<{
    systemPrompt?: string;
    humanMessage?: string;
    llmResponse?: string;
    selections?: any;
  }>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  
  // Load saved LLM data if it exists
  useEffect(() => {
    if (preprocessData?.savedLlmData) {
      setLlmData({
        systemPrompt: preprocessData.savedLlmData.systemPrompt,
        humanMessage: preprocessData.savedLlmData.humanMessage,
        llmResponse: preprocessData.savedLlmData.llmResponse,
        selections: preprocessData.savedRoundNames ? {
          placements: preprocessData.workouts ? 
            // Reconstruct placements from saved workouts
            preprocessData.workouts.flatMap((w: any) => 
              w.workoutExercises
                ?.filter((ex: any) => ex.orderIndex >= 1 && ex.orderIndex <= 5)
                ?.map((ex: any) => [
                  `${w.userId}_${ex.name.toLowerCase().replace(/\s+/g, '_')}`,
                  ex.orderIndex
                ]) || []
            ) : [],
          roundNames: preprocessData.savedRoundNames,
        } : undefined,
      });
      
      if (preprocessData.savedLlmData.timing) {
        setTimestamps({
          startedAt: preprocessData.savedLlmData.timing.startedAt,
          completedAt: preprocessData.savedLlmData.timing.completedAt,
          durationSeconds: preprocessData.savedLlmData.timing.durationSeconds,
        });
      }
      
      // Also update parent component with the loaded data
      if (preprocessData.savedRoundNames) {
        onRoundNamesUpdate(preprocessData.savedRoundNames);
      }
      if (preprocessData.workouts) {
        // Reconstruct selections for parent component
        const selections = preprocessData.workouts.flatMap((w: any) => 
          w.workoutExercises
            ?.filter((ex: any) => ex.orderIndex >= 1 && ex.orderIndex <= 5)
            ?.map((ex: any) => [
              `${w.userId}_${ex.name.toLowerCase().replace(/\s+/g, '_')}`,
              ex.orderIndex
            ]) || []
        );
        onSelectionsUpdate(selections);
      }
    }
  }, [preprocessData, onSelectionsUpdate, onRoundNamesUpdate]);

  const generatePhase2Mutation = useMutation({
    ...trpc.trainingSession.generatePhase2Selections.mutationOptions(),
    onMutate: () => {
      setIsGenerating(true);
      const startTime = new Date();
      setTimestamps({
        startedAt: startTime.toISOString(),
        completedAt: undefined,
        durationSeconds: undefined,
      });
    },
    onSuccess: (data) => {
      const endTime = new Date();
      const startTime = timestamps.startedAt ? new Date(timestamps.startedAt) : new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      
      setLlmData({
        systemPrompt: data.systemPrompt,
        humanMessage: data.humanMessage,
        llmResponse: data.llmResponse,
        selections: data.selections,
      });
      
      setTimestamps(prev => ({
        ...prev,
        completedAt: endTime.toISOString(),
        durationSeconds: Number((durationMs / 1000).toFixed(1)),
      }));
      
      // Validate LLM selections
      const errors: string[] = [];
      if (data.selections?.placements && data.humanMessage) {
        try {
          const inputData = JSON.parse(data.humanMessage.match(/\{[\s\S]*\}/)?.[0] || '{}');
          const placements = data.selections.placements;
          
          // Check 1: Find missed exercises (options that weren't placed)
          const placedIds = new Set(placements.map(([id]: [string, number]) => id));
          const missedExercises = inputData.options?.filter((opt: any) => 
            !placedIds.has(opt.id)
          );
          
          if (missedExercises?.length > 0) {
            missedExercises.forEach((missed: any) => {
              errors.push(`⚠️ Missed exercise: ${missed.id} (client has empty slot)`);
            });
          }
          
          // Check 2: Verify slots remaining are respected
          const slotUsage: Record<string, Record<number, number>> = {};
          placements.forEach(([id, round]: [string, number]) => {
            const clientId = id.split('_')[0];
            if (!slotUsage[clientId]) slotUsage[clientId] = {};
            slotUsage[clientId][round] = (slotUsage[clientId][round] || 0) + 1;
          });
          
          Object.entries(slotUsage).forEach(([clientId, rounds]) => {
            Object.entries(rounds).forEach(([round, used]) => {
              const available = inputData.slotsRemaining?.[clientId]?.[parseInt(round) - 1] || 0;
              if (used > available) {
                errors.push(`❌ Overfilled: Client ${clientId} R${round} - used ${used} slots but only ${available} available`);
              }
            });
          });
          
          // Check 3: Verify exercises placed in allowed rounds only
          placements.forEach(([id, round]: [string, number]) => {
            const exercise = inputData.options?.find((opt: any) => opt.id === id);
            if (exercise && !exercise.allowed.includes(round)) {
              errors.push(`❌ Invalid placement: ${id} placed in R${round} but allowed rounds are [${exercise.allowed.join(', ')}]`);
            }
          });
          
          // Check 4: Check for duplicate placements
          const placementStrings = placements.map(([id, round]: [string, number]) => `${id}_${round}`);
          const duplicates = placementStrings.filter((item, index) => placementStrings.indexOf(item) !== index);
          if (duplicates.length > 0) {
            duplicates.forEach(dup => {
              errors.push(`❌ Duplicate placement: ${dup}`);
            });
          }
        } catch (e) {
          errors.push('⚠️ Could not validate LLM response - parsing error');
        }
      }
      
      setValidationErrors(errors);
      
      // Update parent component with selections and round names
      if (data.selections?.placements) {
        onSelectionsUpdate(data.selections.placements);
      }
      if (data.selections?.roundNames) {
        onRoundNamesUpdate(data.selections.roundNames);
      }
      
      // Automatically save to database if generation was successful
      if (data.selections?.placements && data.selections?.roundNames && errors.length === 0) {
        // Prepare fixed assignments from preprocessing data
        const fixedAssignments = preprocessData?.allowedSlots?.fixedAssignments?.map(fa => ({
          exerciseId: fa.exerciseId,
          clientId: fa.clientId,
          round: fa.round,
        })) || [];
        
        // Include LLM data with timing information
        const llmData = {
          systemPrompt: data.systemPrompt,
          humanMessage: data.humanMessage,
          llmResponse: data.llmResponse,
          timing: data.timing,
        };
        
        updatePhase2Mutation.mutate({
          sessionId,
          placements: data.selections.placements,
          roundNames: data.selections.roundNames || {},
          fixedAssignments: fixedAssignments,
          llmData: llmData,
        });
      }
      
      setIsGenerating(false);
    },
    onError: (error: any) => {
      alert(`Failed to generate Phase 2 selections: ${error.message}`);
      setIsGenerating(false);
      
      // Still update completed timestamp on error
      const endTime = new Date();
      const startTime = timestamps.startedAt ? new Date(timestamps.startedAt) : new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      
      setTimestamps(prev => ({
        ...prev,
        completedAt: endTime.toISOString(),
        durationSeconds: Number((durationMs / 1000).toFixed(1)),
      }));
    },
  });

  const updatePhase2Mutation = useMutation({
    ...trpc.trainingSession.updatePhase2Exercises.mutationOptions(),
    onMutate: () => {
      setIsSaving(true);
    },
    onSuccess: () => {
      setSavedSuccessfully(true);
      setIsSaving(false);
      // Show success for 3 seconds
      setTimeout(() => setSavedSuccessfully(false), 3000);
    },
    onError: (error: any) => {
      alert(`Failed to save Phase 2 updates: ${error.message}`);
      setIsSaving(false);
    },
  });

  const handleGenerate = () => {
    generatePhase2Mutation.mutate({ sessionId });
    setSavedSuccessfully(false); // Reset save status when generating new
  };

  const toggleSection = (section: 'input' | 'output') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="space-y-4">
      {/* Generate Button */}
      <div className="rounded-lg bg-white border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-gray-700">
              Phase 2 LLM Selection
              {hasPhase2Data && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  Using saved data
                </span>
              )}
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Use LLM to select remaining exercises for each client/round
            </p>
            {/* Timestamps */}
            <div className="mt-2 text-xs text-gray-600 space-y-0.5">
              {hasPhase2Data && preprocessData?.generatedAt && (
                <div className="text-gray-600">
                  Generated: {new Date(preprocessData.generatedAt).toLocaleString()}
                </div>
              )}
              {timestamps.startedAt && (
                <div>Started: {new Date(timestamps.startedAt).toLocaleTimeString()}</div>
              )}
              {timestamps.completedAt && (
                <div>Completed: {new Date(timestamps.completedAt).toLocaleTimeString()}</div>
              )}
              {timestamps.durationSeconds !== undefined && (
                <div className="font-medium text-indigo-600">
                  Duration: {timestamps.durationSeconds}s
                </div>
              )}
              {isSaving && (
                <div className="text-blue-600 font-medium">
                  Saving to database...
                </div>
              )}
              {savedSuccessfully && (
                <div className="text-green-600 font-medium">
                  ✓ Saved to database
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || hasPhase2Data}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                isGenerating || hasPhase2Data
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {hasPhase2Data 
                ? "Phase 2 Already Generated" 
                : isGenerating 
                ? "Generating..." 
                : "Generate Phase 2 LLM Selection"}
            </button>
          </div>
        </div>
      </div>

      {/* LLM Input Section */}
      {(llmData.systemPrompt || llmData.humanMessage) && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">
              LLM Input
              {hasPhase2Data && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  (from saved generation)
                </span>
              )}
            </h4>
            <button
              onClick={() => toggleSection('input')}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg
                className={`w-5 h-5 transform transition-transform ${
                  expandedSections.input ? 'rotate-90' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
          
          {expandedSections.input && (
            <>
              {/* System Prompt */}
              {llmData.systemPrompt && (
                <div className="mb-4">
                  <h5 className="text-xs font-medium text-gray-600 mb-2">System Prompt:</h5>
                  <pre className="bg-white p-3 rounded border border-gray-200 text-xs overflow-x-auto whitespace-pre-wrap">
                    {llmData.systemPrompt}
                  </pre>
                </div>
              )}

              {/* Human Message */}
              {llmData.humanMessage && (
                <div>
                  <h5 className="text-xs font-medium text-gray-600 mb-2">Human Message (Compact Input):</h5>
                  <pre className="bg-white p-3 rounded border border-gray-200 text-xs overflow-x-auto">
                    {llmData.humanMessage}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <h4 className="text-sm font-medium text-red-800 mb-2">LLM Validation Errors</h4>
          <div className="space-y-1">
            {validationErrors.map((error, idx) => (
              <div key={idx} className="text-xs text-red-700">{error}</div>
            ))}
          </div>
        </div>
      )}

      {/* LLM Output Section */}
      {llmData.llmResponse && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">
              LLM Output
              {hasPhase2Data && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  (from saved generation)
                </span>
              )}
            </h4>
            <button
              onClick={() => toggleSection('output')}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg
                className={`w-5 h-5 transform transition-transform ${
                  expandedSections.output ? 'rotate-90' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
          
          {expandedSections.output && (
            <>
              {/* Raw Response */}
              <div className="mb-4">
                <h5 className="text-xs font-medium text-gray-600 mb-2">Raw Response:</h5>
                <pre className="bg-white p-3 rounded border border-gray-200 text-xs overflow-x-auto">
                  {llmData.llmResponse}
                </pre>
              </div>

              {/* Parsed Selections */}
              {llmData.selections && (
                <div>
                  <h5 className="text-xs font-medium text-gray-600 mb-2">Parsed Selections:</h5>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <div className="space-y-1 text-xs">
                      {llmData.selections.placements?.map(([id, round]: [string, number], idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-medium text-gray-700">{id}</span>
                          <span className="text-gray-500">→</span>
                          <span className="font-medium text-indigo-600">Round {round}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Round Names */}
                  {llmData.selections.roundNames && Object.keys(llmData.selections.roundNames).length > 0 && (
                    <div className="mt-3">
                      <h5 className="text-xs font-medium text-gray-600 mb-2">Round Names:</h5>
                      <div className="bg-white p-3 rounded border border-gray-200">
                        <div className="space-y-1 text-xs">
                          {Object.entries(llmData.selections.roundNames).map(([round, name]) => (
                            <div key={round} className="flex items-center gap-2">
                              <span className="font-medium text-gray-700">Round {round}:</span>
                              <span className="font-medium text-purple-600">{name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Exercise #3 Content Component
function Exercise3Content({ 
  groupContext, 
  blueprint, 
  clients,
  formatMuscleName 
}: {
  groupContext: GroupContext;
  blueprint: StandardGroupWorkoutBlueprint;
  clients: ClientContext[];
  formatMuscleName: (muscle: string) => string;
}) {
  // Check if any clients have WITH_CORE workout types
  const coreClients = groupContext.clients.filter((client) => {
    const workoutType = client.workoutType as WorkoutType;
    return (
      workoutType === WorkoutType.FULL_BODY_WITHOUT_FINISHER_WITH_CORE ||
      workoutType === WorkoutType.TARGETED_WITHOUT_FINISHER_WITH_CORE ||
      workoutType === WorkoutType.TARGETED_WITH_FINISHER_WITH_CORE
    );
  });

  const nonCoreClients = groupContext.clients.filter(
    (client) => !coreClients.includes(client)
  );

  if (coreClients.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No clients have core-focused workout types.</p>
        <p className="text-sm mt-2">
          Core exercise selection (Exercise #3) is only available for:
        </p>
        <ul className="text-sm mt-2 space-y-1">
          <li>• Full Body Without Finisher With Core</li>
          <li>• Targeted Without Finisher With Core</li>
          <li>• Targeted With Finisher With Core</li>
        </ul>
      </div>
    );
  }

  // Process core exercises for clients with WITH_CORE workout types
  const coreClientIds = coreClients.map(c => c.user_id);
  
  // Check which exercise was selected as Exercise #3
  const selectedExercise3Ids = new Set<string>();
  Object.entries(blueprint.clientExercisePools).forEach(([clientId, pool]) => {
    const exercise3 = pool.preAssigned.find(
      (p) => p.source === "shared_core"
    );
    if (exercise3) {
      selectedExercise3Ids.add(exercise3.exercise.id);
      console.log(`[Exercise3] Client ${clientId} has Exercise #3: ${exercise3.exercise.name} (${exercise3.exercise.id})`);
    } else {
      // Check if this client should have Exercise #3
      if (coreClientIds.includes(clientId)) {
        console.log(`[Exercise3] Client ${clientId} should have Exercise #3 but none found in preAssigned`);
      }
    }
  });
  console.log(`[Exercise3] Selected Exercise #3 IDs:`, Array.from(selectedExercise3Ids));
  
  // Get all exercises from WITH_CORE clients only
  const coreClientExercises = new Map<string, {exercise: any, clients: Set<string>, scores: Map<string, number>}>();
  
  // Build a map of exercises available to WITH_CORE clients
  coreClientIds.forEach(clientId => {
    const clientPool = blueprint.clientExercisePools[clientId];
    
    // Check both availableCandidates AND availableExercises
    const exercises = clientPool?.availableCandidates || clientPool?.availableExercises || [];
    
    // Also check if the selected Exercise #3 is in preAssigned but not in available lists
    const exercise3 = clientPool?.preAssigned.find(p => p.source === "shared_core");
    if (exercise3 && !exercises.find(ex => ex.id === exercise3.exercise.id)) {
      console.log(`[Exercise3] Adding selected Exercise #3 "${exercise3.exercise.name}" to exercise map for client ${clientId}`);
      exercises.push(exercise3.exercise);
    }
    
    exercises.forEach(ex => {
      if (!coreClientExercises.has(ex.id)) {
        coreClientExercises.set(ex.id, {
          exercise: ex,
          clients: new Set(),
          scores: new Map()
        });
      }
      const data = coreClientExercises.get(ex.id)!;
      data.clients.add(clientId);
      data.scores.set(clientId, ex.score);
    });
    
    console.log(`[Exercise3] Client ${clientId} has ${exercises.length} available exercises`);
  });
  
  // Filter for exercises shared by ALL WITH_CORE clients
  const sharedByCoreClients = Array.from(coreClientExercises.values())
    .filter(data => data.clients.size === coreClientIds.length)
    .map(data => ({
      ...data.exercise,
      clientsSharing: Array.from(data.clients),
      coreGroupScore: Array.from(data.scores.values()).reduce((a, b) => a + b, 0) / data.scores.size
    }));
  
  // Filter for core movement pattern AND core muscles
  const coreExercises = sharedByCoreClients.filter((ex) => {
    const movementPattern = ex.movementPattern?.toLowerCase() || "";
    const primaryMuscle = ex.primaryMuscle?.toLowerCase() || "";
    
    const hasCoreMuscle = ["core", "obliques", "abductors", "adductors"].includes(primaryMuscle);
    const hasCoreMovement = movementPattern === "core";
    
    const isCore = hasCoreMovement && hasCoreMuscle;
    
    // Check if this is the selected Exercise #3
    if (selectedExercise3Ids.has(ex.id)) {
      console.log(`[Exercise3] Selected exercise "${ex.name}" - movement: "${movementPattern}", muscle: "${primaryMuscle}" - isCore: ${isCore}`);
    }
    
    return isCore;
  });
  
  console.log(`[Exercise3] Found ${sharedByCoreClients.length} exercises shared by all WITH_CORE clients`);
  console.log(`[Exercise3] Found ${coreExercises.length} core exercises after filtering by movement pattern`);
  
  // Log a few examples of shared exercises to see their movement patterns
  sharedByCoreClients.slice(0, 5).forEach(ex => {
    console.log(`[Exercise3] Example shared exercise: "${ex.name}" - movement: "${ex.movementPattern}"`);
  });
  
  // Filter by score threshold (using core group score)
  const eligibleCoreExercises = coreExercises.filter((ex) => {
    return ex.coreGroupScore >= 5.0;
  });
  
  // Add selected Exercise #3 if it's not already in the list
  let exercisesToDisplay = [...eligibleCoreExercises];
  
  // Check if selected exercise is missing from our filtered list
  selectedExercise3Ids.forEach(selectedId => {
    if (!eligibleCoreExercises.find(ex => ex.id === selectedId)) {
      // Find the selected exercise in the original shared list
      const selectedExercise = Array.from(coreClientExercises.values()).find(
        data => data.exercise.id === selectedId
      );
      if (selectedExercise) {
        console.log(`[Exercise3] Adding selected exercise "${selectedExercise.exercise.name}" to display (movement: ${selectedExercise.exercise.movementPattern})`);
        exercisesToDisplay.push({
          ...selectedExercise.exercise,
          coreGroupScore: Array.from(selectedExercise.scores.values()).reduce((a, b) => a + b, 0) / selectedExercise.scores.size,
          clientsSharing: Array.from(selectedExercise.clients)
        });
      }
    }
  });
  
  // Sort by core group score and prepare for display
  const sharedCoreExercises = exercisesToDisplay
    .sort((a, b) => b.coreGroupScore - a.coreGroupScore)
    .map(ex => {
      return {
        ...ex,
        groupScore: ex.coreGroupScore,
        clientScores: coreClientIds.map(clientId => {
          const exerciseData = coreClientExercises.get(ex.id);
          const score = exerciseData?.scores.get(clientId) || ex.score;
          return {
            clientId,
            individualScore: score
          };
        })
      };
    });

  return (
    <div className="space-y-6">
      <div className="mb-4 rounded-lg bg-blue-50 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-blue-900">
              {coreClients.length} of {groupContext.clients.length} clients have core-focused workout types. Exercise #3 will be selected for these clients only.
            </h4>
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-blue-800">WITH_CORE clients:</p>
                <ul className="text-blue-700 mt-1">
                  {coreClients.map((client) => (
                    <li key={client.user_id}>• {client.name}</li>
                  ))}
                </ul>
              </div>
              {nonCoreClients.length > 0 && (
                <div>
                  <p className="font-medium text-gray-600">Other clients:</p>
                  <ul className="text-gray-500 mt-1">
                    {nonCoreClients.map((client) => (
                      <li key={client.user_id}>• {client.name} (no Exercise #3)</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="text-sm text-blue-700 mt-2">Exercise #3 will be the highest-scoring core exercise shared by all WITH_CORE clients.</p>
      </div>

      {sharedCoreExercises.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No eligible shared core exercises found.</p>
          <p className="text-sm mt-2">Requirements:</p>
          <ul className="text-sm mt-2 space-y-1">
            <li>• Must be available for ALL clients with WITH_CORE workout types</li>
            <li>• Movement pattern must be core</li>
            <li>• Group score must be ≥ 5.0</li>
          </ul>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Exercise Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Movement Pattern
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Primary Muscle
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Secondary Muscles
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Group Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Individual Scores
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Shared By
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {sharedCoreExercises.map((exercise, idx) => {
                const isSelected = selectedExercise3Ids.has(exercise.id);

                return (
                  <tr
                    key={exercise.id}
                    className={isSelected ? "bg-green-50" : ""}
                  >
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {exercise.name}
                      {isSelected && (
                        <span className="ml-2 inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Selected as Exercise #3
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {formatMuscleName(exercise.movementPattern || "")}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {formatMuscleName(exercise.primaryMuscle || "")}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0
                        ? exercise.secondaryMuscles.map(formatMuscleName).join(", ")
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {exercise.groupScore.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {exercise.clientScores.map((clientScore) => {
                          const client = groupContext.clients.find(
                            (c) => c.user_id === clientScore.clientId
                          );
                          return (
                            <span
                              key={clientScore.clientId}
                              className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                            >
                              {client?.name.split(" ")[0]}: {clientScore.individualScore.toFixed(1)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {coreClientIds.map((clientId) => {
                          const client = groupContext.clients.find(
                            (c) => c.user_id === clientId
                          );
                          return (
                            <span
                              key={clientId}
                              className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                            >
                              {client?.name || clientId}
                            </span>
                          );
                        })}
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
  );
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
  llmDebugData,
  llmResult,
  isFromSavedData = false,
  isSaving = false,
  sessionData,
}: StandardTemplateViewProps) {
  // State to track which client's LLM section is expanded
  const [expandedLLMSections, setExpandedLLMSections] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // State for main phase tabs
  const [mainPhaseTab, setMainPhaseTab] = useState<"phase1" | "phase2">("phase1");
  
  const trpc = useTRPC();
  
  // Fetch exercise selections (includes workout exercises and swap history)
  const { selections, swapHistory } = useExerciseSelections(groupContext.sessionId);

  // Toggle LLM section expansion
  const toggleLLMSection = (clientId: string) => {
    setExpandedLLMSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    ...trpc.trainingSession.deleteSession.mutationOptions(),
    onMutate: () => {
      setIsDeleting(true);
    },
    onSuccess: () => {
      router.push("/sessions");
    },
    onError: (error: any) => {
      alert(`Failed to delete session: ${error.message}`);
      setIsDeleting(false);
    },
  });

  // Log what data we're receiving
  React.useEffect(() => {
    // Log the llmDebugData
    console.log("🔍 LLM DEBUG DATA IN STANDARD TEMPLATE VIEW:", {
      hasLlmDebugData: !!llmDebugData,
      hasSystemPromptsByClient: !!llmDebugData?.systemPromptsByClient,
      hasLlmResponsesByClient: !!llmDebugData?.llmResponsesByClient,
      systemPromptsByClientKeys: llmDebugData?.systemPromptsByClient ? Object.keys(llmDebugData.systemPromptsByClient) : [],
      llmResponsesByClientKeys: llmDebugData?.llmResponsesByClient ? Object.keys(llmDebugData.llmResponsesByClient) : [],
      llmDebugDataStructure: llmDebugData
    });

    // Log bucketing data for all clients
    console.log("🪣 [Bucketing Debug] Blueprint overview:", {
      clientCount: groupContext.clients.length,
      clientWorkoutTypes: groupContext.clients.map(c => ({
        name: c.name,
        workoutType: c.workoutType,
        clientId: c.user_id
      })),
      blueprintClientIds: Object.keys(blueprint?.clientExercisePools || {}),
      bucketingStatus: Object.entries(blueprint?.clientExercisePools || {}).map(([clientId, pool]) => {
        const client = groupContext.clients.find(c => c.user_id === clientId);
        return {
          clientName: client?.name || 'Unknown',
          clientId,
          workoutType: client?.workoutType,
          hasBucketedSelection: !!pool.bucketedSelection,
          bucketedCount: pool.bucketedSelection?.exercises?.length || 0
        };
      })
    });

    if (blueprint?.clientExercisePools) {
      Object.entries(blueprint.clientExercisePools).forEach(
        ([clientId, pool]: [string, any]) => {
          // Check if we have debug data for this specific client
          console.log(`  🔍 Client ${clientId} LLM debug data:`, {
            hasSystemPrompt: !!llmDebugData?.systemPromptsByClient?.[clientId],
            hasLlmResponse: !!llmDebugData?.llmResponsesByClient?.[clientId],
            systemPromptLength: llmDebugData?.systemPromptsByClient?.[clientId]?.length || 0,
            llmResponseLength: llmDebugData?.llmResponsesByClient?.[clientId]?.length || 0
          });
        },
      );
    }
  }, [blueprint, isFromSavedData, llmDebugData]);

  // Create tab options: one per client + shared tab
  const clientTabs = groupContext.clients.map((client) => ({
    id: client.user_id,
    name: client.name,
    type: "client" as const,
  }));

  const allTabs = [
    ...clientTabs,
    { id: "shared", name: "Shared Exercises", type: "shared" as const },
  ];

  // State for client sub-tabs
  const [clientSubTabs, setClientSubTabs] = useState<
    Record<string, "all" | "selected">
  >({});

  const setClientSubTab = (clientId: string, tab: "all" | "selected") => {
    setClientSubTabs((prev) => ({ ...prev, [clientId]: tab }));
  };

  // State for shared exercise sub-tabs
  const [sharedSubTab, setSharedSubTab] = useState<"other" | "exercise3">(
    "other",
  );

  // Categorize shared exercises
  const categorizedSharedExercises = useMemo(() => {
    return categorizeSharedExercises(blueprint.sharedExercisePool);
  }, [blueprint.sharedExercisePool]);

  // State for expandable sections
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Set default tab if none selected
  useEffect(() => {
    if (!activeTab && allTabs.length > 0) {
      setActiveTab(allTabs[0].id);
    }
  }, [activeTab, allTabs, setActiveTab]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Standard Group Workout
            </h1>
            <p className="mt-1 text-lg text-gray-600">
              {(() => {
                // Check for total process timing first (from new generations)
                if (sessionData?.totalProcessTiming) {
                  return `Total generation time: ${sessionData.totalProcessTiming.durationSeconds}s`;
                }
                
                // Calculate end-to-end time from LLM start to save completion
                if (llmResult?.llmTimings && sessionData?.templateConfig?.visualizationData?.savedAt) {
                  const timings = Object.values(llmResult.llmTimings) as any[];
                  if (timings.length > 0) {
                    // Find earliest LLM start time
                    const starts = timings.map(t => new Date(t.start).getTime());
                    const earliestStart = Math.min(...starts);
                    
                    // Use savedAt as the end time
                    const savedAt = new Date(sessionData.templateConfig.visualizationData.savedAt).getTime();
                    
                    // Calculate total duration
                    const totalMs = savedAt - earliestStart;
                    return `Total generation time: ${(totalMs / 1000).toFixed(1)}s`;
                  }
                }
                
                // Default text if no timing data
                return `Exercise pools for ${summary.totalClients} clients`;
              })()}
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
                {isGenerating ? "Generating..." : "Generate Workout"}
              </button>
            ) : (
              <a
                href={`/workout-overview?sessionId=${new URLSearchParams(window.location.search).get("sessionId")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg bg-green-600 px-4 py-2 text-center text-white hover:bg-green-700"
              >
                Exercise Selection
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
            <button
              onClick={() => setShowDeleteModal(true)}
              className="rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
            >
              Delete Session
            </button>
          </div>
        </div>

        {/* Main Phase Tabs */}
        <div className="rounded-lg bg-white shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setMainPhaseTab("phase1")}
                className={`px-6 py-3 text-sm font-medium ${
                  mainPhaseTab === "phase1"
                    ? "border-b-2 border-indigo-500 text-indigo-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Phase 1
              </button>
              <button
                onClick={() => setMainPhaseTab("phase2")}
                className={`px-6 py-3 text-sm font-medium ${
                  mainPhaseTab === "phase2"
                    ? "border-b-2 border-indigo-500 text-indigo-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Phase 2
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Phase 1 Content */}
            {mainPhaseTab === "phase1" && (
              <div>
                {/* Sub-tabs for clients */}
                <div className="mb-6 border-b border-gray-200">
                  <nav className="-mb-px flex">
                    {allTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 text-sm font-medium ${
                          activeTab === tab.id
                            ? "border-b-2 border-indigo-500 text-indigo-600"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {tab.name}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Phase 1 Sub-tab Content */}
                <div>
            {/* Client Exercise Tables */}
            {clientTabs.map((clientTab) => {
              if (activeTab !== clientTab.id) return null;

              const client = groupContext.clients.find(
                (c) => c.user_id === clientTab.id,
              );
              const pool = blueprint.clientExercisePools[clientTab.id];

              if (!client || !pool) return null;

              return (
                <div key={clientTab.id}>
                  {/* Client Info Header */}
                  <div className="mb-6 flex items-start gap-4">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.user_id}`}
                      alt={client.name}
                      className="h-16 w-16 rounded-full"
                    />
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold">{client.name}</h3>
                      <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Workout Type:</span>{" "}
                          {client.workoutType
                            ?.replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase()) ||
                            "Not Set"}
                        </div>
                        <div>
                          <span className="font-medium">Intensity:</span>{" "}
                          {client.intensity}
                        </div>
                        {client.muscle_target &&
                          client.muscle_target.length > 0 && (
                            <div>
                              <span className="font-medium">
                                Target Muscles:
                              </span>{" "}
                              {client.muscle_target
                                .map(formatMuscleName)
                                .join(", ")}
                            </div>
                          )}
                        {client.muscle_lessen &&
                          client.muscle_lessen.length > 0 && (
                            <div>
                              <span className="font-medium">
                                Avoid Muscles:
                              </span>{" "}
                              {client.muscle_lessen
                                .map(formatMuscleName)
                                .join(", ")}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Muscle Distribution Calculator for Targeted Workouts */}
                  {(() => {
                    console.log(`[MuscleDistCalc] Client ${client.name}:`, {
                      workoutType: client.workoutType,
                      isTargeted: client.workoutType?.toLowerCase().includes("targeted"),
                      muscleTargets: client.muscle_target
                    });
                    return null;
                  })()}
                  {client.workoutType?.toLowerCase().includes("targeted") && (
                    <div className="mb-6 rounded-lg bg-purple-50 p-4">
                      <h4 className="mb-3 text-sm font-semibold text-gray-900">
                        💪 Muscle Distribution Calculator
                      </h4>
                      {(() => {
                        // Calculate muscle distribution for this client
                        const totalExercises = (() => {
                          switch (client.intensity) {
                            case "low": return 4;
                            case "moderate": return 5;
                            case "high": return 6;
                            case "intense": return 7;
                            default: return 5;
                          }
                        })();
                        
                        // Get pre-assigned muscles
                        const preAssignedMuscles: string[] = [];
                        pool.preAssigned.forEach((pa) => {
                          const muscle = pa.exercise.primaryMuscle?.toLowerCase();
                          if (muscle) {
                            preAssignedMuscles.push(muscle);
                          }
                        });
                        
                        // Get target muscles
                        const targetMuscles = client.muscle_target?.map(m => m.toLowerCase()) || [];
                        
                        // Simplified muscle distribution logic (matching the calculator)
                        const remainingSlots = totalExercises - preAssignedMuscles.length;
                        
                        // Count current exercises per muscle
                        const currentPerMuscle: Record<string, number> = {};
                        targetMuscles.forEach(muscle => {
                          currentPerMuscle[muscle] = 0;
                        });
                        preAssignedMuscles.forEach(muscle => {
                          if (targetMuscles.includes(muscle)) {
                            currentPerMuscle[muscle] = (currentPerMuscle[muscle] || 0) + 1;
                          }
                        });
                        
                        // Generate distribution options
                        const uncoveredMuscles = targetMuscles.filter(m => currentPerMuscle[m] === 0);
                        
                        // Create a simple balanced distribution
                        const distribution: Record<string, number> = {};
                        let slotsLeft = remainingSlots;
                        
                        // For targeted workouts: only ensure each uncovered muscle gets 1
                        uncoveredMuscles.forEach(muscle => {
                          if (slotsLeft > 0) {
                            distribution[muscle] = 1;
                            slotsLeft--;
                          }
                        });
                        
                        // Remaining slots should be used for movement pattern variety
                        // Rather than assigning specific muscles, provide guidance
                        const movementPatternGuidance = slotsLeft;
                        
                        return (
                          <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="font-medium">Total Exercises:</span> {totalExercises}
                              </div>
                              <div>
                                <span className="font-medium">Pre-assigned:</span> {preAssignedMuscles.length}
                              </div>
                              <div>
                                <span className="font-medium">Target Muscles:</span> {targetMuscles.map(formatMuscleName).join(", ")}
                              </div>
                              <div>
                                <span className="font-medium">Remaining Slots:</span> {remainingSlots}
                              </div>
                            </div>
                            
                            {/* Pre-assigned breakdown */}
                            <div className="border-t pt-2">
                              <div className="text-xs font-medium text-gray-700 mb-1">Pre-assigned Exercises:</div>
                              {pool.preAssigned.map((pa, idx) => (
                                <div key={idx} className="text-xs text-gray-600 ml-2">
                                  • {pa.exercise.name} ({formatMuscleName(pa.exercise.primaryMuscle || "unknown")})
                                  {pa.source === "favorite" && " - Favorite"}
                                  {pa.source === "shared_other" && " - Shared"}
                                  {pa.source === "shared_core" && " - Core"}
                                </div>
                              ))}
                            </div>
                            
                            {/* Distribution to LLM */}
                            <div className="border-t pt-2">
                              <div className="text-xs font-medium text-gray-700 mb-1">LLM Requirements:</div>
                              <div className="space-y-2">
                                {/* Muscle requirements */}
                                {uncoveredMuscles.length > 0 && (
                                  <div className="bg-purple-100 rounded px-3 py-2">
                                    <div className="text-xs font-medium mb-1">Must Include (at least 1 each):</div>
                                    <div className="font-mono text-xs">
                                      {uncoveredMuscles.map(muscle => formatMuscleName(muscle)).join(", ")}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Movement variety guidance */}
                                {movementPatternGuidance > 0 && (
                                  <div className="bg-blue-100 rounded px-3 py-2">
                                    <div className="text-xs font-medium mb-1">Additional {movementPatternGuidance} exercise{movementPatternGuidance > 1 ? 's' : ''} for movement variety:</div>
                                    <div className="text-xs text-gray-700">
                                      • Prioritize different movement patterns<br/>
                                      • Consider compound movements<br/>
                                      • Avoid duplicating existing patterns
                                    </div>
                                  </div>
                                )}
                                
                                {remainingSlots === 0 && (
                                  <div className="text-xs text-gray-500 italic">No additional exercises needed</div>
                                )}
                              </div>
                            </div>
                            
                            {/* Current muscle coverage */}
                            <div className="border-t pt-2">
                              <div className="text-xs font-medium text-gray-700 mb-1">Muscle Coverage Status:</div>
                              <div className="space-y-1">
                                {targetMuscles.map(muscle => {
                                  const preCount = currentPerMuscle[muscle];
                                  const needsCoverage = preCount === 0;
                                  return (
                                    <div key={muscle} className="flex items-center justify-between text-xs">
                                      <span className="text-gray-600">{formatMuscleName(muscle)}:</span>
                                      <span className={`font-medium ${needsCoverage ? 'text-orange-600' : 'text-green-600'}`}>
                                        {preCount > 0 ? `✓ Covered (${preCount} pre-assigned)` : '⚠ Needs coverage'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              {movementPatternGuidance > 0 && (
                                <div className="mt-2 text-xs text-gray-600">
                                  + {movementPatternGuidance} additional exercise{movementPatternGuidance > 1 ? 's' : ''} for movement variety
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* LLM System Prompt & Output - Only show if we have LLM debug data for this client */}
                  {llmDebugData?.systemPromptsByClient?.[clientTab.id] && (
                    <div className="mb-6 rounded-lg bg-blue-50 p-4">
                      <button
                        onClick={() => toggleLLMSection(clientTab.id)}
                        className="flex w-full items-center justify-between text-left"
                      >
                        <h4 className="text-sm font-semibold text-gray-900">
                          🤖 LLM System Prompt & Output
                          {llmResult?.llmTimings?.[clientTab.id] && (
                            <span className="ml-2 text-xs font-normal text-gray-600">
                              ({(llmResult.llmTimings[clientTab.id].durationMs / 1000).toFixed(1)}s)
                            </span>
                          )}
                        </h4>
                        <span className="text-gray-500">
                          {expandedLLMSections.has(clientTab.id) ? '▼' : '▶'}
                        </span>
                      </button>

                      {expandedLLMSections.has(clientTab.id) && (
                        <div className="mt-4">
                          {/* System Prompt */}
                          <div className="mb-4">
                            <h5 className="mb-2 text-xs font-medium text-gray-700">
                              System Prompt:
                            </h5>
                            <pre className="overflow-x-auto whitespace-pre-wrap rounded border border-blue-200 bg-white p-3 text-xs">
                              {llmDebugData.systemPromptsByClient[clientTab.id]}
                            </pre>
                          </div>

                          {/* LLM Response */}
                          {llmDebugData.llmResponsesByClient?.[clientTab.id] && (
                            <div>
                              <h5 className="mb-2 text-xs font-medium text-gray-700">
                                LLM Response:
                              </h5>
                              <pre className="overflow-x-auto whitespace-pre-wrap rounded border border-blue-200 bg-white p-3 text-xs">
                                {llmDebugData.llmResponsesByClient[clientTab.id]}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Constraint Analysis for Pre-Assigned Exercises */}
                  <div className="mb-6 rounded-lg bg-gray-50 p-4">
                    <h4 className="mb-4 text-sm font-semibold text-gray-900">
                      Constraint Analysis for Pre-Assigned Exercises
                    </h4>

                    <div className="space-y-4">
                      {/* Muscle Coverage */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <button
                            onClick={() =>
                              toggleSection(`${clientTab.id}-muscle`)
                            }
                            className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
                          >
                            <span
                              className={`transition-transform ${expandedSections[`${clientTab.id}-muscle`] ? "rotate-90" : ""}`}
                            >
                              ▶
                            </span>
                            Muscle
                          </button>
                          {(() => {
                            const preAssignedExercises = pool.preAssigned.map(
                              (p) => p.exercise,
                            );
                            const patternCounts = preAssignedExercises.reduce(
                              (acc, ex) => {
                                const pattern =
                                  ex.movementPattern?.toLowerCase() ||
                                  "unknown";
                                acc[pattern] = (acc[pattern] || 0) + 1;
                                return acc;
                              },
                              {} as Record<string, number>,
                            );
                            const uniquePatterns = Object.keys(
                              patternCounts,
                            ).filter((p) => p !== "unknown").length;

                            return (
                              <span
                                className={`text-xs font-medium ${uniquePatterns >= 2 ? "text-green-600" : uniquePatterns >= 1 ? "text-yellow-600" : "text-red-600"}`}
                              >
                                {uniquePatterns} unique patterns (of{" "}
                                {preAssignedExercises.length} exercises)
                              </span>
                            );
                          })()}
                        </div>
                        {expandedSections[`${clientTab.id}-muscle`] && (
                          <div className="mt-2 space-y-2">
                            {(() => {
                              const muscleGroups = [
                                "chest",
                                "back",
                                "legs",
                                "biceps",
                                "triceps",
                                "shoulders",
                                "core",
                              ];
                              const selectedExercises = pool.preAssigned.map(
                                (p) => p.exercise,
                              );

                              return muscleGroups.map((muscle) => {
                                const muscleMapping: Record<string, string[]> =
                                  {
                                    chest: ["chest", "pectorals"],
                                    back: [
                                      "lats",
                                      "middle_back",
                                      "upper_back",
                                      "lower_back",
                                      "rhomboids",
                                      "traps",
                                    ],
                                    legs: [
                                      "quads",
                                      "hamstrings",
                                      "glutes",
                                      "calves",
                                      "hip_flexors",
                                      "adductors",
                                      "abductors",
                                    ],
                                    biceps: ["biceps"],
                                    triceps: ["triceps"],
                                    shoulders: [
                                      "shoulders",
                                      "delts",
                                      "deltoids",
                                      "anterior_delts",
                                      "lateral_delts",
                                      "posterior_delts",
                                    ],
                                    core: [
                                      "abs",
                                      "core",
                                      "obliques",
                                      "transverse_abs",
                                    ],
                                  };

                                const targetMuscles = muscleMapping[muscle] || [
                                  muscle,
                                ];
                                const coverageExercises =
                                  selectedExercises.filter((ex) =>
                                    targetMuscles.some(
                                      (target) =>
                                        ex.primaryMuscle === target ||
                                        (ex.secondaryMuscles &&
                                          ex.secondaryMuscles.includes(target)),
                                    ),
                                  );

                                const coverageCount = coverageExercises.length;
                                const maxExpected = 3;
                                const percentage = Math.min(
                                  100,
                                  (coverageCount / maxExpected) * 100,
                                );

                                return (
                                  <div key={muscle}>
                                    <div className="mb-1 flex items-center justify-between text-xs">
                                      <span className="text-gray-600">
                                        {muscle.charAt(0).toUpperCase() +
                                          muscle.slice(1)}
                                      </span>
                                      <span
                                        className={`font-medium ${coverageCount >= 1 ? "text-green-600" : "text-red-600"}`}
                                      >
                                        {coverageCount} exercise
                                        {coverageCount !== 1 ? "s" : ""}
                                      </span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-gray-200">
                                      <div
                                        className={`h-2 rounded-full transition-all duration-300 ${
                                          coverageCount === 0
                                            ? "bg-red-500"
                                            : coverageCount === 1
                                              ? "bg-yellow-500"
                                              : "bg-green-500"
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Smart Bucketing Constraint Compliance */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <button
                            onClick={() =>
                              toggleSection(`${clientTab.id}-compliance`)
                            }
                            className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
                          >
                            <span
                              className={`transition-transform ${expandedSections[`${clientTab.id}-compliance`] ? "rotate-90" : ""}`}
                            >
                              ▶
                            </span>
                            Constraint Details
                          </button>
                          {(() => {
                            if (
                              !client.workoutType ||
                              !BUCKET_CONFIGS[client.workoutType]
                            ) {
                              return (
                                <span className="text-xs text-gray-500">
                                  No constraints defined
                                </span>
                              );
                            }

                            // Include BOTH pre-assigned and bucketed exercises
                            const preAssignedExercises = pool.preAssigned.map(
                              (p) => p.exercise,
                            );
                            const bucketedExercises =
                              pool.bucketedSelection?.exercises || [];
                            const allSelectedExercises = [
                              ...preAssignedExercises,
                              ...bucketedExercises,
                            ];

                            const config = BUCKET_CONFIGS[client.workoutType];
                            let violations = 0;
                            let warnings = 0;

                            // Check movement pattern constraints
                            const patternCounts: Record<string, number> = {};
                            allSelectedExercises.forEach((ex) => {
                              if (ex.movementPattern) {
                                // Normalize to lowercase to match constraint keys
                                const pattern =
                                  ex.movementPattern.toLowerCase();
                                patternCounts[pattern] =
                                  (patternCounts[pattern] || 0) + 1;
                              }
                            });

                            Object.entries(config.movementPatterns).forEach(
                              ([pattern, { min, max }]) => {
                                const count = patternCounts[pattern] || 0;
                                if (count < min) violations++;
                                // Don't count exceeding max as a warning - it's fine to have more
                              },
                            );

                            // Check functional requirements
                            Object.entries(
                              config.functionalRequirements,
                            ).forEach(([funcType, required]) => {
                              let count = 0;

                              if (funcType === "muscle_target") {
                                const targetMuscles =
                                  client.muscle_target || [];
                                count = allSelectedExercises.filter((ex) => {
                                  if (!ex.primaryMuscle) return false;
                                  return targetMuscles.some((muscle) => {
                                    const oldMuscles =
                                      getOldMusclesForConsolidated(
                                        muscle as ConsolidatedMuscle,
                                      );
                                    return oldMuscles.includes(
                                      ex.primaryMuscle.toLowerCase(),
                                    );
                                  });
                                }).length;
                              } else {
                                count = allSelectedExercises.filter((ex) =>
                                  ex.functionTags?.includes(funcType),
                                ).length;
                              }

                              if (count < required) violations++;
                            });

                            if (violations > 0) {
                              return (
                                <span className="text-xs font-medium text-red-600">
                                  {violations} violation
                                  {violations > 1 ? "s" : ""}
                                </span>
                              );
                            } else if (warnings > 0) {
                              return (
                                <span className="text-xs font-medium text-yellow-600">
                                  {warnings} warning{warnings > 1 ? "s" : ""}
                                </span>
                              );
                            } else {
                              return (
                                <span className="text-xs font-medium text-green-600">
                                  All constraints met
                                </span>
                              );
                            }
                          })()}
                        </div>
                        {expandedSections[`${clientTab.id}-compliance`] &&
                          client.workoutType &&
                          BUCKET_CONFIGS[client.workoutType] && (
                            <div className="mt-3 space-y-2">
                              {(() => {
                                // Include BOTH pre-assigned and bucketed exercises for complete view
                                const preAssignedExercises =
                                  pool.preAssigned.map((p) => p.exercise);
                                const bucketedExercises =
                                  pool.bucketedSelection?.exercises || [];
                                const allSelectedExercises = [
                                  ...preAssignedExercises,
                                  ...bucketedExercises,
                                ];

                                const patternCounts: Record<string, number> =
                                  {};
                                allSelectedExercises.forEach((ex) => {
                                  if (ex.movementPattern) {
                                    // Normalize to lowercase to match constraint keys
                                    const pattern =
                                      ex.movementPattern.toLowerCase();
                                    patternCounts[pattern] =
                                      (patternCounts[pattern] || 0) + 1;
                                  }
                                });

                                return Object.entries(
                                  BUCKET_CONFIGS[client.workoutType]
                                    .movementPatterns,
                                ).map(([pattern, { min, max }]) => {
                                  const count = patternCounts[pattern] || 0;
                                  const status = count < min ? "fail" : "pass"; // Always pass if >= min

                                  return (
                                    <div
                                      key={pattern}
                                      className="flex items-center justify-between rounded border border-gray-200 bg-white p-2"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={`flex h-4 w-4 items-center justify-center rounded-full ${
                                            status === "pass"
                                              ? "bg-green-100"
                                              : status === "warning"
                                                ? "bg-yellow-100"
                                                : "bg-red-100"
                                          }`}
                                        >
                                          {status === "pass" ? (
                                            <span className="text-xs text-green-600"></span>
                                          ) : status === "warning" ? (
                                            <span className="text-xs text-yellow-600">
                                              !
                                            </span>
                                          ) : (
                                            <span className="text-xs text-red-600"></span>
                                          )}
                                        </div>
                                        <span className="text-xs text-gray-700">
                                          {pattern.replace(/_/g, " ")}
                                        </span>
                                      </div>
                                      <span
                                        className={`text-xs ${
                                          status === "pass"
                                            ? "text-gray-600"
                                            : status === "warning"
                                              ? "text-yellow-600"
                                              : "text-red-600"
                                        }`}
                                      >
                                        {count} /{" "}
                                        {min === max ? min : `${min}-${max}`}
                                      </span>
                                    </div>
                                  );
                                });
                              })()}

                              {/* Functional Requirements without label */}
                              {(() => {
                                // Use all selected exercises (pre-assigned + bucketed)
                                const preAssignedExercises =
                                  pool.preAssigned.map((p) => p.exercise);
                                const bucketedExercises =
                                  pool.bucketedSelection?.exercises || [];
                                const allSelectedExercises = [
                                  ...preAssignedExercises,
                                  ...bucketedExercises,
                                ];

                                return Object.entries(
                                  BUCKET_CONFIGS[client.workoutType]
                                    .functionalRequirements,
                                ).map(([funcType, required]) => {
                                  let count = 0;

                                  if (funcType === "muscle_target") {
                                    // Count exercises that target the client's muscle targets (PRIMARY ONLY)
                                    const targetMuscles =
                                      client.muscle_target || [];
                                    count = allSelectedExercises.filter(
                                      (ex) => {
                                        if (!ex.primaryMuscle) return false;
                                        return targetMuscles.some((muscle) => {
                                          const oldMuscles =
                                            getOldMusclesForConsolidated(
                                              muscle as ConsolidatedMuscle,
                                            );
                                          return oldMuscles.includes(
                                            ex.primaryMuscle.toLowerCase(),
                                          );
                                        });
                                      },
                                    ).length;
                                  } else {
                                    // Standard function tag check (capacity, strength)
                                    count = allSelectedExercises.filter((ex) =>
                                      ex.functionTags?.includes(funcType),
                                    ).length;
                                  }

                                  const status =
                                    count >= required ? "pass" : "fail";

                                  return (
                                    <div
                                      key={funcType}
                                      className="flex items-center justify-between rounded border border-gray-200 bg-white p-2"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={`flex h-4 w-4 items-center justify-center rounded-full ${
                                            status === "pass"
                                              ? "bg-green-100"
                                              : "bg-red-100"
                                          }`}
                                        >
                                          {status === "pass" ? (
                                            <span className="text-xs text-green-600">
                                              ✓
                                            </span>
                                          ) : (
                                            <span className="text-xs text-red-600">
                                              ✗
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-xs text-gray-700">
                                          {funcType.replace(/_/g, " ")}
                                        </span>
                                      </div>
                                      <span
                                        className={`text-xs ${
                                          status === "pass"
                                            ? "text-gray-600"
                                            : "text-red-600"
                                        }`}
                                      >
                                        {count} / {required}
                                      </span>
                                    </div>
                                  );
                                });
                              })()}

                              {/* Summary Info */}
                              <div className="border-t pt-2 text-xs text-gray-600">
                                <p>
                                  Total exercises needed:{" "}
                                  {
                                    BUCKET_CONFIGS[client.workoutType]
                                      .totalExercises
                                  }
                                </p>
                                <p>Pre-assigned: {pool.preAssigned.length}</p>
                                <p>
                                  Remaining to select:{" "}
                                  {BUCKET_CONFIGS[client.workoutType]
                                    .totalExercises - pool.preAssigned.length}
                                </p>

                                {/* Pre-assignment Requirements */}
                                {client.workoutType ===
                                  WorkoutType.FULL_BODY_WITH_FINISHER && (
                                  <div className="mt-2 border-t pt-2">
                                    <p className="mb-1 font-medium text-gray-700">
                                      Pre-assignment requirements:
                                    </p>
                                    <div className="mb-2 text-xs text-gray-600">
                                      <p>
                                        • 2 favorites (MUST be 1 upper body + 1
                                        lower body)
                                      </p>
                                      <p>• Plus any include requests</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Selected Exercises */}
                  <div className="mb-6 rounded-lg bg-gray-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        onClick={() =>
                          toggleSection(`${clientTab.id}-selected`)
                        }
                        className="flex items-center gap-1 text-sm font-semibold text-gray-900 hover:text-gray-900"
                      >
                        <span
                          className={`transition-transform ${expandedSections[`${clientTab.id}-selected`] ? "rotate-90" : ""}`}
                        >
                          ▶
                        </span>
                        Selected Exercises
                      </button>
                      <span className="text-xs font-medium text-gray-600">
                        {selections && Array.isArray(selections) 
                          ? selections.filter((s: any) => s.clientId === clientTab.id).length
                          : pool.preAssigned.length + (pool.bucketedSelection?.exercises?.length || 0)
                        } total
                      </span>
                    </div>
                    {expandedSections[`${clientTab.id}-selected`] && (
                      <div className="mt-4 space-y-3">
                        {/* If we have workout exercises from the database, show those */}
                        {selections && Array.isArray(selections) && selections.filter((s: any) => s.clientId === clientTab.id).length > 0 ? (
                          <div>
                            <h5 className="mb-2 text-xs font-medium text-gray-700">
                              Final Workout Exercises
                            </h5>
                            <div className="space-y-1">
                              {selections
                                .filter((s: any) => s.clientId === clientTab.id)
                                .map((selection: any, idx: number) => {
                                  // Check if this exercise was swapped
                                  const wasSwapped = selection.selectionSource === "manual_swap";
                                  const swapInfo = Array.isArray(swapHistory) ? swapHistory.find((swap: any) => 
                                    swap.clientId === clientTab.id && 
                                    swap.newExerciseId === selection.exerciseId
                                  ) : undefined;
                                  
                                  // Find the original exercise name from the available exercises
                                  let originalExerciseName = "";
                                  if (swapInfo && swapInfo.originalExerciseId) {
                                    // First try to find in pre-assigned exercises
                                    const preAssignedExercise = pool.preAssigned.find((p: any) => 
                                      p.exercise.id === swapInfo.originalExerciseId
                                    );
                                    if (preAssignedExercise) {
                                      originalExerciseName = preAssignedExercise.exercise.name;
                                    } else {
                                      // Try to find in available candidates
                                      const candidateExercise = pool.availableCandidates.find((ex: any) => 
                                        ex.id === swapInfo.originalExerciseId
                                      );
                                      if (candidateExercise) {
                                        originalExerciseName = candidateExercise.name;
                                      } else if (pool.bucketedSelection) {
                                        // Try to find in bucketed selection
                                        const bucketedExercise = pool.bucketedSelection.exercises.find((ex: any) => 
                                          ex.id === swapInfo.originalExerciseId
                                        );
                                        if (bucketedExercise) {
                                          originalExerciseName = bucketedExercise.name;
                                        }
                                      }
                                    }
                                  }
                                  
                                  return (
                                    <div
                                      key={selection.id}
                                      className={`rounded border p-2 ${
                                        wasSwapped 
                                          ? "border-blue-200 bg-blue-50" 
                                          : "border-gray-200 bg-white"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-900">
                                          {idx + 1}. {selection.exerciseName}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          {wasSwapped && (
                                            <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                              Swapped
                                            </span>
                                          )}
                                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                                            selection.selectionSource === "ai_selection"
                                              ? "bg-green-100 text-green-800"
                                              : selection.selectionSource === "pre_assigned"
                                                ? "bg-purple-100 text-purple-800"
                                                : "bg-gray-100 text-gray-800"
                                          }`}>
                                            {selection.selectionSource === "ai_selection" 
                                              ? "AI Selected" 
                                              : selection.selectionSource === "pre_assigned"
                                                ? "Pre-assigned"
                                                : selection.selectionSource.replace(/_/g, " ")}
                                          </span>
                                        </div>
                                      </div>
                                      {swapInfo && originalExerciseName && (
                                        <div className="mt-1 text-xs text-gray-500">
                                          Originally: {originalExerciseName}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Show blueprint selections if no workout exercises exist yet */}
                            {/* Pre-assigned Exercises */}
                            {pool.preAssigned.length > 0 && (
                              <div>
                                <h5 className="mb-2 text-xs font-medium text-gray-700">
                                  Pre-assigned ({pool.preAssigned.length})
                                </h5>
                                <div className="space-y-1">
                                  {pool.preAssigned.map((preAssigned, idx) => (
                                    <div
                                      key={preAssigned.exercise.id}
                                      className="rounded border border-purple-200 bg-purple-50 p-2"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-900">
                                          {idx + 1}. {preAssigned.exercise.name}
                                        </span>
                                        <span
                                          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                                            preAssigned.source === "Include"
                                              ? "bg-purple-100 text-purple-800"
                                              : preAssigned.source === "favorite"
                                                ? "bg-yellow-100 text-yellow-800"
                                                : "bg-gray-100 text-gray-800"
                                          }`}
                                        >
                                          {preAssigned.source}
                                        </span>
                                      </div>
                                      <div className="mt-1 text-xs text-gray-600">
                                        {formatMuscleName(preAssigned.exercise.movementPattern || "")} • 
                                        {formatMuscleName(preAssigned.exercise.primaryMuscle || "")}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Bucketed Selection */}
                            {(() => {
                              console.log(`[Bucketing Debug] Client ${client.name} (${client.workoutType}):`, {
                                clientId: client.user_id,
                                hasBucketedSelection: !!pool.bucketedSelection,
                                bucketedExerciseCount: pool.bucketedSelection?.exercises?.length || 0,
                                bucketAssignments: pool.bucketedSelection?.bucketAssignments || {},
                                workoutType: client.workoutType,
                                poolKeys: Object.keys(pool),
                                pool: pool,
                                preAssignedCount: pool.preAssigned?.length || 0,
                                availableCandidatesCount: pool.availableCandidates?.length || 0,
                                blueprintClientIds: Object.keys(blueprint.clientExercisePools),
                              });
                              // Log the first bucketed exercise if any
                              if (pool.bucketedSelection?.exercises?.length > 0) {
                                console.log('[Bucketing Debug] First bucketed exercise:', pool.bucketedSelection.exercises[0]);
                                console.log('[Bucketing Debug] All bucket assignments:', pool.bucketedSelection.bucketAssignments);
                              } else {
                                console.log('[Bucketing Debug] NO BUCKETED SELECTION for', client.name);
                              }
                              return null;
                            })()}
                            {pool.bucketedSelection && pool.bucketedSelection.exercises.length > 0 && (
                              <div>
                                <h5 className="mb-2 text-xs font-medium text-gray-700">
                                  Smart Bucketed Selection ({pool.bucketedSelection.exercises.length})
                                </h5>
                                <div className="space-y-1">
                                  {pool.bucketedSelection.exercises.map((exercise, idx) => {
                                    const assignment = pool.bucketedSelection?.bucketAssignments[exercise.id];
                                    return (
                                      <div
                                        key={exercise.id}
                                        className="rounded border border-green-200 bg-green-50 p-2"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-medium text-gray-900">
                                            {pool.preAssigned.length + idx + 1}. {exercise.name}
                                          </span>
                                          {assignment && (
                                            <div className="flex items-center gap-1">
                                              <span
                                                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                                                  assignment.bucketType === "movement_pattern"
                                                    ? "bg-purple-100 text-purple-800"
                                                    : assignment.bucketType === "muscle_target"
                                                    ? "bg-blue-100 text-blue-800"
                                                    : assignment.bucketType === "movement_diversity"
                                                    ? "bg-teal-100 text-teal-800"
                                                    : "bg-indigo-100 text-indigo-800"
                                                }`}
                                              >
                                                {assignment.constraint.replace(/_/g, " ")}
                                              </span>
                                              {assignment.selectionRound && (
                                                <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                                                  R{assignment.selectionRound}
                                                </span>
                                              )}
                                              {assignment.tiedCount && assignment.tiedCount > 1 && (
                                                <span className="inline-flex items-center rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">
                                                  {assignment.tiedCount} tied
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <div className="mt-1 text-xs text-gray-600">
                                          {formatMuscleName(exercise.movementPattern || "")} • 
                                          {formatMuscleName(exercise.primaryMuscle || "")}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* All Exercises */}
                  <h4 className="mb-4 text-sm font-semibold text-gray-900">
                    All Exercises
                  </h4>
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              #
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Exercise Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Movement Pattern
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Primary Muscle
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Secondary Muscles
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Score
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Score Breakdown
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {/* Pre-assigned Exercises */}
                          {pool.preAssigned.map((preAssigned, idx) => (
                            <tr
                              key={preAssigned.exercise.id}
                              className="bg-purple-50"
                            >
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                {preAssigned.exercise.name}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                <div className="flex flex-col gap-0.5">
                                  <span>
                                    {formatMuscleName(
                                      preAssigned.exercise.movementPattern ||
                                        "",
                                    )}
                                  </span>
                                  {preAssigned.exercise.functionTags?.includes(
                                    "capacity",
                                  ) && (
                                    <span className="inline-flex w-fit items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
                                      capacity
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {formatMuscleName(
                                  preAssigned.exercise.primaryMuscle || "",
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {preAssigned.exercise.secondaryMuscles
                                  ?.map(formatMuscleName)
                                  .join(", ") || "-"}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {preAssigned.exercise.score.toFixed(1)}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1">
                                    <span
                                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                                        preAssigned.source === "Include"
                                          ? "bg-purple-100 text-purple-800"
                                          : preAssigned.source === "favorite"
                                            ? "bg-yellow-100 text-yellow-800"
                                            : preAssigned.source ===
                                                "shared_other"
                                              ? "bg-blue-100 text-blue-800"
                                              : preAssigned.source ===
                                                  "shared_core_finisher"
                                                ? "bg-green-100 text-green-800"
                                                : preAssigned.source ===
                                                    "finisher"
                                                  ? "bg-orange-100 text-orange-800"
                                                  : "bg-gray-100 text-gray-800"
                                      }`}
                                    >
                                      {preAssigned.source === "Include"
                                        ? "Include"
                                        : preAssigned.source === "favorite"
                                          ? "Favorite"
                                          : preAssigned.source ===
                                              "shared_other"
                                            ? "Shared"
                                            : preAssigned.source ===
                                                "shared_core_finisher"
                                              ? "Shared Core/Finisher"
                                              : preAssigned.source ===
                                                  "finisher"
                                                ? "Finisher"
                                                : preAssigned.source}
                                    </span>
                                    {preAssigned.tiedCount &&
                                      preAssigned.tiedCount > 1 && (
                                        <span className="inline-flex items-center rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">
                                          Selected from {preAssigned.tiedCount}{" "}
                                          tied
                                        </span>
                                      )}
                                    {preAssigned.sharedWith &&
                                      preAssigned.sharedWith.length > 0 && (
                                        <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
                                          Shared with{" "}
                                          {preAssigned.sharedWith.length} other
                                          {preAssigned.sharedWith.length > 1
                                            ? "s"
                                            : ""}
                                        </span>
                                      )}
                                  </div>
                                  {preAssigned.exercise.scoreBreakdown && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {(() => {
                                        const scoreBreakdown =
                                          preAssigned.exercise.scoreBreakdown;
                                        const breakdownBadges = [];

                                        if (
                                          scoreBreakdown.includeExerciseBoost >
                                          0
                                        ) {
                                          breakdownBadges.push(
                                            <span
                                              key="include"
                                              className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800"
                                            >
                                              Include +
                                              {scoreBreakdown.includeExerciseBoost.toFixed(
                                                1,
                                              )}
                                            </span>,
                                          );
                                        }

                                        if (
                                          scoreBreakdown.favoriteExerciseBoost >
                                          0
                                        ) {
                                          breakdownBadges.push(
                                            <span
                                              key="favorite"
                                              className="inline-flex items-center rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800"
                                            >
                                              ⭐ Favorite +
                                              {scoreBreakdown.favoriteExerciseBoost.toFixed(
                                                1,
                                              )}
                                            </span>,
                                          );
                                        }

                                        if (
                                          scoreBreakdown.muscleTargetBonus > 0
                                        ) {
                                          const isPrimary =
                                            scoreBreakdown.muscleTargetBonus >=
                                            3.0;
                                          breakdownBadges.push(
                                            <span
                                              key="target"
                                              className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800"
                                            >
                                              Target {isPrimary ? "" : "(2nd)"}{" "}
                                              +
                                              {scoreBreakdown.muscleTargetBonus.toFixed(
                                                1,
                                              )}
                                            </span>,
                                          );
                                        }

                                        if (
                                          scoreBreakdown.muscleLessenPenalty < 0
                                        ) {
                                          const isPrimary =
                                            scoreBreakdown.muscleLessenPenalty <=
                                            -3.0;
                                          breakdownBadges.push(
                                            <span
                                              key="lessen"
                                              className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800"
                                            >
                                              Lessen {isPrimary ? "" : "(2nd)"}{" "}
                                              {scoreBreakdown.muscleLessenPenalty.toFixed(
                                                1,
                                              )}
                                            </span>,
                                          );
                                        }

                                        // Intensity adjustment removed - no longer affects scores

                                        return breakdownBadges;
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}

                          {/* Smart Bucketed Selection */}
                          {pool.bucketedSelection && (
                            <>
                              <tr className="bg-green-50">
                                <td
                                  colSpan={7}
                                  className="px-4 py-2 text-sm font-medium text-green-800"
                                >
                                  Smart Bucketed Selection (
                                  {pool.bucketedSelection.exercises.length}{" "}
                                  exercises)
                                </td>
                              </tr>
                              {pool.bucketedSelection.exercises.map(
                                (exercise, idx) => {
                                  const assignment =
                                    pool.bucketedSelection?.bucketAssignments[
                                      exercise.id
                                    ];
                                  const isShared =
                                    blueprint.sharedExercisePool.some(
                                      (shared) => shared.id === exercise.id,
                                    );

                                  return (
                                    <tr
                                      key={exercise.id}
                                      className="border-l-4 border-green-500 bg-green-50"
                                    >
                                      <td className="px-4 py-2 text-sm text-gray-900">
                                        {idx + 1}
                                      </td>
                                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                        {exercise.name}
                                        {isShared && (
                                          <span className="ml-2 inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                            Shared
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-600">
                                        <div className="flex flex-col gap-0.5">
                                          <span>
                                            {formatMuscleName(
                                              exercise.movementPattern || "",
                                            )}
                                          </span>
                                          {exercise.functionTags?.includes(
                                            "capacity",
                                          ) && (
                                            <span className="inline-flex w-fit items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
                                              capacity
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-600">
                                        {formatMuscleName(
                                          exercise.primaryMuscle || "",
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-600">
                                        {exercise.secondaryMuscles
                                          ?.map(formatMuscleName)
                                          .join(", ") || "-"}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-900">
                                        {exercise.score.toFixed(1)}
                                      </td>
                                      <td className="px-4 py-2 text-sm">
                                        {assignment && (
                                          <div className="flex items-center gap-1">
                                            <span
                                              className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                                                assignment.bucketType === "movement_pattern"
                                                  ? "bg-purple-100 text-purple-800"
                                                  : assignment.bucketType === "muscle_target"
                                                  ? "bg-blue-100 text-blue-800"
                                                  : assignment.bucketType === "movement_diversity"
                                                  ? "bg-teal-100 text-teal-800"
                                                  : assignment.bucketType === "functional"
                                                  ? "bg-indigo-100 text-indigo-800"
                                                  : "bg-gray-100 text-gray-800"
                                              }`}
                                            >
                                              {assignment.constraint.replace(/_/g, " ")}
                                            </span>
                                            {assignment.selectionRound && (
                                              <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                                                R{assignment.selectionRound}
                                              </span>
                                            )}
                                            {assignment.tiedCount &&
                                              assignment.tiedCount > 1 && (
                                                <span className="inline-flex items-center rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">
                                                  Selected from{" "}
                                                  {assignment.tiedCount} tied
                                                </span>
                                              )}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                },
                              )}
                              <tr className="bg-gray-50">
                                <td
                                  colSpan={7}
                                  className="px-4 py-2 text-sm font-medium text-gray-700"
                                >
                                  All Available Candidates (
                                  {pool.availableCandidates.length} exercises)
                                </td>
                              </tr>
                            </>
                          )}

                          {/* Available Candidates */}
                          {pool.availableCandidates.map((exercise, idx) => {
                            const scoreBreakdown =
                              exercise.scoreBreakdown || {};
                            const isShared = blueprint.sharedExercisePool.some(
                              (shared) => shared.id === exercise.id,
                            );

                            // Build score breakdown badges
                            const breakdownBadges = [];

                            if (scoreBreakdown.includeExerciseBoost > 0) {
                              breakdownBadges.push(
                                <span
                                  key="include"
                                  className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800"
                                >
                                  Include +
                                  {scoreBreakdown.includeExerciseBoost.toFixed(
                                    1,
                                  )}
                                </span>,
                              );
                            }

                            if (scoreBreakdown.favoriteExerciseBoost > 0) {
                              breakdownBadges.push(
                                <span
                                  key="favorite"
                                  className="inline-flex items-center rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800"
                                >
                                  ⭐ Favorite +
                                  {scoreBreakdown.favoriteExerciseBoost.toFixed(
                                    1,
                                  )}
                                </span>,
                              );
                            }

                            if (scoreBreakdown.muscleTargetBonus > 0) {
                              const isPrimary =
                                scoreBreakdown.muscleTargetBonus >= 3.0;
                              breakdownBadges.push(
                                <span
                                  key="target"
                                  className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800"
                                >
                                  Target {isPrimary ? "" : "(2nd)"} +
                                  {scoreBreakdown.muscleTargetBonus.toFixed(1)}
                                </span>,
                              );
                            }

                            if (scoreBreakdown.muscleLessenPenalty < 0) {
                              const isPrimary =
                                scoreBreakdown.muscleLessenPenalty <= -3.0;
                              breakdownBadges.push(
                                <span
                                  key="lessen"
                                  className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800"
                                >
                                  Lessen {isPrimary ? "" : "(2nd)"}{" "}
                                  {scoreBreakdown.muscleLessenPenalty.toFixed(
                                    1,
                                  )}
                                </span>,
                              );
                            }

                            // Intensity adjustment removed - no longer affects scores

                            return (
                              <tr key={exercise.id}>
                                <td className="px-4 py-2 text-sm text-gray-900">
                                  {pool.preAssigned.length + idx + 1}
                                </td>
                                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                  {exercise.name}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  <div className="flex flex-col gap-0.5">
                                    <span>
                                      {formatMuscleName(
                                        exercise.movementPattern || "",
                                      )}
                                    </span>
                                    {exercise.functionTags?.includes(
                                      "capacity",
                                    ) && (
                                      <span className="inline-flex w-fit items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
                                        capacity
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  {formatMuscleName(
                                    exercise.primaryMuscle || "",
                                  )}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  {exercise.secondaryMuscles &&
                                  exercise.secondaryMuscles.length > 0
                                    ? exercise.secondaryMuscles
                                        .map(formatMuscleName)
                                        .join(", ")
                                    : "-"}
                                </td>
                                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                  {exercise.score.toFixed(1)}
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  <div className="flex flex-wrap gap-1">
                                    {breakdownBadges.length > 0 ? (
                                      breakdownBadges
                                    ) : (
                                      <span className="text-xs text-gray-400">
                                        Base score
                                      </span>
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
                      <p>
                        * Purple rows: Pre-assigned exercises (
                        {pool.preAssigned.length})
                      </p>
                      <p>
                        * Green rows: Smart bucketed selection (
                        {pool.totalExercisesNeeded - pool.preAssigned.length})
                      </p>
                      <p>
                        * Total needed: {pool.totalExercisesNeeded} exercises
                      </p>
                    </div>
                  </>
                </div>
              );
            })}

            {/* Shared Exercises Tab */}
            {activeTab === "shared" && (
              <div>
                <h3 className="mb-4 text-xl font-semibold">
                  Shared Exercise Pool ({blueprint.sharedExercisePool.length}{" "}
                  exercises)
                </h3>
                <p className="mb-4 text-gray-600">
                  These exercises can be performed by multiple clients and may
                  be selected to increase group cohesion.
                </p>

                {/* Sub-tabs for Other vs Exercise #3 */}
                <div className="mb-6">
                  <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                      <button
                        onClick={() => setSharedSubTab("other")}
                        className={`${
                          sharedSubTab === "other"
                            ? "border-indigo-500 text-indigo-600"
                            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                        } whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium`}
                      >
                        Other Shared Exercises (
                        {categorizedSharedExercises.other.length})
                      </button>
                      <button
                        onClick={() => setSharedSubTab("exercise3")}
                        className={`${
                          sharedSubTab === "exercise3"
                            ? "border-indigo-500 text-indigo-600"
                            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                        } whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium`}
                      >
                        Exercise #3 (Core)
                      </button>
                    </nav>
                  </div>
                </div>

                {/* Exercise #3 Content */}
                {sharedSubTab === "exercise3" ? (
                  <Exercise3Content 
                    groupContext={groupContext}
                    blueprint={blueprint}
                    clients={groupContext.clients}
                    formatMuscleName={formatMuscleName}
                  />
                ) : (
                  <>
                    {/* Smart Bucketing Analysis for Shared Pool */}
                    <div className="mb-6 rounded-lg bg-gray-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-gray-900">
                    Other Exercises Analysis
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Client Sharing Distribution */}
                    <div>
                      <h5 className="mb-2 text-xs font-medium text-gray-700">
                        Client Sharing
                      </h5>
                      <div className="space-y-1">
                        {(() => {
                          const currentExercises = categorizedSharedExercises.other;
                          const distribution = currentExercises.reduce(
                            (acc, ex) => {
                              const count = ex.clientsSharing.length;
                              const key = `${count} client${count > 1 ? "s" : ""}`;
                              acc[key] = (acc[key] || 0) + 1;
                              return acc;
                            },
                            {} as Record<string, number>,
                          );

                          return Object.entries(distribution)
                            .sort(([a], [b]) => parseInt(b) - parseInt(a))
                            .map(([sharing, count]) => (
                              <div
                                key={sharing}
                                className="flex justify-between text-xs"
                              >
                                <span className="text-gray-600">{sharing}</span>
                                <span className="font-medium text-gray-900">
                                  {count} exercises
                                </span>
                              </div>
                            ));
                        })()}
                      </div>
                    </div>

                    {/* Exercise #2 Constraints */}
                    <div>
                      <h5 className="mb-2 text-xs font-medium text-gray-700">
                        Exercise #2 Constraints
                      </h5>
                      <div className="space-y-2">
                        {groupContext.clients.map((client) => {
                          // Get Exercise #1 from pre-assigned
                          const clientPool = blueprint.clientExercisePools[client.user_id];
                          const exercise1 = clientPool?.preAssigned.find(p => p.source === "favorite" || p.source === "Favorite");
                          const isTargeted = client.workoutType?.includes("targeted");
                          
                          return (
                            <details key={client.user_id} className="group">
                              <summary className="cursor-pointer text-xs text-gray-700 hover:text-gray-900">
                                <span className="font-medium">{client.name.split(" ")[0]}</span>
                                <span className="ml-1 text-gray-500">
                                  ({isTargeted ? "Targeted" : "Full Body"})
                                </span>
                              </summary>
                              <div className="mt-1 ml-4 space-y-1 text-xs">
                                <div className="text-gray-600">
                                  <span className="font-medium">Type:</span> {isTargeted ? "Targeted" : "Full Body"}
                                </div>
                                {exercise1 && (
                                  <div className="text-gray-600">
                                    <span className="font-medium">Ex #1:</span> {exercise1.exercise.name}
                                    {exercise1.exercise.primaryMuscle && (
                                      <span className="text-gray-500"> ({formatMuscleName(exercise1.exercise.primaryMuscle)})</span>
                                    )}
                                  </div>
                                )}
                                <div className="text-gray-600">
                                  <span className="font-medium">Constraint:</span>{" "}
                                  {isTargeted ? (
                                    <span className="text-green-700">
                                      Must be: {client.muscle_target?.map(m => {
                                        const consolidated = mapMuscleToConsolidated(m);
                                        return formatMuscleName(consolidated);
                                      }).join(" or ") || "N/A"}
                                    </span>
                                  ) : (
                                    <span className="text-red-700">
                                      Cannot be: {exercise1?.exercise.primaryMuscle ? 
                                        formatMuscleName(mapMuscleToConsolidated(exercise1.exercise.primaryMuscle)) : "N/A"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Exercise Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Movement Pattern
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Primary Muscle
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Secondary Muscles
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Function Tags
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Group Score
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Clients
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {categorizedSharedExercises.other.map((exercise, idx) => {
                        // Check if this exercise was selected as pre-assigned for any client
                        const isSelected = Object.values(
                          blueprint.clientExercisePools,
                        ).some((pool) =>
                          pool.preAssigned.some(
                            (p) =>
                              p.exercise.id === exercise.id &&
                              p.source === "shared_other",
                          ),
                        );

                        return (
                          <tr
                            key={exercise.id}
                            className={isSelected ? "bg-blue-50" : ""}
                          >
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">
                              {exercise.name}
                              {isSelected && (
                                <span className="ml-2 inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                  Selected
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {formatMuscleName(exercise.movementPattern || "")}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {formatMuscleName(exercise.primaryMuscle || "")}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {exercise.secondaryMuscles &&
                              exercise.secondaryMuscles.length > 0
                                ? exercise.secondaryMuscles
                                    .map(formatMuscleName)
                                    .join(", ")
                                : "-"}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              <div className="flex flex-wrap gap-1">
                                {exercise.functionTags?.map((tag) => (
                                  <span
                                    key={tag}
                                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                                      tag === "core" || tag === "capacity"
                                        ? "bg-purple-100 text-purple-800"
                                        : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {tag}
                                  </span>
                                )) || "-"}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {exercise.groupScore.toFixed(1)}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              <div className="flex flex-wrap gap-1">
                                {exercise.clientsSharing.map((clientId) => {
                                  const client = groupContext.clients.find(
                                    (c) => c.user_id === clientId,
                                  );
                                  return (
                                    <span
                                      key={clientId}
                                      className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                                    >
                                      {client?.name || clientId}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                  </>
                )}
              </div>
            )}
                </div>
              </div>
            )}

            {/* Phase 2 Content */}
            {mainPhaseTab === "phase2" && (
              <div>
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Phase 2 - Preprocessed Data</h3>
                  <Phase2PreviewContent sessionId={groupContext.sessionId} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Delete Session?</h3>
            <p className="mb-6 text-gray-600">
              Are you sure you want to delete this session? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (groupContext.sessionId) {
                    deleteSessionMutation.mutate({ sessionId: groupContext.sessionId });
                  }
                }}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
