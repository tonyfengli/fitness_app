"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { GroupScoredExercise } from "@acme/ai/client";

import { useGenerateGroupWorkout } from "~/hooks/useGenerateGroupWorkout";
import { useGroupWorkoutBlueprint } from "~/hooks/useGroupWorkoutBlueprint";
import { useTRPC } from "~/trpc/react";
import StandardTemplateView from "./StandardTemplateView";

// Constants
const SCORE_THRESHOLDS = {
  TARGET_PRIMARY: 3.0,
  TARGET_SECONDARY: 1.5,
  INTENSITY_HIGH: 1.0, // was 1.5
  INTENSITY_MODERATE: 0.5, // was 0.75
} as const;

// Helper to format muscle names for display (convert underscore to space and capitalize)
function formatMuscleName(muscle: string): string {
  return muscle.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// Helper function to determine score adjustment labels
function getScoreAdjustmentLabels(
  score: number,
  scoreBreakdown?: any,
): React.ReactElement | React.ReactElement[] | null {
  // If we have the actual breakdown, use it
  if (scoreBreakdown) {
    const labels: React.ReactElement[] = [];

    if (scoreBreakdown.includeExerciseBoost > 0) {
      labels.push(
        <span
          key="include"
          className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800"
        >
          Include +{scoreBreakdown.includeExerciseBoost.toFixed(1)}
        </span>,
      );
    }

    if (scoreBreakdown.favoriteExerciseBoost > 0) {
      labels.push(
        <span
          key="favorite"
          className="inline-flex items-center rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800"
        >
          ⭐ Favorite +{scoreBreakdown.favoriteExerciseBoost.toFixed(1)}
        </span>,
      );
    }

    if (scoreBreakdown.muscleTargetBonus > 0) {
      const isPrimary =
        scoreBreakdown.muscleTargetBonus >= SCORE_THRESHOLDS.TARGET_PRIMARY;
      labels.push(
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
      const isPrimary = scoreBreakdown.muscleLessenPenalty <= -3.0;
      labels.push(
        <span
          key="lessen"
          className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800"
        >
          Lessen {isPrimary ? "" : "(2nd)"}{" "}
          {scoreBreakdown.muscleLessenPenalty.toFixed(1)}
        </span>,
      );
    }

    if (scoreBreakdown.intensityAdjustment > 0) {
      labels.push(
        <span
          key="intensity"
          className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800"
        >
          Intensity +{scoreBreakdown.intensityAdjustment.toFixed(2)}
        </span>,
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
    if (isClose(absDiff, 4.0)) {
      // 3.0 (target primary) + 1.0 (intensity)
      return (
        <>
          <span className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
            Target +3.0
          </span>
          <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
            Intensity +1.0
          </span>
        </>
      );
    } else if (isClose(absDiff, 3.5)) {
      // 3.0 (target primary) + 0.5 (intensity)
      return (
        <>
          <span className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
            Target +3.0
          </span>
          <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
            Intensity +0.5
          </span>
        </>
      );
    } else if (isClose(absDiff, 3.0)) {
      // Include exercise boost or target primary
      if (score >= 8.0) {
        return (
          <span className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800">
            Include +{diff.toFixed(1)}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
          Target +3.0
        </span>
      );
    } else if (isClose(absDiff, 2.0)) {
      // 1.5 (target secondary) + 0.5 (intensity)
      return (
        <>
          <span className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
            Target +1.5
          </span>
          <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
            Intensity +0.5
          </span>
        </>
      );
    } else if (isClose(absDiff, 1.5)) {
      return (
        <span className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
          Target +1.5
        </span>
      );
    } else if (isClose(absDiff, 0.5)) {
      return (
        <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
          Intensity +0.5
        </span>
      );
    } else if (isClose(absDiff, 1.0)) {
      return (
        <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
          Intensity +1.0
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-800">
          +{diff.toFixed(2)}
        </span>
      );
    }
  } else if (diff < 0) {
    // Negative adjustments (only from muscle lessen now, no negative intensity)
    if (isClose(absDiff, 3.0)) {
      return (
        <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
          Lessen -3.0
        </span>
      );
    } else if (isClose(absDiff, 1.5)) {
      return (
        <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
          Lessen -1.5
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-800">
          {diff.toFixed(2)}
        </span>
      );
    }
  }

  return null;
}

function GroupVisualizationPageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const router = useRouter();

  const [selectedBlock, setSelectedBlock] = useState<string>("");
  const [showRawData, setShowRawData] = useState(false);
  const [llmDebugData, setLlmDebugData] = useState<{
    systemPrompt: string | null;
    userMessage: string | null;
    llmOutput: string | null;
    systemPromptsByClient?: Record<string, string>;
    llmResponsesByClient?: Record<string, string>;
  }>({ systemPrompt: null, userMessage: null, llmOutput: null });
  const [activeTab, setActiveTab] = useState<string>("");
  const trpc = useTRPC();

  // Fetch session details to check status
  const { data: sessionData } = useQuery({
    ...trpc.trainingSession.getById.queryOptions({ id: sessionId || "" }),
    enabled: !!sessionId,
  });

  // Check for saved visualization data first
  const savedDataQuery = useQuery({
    ...trpc.trainingSession.getSavedVisualizationData.queryOptions({
      sessionId: sessionId || "",
    }),
    enabled: !!sessionId,
    onSuccess: (data) => {
      console.log("🔍 SAVED DATA LOADED SUCCESS:", {
        sessionId,
        sessionStatus: sessionData?.status,
        dataReceived: data,
        hasSavedData: !!data,
        hasBlueprint: !!data?.blueprint,
        hasClientPools: !!data?.blueprint?.clientExercisePools,
        clientPoolKeys: data?.blueprint?.clientExercisePools
          ? Object.keys(data.blueprint.clientExercisePools)
          : [],
        hasBucketedSelection: data?.blueprint?.clientExercisePools
          ? Object.values(data.blueprint.clientExercisePools).some(
              (pool: any) => !!pool.bucketedSelection,
            )
          : false,
        hasLlmResult: !!data?.llmResult,
        llmResultKeys: data?.llmResult ? Object.keys(data.llmResult) : [],
        llmResultDebug: data?.llmResult?.debug || "NO DEBUG DATA",
      });
      if (data?.blueprint?.clientExercisePools) {
        Object.entries(data.blueprint.clientExercisePools).forEach(
          ([clientId, pool]: [string, any]) => {
            console.log(`  Client ${clientId} saved pool structure:`, {
              hasPreAssigned: !!pool.preAssigned,
              preAssignedCount: pool.preAssigned?.length || 0,
              hasAvailableCandidates: !!pool.availableCandidates,
              availableCandidatesCount: pool.availableCandidates?.length || 0,
              hasBucketedSelection: !!pool.bucketedSelection,
              bucketedExerciseCount:
                pool.bucketedSelection?.exercises?.length || 0,
              bucketedExerciseNames:
                pool.bucketedSelection?.exercises
                  ?.map((e: any) => e.name)
                  .slice(0, 5) || "NO BUCKETED SELECTION",
            });
          },
        );
      }

      // Additional debug for completed sessions
      if (sessionData?.status === "completed") {
        console.log("📊 COMPLETED SESSION DATA CHECK:", {
          hasData: !!data,
          dataStructure: data ? Object.keys(data) : "NO DATA",
          rawData: data,
        });
      }
    },
    onError: (error) => {
      console.error("❌ SAVED DATA QUERY ERROR:", {
        sessionId,
        sessionStatus: sessionData?.status,
        error: error.message,
        fullError: error,
      });
    },
  });

  // Save visualization mutation
  const saveVisualizationMutation = useMutation({
    ...trpc.trainingSession.saveVisualizationData.mutationOptions(),
  });

  // Use the blueprint hook for fetching visualization data
  const blueprintQuery = useGroupWorkoutBlueprint({
    sessionId,
    includeDiagnostics: true,
    phase1Only: true, // Only run Phase 1 for visualization
    enabled: !!sessionId && !savedDataQuery.data && sessionData?.status !== "completed", // Only fetch if no saved data AND session is not completed
    onSuccess: (data) => {
      console.log("🔨 NEW BLUEPRINT GENERATED:", {
        reason: savedDataQuery.data
          ? "Should not happen - saved data exists!"
          : "No saved data found",
        hasBlueprint: !!data?.blueprint,
        hasClientPools: !!data?.blueprint?.clientExercisePools,
        hasLlmResult: !!data?.llmResult,
        llmResultKeys: data?.llmResult ? Object.keys(data.llmResult) : [],
        hasDebug: !!data?.llmResult?.debug,
        debugKeys: data?.llmResult?.debug
          ? Object.keys(data.llmResult.debug)
          : [],
        timestamp: new Date().toISOString(),
      });

      if (data?.llmResult) {
        console.log("🎉 LLM Result in blueprint query:", {
          llmResultKeys: Object.keys(data.llmResult),
          hasDebug: !!data.llmResult.debug,
          debugStructure: data.llmResult.debug || "NO DEBUG PROPERTY",
          fullLlmResult: data.llmResult,
        });

        if (data.llmResult.debug) {
          console.log("🔍 LLM Debug data structure:", {
            systemPromptsByClient: Object.keys(
              data.llmResult.debug.systemPromptsByClient || {},
            ),
            llmResponsesByClient: Object.keys(
              data.llmResult.debug.llmResponsesByClient || {},
            ),
          });
        }
      }

      if (data?.blueprint?.clientExercisePools) {
        Object.entries(data.blueprint.clientExercisePools).forEach(
          ([clientId, pool]: [string, any]) => {
            console.log(
              `  Client ${clientId} NEW bucketed exercises:`,
              pool.bucketedSelection?.exercises?.map((e: any) => e.name) ||
                "NO BUCKETED SELECTION",
            );
          },
        );
      }
    },
  });

  // Use the generation hook for creating workouts
  const {
    generateWorkout,
    isGenerating,
    data: generationData,
  } = useGenerateGroupWorkout({
    sessionId: sessionId || "",
    navigateOnSuccess: false, // Stay on visualization page
    includeDiagnostics: true,
    showToasts: true,
    onSuccess: (data) => {
      console.log("Workout generation response:", data);

      // Update the debug data
      if (data.debug) {
        console.log("=== WORKOUT GENERATION SYSTEM PROMPT ===");
        console.log(data.debug.systemPrompt);
        console.log("=== END SYSTEM PROMPT ===");

        setLlmDebugData({
          systemPrompt: data.debug.systemPrompt,
          userMessage: data.debug.userMessage,
          llmOutput: data.debug.llmOutput,
          systemPromptsByClient: data.debug.systemPromptsByClient,
          llmResponsesByClient: data.debug.llmResponsesByClient,
        });
      } else {
        console.log(
          "No debug data included in response. Make sure includeDiagnostics is set to true.",
        );
      }
    },
  });

  // Extract data for easier access - prefer saved data if available
  const isLoading =
    savedDataQuery.isLoading ||
    blueprintQuery.isLoading ||
    blueprintQuery.isFetching;
  const error = savedDataQuery.error || blueprintQuery.error;

  // Use saved data if available, otherwise use fresh blueprint data
  const data = savedDataQuery.data
    ? savedDataQuery.data
    : blueprintQuery.blueprint &&
        blueprintQuery.groupContext &&
        blueprintQuery.summary
      ? {
          blueprint: blueprintQuery.blueprint,
          groupContext: blueprintQuery.groupContext,
          summary: blueprintQuery.summary,
          llmResult: blueprintQuery.llmResult,
        }
      : null;

  // Debug logging for data resolution
  useEffect(() => {
    console.log("📊 DATA RESOLUTION DEBUG:", {
      sessionId,
      sessionStatus: sessionData?.status,
      savedDataQueryStatus: {
        isLoading: savedDataQuery.isLoading,
        isError: savedDataQuery.isError,
        isSuccess: savedDataQuery.isSuccess,
        hasData: !!savedDataQuery.data,
        error: savedDataQuery.error?.message,
        fullError: savedDataQuery.error,
      },
      blueprintQueryStatus: {
        enabled: !!sessionId && !savedDataQuery.data && sessionData?.status !== "completed",
        isLoading: blueprintQuery.isLoading,
        isError: blueprintQuery.error,
        hasBlueprint: !!blueprintQuery.blueprint,
      },
      resolvedData: {
        hasData: !!data,
        dataSource: savedDataQuery.data ? "savedData" : blueprintQuery.blueprint ? "blueprintQuery" : "none",
      },
      willShowEmptyState: !data && sessionData?.status === "completed",
    });
  }, [sessionId, sessionData?.status, savedDataQuery.isLoading, savedDataQuery.isError, savedDataQuery.data, blueprintQuery.isLoading, blueprintQuery.error, blueprintQuery.blueprint, data]);

  // Update LLM debug data when blueprint loads with LLM result
  useEffect(() => {
    console.log("🔄 Checking llmResult for debug data:", {
      hasLlmResult: !!data?.llmResult,
      hasError: !!data?.llmResult?.error,
      hasDebug: !!data?.llmResult?.debug,
      debugKeys: data?.llmResult?.debug
        ? Object.keys(data.llmResult.debug)
        : [],
    });

    if (data?.llmResult && !data.llmResult.error) {
      // Check if debug data is nested inside llmResult.debug
      if (data.llmResult.debug) {
        console.log("✅ Found debug data in llmResult.debug");
        setLlmDebugData({
          systemPrompt: data.llmResult.systemPrompt || null,
          userMessage: data.llmResult.userMessage || null,
          llmOutput: data.llmResult.llmOutput || null,
          systemPromptsByClient: data.llmResult.debug.systemPromptsByClient,
          llmResponsesByClient: data.llmResult.debug.llmResponsesByClient,
        });
      } else {
        // Fallback to direct properties (old format)
        console.log("⚠️ No debug property, checking direct properties");
        setLlmDebugData({
          systemPrompt: data.llmResult.systemPrompt || null,
          userMessage: data.llmResult.userMessage || null,
          llmOutput: data.llmResult.llmOutput || null,
          systemPromptsByClient: data.llmResult.systemPromptsByClient,
          llmResponsesByClient: data.llmResult.llmResponsesByClient,
        });
      }
    }
  }, [data?.llmResult]);

  // Save visualization data when blueprint is generated (not from saved data)
  useEffect(() => {
    if (
      blueprintQuery.blueprint &&
      blueprintQuery.groupContext &&
      !savedDataQuery.data &&
      sessionId
    ) {
      console.log("💾 SAVING VISUALIZATION DATA:", {
        hasBlueprint: !!blueprintQuery.blueprint,
        hasClientPools: !!blueprintQuery.blueprint?.clientExercisePools,
        hasBucketedSelections: blueprintQuery.blueprint?.clientExercisePools
          ? Object.values(blueprintQuery.blueprint.clientExercisePools).every(
              (pool: any) => !!pool.bucketedSelection,
            )
          : false,
      });

      // Deep log the blueprint structure before saving
      if (blueprintQuery.blueprint?.clientExercisePools) {
        Object.entries(blueprintQuery.blueprint.clientExercisePools).forEach(
          ([clientId, pool]: [string, any]) => {
            console.log(`  💾 Client ${clientId} data to save:`, {
              preAssignedCount: pool.preAssigned?.length || 0,
              availableCandidatesCount: pool.availableCandidates?.length || 0,
              hasBucketedSelection: !!pool.bucketedSelection,
              bucketedExerciseCount:
                pool.bucketedSelection?.exercises?.length || 0,
              firstBucketedExercises:
                pool.bucketedSelection?.exercises
                  ?.slice(0, 3)
                  .map((e: any) => e.name) || "NONE",
            });
          },
        );
      }

      // Log llmResult structure before saving
      console.log("📦 LLM Result structure before saving:", {
        hasLlmResult: !!blueprintQuery.llmResult,
        llmResultKeys: blueprintQuery.llmResult
          ? Object.keys(blueprintQuery.llmResult)
          : [],
        hasDebug: !!blueprintQuery.llmResult?.debug,
        debugKeys: blueprintQuery.llmResult?.debug
          ? Object.keys(blueprintQuery.llmResult.debug)
          : [],
        systemPromptsByClientKeys: blueprintQuery.llmResult?.debug
          ?.systemPromptsByClient
          ? Object.keys(blueprintQuery.llmResult.debug.systemPromptsByClient)
          : [],
      });

      // Prepare the data to save - save the complete blueprint including bucketedSelection
      const visualizationData = {
        blueprint: blueprintQuery.blueprint, // This includes clientExercisePools with bucketedSelection
        groupContext: blueprintQuery.groupContext,
        llmResult: blueprintQuery.llmResult,
        summary: blueprintQuery.summary,
      };

      // Save the visualization data
      saveVisualizationMutation.mutate({
        sessionId,
        visualizationData,
      });
    }
  }, [
    blueprintQuery.blueprint,
    blueprintQuery.groupContext,
    savedDataQuery.data,
    sessionId,
  ]);

  // Set default selected block when data loads (only for BMF blueprints)
  useEffect(() => {
    if (
      data &&
      data.blueprint.blocks &&
      data.blueprint.blocks.length > 0 &&
      !selectedBlock
    ) {
      setSelectedBlock(data.blueprint.blocks[0].blockId);
    }
  }, [data, selectedBlock]);

  // Extract debug data from llmResult if available (must be before early returns)
  const effectiveLlmDebugData = React.useMemo(() => {
    // If we have debug data from generateWorkout, use that
    if (
      llmDebugData.systemPromptsByClient ||
      llmDebugData.llmResponsesByClient
    ) {
      console.log("🎯 Using debug data from generateWorkout");
      return llmDebugData;
    }

    // Log what we're receiving
    console.log("🔍 Checking for debug data in llmResult:", {
      hasData: !!data,
      hasLlmResult: !!data?.llmResult,
      llmResultType: typeof data?.llmResult,
      llmResultKeys: data?.llmResult ? Object.keys(data.llmResult) : [],
      hasDebug: !!data?.llmResult?.debug,
      debugType: typeof data?.llmResult?.debug,
      debugKeys: data?.llmResult?.debug
        ? Object.keys(data.llmResult.debug)
        : [],
    });

    // Otherwise, try to extract from llmResult if data is available
    if (data?.llmResult?.debug) {
      console.log("📊 Extracting debug data from llmResult:", {
        hasSystemPromptsByClient: !!data.llmResult.debug.systemPromptsByClient,
        hasLlmResponsesByClient: !!data.llmResult.debug.llmResponsesByClient,
        clientIds: Object.keys(
          data.llmResult.debug.systemPromptsByClient || {},
        ),
      });

      return {
        ...llmDebugData,
        systemPromptsByClient: data.llmResult.debug.systemPromptsByClient,
        llmResponsesByClient: data.llmResult.debug.llmResponsesByClient,
      };
    }

    console.log("⚠️ No debug data found in llmResult");
    return llmDebugData;
  }, [llmDebugData, data]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            No Session Selected
          </h1>
          <p className="mt-2 text-gray-600">
            Please select a session from the sessions page.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-lg font-medium text-gray-900">
            {sessionData?.status === "completed" ? "Loading Session Data" : "Generating Workout Blueprint"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {sessionData?.status === "completed" ? "Fetching visualization data..." : "This includes exercise selection and AI organization"}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">
            Error Loading Data
          </h1>
          <p className="mt-2 text-gray-600">
            {error?.message || "Failed to load group workout visualization"}
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 rounded-lg bg-gray-200 px-4 py-2 hover:bg-gray-300"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // For completed sessions without data, show empty state
  if (!data && sessionData?.status === "completed") {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Completed Session
              </h1>
              <p className="mt-1 text-lg text-gray-600">
                No visualization data available for this session
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`/workout-overview?sessionId=${sessionId}`}
                className="inline-block rounded-lg bg-green-600 px-4 py-2 text-center text-white hover:bg-green-700"
              >
                View Workouts
              </a>
              <button
                onClick={() => router.push("/sessions")}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Back to Sessions
              </button>
            </div>
          </div>
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500">
              This session was completed without saving visualization data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // For non-completed sessions without data, show error
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">
            No Data Available
          </h1>
          <p className="mt-2 text-gray-600">
            Unable to load workout visualization data
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 rounded-lg bg-gray-200 px-4 py-2 hover:bg-gray-300"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { groupContext, blueprint, summary } = data;
  const selectedBlockData = blueprint.blocks?.find(
    (b) => b.blockId === selectedBlock,
  );

  // Detect blueprint type
  const isStandardBlueprint = !!(blueprint as any).clientExercisePools;

  // For standard blueprints, use the StandardTemplateView
  if (isStandardBlueprint) {
    return (
      <StandardTemplateView
        groupContext={groupContext}
        blueprint={blueprint}
        summary={summary}
        generateWorkout={generateWorkout}
        isGenerating={isGenerating}
        router={router}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        llmDebugData={effectiveLlmDebugData}
        llmResult={data.llmResult}
        sessionData={sessionData}
        isFromSavedData={!!savedDataQuery.data}
        isSaving={saveVisualizationMutation.isPending}
      />
    );
  }

  // For BMF blueprints, use the existing view
  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
        {/* Header */}
        <div className="mb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Group Workout Visualization
              </h1>
              <p className="text-sm text-gray-600">
                Phase A & B Results for {summary.totalClients} clients
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => generateWorkout()}
                disabled={isGenerating}
                className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? "Generating..." : "Test LLM Generation"}
              </button>
              <div className="flex gap-2">
                <Link
                  href={`/workout-overview?sessionId=${sessionId}`}
                  className="inline-block rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
                >
                  View Workouts
                </Link>
                <Link
                  href={`/preferences?sessionId=${sessionId}`}
                  className="inline-block rounded-md bg-purple-600 px-3 py-1 text-sm text-white transition-colors hover:bg-purple-700"
                >
                  View Preferences
                </Link>
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
          <div className="mb-2 flex-shrink-0 rounded border border-yellow-200 bg-yellow-50 p-2 text-xs">
            <span className="font-medium text-yellow-800">Warnings:</span>
            <span className="ml-2 text-yellow-700">
              {summary.cohesionWarnings.join(", ")}
            </span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Client Overview */}
          <div className="mb-1 flex-shrink-0">
            <div className="mb-1 flex items-center justify-between">
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
                const clientExercises =
                  selectedBlockData?.individualCandidates[client.user_id]
                    ?.exercises || [];

                return (
                  <div
                    key={client.user_id}
                    className="rounded border border-gray-200 bg-white p-2 text-[9px]"
                  >
                    <div className="flex items-start gap-2">
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.user_id}`}
                        alt={client.name}
                        className="h-5 w-5 flex-shrink-0 rounded-full"
                      />
                      <div className="grid flex-1 grid-cols-2 gap-2">
                        {/* Left column: Client info and preferences */}
                        <div>
                          <h4 className="mb-1 text-[10px] font-medium text-gray-900">
                            {client.name}
                          </h4>
                          <div className="space-y-0">
                            {groupContext.workoutType && (
                              <p className="leading-tight text-gray-600">
                                <span className="font-medium">
                                  Workout Type:
                                </span>{" "}
                                {groupContext.workoutType
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (l) => l.toUpperCase())}
                              </p>
                            )}
                            {client.intensity && (
                              <p className="leading-tight text-gray-600">
                                <span className="font-medium">Intensity:</span>{" "}
                                {client.intensity}
                              </p>
                            )}
                            {client.muscle_target &&
                              client.muscle_target.length > 0 && (
                                <p className="leading-tight text-gray-600">
                                  <span className="font-medium">Target:</span>{" "}
                                  {client.muscle_target
                                    .map(formatMuscleName)
                                    .join(", ")}
                                </p>
                              )}
                            {client.muscle_lessen &&
                              client.muscle_lessen.length > 0 && (
                                <p className="leading-tight text-gray-600">
                                  <span className="font-medium">Lessen:</span>{" "}
                                  {client.muscle_lessen
                                    .map(formatMuscleName)
                                    .join(", ")}
                                </p>
                              )}
                            {client.exercise_requests?.include &&
                              client.exercise_requests.include.length > 0 && (
                                <p className="leading-tight text-green-600">
                                  <span className="font-medium">Include:</span>{" "}
                                  {client.exercise_requests.include.join(", ")}
                                </p>
                              )}
                            {client.exercise_requests?.avoid &&
                              client.exercise_requests.avoid.length > 0 && (
                                <p className="leading-tight text-red-600">
                                  <span className="font-medium">Exclude:</span>{" "}
                                  {client.exercise_requests.avoid.join(", ")}
                                </p>
                              )}
                            {client.avoid_joints &&
                              client.avoid_joints.length > 0 && (
                                <p className="leading-tight text-orange-600">
                                  <span className="font-medium">
                                    Avoid Joints:
                                  </span>{" "}
                                  {client.avoid_joints.join(", ")}
                                </p>
                              )}
                          </div>
                        </div>

                        {/* Right column: Exercises for selected block */}
                        <div className="border-l pl-2">
                          <h5 className="mb-1 text-[9px] font-medium text-gray-700">
                            {selectedBlock} Options:
                          </h5>
                          <div className="space-y-0.5">
                            {clientExercises
                              .slice(0, 5)
                              .map((exercise, idx) => {
                                const isClientRequest =
                                  exercise.scoreBreakdown
                                    ?.includeExerciseBoost > 0;
                                const isTopChoice = idx === 0;

                                return (
                                  <p
                                    key={exercise.id}
                                    className={`leading-tight ${
                                      isTopChoice
                                        ? "font-medium text-indigo-700"
                                        : isClientRequest
                                          ? "text-green-700"
                                          : "text-gray-600"
                                    }`}
                                  >
                                    {idx + 1}. {exercise.name}
                                    <span className="ml-1 text-gray-400">
                                      ({exercise.score.toFixed(1)})
                                    </span>
                                    {isClientRequest && (
                                      <span className="ml-1 text-[8px] text-green-600">
                                        ✓
                                      </span>
                                    )}
                                  </p>
                                );
                              })}
                            {clientExercises.length === 0 && (
                              <p className="italic text-gray-400">
                                No exercises available
                              </p>
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
                    className={`border-b-2 px-1 py-1 text-sm font-medium ${
                      selectedBlock === block.blockId
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
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
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
              {/* LLM Debug Section */}
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <div className="space-y-4">
                  {/* System Prompt */}
                  <details className="rounded-lg border border-gray-200 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                      System Prompt Step 1: Group Workout Assignment (Rounds 3 &
                      4)
                    </summary>
                    <div className="mt-2 rounded-md bg-gray-50 p-3">
                      <pre className="whitespace-pre-wrap font-mono text-xs text-gray-600">
                        {llmDebugData.systemPrompt || (
                          <span className="text-gray-400">
                            Click "Test LLM Generation" to see the dynamic
                            prompt based on session data
                          </span>
                        )}
                      </pre>
                    </div>
                  </details>

                  {/* LLM Output */}
                  <details className="rounded-lg border border-gray-200 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                      LLM Output
                    </summary>
                    <div className="mt-2 rounded-md bg-gray-50 p-3">
                      <pre className="whitespace-pre-wrap font-mono text-xs text-gray-600">
                        {llmDebugData.llmOutput || (
                          <span className="text-gray-400">
                            Click "Test LLM Generation" to see the LLM response
                          </span>
                        )}
                      </pre>
                    </div>
                  </details>
                </div>
              </div>

              {/* Exercise Table View */}
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-base font-medium text-gray-900">
                  {selectedBlock} Exercises
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-64 min-w-[16rem] px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Shared (
                          {selectedBlockData.slots.actualSharedAvailable})
                        </th>
                        {groupContext.clients.map((client) => {
                          const clientName = client.name.split(" ")[0]; // First name only
                          return (
                            <th
                              key={client.user_id}
                              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                            >
                              {clientName} (Top 6)
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {/* Calculate max rows needed */}
                      {(() => {
                        // Calculate max rows based on all filtered exercises, not just top candidates
                        const maxRows = Math.max(
                          selectedBlockData.sharedCandidates?.exercises
                            ?.length || 0,
                          ...groupContext.clients.map((client) => {
                            const clientData =
                              selectedBlockData.individualCandidates?.[
                                client.user_id
                              ];
                            return (
                              clientData?.allFilteredExercises?.length ||
                              clientData?.exercises?.length ||
                              0
                            );
                          }),
                        );

                        return Array.from(
                          { length: maxRows },
                          (_, rowIndex) => {
                            const sharedExercise =
                              selectedBlockData.sharedCandidates?.exercises?.[
                                rowIndex
                              ];

                            return (
                              <tr key={rowIndex}>
                                {/* Shared Exercise Column */}
                                <td className="px-3 py-2 text-sm">
                                  {sharedExercise ? (
                                    <div className="rounded border border-gray-200 p-3">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-2">
                                            <span className="text-sm font-medium text-gray-900">
                                              #{rowIndex + 1}
                                            </span>
                                            <h4 className="text-sm font-medium text-gray-900">
                                              {sharedExercise.name}
                                            </h4>
                                          </div>
                                          <div className="mt-1 flex items-center space-x-3 text-xs">
                                            <span className="text-gray-500">
                                              Score:{" "}
                                              <span className="font-medium text-gray-900">
                                                {sharedExercise.groupScore.toFixed(
                                                  2,
                                                )}
                                              </span>
                                            </span>
                                            <span className="text-blue-600">
                                              {
                                                sharedExercise.clientsSharing
                                                  .length
                                              }{" "}
                                              clients
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {sharedExercise.clientScores.map(
                                          (cs) => {
                                            const client =
                                              groupContext.clients.find(
                                                (c) =>
                                                  c.user_id === cs.clientId,
                                              );
                                            const clientName =
                                              client?.name || cs.clientId;
                                            const firstName =
                                              clientName.split(" ")[0];
                                            return (
                                              <div
                                                key={cs.clientId}
                                                className={`rounded px-1 py-0.5 text-xs ${
                                                  cs.hasExercise
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-gray-100 text-gray-500"
                                                }`}
                                              >
                                                {firstName}:{" "}
                                                {cs.individualScore.toFixed(2)}
                                              </div>
                                            );
                                          },
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-gray-300">-</div>
                                  )}
                                </td>

                                {/* Client Exercise Columns */}
                                {groupContext.clients.map((client) => {
                                  const clientData =
                                    selectedBlockData.individualCandidates?.[
                                      client.user_id
                                    ];
                                  const allExercises =
                                    clientData?.allFilteredExercises ||
                                    clientData?.exercises ||
                                    [];
                                  const clientExercise = allExercises[rowIndex];
                                  const isCandidate =
                                    rowIndex <
                                    (clientData?.exercises?.length || 0);

                                  return (
                                    <td
                                      key={client.user_id}
                                      className="whitespace-nowrap px-3 py-2 text-sm"
                                    >
                                      {clientExercise ? (
                                        <div
                                          className={`${isCandidate ? "-m-2 rounded-md border-2 border-blue-500 p-2" : ""}`}
                                        >
                                          <div className="font-medium text-gray-900">
                                            {rowIndex + 1}.{" "}
                                            {clientExercise.name}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            Score:{" "}
                                            {clientExercise.score.toFixed(2)}
                                            {/* Show score adjustments as tags */}
                                            {clientExercise.score !== 5.0 && (
                                              <div className="mt-1 flex flex-wrap gap-1">
                                                {getScoreAdjustmentLabels(
                                                  clientExercise.score,
                                                  clientExercise.scoreBreakdown,
                                                )}
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
                          },
                        );
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
            <div className="mt-2 max-h-32 overflow-auto rounded bg-gray-100 p-2 text-xs">
              <pre>{JSON.stringify({ groupContext, blueprint }, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GroupVisualizationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading group visualization...</p>
          </div>
        </div>
      }
    >
      <GroupVisualizationPageContent />
    </Suspense>
  );
}
