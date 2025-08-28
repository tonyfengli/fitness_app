import { and, eq, inArray, notInArray } from "@acme/db";
import type { Database } from "@acme/db/client";
import {
  Workout,
  WorkoutExercise,
  workoutExerciseSwaps,
  exercises,
  UserExerciseRatings,
  UserTrainingSession,
} from "@acme/db/schema";

export interface FeedbackExercise {
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  movementPattern: string | null;
  feedbackType: "performed" | "swapped_out";
  swapReason?: string | null;
  originalExerciseId?: string;
  originalExerciseName?: string;
}

export interface GetFeedbackExercisesInput {
  sessionId: string;
  userId: string;
  businessId: string;
}

export class PostWorkoutFeedbackService {
  constructor(private db: Database) {}

  /**
   * Get all exercises that need feedback for a user's workout session
   * Excludes exercises that already have ratings
   */
  async getFeedbackExercises(input: GetFeedbackExercisesInput): Promise<{
    exercises: FeedbackExercise[];
    sessionInfo: {
      sessionId: string;
      userId: string;
      workoutId?: string;
    };
  }> {
    const { sessionId, userId, businessId } = input;

    console.log("[PostWorkoutFeedbackService] getFeedbackExercises called with:", {
      sessionId,
      userId,
      businessId,
      timestamp: new Date().toISOString(),
    });

    // Step 1: Verify user is part of this session
    const userSession = await this.db.query.UserTrainingSession.findFirst({
      where: and(
        eq(UserTrainingSession.userId, userId),
        eq(UserTrainingSession.trainingSessionId, sessionId)
      ),
    });

    if (!userSession) {
      console.log("[PostWorkoutFeedbackService] User not found in session");
      throw new Error("User not found in this training session");
    }

    console.log("[PostWorkoutFeedbackService] User session found:", {
      userSessionId: userSession.id,
      status: userSession.status,
    });

    // Step 2: Get the workout for this session and user
    // First try to find workout for this specific user
    let workout = await this.db.query.Workout.findFirst({
      where: and(
        eq(Workout.trainingSessionId, sessionId),
        eq(Workout.userId, userId)
      ),
    });

    // If no workout for this user, get ANY workout for this session (for group workouts)
    if (!workout) {
      console.log("[PostWorkoutFeedbackService] No workout found for specific user, checking for group workout");
      workout = await this.db.query.Workout.findFirst({
        where: eq(Workout.trainingSessionId, sessionId),
      });
    }

    console.log("[PostWorkoutFeedbackService] Workout query result:", {
      found: !!workout,
      workoutId: workout?.id,
      workoutUserId: workout?.userId,
      searchedUserId: userId,
      sessionId: sessionId,
    });

    // Step 3: Get exercises that were swapped out by this user
    const swappedExercises = await this.db
      .select({
        exerciseId: workoutExerciseSwaps.originalExerciseId,
        exerciseName: exercises.name,
        primaryMuscle: exercises.primaryMuscle,
        movementPattern: exercises.movementPattern,
        swapReason: workoutExerciseSwaps.swapReason,
      })
      .from(workoutExerciseSwaps)
      .innerJoin(exercises, eq(workoutExerciseSwaps.originalExerciseId, exercises.id))
      .where(
        and(
          eq(workoutExerciseSwaps.trainingSessionId, sessionId),
          eq(workoutExerciseSwaps.clientId, userId)
        )
      );

    console.log("[PostWorkoutFeedbackService] Swapped exercises found:", {
      count: swappedExercises.length,
      exercises: swappedExercises.map(e => ({
        id: e.exerciseId,
        name: e.exerciseName,
      })),
    });

    // Step 4: Get exercises performed in the workout
    let performedExercises: Array<{
      exerciseId: string;
      exerciseName: string;
      primaryMuscle: string;
      movementPattern: string | null;
    }> = [];

    if (workout) {
      // Get all exercises from the workout
      const workoutExercises = await this.db
        .select({
          exerciseId: WorkoutExercise.exerciseId,
          exerciseName: exercises.name,
          primaryMuscle: exercises.primaryMuscle,
          movementPattern: exercises.movementPattern,
          isShared: WorkoutExercise.isShared,
          sharedWithClients: WorkoutExercise.sharedWithClients,
        })
        .from(WorkoutExercise)
        .innerJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .where(eq(WorkoutExercise.workoutId, workout.id));

      console.log("[PostWorkoutFeedbackService] Raw workout exercises:", {
        count: workoutExercises.length,
        exercises: workoutExercises.map(e => ({
          id: e.exerciseId,
          name: e.exerciseName,
          isShared: e.isShared,
          sharedWithClients: e.sharedWithClients,
        })),
      });

      // Include ALL exercises from the workout - no filtering
      // This gives users access to provide feedback on any exercise in the session
      performedExercises = workoutExercises;

      console.log("[PostWorkoutFeedbackService] All workout exercises (no filtering):", {
        count: performedExercises.length,
        userIdSearched: userId,
        exercises: performedExercises.map(e => ({
          id: e.exerciseId,
          name: e.exerciseName,
        })),
      });
    }

    // Step 5: Get all exercise IDs that need feedback
    const allExerciseIds = [
      ...swappedExercises.map(e => e.exerciseId),
      ...performedExercises.map(e => e.exerciseId),
    ];

    console.log("[PostWorkoutFeedbackService] All exercise IDs for feedback:", {
      total: allExerciseIds.length,
      exerciseIds: allExerciseIds,
    });

    // Step 6: Get existing ratings to exclude
    let existingRatings: { exerciseId: string }[] = [];
    
    if (allExerciseIds.length > 0) {
      existingRatings = await this.db
        .select({
          exerciseId: UserExerciseRatings.exerciseId,
        })
        .from(UserExerciseRatings)
        .where(
          and(
            eq(UserExerciseRatings.userId, userId),
            eq(UserExerciseRatings.businessId, businessId),
            inArray(UserExerciseRatings.exerciseId, allExerciseIds)
          )
        );
    }

    const ratedExerciseIds = new Set(existingRatings.map(r => r.exerciseId));
    
    console.log("[PostWorkoutFeedbackService] Existing ratings:", {
      count: existingRatings.length,
      ratedExerciseIds: Array.from(ratedExerciseIds),
    });

    // Step 7: Build feedback exercise list
    const feedbackExercises: FeedbackExercise[] = [];

    // Add swapped exercises (not yet rated)
    swappedExercises.forEach(ex => {
      if (!ratedExerciseIds.has(ex.exerciseId)) {
        feedbackExercises.push({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          primaryMuscle: ex.primaryMuscle,
          movementPattern: ex.movementPattern,
          feedbackType: "swapped_out",
          swapReason: ex.swapReason,
        });
      }
    });

    // Add performed exercises (not yet rated and not swapped)
    const swappedIds = new Set(swappedExercises.map(e => e.exerciseId));
    performedExercises.forEach(ex => {
      if (!ratedExerciseIds.has(ex.exerciseId) && !swappedIds.has(ex.exerciseId)) {
        feedbackExercises.push({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          primaryMuscle: ex.primaryMuscle,
          movementPattern: ex.movementPattern,
          feedbackType: "performed",
        });
      }
    });

    console.log("[PostWorkoutFeedbackService] Final result:", {
      feedbackExercisesCount: feedbackExercises.length,
      workoutId: workout?.id,
      sessionId,
      userId,
    });

    return {
      exercises: feedbackExercises,
      sessionInfo: {
        sessionId,
        userId,
        workoutId: workout?.id,
      },
    };
  }

  /**
   * Get exercises grouped by feedback type for better UX
   */
  async getFeedbackExercisesGrouped(input: GetFeedbackExercisesInput) {
    const result = await this.getFeedbackExercises(input);
    
    return {
      ...result,
      exercisesByType: {
        swapped: result.exercises.filter(e => e.feedbackType === "swapped_out"),
        performed: result.exercises.filter(e => e.feedbackType === "performed"),
      },
    };
  }
}