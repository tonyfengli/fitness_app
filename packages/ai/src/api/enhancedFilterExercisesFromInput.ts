import { filterExercises } from "../core/filtering/filterExercises";
import type { WorkoutSessionStateType, ClientContext, WorkoutTemplate } from "../types";
import type { ScoredExercise } from "../types/scoredExercise";
import { ExerciseFilterError } from "../core/filtering/applyClientFilters";
import { buildScoringCriteria } from "../utils/scoringCriteria";
import type { FilterCriteria } from "../core/filtering/types";
import { applyTemplateOrganization } from "../utils/templateOrganization";
import { addPresentationFlagsAuto } from "../formatting/exerciseFlags";
import { applyAllFiltersEnhanced } from "../core/filtering/enhancedFilterFunctions";
import { 
  exclusionTracker, 
  constraintTracker, 
  debugLogger,
  saveEnhancedDebugData,
  saveWorkoutGenerationLog
  
  
} from "../utils/enhancedDebug";
import type {EnhancedFilterDebugData, WorkoutGenerationLog} from "../utils/enhancedDebug";
import { saveFilterDebugData } from "../utils/debugToFile";
import { v4 as uuidv4 } from "uuid";

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
function buildFilterCriteria(clientContext: ClientContext | undefined): FilterCriteria | undefined {
  if (!clientContext) {
    return undefined;
  }

  return {
    strength: clientContext.strength_capacity || 'moderate',
    skill: clientContext.skill_capacity || 'moderate',
    include: clientContext.exercise_requests?.include,
    avoid: clientContext.exercise_requests?.avoid,
    avoidJoints: clientContext.avoid_joints
  };
}

/**
 * Enhanced version of filterExercisesFromInput with comprehensive debug tracking
 */
export async function enhancedFilterExercisesFromInput(
  options: EnhancedFilterExercisesOptions
): Promise<WorkoutSessionStateType> {
  const sessionId = uuidv4();
  const sessionStartTime = performance.now();
  
  try {
    console.log('🚀 Enhanced filterExercisesFromInput called');
    const { 
      userInput = "", 
      clientContext, 
      workoutTemplate, 
      exercises, 
      intensity,
      enableDebug = false 
    } = options;
    
    // Clear previous debug data if debug mode is enabled
    if (enableDebug) {
      debugLogger.enable();
      debugLogger.clear();
      // Note: We don't clear the trackers here as they accumulate data during the process
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
      customFilterFunction: filterCriteria ? (exercises, _) => {
        return applyAllFiltersEnhanced(exercises as ScoredExercise[], filterCriteria, enableDebug);
      } : undefined
    });
    const filterEndTime = performance.now();
    
    // Step 3: Regular scoring (enhanced scoring removed)
    const scoreStartTime = performance.now();
    // For now, just use default scoring when in debug mode
    // In the future, could add score breakdown tracking to regular scoring
    const scoredExercises = filteredExercises.map(ex => ({ ...ex, score: 5.0 }) as ScoredExercise);
    const scoreEndTime = performance.now();
    
    // Step 4: Apply template organization
    const templateStartTime = performance.now();
    const templateResult = applyTemplateOrganization(scoredExercises, workoutTemplate);
    const templateEndTime = performance.now();
    
    // Step 5: Add presentation flags
    const flagStartTime = performance.now();
    const exercisesWithFlags = addPresentationFlagsAuto(
      scoredExercises,
      templateResult?.organizedExercises || null
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
        isFullBody: (workoutTemplate as any)?.isFullBody || false
      },
      results: {
        totalExercises: exercisesWithFlags.length,
        blockA: {
          count: blockA.length,
          exercises: blockA.slice(0, 5).map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            score: ex.score || 0
          }))
        },
        blockB: {
          count: blockB.length,
          exercises: blockB.slice(0, 3).map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            score: ex.score || 0
          }))
        },
        blockC: {
          count: blockC.length,
          exercises: blockC.slice(0, 3).map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            score: ex.score || 0
          }))
        },
        blockD: {
          count: blockD.length,
          exercises: blockD.slice(0, 4).map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            score: ex.score || 0
          }))
        }
      }
    };
    
    saveFilterDebugData(standardDebugData);
    
    // Save enhanced debug data if enabled
    if (enableDebug) {
      const enhancedDebugData: EnhancedFilterDebugData = {
        ...standardDebugData,
        exclusionReasons: exclusionTracker.getExclusions(),
        constraintAnalysis: constraintTracker.getAnalysis(),
        scoreBreakdowns: {}, // Enhanced scoring removed - no breakdown tracking
        debugLog: debugLogger.getLogs()
      };
      
      saveEnhancedDebugData(enhancedDebugData);
      
      console.log('🔍 Enhanced Debug Summary:');
      console.log(`  - Exercises excluded: ${Object.keys(exclusionTracker.getExclusions()).length}`);
      console.log(`  - Constraints tracked: ${Object.keys(constraintTracker.getAnalysis()).length} blocks`);
      console.log(`  - Debug log entries: ${debugLogger.getLogs().length}`);
    }
    
    // Save workout generation history
    const workoutLog: WorkoutGenerationLog = {
      sessionId,
      timestamp: new Date().toISOString(),
      filters: standardDebugData.filters,
      results: {
        template: templateResult?.templateId || 'none',
        exerciseCount: exercisesWithFlags.length,
        constraintsSatisfied: templateResult !== null, // Simple check for now
        generationTime: totalTime,
        blockCounts: {
          blockA: blockA.length,
          blockB: blockB.length,
          blockC: blockC.length,
          blockD: blockD.length
        }
      }
    };
    
    saveWorkoutGenerationLog(workoutLog);
    
    console.log(`⏱️ TOTAL enhanced filterExercisesFromInput time: ${totalTime.toFixed(2)}ms`);
    console.log(`  - Filtering: ${(filterEndTime - filterStartTime).toFixed(2)}ms`);
    console.log(`  - Scoring: ${(scoreEndTime - scoreStartTime).toFixed(2)}ms`);
    console.log(`  - Template: ${(templateEndTime - templateStartTime).toFixed(2)}ms`);
    console.log(`  - Flags: ${(flagEndTime - flagStartTime).toFixed(2)}ms`);
    
    // Return in the expected WorkoutSessionStateType format
    return {
      userInput: userInput.trim(),
      programmedRoutine: "",
      exercises: [],
      clientContext: clientContext ?? {} as ClientContext,
      filteredExercises: exercisesWithFlags,
      workoutTemplate: workoutTemplate ?? {
        workout_goal: "mixed_focus",
        muscle_target: [],
        workout_intensity: "moderate_local"
      }
    };
  } catch (error) {
    // Re-throw ExerciseFilterError as-is
    if (error instanceof ExerciseFilterError) {
      throw error;
    }
    
    console.error('❌ Unexpected error in enhancedFilterExercisesFromInput:', error);
    
    // Wrap any other errors
    throw new ExerciseFilterError(
      'Failed to filter exercises from input',
      error
    );
  } finally {
    if (options.enableDebug) {
      debugLogger.disable();
    }
  }
}