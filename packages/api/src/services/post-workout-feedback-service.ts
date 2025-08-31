import { and, eq, inArray, notInArray, desc } from "@acme/db";
import type { Database } from "@acme/db/client";
import {
  Workout,
  WorkoutExercise,
  workoutExerciseSwaps,
  exercises,
  UserExerciseRatings,
  UserTrainingSession,
  ExercisePerformanceLog,
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
  existingRating?: string | null;
  latestWeight?: number | null;
  isPersonalRecord?: boolean;
  previousBestWeight?: number | null;
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

    // Step 6: Get existing ratings (but don't exclude them)
    let existingRatingsMap = new Map<string, string>();
    
    if (allExerciseIds.length > 0) {
      const existingRatings = await this.db
        .select({
          exerciseId: UserExerciseRatings.exerciseId,
          ratingType: UserExerciseRatings.ratingType,
        })
        .from(UserExerciseRatings)
        .where(
          and(
            eq(UserExerciseRatings.userId, userId),
            eq(UserExerciseRatings.businessId, businessId),
            inArray(UserExerciseRatings.exerciseId, allExerciseIds)
          )
        );
      
      // Create a map of exercise ID to rating type
      existingRatings.forEach(rating => {
        existingRatingsMap.set(rating.exerciseId, rating.ratingType);
      });
    }
    
    console.log("[PostWorkoutFeedbackService] Existing ratings:", {
      count: existingRatingsMap.size,
      ratings: Array.from(existingRatingsMap.entries()),
    });

    // Step 6.5: Get latest performance logs for all exercises (across all workouts)
    let performanceLogsMap = new Map<string, { weight: number; isPr: boolean; previousBest: number | null }>();
    
    if (allExerciseIds.length > 0) {
      // Get all performance logs for this user and these exercises (not limited to current workout)
      const performanceLogs = await this.db
        .select({
          exerciseId: ExercisePerformanceLog.exerciseId,
          weightLbs: ExercisePerformanceLog.weightLbs,
          isWeightPr: ExercisePerformanceLog.isWeightPr,
          previousBestWeightLbs: ExercisePerformanceLog.previousBestWeightLbs,
          createdAt: ExercisePerformanceLog.createdAt,
        })
        .from(ExercisePerformanceLog)
        .where(
          and(
            eq(ExercisePerformanceLog.userId, userId),
            inArray(ExercisePerformanceLog.exerciseId, allExerciseIds)
          )
        )
        .orderBy(desc(ExercisePerformanceLog.createdAt));
      
      // Group by exercise and take the latest entry for each
      const latestPerformanceByExercise = new Map<string, typeof performanceLogs[0]>();
      performanceLogs.forEach(log => {
        if (!latestPerformanceByExercise.has(log.exerciseId)) {
          latestPerformanceByExercise.set(log.exerciseId, log);
        }
      });
      
      // Convert to our map format
      latestPerformanceByExercise.forEach((log, exerciseId) => {
        performanceLogsMap.set(exerciseId, {
          weight: Number(log.weightLbs),
          isPr: log.isWeightPr,
          previousBest: log.previousBestWeightLbs ? Number(log.previousBestWeightLbs) : null,
        });
      });
    }
    
    console.log("[PostWorkoutFeedbackService] Performance logs:", {
      count: performanceLogsMap.size,
      logs: Array.from(performanceLogsMap.entries()),
    });

    // Step 7: Build feedback exercise list (include ALL exercises)
    const feedbackExercises: FeedbackExercise[] = [];

    // Add swapped exercises (include rated ones)
    swappedExercises.forEach(ex => {
      const performanceData = performanceLogsMap.get(ex.exerciseId);
      feedbackExercises.push({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        primaryMuscle: ex.primaryMuscle,
        movementPattern: ex.movementPattern,
        feedbackType: "swapped_out",
        swapReason: ex.swapReason,
        existingRating: existingRatingsMap.get(ex.exerciseId) || null,
        latestWeight: performanceData?.weight || null,
        isPersonalRecord: performanceData?.isPr || false,
        previousBestWeight: performanceData?.previousBest || null,
      });
    });

    // Add performed exercises (include rated ones, but exclude swapped)
    const swappedIds = new Set(swappedExercises.map(e => e.exerciseId));
    performedExercises.forEach(ex => {
      if (!swappedIds.has(ex.exerciseId)) {
        const performanceData = performanceLogsMap.get(ex.exerciseId);
        feedbackExercises.push({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          primaryMuscle: ex.primaryMuscle,
          movementPattern: ex.movementPattern,
          feedbackType: "performed",
          existingRating: existingRatingsMap.get(ex.exerciseId) || null,
          latestWeight: performanceData?.weight || null,
          isPersonalRecord: performanceData?.isPr || false,
          previousBestWeight: performanceData?.previousBest || null,
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