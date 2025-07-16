import { and, desc, eq, inArray } from "@acme/db";
import type { Database } from "@acme/db/client";
import { Workout, WorkoutExercise, exercises } from "@acme/db/schema";
import { createLogger } from "./logger";

const logger = createLogger('QueryHelpers');

/**
 * Optimized query helpers to prevent N+1 query problems
 * 
 * PERFORMANCE OPTIMIZATION:
 * This module contains query helpers that solve N+1 query problems by:
 * - Fetching all related data in minimal queries (usually 2)
 * - Grouping data in memory instead of making multiple DB calls
 * - Providing performance monitoring capabilities
 * 
 * See PERFORMANCE_OPTIMIZATION.md for detailed documentation
 */

export interface WorkoutWithExercises {
  id: string;
  createdAt: Date;
  completedAt: Date | null;
  notes: string | null;
  workoutType: string | null;
  context: string;
  llmOutput: unknown;
  exerciseBlocks: Array<{
    blockName: string;
    exercises: Array<{
      id: string;
      name: string;
      sets: number;
    }>;
  }>;
}

/**
 * Get workouts with exercises in a single optimized query
 * This prevents N+1 query problems by fetching all data at once
 */
export async function getWorkoutsWithExercisesOptimized(
  db: Database,
  filters: {
    userId?: string;
    businessId: string;
    limit?: number;
  }
): Promise<WorkoutWithExercises[]> {
  // Step 1: Get workouts
  const workoutQuery = db
    .select({
      id: Workout.id,
      createdAt: Workout.createdAt,
      completedAt: Workout.completedAt,
      notes: Workout.notes,
      workoutType: Workout.workoutType,
      context: Workout.context,
      llmOutput: Workout.llmOutput,
    })
    .from(Workout)
    .where(
      and(
        filters.userId ? eq(Workout.userId, filters.userId) : undefined,
        eq(Workout.businessId, filters.businessId)
      )
    )
    .orderBy(desc(Workout.createdAt));

  if (filters.limit) {
    workoutQuery.limit(filters.limit);
  }

  const workouts = await workoutQuery;

  if (workouts.length === 0) {
    return [];
  }

  // Step 2: Get all exercises for all workouts in a single query
  const workoutIds = workouts.map(w => w.id);
  const allExercises = await db
    .select({
      workoutId: WorkoutExercise.workoutId,
      orderIndex: WorkoutExercise.orderIndex,
      setsCompleted: WorkoutExercise.setsCompleted,
      groupName: WorkoutExercise.groupName,
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      primaryMuscle: exercises.primaryMuscle,
    })
    .from(WorkoutExercise)
    .innerJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
    .where(inArray(WorkoutExercise.workoutId, workoutIds))
    .orderBy(WorkoutExercise.orderIndex);

  // Step 3: Group exercises by workout
  const exercisesByWorkout = allExercises.reduce((acc, row) => {
    if (!acc[row.workoutId]) {
      acc[row.workoutId] = [];
    }
    acc[row.workoutId].push({
      orderIndex: row.orderIndex,
      setsCompleted: row.setsCompleted,
      groupName: row.groupName,
      exercise: {
        id: row.exerciseId,
        name: row.exerciseName,
        primaryMuscle: row.primaryMuscle,
      },
    });
    return acc;
  }, {} as Record<string, Array<{
    orderIndex: number;
    setsCompleted: number;
    groupName: string | null;
    exercise: {
      id: string;
      name: string;
      primaryMuscle: string | null;
    };
  }>>);

  // Step 4: Transform to final format
  return workouts.map(workout => {
    const workoutExercises = exercisesByWorkout[workout.id] || [];
    
    // Group exercises by block
    const exerciseBlocks = workoutExercises.reduce((acc, we) => {
      const blockName = we.groupName || 'Block A';
      if (!acc[blockName]) {
        acc[blockName] = [];
      }
      acc[blockName].push({
        id: we.exercise.id,
        name: we.exercise.name,
        sets: we.setsCompleted,
      });
      return acc;
    }, {} as Record<string, Array<{ id: string; name: string; sets: number }>>);

    return {
      ...workout,
      exerciseBlocks: Object.entries(exerciseBlocks).map(([blockName, exercises]) => ({
        blockName,
        exercises,
      })),
    };
  });
}

/**
 * Performance monitoring wrapper for database queries
 */
export async function withPerformanceMonitoring<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    // Log performance metrics (can be sent to monitoring service)
    if (duration > 1000) {
      logger.performance(operation, duration);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`Query failed: ${operation} after ${duration}ms`, error);
    throw error;
  }
}