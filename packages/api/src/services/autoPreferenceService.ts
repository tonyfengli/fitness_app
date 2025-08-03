/**
 * Auto Preference Service
 * Automatically creates default preferences for standard template workouts
 */

import { db } from "@acme/db/client";
import { WorkoutPreferences, TrainingSession, user } from "@acme/db/schema";
import { eq, and } from "@acme/db";
import { getWorkoutTemplate } from "@acme/ai";
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
    const standardTemplates = ['standard', 'standard_strength'];
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
  options: AutoPreferenceOptions
): Promise<boolean> {
  const { userId, sessionId, businessId } = options;

  try {
    // 1. Check if it's a standard template session
    const isStandard = await isStandardTemplateSession(sessionId);
    if (!isStandard) {
      logger.info("Not a standard template, skipping auto preferences", { sessionId });
      return false;
    }

    // 2. Check if preferences already exist
    const [existingPref] = await db
      .select()
      .from(WorkoutPreferences)
      .where(
        and(
          eq(WorkoutPreferences.userId, userId),
          eq(WorkoutPreferences.trainingSessionId, sessionId)
        )
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
        // Default to full body with finisher
        workoutType: "full_body_with_finisher",
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