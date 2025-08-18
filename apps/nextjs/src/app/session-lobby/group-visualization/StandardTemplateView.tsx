"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type {
  GroupContext,
  StandardGroupWorkoutBlueprint,
} from "@acme/ai/client";
import type { ConsolidatedMuscle } from "@acme/ai/client";
import {
  BUCKET_CONFIGS,
  categorizeSharedExercises,
  getOldMusclesForConsolidated,
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
}

// Helper to format muscle names
function formatMuscleName(muscle: string): string {
  return muscle.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
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
}: StandardTemplateViewProps) {
  // Log what data we're receiving
  React.useEffect(() => {
    console.log("🎯 STANDARD TEMPLATE VIEW RENDERED:", {
      isFromSavedData,
      hasBlueprint: !!blueprint,
      hasClientPools: !!blueprint?.clientExercisePools,
      timestamp: new Date().toISOString(),
    });

    if (blueprint?.clientExercisePools) {
      Object.entries(blueprint.clientExercisePools).forEach(
        ([clientId, pool]: [string, any]) => {
          console.log(`  Client ${clientId} in StandardTemplateView:`, {
            hasBucketedSelection: !!pool.bucketedSelection,
            bucketedExerciseCount:
              pool.bucketedSelection?.exercises?.length || 0,
            bucketedExercises:
              pool.bucketedSelection?.exercises
                ?.map((e: any) => e.name)
                .slice(0, 5) || "NONE",
          });
        },
      );
    }
  }, [blueprint, isFromSavedData]);

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
  const [sharedSubTab, setSharedSubTab] = useState<"coreFinisher" | "other">(
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
              Exercise pools for {summary.totalClients} clients
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
          </div>
        </div>

        {/* Tabs */}
        <div className="rounded-lg bg-white shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              {allTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 text-sm font-medium ${
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

          <div className="p-6">
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

                  {/* LLM System Prompt & Output - Only show if we have LLM debug data for this client */}
                  {llmDebugData?.systemPromptsByClient?.[clientTab.id] && (
                    <div className="mb-6 rounded-lg bg-blue-50 p-4">
                      <h4 className="mb-4 text-sm font-semibold text-gray-900">
                        🤖 LLM System Prompt & Output
                      </h4>

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
                                                assignment.bucketType ===
                                                "movement_pattern"
                                                  ? "bg-purple-100 text-purple-800"
                                                  : assignment.bucketType ===
                                                      "functional"
                                                    ? "bg-indigo-100 text-indigo-800"
                                                    : "bg-gray-100 text-gray-800"
                                              }`}
                                            >
                                              {assignment.constraint.replace(
                                                /_/g,
                                                " ",
                                              )}
                                            </span>
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

                {/* Sub-tabs for Core & Finisher vs Other */}
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
                        onClick={() => setSharedSubTab("coreFinisher")}
                        className={`${
                          sharedSubTab === "coreFinisher"
                            ? "border-indigo-500 text-indigo-600"
                            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                        } whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium`}
                      >
                        Core & Finisher (
                        {categorizedSharedExercises.coreAndFinisher.length})
                      </button>
                    </nav>
                  </div>
                </div>

                {/* Smart Bucketing Analysis for Shared Pool */}
                <div className="mb-6 rounded-lg bg-gray-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-gray-900">
                    {sharedSubTab === "coreFinisher"
                      ? "Core & Finisher"
                      : "Other Exercises"}{" "}
                    Analysis
                  </h4>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Movement Pattern Distribution */}
                    <div>
                      <h5 className="mb-2 text-xs font-medium text-gray-700">
                        Movement Patterns
                      </h5>
                      <div className="space-y-1">
                        {(() => {
                          const currentExercises =
                            sharedSubTab === "coreFinisher"
                              ? categorizedSharedExercises.coreAndFinisher
                              : categorizedSharedExercises.other;
                          const patterns = currentExercises.reduce(
                            (acc, ex) => {
                              const pattern = ex.movementPattern || "unknown";
                              acc[pattern] = (acc[pattern] || 0) + 1;
                              return acc;
                            },
                            {} as Record<string, number>,
                          );

                          return Object.entries(patterns)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 5)
                            .map(([pattern, count]) => (
                              <div
                                key={pattern}
                                className="flex justify-between text-xs"
                              >
                                <span className="text-gray-600">
                                  {formatMuscleName(pattern)}
                                </span>
                                <span className="font-medium text-gray-900">
                                  {count}
                                </span>
                              </div>
                            ));
                        })()}
                      </div>
                    </div>

                    {/* Client Sharing Distribution */}
                    <div>
                      <h5 className="mb-2 text-xs font-medium text-gray-700">
                        Client Sharing
                      </h5>
                      <div className="space-y-1">
                        {(() => {
                          const currentExercises =
                            sharedSubTab === "coreFinisher"
                              ? categorizedSharedExercises.coreAndFinisher
                              : categorizedSharedExercises.other;
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

                    {/* Selection Strategy */}
                    <div>
                      <h5 className="mb-2 text-xs font-medium text-gray-700">
                        Selection Priority
                      </h5>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>1. Take top 2 per movement pattern</p>
                        <p>2. Ensure 3-5 per function type</p>
                        <p>3. Verify muscle diversity</p>
                        <p className="mt-2 font-medium text-gray-900">
                          Target:{" "}
                          {Math.floor(
                            (sharedSubTab === "coreFinisher"
                              ? categorizedSharedExercises.coreAndFinisher
                                  .length
                              : categorizedSharedExercises.other.length) * 0.4,
                          )}{" "}
                          exercises (40%)
                        </p>
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
                      {(sharedSubTab === "coreFinisher"
                        ? categorizedSharedExercises.coreAndFinisher
                        : categorizedSharedExercises.other
                      ).map((exercise, idx) => {
                        // Check if this exercise was selected as pre-assigned for any client
                        const isSelected = Object.values(
                          blueprint.clientExercisePools,
                        ).some((pool) =>
                          pool.preAssigned.some(
                            (p) =>
                              p.exercise.id === exercise.id &&
                              (sharedSubTab === "coreFinisher"
                                ? p.source === "shared_core_finisher" ||
                                  p.source === "finisher"
                                : p.source === "shared_other"),
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
