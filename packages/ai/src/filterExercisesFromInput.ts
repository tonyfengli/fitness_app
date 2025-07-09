import { filterExercises } from "./filtering/filterExercises";
import type { WorkoutSessionStateType, ClientContext, WorkoutTemplate } from "./types";
import type { ScoredExercise, ScoringCriteria } from "./types/scoredExercise";
import { ExerciseFilterError } from "./filtering/applyClientFilters";
import { getTemplateHandler } from "./templates";

export interface FilterExercisesOptions {
  userInput?: string;
  clientContext?: ClientContext;
  workoutTemplate?: WorkoutTemplate;
  exercises?: any[]; // Pass exercises directly from API
  intensity?: "low" | "moderate" | "high"; // Pass intensity separately for scoring
}

/**
 * Filters exercises based on client context and optional user input
 * This is the main API-ready function for exercise filtering
 * 
 * @param options - Object containing client context, user input, or legacy filter criteria
 * @returns Promise<WorkoutSessionStateType> - The filtered exercises
 * @throws {ExerciseFilterError} If filtering fails
 * 
 * @example
 * ```typescript
 * const result = await filterExercisesFromInput({
 *   clientContext: {
 *     name: "John Doe",
 *     fitness_profile: {
 *       strength_capacity: "moderate",
 *       skill_capacity: "low"
 *     }
 *   },
 *   userInput: "I want to work out today"
 * });
 * console.log(result.filteredExercises); // Array of filtered exercises
 * ```
 */
export async function filterExercisesFromInput(options: FilterExercisesOptions): Promise<WorkoutSessionStateType> {
  try {
    console.log('🚀 filterExercisesFromInput called');
    const { userInput = "", clientContext, workoutTemplate, exercises, intensity } = options;
    
    // Check if we have any scoring criteria (Phase 1 or Phase 2)
    // Scoring should be enabled if ANY criteria are provided
    const hasScoringCriteria = clientContext && (
      (clientContext.exercise_requests?.include && clientContext.exercise_requests.include.length > 0) ??
      (clientContext.muscle_target && clientContext.muscle_target.length > 0) ??
      (clientContext.muscle_lessen && clientContext.muscle_lessen.length > 0) ??
      intensity // Enable scoring if intensity is selected (even if medium)
    );
    
    // Build scoring criteria if we have any scoring data
    let scoringCriteria: ScoringCriteria | undefined;
    if (hasScoringCriteria) {
      scoringCriteria = {
        includeExercises: clientContext.exercise_requests?.include ?? [],
        muscleTarget: clientContext.muscle_target ?? [],
        muscleLessen: clientContext.muscle_lessen ?? [],
        intensity: intensity,
        skillLevel: clientContext.skill_capacity,
        strengthLevel: clientContext.strength_capacity,
      };
    }
    
    // Use the new direct filtering function with optional scoring
    const filteredExercises = await filterExercises({
      exercises: exercises, // Use exercises passed from API
      businessId: clientContext?.business_id,
      clientContext,
      includeScoring: !!hasScoringCriteria,
      scoringCriteria,
    });
    
    // Apply template handler to mark TOP 6 selections
    let organizedExercises = filteredExercises;
    
    // Always use template handler for organizing exercises into blocks
    if (workoutTemplate) {
      const isFullBody = (workoutTemplate as any).isFullBody;
      const templateId = isFullBody ? 'full_body' : 'workout';
      
      console.log(`🏋️ Using ${isFullBody ? 'FullBodyWorkoutTemplateHandler' : 'WorkoutTemplateHandler'} to select TOP 6 with constraints`);
      console.log(`📊 Total exercises: ${filteredExercises.length}`);
      
      const templateHandler = getTemplateHandler(templateId);
      const organized = templateHandler.organize(filteredExercises as ScoredExercise[]);
      
      // Create sets of IDs for TOP 6 selections in Block A, B, C, and D
      const top6BlockA = new Set(organized.blockA.map(ex => ex.id));
      const top6BlockB = new Set(organized.blockB.map(ex => ex.id));
      const top6BlockC = new Set(organized.blockC.map(ex => ex.id));
      const top6BlockD = new Set(organized.blockD.map(ex => ex.id));
      
      // Mark exercises that are selected as TOP 6
      organizedExercises = filteredExercises.map(exercise => {
        const tags = exercise.functionTags ?? [];
        
        // Check if this exercise is selected as TOP 6 for specific blocks
        const isTop6BlockA = tags.includes('primary_strength') && top6BlockA.has(exercise.id);
        const isTop6BlockB = tags.includes('secondary_strength') && top6BlockB.has(exercise.id);
        const isTop6BlockC = tags.includes('accessory') && top6BlockC.has(exercise.id);
        const isTop6BlockD = (tags.includes('core') || tags.includes('capacity')) && top6BlockD.has(exercise.id);
        
        // Add block-specific flags to indicate TOP 6 selection
        return {
          ...exercise,
          isTop6Selected: isTop6BlockA || isTop6BlockB || isTop6BlockC || isTop6BlockD, // Keep for backward compatibility
          isTop6BlockA,
          isTop6BlockB,
          isTop6BlockC,
          isTop6BlockD,
          // Add penalty info for Block B display
          blockBPenalty: isTop6BlockA ? 2.0 : 0,
          // Add penalty info for Block C display
          blockCPenalty: isTop6BlockB ? 2.0 : 0
        };
      });
      
      console.log(`📊 TOP 6 selections:`);
      console.log(`   - Block A (primary_strength): ${organized.blockA.length} exercises selected`);
      console.log(`   - Block B (secondary_strength): ${organized.blockB.length} exercises selected`);
      console.log(`   - Block C (accessory): ${organized.blockC.length} exercises selected`);
      console.log(`   - Block D (core & capacity): ${organized.blockD.length} exercises selected`);
      
      // Debug: Count how many exercises are marked as TOP 6 for each block
      const blockACount = organizedExercises.filter(ex => (ex as any).isTop6BlockA).length;
      const blockBCount = organizedExercises.filter(ex => (ex as any).isTop6BlockB).length;
      const blockCCount = organizedExercises.filter(ex => (ex as any).isTop6BlockC).length;
      const blockDCount = organizedExercises.filter(ex => (ex as any).isTop6BlockD).length;
      console.log(`📊 TOP 6 flags set:`);
      console.log(`   - isTop6BlockA: ${blockACount} exercises marked`);
      console.log(`   - isTop6BlockB: ${blockBCount} exercises marked`);
      console.log(`   - isTop6BlockC: ${blockCCount} exercises marked`);
      console.log(`   - isTop6BlockD: ${blockDCount} exercises marked`);
    }
    
    // Return in the expected WorkoutSessionStateType format
    return {
      userInput: userInput.trim(),
      programmedRoutine: "",
      exercises: [], // Original exercises not needed in response
      clientContext: clientContext!,
      filteredExercises: organizedExercises,
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
    
    // Log unexpected errors
    console.error('❌ Unexpected error in filterExercisesFromInput:', error);
    
    // Wrap any other errors
    throw new ExerciseFilterError(
      'Failed to filter exercises from input',
      error
    );
  }
}