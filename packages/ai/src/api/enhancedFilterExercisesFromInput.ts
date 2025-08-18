import { v4 as uuidv4 } from "uuid";

import type { FilterCriteria } from "../core/filtering/types";
import type {
  ClientContext,
  WorkoutSessionStateType,
  WorkoutTemplate,
} from "../types";
import type { ScoredExercise } from "../types/scoredExercise";
import type {
  EnhancedFilterDebugData,
  WorkoutGenerationLog,
} from "../utils/enhancedDebug";
import { ExerciseFilterError } from "../core/filtering/applyClientFilters";
import { applyAllFiltersEnhanced } from "../core/filtering/enhancedFilterFunctions";
import { filterExercises } from "../core/filtering/filterExercises";
// Template organization removed - individual workouts not template-aware yet
import { addPresentationFlagsAuto } from "../formatting/exerciseFlags";
import { saveFilterDebugData } from "../utils/debugToFile";
import {
  ConstraintAnalysisTracker,
  constraintTracker,
  debugLogger,
  ExclusionTracker,
  exclusionTracker,
  saveEnhancedDebugData,
  saveWorkoutGenerationLog,
  ScoreTracker,
  scoreTracker,
} from "../utils/enhancedDebug";
import { buildScoringCriteria } from "../utils/scoringCriteria";

export interface EnhancedFilterExercisesOptions {
  userInput?: string;
  clientContext?: ClientContext;
  workoutTemplate?: WorkoutTemplate;
  exercises?: any[];
  intensity?: "low" | "moderate" | "high";
  enableDebug?: boolean; // Enable enhanced debugging
}

/**
 * Convert ClientContext to FilterCriteria
 */
function buildFilterCriteria(
  clientContext: ClientContext | undefined,
): FilterCriteria | undefined {
  if (!clientContext) {
    return undefined;
  }

  return {
    strength: clientContext.strength_capacity || "moderate",
    skill: clientContext.skill_capacity || "moderate",
    include: clientContext.exercise_requests?.include,
    avoid: clientContext.exercise_requests?.avoid,
    avoidJoints: clientContext.avoid_joints,
  };
}

/**
 * Enhanced version of filterExercisesFromInput with comprehensive debug tracking
 */
