import type { WorkoutStateType, Exercise } from "../types";
import { fetchAllExercises, selectRandomExercisesByMuscles, formatWorkoutPlan } from "../utils";
import { ExerciseFetchError } from "../utils/fetchExercises";
import { ExerciseSelectionError } from "../utils/selectRandomExercisesByMuscles";

export class WorkoutGenerationError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'WorkoutGenerationError';
  }
}

/**
 * LangGraph node that generates a complete workout plan
 * Fetches exercises from database, selects random ones by muscle group, and formats the plan
 * @param state - Current workflow state
 * @returns Updated state with workout plan and selected exercises
 * @throws {WorkoutGenerationError} If workout generation fails
 */
export async function generateWorkoutNode(state: WorkoutStateType) {
  try {
    // Fetch all exercises from database
    const allExercises = await fetchAllExercises();
    
    if (!allExercises || allExercises.length === 0) {
      throw new WorkoutGenerationError('No exercises available in database');
    }
    
    // Select random exercises for each muscle group with error handling
    let pushExercises: Exercise[] = [];
    let pullExercises: Exercise[] = [];
    let legExercises: Exercise[] = [];
    
    try {
      pushExercises = selectRandomExercisesByMuscles(allExercises, ['chest', 'shoulders', 'triceps'], 3);
    } catch (error) {
      console.warn('Failed to select push exercises, using fallback', error);
    }
    
    try {
      pullExercises = selectRandomExercisesByMuscles(allExercises, ['lats', 'biceps', 'upper_back'], 3);
    } catch (error) {
      console.warn('Failed to select pull exercises, using fallback', error);
    }
    
    try {
      legExercises = selectRandomExercisesByMuscles(allExercises, ['quads', 'glutes', 'hamstrings'], 3);
    } catch (error) {
      console.warn('Failed to select leg exercises, using fallback', error);
    }
    
    // Ensure we have at least some exercises
    const totalExercises = pushExercises.length + pullExercises.length + legExercises.length;
    if (totalExercises === 0) {
      throw new WorkoutGenerationError('Unable to select any exercises for workout plan');
    }
    
    // Format the workout plan
    const workoutPlan = formatWorkoutPlan(pushExercises, pullExercises, legExercises);

    return {
      workoutPlan,
      exercises: [...pushExercises, ...pullExercises, ...legExercises],
    };
  } catch (error) {
    if (error instanceof ExerciseFetchError) {
      throw new WorkoutGenerationError('Failed to fetch exercises from database', error);
    }
    if (error instanceof ExerciseSelectionError) {
      throw new WorkoutGenerationError('Failed to select exercises', error);
    }
    if (error instanceof WorkoutGenerationError) {
      throw error;
    }
    throw new WorkoutGenerationError('Unexpected error during workout generation', error);
  }
}