import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "@acme/db";
import type { Database } from "@acme/db/client";
import { 
  Workout,
  WorkoutExercise,
  TrainingSession,
  UserTrainingSession,
  exercises,
  BusinessExercise,
  user
} from "@acme/db/schema";
import type { SessionUser } from "../types/auth";

export class WorkoutService {
  constructor(private db: Database) {}

  /**
   * Verify that a training session exists and belongs to the user's business
   */
  async verifyTrainingSession(sessionId: string, businessId: string) {
    const session = await this.db.query.TrainingSession.findFirst({
      where: and(
        eq(TrainingSession.id, sessionId),
        eq(TrainingSession.businessId, businessId)
      ),
    });

    if (!session) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Training session not found',
      });
    }

    return session;
  }

  /**
   * Verify that a user is registered for a training session
   */
  async verifyUserRegistration(userId: string, sessionId: string, trainerId: string) {
    // Trainers don't need to be registered
    if (userId === trainerId) {
      return true;
    }

    const registration = await this.db.query.UserTrainingSession.findFirst({
      where: and(
        eq(UserTrainingSession.userId, userId),
        eq(UserTrainingSession.trainingSessionId, sessionId)
      ),
    });

    if (!registration) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'User must be registered for the session to log a workout',
      });
    }

    return registration;
  }

  /**
   * Verify that a workout exists and user has access to it
   */
  async verifyWorkoutAccess(workoutId: string, businessId: string) {
    const workout = await this.db.query.Workout.findFirst({
      where: and(
        eq(Workout.id, workoutId),
        eq(Workout.businessId, businessId)
      ),
    });

    if (!workout) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Workout not found',
      });
    }

    return workout;
  }

  /**
   * Verify that a user can log workouts for another user
   */
  verifyWorkoutPermission(targetUserId: string, currentUser: SessionUser) {
    if (targetUserId !== currentUser.id && currentUser.role !== 'trainer') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You can only log your own workouts',
      });
    }
  }

  /**
   * Verify that an exercise belongs to a workout
   */
  async verifyExerciseInWorkout(workoutId: string, exerciseId: string) {
    const exercise = await this.db.query.WorkoutExercise.findFirst({
      where: and(
        eq(WorkoutExercise.workoutId, workoutId),
        eq(WorkoutExercise.id, exerciseId)
      ),
    });

    if (!exercise) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Exercise not found in workout',
      });
    }

    return exercise;
  }

  /**
   * Get all exercises for a workout grouped by block
   */
  async getWorkoutExercisesGrouped(workoutId: string) {
    const workoutExercises = await this.db.query.WorkoutExercise.findMany({
      where: eq(WorkoutExercise.workoutId, workoutId),
      orderBy: WorkoutExercise.orderIndex,
    });

    // Group exercises by block
    const exercisesByBlock = new Map<string, typeof workoutExercises>();
    for (const exercise of workoutExercises) {
      const blockName = exercise.groupName || 'Block A';
      if (!exercisesByBlock.has(blockName)) {
        exercisesByBlock.set(blockName, []);
      }
      exercisesByBlock.get(blockName)!.push(exercise);
    }

    return exercisesByBlock;
  }

  /**
   * Reorder exercises after deletion or reordering
   */
  async reorderExercises(workoutId: string, blockName: string, startIndex: number) {
    const exercises = await this.db.query.WorkoutExercise.findMany({
      where: and(
        eq(WorkoutExercise.workoutId, workoutId),
        eq(WorkoutExercise.groupName, blockName)
      ),
      orderBy: WorkoutExercise.orderIndex,
    });

    // Update order indexes for exercises after the deleted one
    for (let i = startIndex; i < exercises.length; i++) {
      const exercise = exercises[i];
      if (exercise && exercise.orderIndex > startIndex) {
        await this.db
          .update(WorkoutExercise)
          .set({ orderIndex: exercise.orderIndex - 1 })
          .where(eq(WorkoutExercise.id, exercise.id));
      }
    }
  }

  /**
   * Verify that a client exists in the same business
   */
  async verifyClientInBusiness(clientId: string, businessId: string) {
    const client = await this.db.query.user.findFirst({
      where: and(
        eq(user.id, clientId),
        eq(user.businessId, businessId)
      ),
    });

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Client not found in your business',
      });
    }

    return client;
  }

  /**
   * Check if a workout is an assessment (can't be deleted)
   */
  isAssessmentWorkout(workout: { context: string }) {
    return workout.context === 'assessment';
  }

  /**
   * Create a workout for a training session
   */
  async createWorkoutForSession(params: {
    trainingSessionId: string;
    userId: string;
    businessId: string;
    createdByTrainerId: string;
    completedAt: Date;
    notes?: string;
    exercises?: Array<{
      exerciseId: string;
      orderIndex: number;
      setsCompleted: number;
    }>;
  }) {
    const { trainingSessionId, userId, businessId, createdByTrainerId, completedAt, notes, exercises } = params;

    return await this.db.transaction(async (tx) => {
      // Create workout
      const [workout] = await tx
        .insert(Workout)
        .values({
          trainingSessionId,
          userId,
          businessId,
          createdByTrainerId,
          completedAt,
          notes,
          context: "group", // Group context since it has a training session
        })
        .returning();
        
      if (!workout) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create workout',
        });
      }
      
      // Create workout exercises if provided
      if (exercises && exercises.length > 0) {
        await tx.insert(WorkoutExercise).values(
          exercises.map(ex => ({
            workoutId: workout.id,
            exerciseId: ex.exerciseId,
            orderIndex: ex.orderIndex,
            setsCompleted: ex.setsCompleted,
            groupName: "Block A", // Default for now
          }))
        );
      }
      
      return workout;
    });
  }

  /**
   * Standard error messages
   */
  static readonly ERRORS = {
    WORKOUT_NOT_FOUND: 'Workout not found',
    SESSION_NOT_FOUND: 'Training session not found',
    UNAUTHORIZED: 'Unauthorized',
    FORBIDDEN: 'You do not have permission to perform this action',
    INVALID_INPUT: 'Invalid input provided',
    BUSINESS_REQUIRED: 'User must be associated with a business',
  } as const;
}