export async function enhancedFilterExercisesFromInput(
  options: EnhancedFilterExercisesOptions,
): Promise<WorkoutSessionStateType> {
  const sessionId = uuidv4();
  const sessionStartTime = performance.now();

  try {
    // console.log('🚀 Enhanced filterExercisesFromInput called');
    const {
      userInput = "",
      clientContext,
      workoutTemplate,
      exercises,
      intensity,
      enableDebug = false,
    } = options;

    // Clear previous debug data if debug mode is enabled
    if (enableDebug) {
      debugLogger.enable();
      debugLogger.clear();
      // Clear the singleton instances
      exclusionTracker.clear();
      constraintTracker.clear();
      scoreTracker.clear();
    }

    // Step 1: Build scoring criteria
    const scoringCriteria = buildScoringCriteria(clientContext, intensity);

    // Step 2: Enhanced filtering with exclusion tracking
    const filterStartTime = performance.now();
    const filterCriteria = buildFilterCriteria(clientContext);

    const filteredExercises = await filterExercises({
      clientContext,
      exercises,
      enhancedMode: enableDebug,
      customFilterFunction: filterCriteria
        ? (exercises, _) => {
            return applyAllFiltersEnhanced(
              exercises as ScoredExercise[],
              filterCriteria,
              enableDebug,
            );
          }
        : undefined,
    });
    const filterEndTime = performance.now();

    // Step 3: Import scoring function and apply scoring with tracking
    const scoreStartTime = performance.now();
    const { scoreAndSortExercises } = await import(
      "../core/scoring/scoreExercises"
    );
    const scoredExercises = await scoreAndSortExercises(
      filteredExercises,
      scoringCriteria || {
        muscleTarget: [],
        muscleLessen: [],
        intensity: intensity || "moderate",
        includeExercises: [],
      },
    );

    // If debug mode, track score breakdowns
    if (enableDebug) {
      for (const exercise of scoredExercises) {
        const { scoreExercise } = await import(
          "../core/scoring/firstPassScoring"
        );
        const scoredWithBreakdown = scoreExercise(
          exercise,
          scoringCriteria || {
            muscleTarget: [],
            muscleLessen: [],
            intensity: intensity || "moderate",
            includeExercises: [],
          },
          0,
        );

        // scoreBreakdown is now always present
        const breakdown = scoredWithBreakdown.scoreBreakdown;
        // Track in a score tracker (we'll create this)
        scoreTracker.addScoreBreakdown(exercise, breakdown);
      }
    }

    const scoreEndTime = performance.now();

    // Step 4: Add presentation flags (no template organization for now)
    const flagStartTime = performance.now();
    const exercisesWithFlags = addPresentationFlagsAuto(
      scoredExercises,
      null, // No template organization for individual workouts yet
    );
    const flagEndTime = performance.now();

    const totalTime = performance.now() - sessionStartTime;

    // Save standard debug data (always)
    const blockA = exercisesWithFlags.filter((ex: any) => ex.isSelectedBlockA);
    const blockB = exercisesWithFlags.filter((ex: any) => ex.isSelectedBlockB);
    const blockC = exercisesWithFlags.filter((ex: any) => ex.isSelectedBlockC);
    const blockD = exercisesWithFlags.filter((ex: any) => ex.isSelectedBlockD);

    const standardDebugData = {
      timestamp: new Date().toISOString(),
      filters: {
        clientName: clientContext?.name || "Default Client",
        strengthCapacity: clientContext?.strength_capacity || "moderate",
        skillCapacity: clientContext?.skill_capacity || "moderate",
        intensity: intensity || "moderate",
        muscleTarget: clientContext?.muscle_target || [],
        muscleLessen: clientContext?.muscle_lessen || [],
        avoidJoints: clientContext?.avoid_joints || [],
        includeExercises: clientContext?.exercise_requests?.include || [],
        avoidExercises: clientContext?.exercise_requests?.avoid || [],
        sessionGoal: clientContext?.primary_goal,
        isFullBody: (workoutTemplate as any)?.isFullBody || false,
      },
      results: {
        totalExercises: exercisesWithFlags.length,
        blockA: {
          count: blockA.length,
          exercises: blockA.slice(0, 5).map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            score: ex.score || 0,
          })),
        },
        blockB: {
          count: blockB.length,
          exercises: blockB.slice(0, 3).map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            score: ex.score || 0,
          })),
        },
        blockC: {
          count: blockC.length,
          exercises: blockC.slice(0, 3).map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            score: ex.score || 0,
          })),
        },
        blockD: {
          count: blockD.length,
          exercises: blockD.slice(0, 4).map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            score: ex.score || 0,
          })),
        },
      },
    };

    saveFilterDebugData(standardDebugData);

    // Save enhanced debug data if enabled
    if (enableDebug) {
      const enhancedDebugData: EnhancedFilterDebugData = {
        ...standardDebugData,
        exclusionReasons: exclusionTracker.getExclusions(),
        constraintAnalysis: constraintTracker.getConstraintAnalysis(),
        scoreBreakdowns: scoreTracker.getScoreBreakdowns(),
        debugLog: debugLogger.getLogs(),
      };

      saveEnhancedDebugData(enhancedDebugData);

      // console.log('🔍 Enhanced Debug Summary:');
      // console.log(`  - Exercises excluded: ${Object.keys(exclusionTracker.getExclusions()).length}`);
      // console.log(`  - Constraints tracked: ${Object.keys(constraintTracker.getAnalysis()).length} blocks`);
      // console.log(`  - Debug log entries: ${debugLogger.getLogs().length}`);
    }

    // Save workout generation history
    const workoutLog: WorkoutGenerationLog = {
      sessionId,
      timestamp: new Date().toISOString(),
      filters: standardDebugData.filters,
      results: {
        template: "none", // No template organization for individual workouts
        exerciseCount: exercisesWithFlags.length,
        constraintsSatisfied: true, // No constraints for now
        generationTime: totalTime,
        blockCounts: {
          blockA: blockA.length,
          blockB: blockB.length,
          blockC: blockC.length,
          blockD: blockD.length,
        },
      },
    };

    saveWorkoutGenerationLog(workoutLog);

    // console.log(`⏱️ TOTAL enhanced filterExercisesFromInput time: ${totalTime.toFixed(2)}ms`);
    // console.log(`  - Filtering: ${(filterEndTime - filterStartTime).toFixed(2)}ms`);
    // console.log(`  - Scoring: ${(scoreEndTime - scoreStartTime).toFixed(2)}ms`);
    // console.log(`  - Template: ${(templateEndTime - templateStartTime).toFixed(2)}ms`);
    // console.log(`  - Flags: ${(flagEndTime - flagStartTime).toFixed(2)}ms`);

    // Return in the expected WorkoutSessionStateType format
    return {
      userInput: userInput.trim(),
      programmedRoutine: "",
      exercises: [],
      clientContext: clientContext ?? ({} as ClientContext),
      filteredExercises: exercisesWithFlags,
      workoutTemplate: workoutTemplate ?? {
        workout_goal: "mixed_focus",
        muscle_target: [],
        workout_intensity: "moderate_local",
      },
    };
  } catch (error) {
    // Re-throw ExerciseFilterError as-is
    if (error instanceof ExerciseFilterError) {
      throw error;
    }

    console.error(
      "❌ Unexpected error in enhancedFilterExercisesFromInput:",
      error,
    );

    // Wrap any other errors
    throw new ExerciseFilterError(
      "Failed to filter exercises from input",
      error,
    );
  } finally {
    if (options.enableDebug) {
      debugLogger.disable();
    }
  }
}
