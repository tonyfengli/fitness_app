/**
 * Auto Preference Service
 * Automatically creates default preferences for standard template workouts
 */

import { getWorkoutTemplate } from "@acme/ai";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { 
  TrainingSession, 
  user, 
  WorkoutPreferences,
  UserExerciseRatings,
  exercises 
} from "@acme/db/schema";

import { createLogger } from "../utils/logger";

const logger = createLogger("AutoPreferenceService");

export interface AutoPreferenceOptions {
  userId: string;
  sessionId: string;
  businessId: string;
}

/**
 * Check if a session uses a standard template
 */
async function isStandardTemplateSession(sessionId: string): Promise<boolean> {
  try {
    const [session] = await db
      .select({ templateType: TrainingSession.templateType })
      .from(TrainingSession)
      .where(eq(TrainingSession.id, sessionId))
      .limit(1);

    if (!session?.templateType) {
      return false;
    }

    // Check if it's a standard template
    const standardTemplates = ["standard", "standard_strength"];
    return standardTemplates.includes(session.templateType);
  } catch (error) {
    logger.error("Error checking template type", { error, sessionId });
    return false;
  }
}

/**
 * Create default preferences for standard template workouts
 */
export async function createDefaultPreferencesIfNeeded(
  options: AutoPreferenceOptions,
): Promise<boolean> {
  const { userId, sessionId, businessId } = options;

  try {
    // 1. Check if it's a standard template session
    const isStandard = await isStandardTemplateSession(sessionId);
    if (!isStandard) {
      logger.info("Not a standard template, skipping auto preferences", {
        sessionId,
      });
      return false;
    }

    // 2. Check if preferences already exist
    const [existingPref] = await db
      .select()
      .from(WorkoutPreferences)
      .where(
        and(
          eq(WorkoutPreferences.userId, userId),
          eq(WorkoutPreferences.trainingSessionId, sessionId),
        ),
      )
      .limit(1);

    if (existingPref) {
      logger.info("Preferences already exist", { userId, sessionId });
      return false;
    }

    // 3. Get user info for personalization (optional - skipped for now)

    // 4. Create default preferences
    // For standard templates, create minimal defaults that will be updated via prompt
    const [newPref] = await db
      .insert(WorkoutPreferences)
      .values({
        userId,
        trainingSessionId: sessionId,
        businessId,
        // Default to moderate intensity
        intensity: "moderate",
        intensitySource: "default",
        // Default to full body without finisher with core
        workoutType: "full_body_without_finisher_with_core",
        // Empty arrays for targets - will be filled by preference prompt
        muscleTargets: [],
        muscleLessens: [],
        includeExercises: [],
        avoidExercises: [],
        avoidJoints: [],
        sessionGoal: null,
        collectionMethod: "auto",
      })
      .returning();

    logger.info("Created default preferences for standard template", {
      userId,
      sessionId,
      preferenceId: newPref?.id,
    });

    // Sync avoid exercises in the background - don't await
    if (newPref?.id) {
      syncAvoidExercisesInBackground(userId, businessId, newPref.id)
        .then(() => {
          logger.info("Background sync completed", { userId, preferenceId: newPref.id });
        })
        .catch((error) => {
          logger.error("Background sync failed", { error, userId, preferenceId: newPref.id });
        });
    }

    return true;
  } catch (error) {
    logger.error("Error creating default preferences", {
      error,
      userId,
      sessionId,
    });
    return false;
  }
}

/**
 * Sync user's avoid exercise ratings to workout preferences in the background
 * This runs asynchronously to not block the check-in flow
 */
async function syncAvoidExercisesInBackground(
  userId: string,
  businessId: string,
  preferenceId: string
): Promise<void> {
  try {
    logger.info("Starting background sync of avoid exercises", {
      userId,
      businessId,
      preferenceId,
    });

    // Get all avoid ratings for the user in this business
    const avoidRatings = await db
      .select({
        exerciseId: UserExerciseRatings.exerciseId,
        exerciseName: exercises.name,
      })
      .from(UserExerciseRatings)
      .innerJoin(exercises, eq(UserExerciseRatings.exerciseId, exercises.id))
      .where(
        and(
          eq(UserExerciseRatings.userId, userId),
          eq(UserExerciseRatings.businessId, businessId),
          eq(UserExerciseRatings.ratingType, "avoid")
        )
      );

    const avoidExerciseNames = avoidRatings.map(r => r.exerciseName);

    if (avoidExerciseNames.length > 0) {
      // Update the preferences with avoid exercises
      await db
        .update(WorkoutPreferences)
        .set({
          avoidExercises: avoidExerciseNames,
        })
        .where(eq(WorkoutPreferences.id, preferenceId));

      logger.info("Successfully synced avoid exercises to preferences", {
        userId,
        businessId,
        preferenceId,
        avoidCount: avoidExerciseNames.length,
        exercises: avoidExerciseNames,
      });
    } else {
      logger.info("No avoid exercises found for user", {
        userId,
        businessId,
      });
    }
  } catch (error) {
    // Log error but don't throw - this is a background operation
    logger.error("Failed to sync avoid exercises in background", {
      error,
      userId,
      businessId,
      preferenceId,
    });
  }
}
