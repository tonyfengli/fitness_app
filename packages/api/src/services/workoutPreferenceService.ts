import { db } from "@acme/db/client";
import { WorkoutPreferences, UserTrainingSession, TrainingSession, user } from "@acme/db/schema";
import { eq, and, or, desc } from "@acme/db";
import { createLogger } from "../utils/logger";

const logger = createLogger("WorkoutPreferenceService");

interface ParsedPreferences {
  intensity?: "low" | "moderate" | "high";
  muscleTargets?: string[];
  muscleLessens?: string[];
  includeExercises?: string[];
  avoidExercises?: string[];
  avoidJoints?: string[];
  sessionGoal?: "strength" | "stability" | null;
  generalNotes?: string;
  systemPromptUsed?: string;
  intensitySource?: "explicit" | "default" | "inherited";
  sessionGoalSource?: "explicit" | "default" | "inherited";
}

// SSE broadcast function removed - will be replaced with Supabase Realtime

export class WorkoutPreferenceService {
  static getPreferencePrompt(userName?: string): string {
    const name = userName || "there";
    return `You're checked in, ${name}! What's your priority for today's session? Examples: "abs" or "stability work."`;
  }

  static async isAwaitingPreferences(phoneNumber: string): Promise<{
    waiting: boolean;
    userId?: string;
    trainingSessionId?: string;
    businessId?: string;
    currentStep?: string;
  }> {
    try {
      // Find user by phone
      const [foundUser] = await db
        .select()
        .from(user)
        .where(eq(user.phone, phoneNumber))
        .limit(1);

      if (!foundUser) {
        return { waiting: false };
      }

      // Check if user is checked into an open session without preferences
      const [activeCheckIn] = await db
        .select({
          trainingSessionId: UserTrainingSession.trainingSessionId,
          userId: UserTrainingSession.userId,
          preferenceCollectionStep: UserTrainingSession.preferenceCollectionStep,
          businessId: TrainingSession.businessId,
        })
        .from(UserTrainingSession)
        .innerJoin(
          TrainingSession,
          eq(UserTrainingSession.trainingSessionId, TrainingSession.id)
        )
        .where(
          and(
            eq(UserTrainingSession.userId, foundUser.id),
            eq(UserTrainingSession.status, "checked_in"),
            or(
              eq(UserTrainingSession.preferenceCollectionStep, "not_started"),
              eq(UserTrainingSession.preferenceCollectionStep, "initial_collected"),
              eq(UserTrainingSession.preferenceCollectionStep, "disambiguation_pending"),
              eq(UserTrainingSession.preferenceCollectionStep, "disambiguation_clarifying"),
              eq(UserTrainingSession.preferenceCollectionStep, "followup_sent"),
              eq(UserTrainingSession.preferenceCollectionStep, "preferences_active")
            ),
            eq(TrainingSession.status, "open")
          )
        )
        .limit(1);

      if (activeCheckIn) {
        return {
          waiting: true,
          userId: activeCheckIn.userId,
          trainingSessionId: activeCheckIn.trainingSessionId,
          businessId: activeCheckIn.businessId,
          currentStep: activeCheckIn.preferenceCollectionStep,
        };
      }
    } catch (error) {
      logger.error("Error checking preference state:", error);
    }

    return { waiting: false };
  }

  static async saveSimplePreferences(
    userId: string,
    sessionId: string,
    businessId: string,
    preferences: Partial<ParsedPreferences>
  ): Promise<void> {
    try {
      // Only save if there are simple preferences to save
      const hasSimplePrefs = preferences.intensity || 
                            preferences.sessionGoal !== undefined ||
                            preferences.muscleTargets?.length ||
                            preferences.muscleLessens?.length ||
                            preferences.avoidJoints?.length;
      
      if (!hasSimplePrefs) {
        return;
      }

      logger.info("Saving simple preferences (fire-and-forget)", { 
        userId, 
        sessionId,
        hasIntensity: !!preferences.intensity,
        hasSessionGoal: preferences.sessionGoal !== undefined,
        hasMuscleTargets: !!preferences.muscleTargets?.length
      });

      // Check if preferences already exist
      const [existing] = await db
        .select()
        .from(WorkoutPreferences)
        .where(
          and(
            eq(WorkoutPreferences.userId, userId),
            eq(WorkoutPreferences.trainingSessionId, sessionId)
          )
        )
        .limit(1);

      if (existing) {
        // Update only the simple preference fields
        await db
          .update(WorkoutPreferences)
          .set({
            intensity: preferences.intensity || existing.intensity,
            muscleTargets: preferences.muscleTargets || existing.muscleTargets,
            muscleLessens: preferences.muscleLessens || existing.muscleLessens,
            avoidJoints: preferences.avoidJoints || existing.avoidJoints,
            sessionGoal: preferences.sessionGoal !== undefined ? preferences.sessionGoal : existing.sessionGoal,
          })
          .where(eq(WorkoutPreferences.id, existing.id));
      } else {
        // Insert new preferences with only simple fields
        await db.insert(WorkoutPreferences).values({
          userId,
          trainingSessionId: sessionId,
          businessId,
          intensity: preferences.intensity,
          muscleTargets: preferences.muscleTargets,
          muscleLessens: preferences.muscleLessens,
          avoidJoints: preferences.avoidJoints,
          sessionGoal: preferences.sessionGoal,
          collectionMethod: "sms",
        });
      }

      // SSE broadcast removed - will be replaced with Supabase Realtime
    } catch (error) {
      logger.error("Error saving simple preferences (non-blocking):", error);
      // Don't throw - this is fire-and-forget
    }
  }

  static async savePreferences(
    userId: string,
    sessionId: string,
    businessId: string,
    preferences: ParsedPreferences,
    step: "initial_collected" | "disambiguation_pending" | "disambiguation_clarifying" | "disambiguation_resolved" | "followup_sent" | "preferences_active" = "initial_collected"
  ): Promise<void> {
    console.log("[WorkoutPreferenceService.savePreferences] START", {
      userId,
      sessionId,
      businessId,
      step,
      preferencesKeys: Object.keys(preferences),
      includeExercisesCount: preferences.includeExercises?.length || 0
    });

    try {
      // Check if preferences already exist
      const [existing] = await db
        .select()
        .from(WorkoutPreferences)
        .where(
          and(
            eq(WorkoutPreferences.userId, userId),
            eq(WorkoutPreferences.trainingSessionId, sessionId)
          )
        )
        .limit(1);
      
      console.log("[WorkoutPreferenceService.savePreferences] Existing check:", {
        userId,
        sessionId,
        existingFound: !!existing,
        existingId: existing?.id
      });

      if (existing) {
        // Update existing preferences (intelligent merge)
        // For arrays: merge if new array is not empty, otherwise keep existing
        // For scalars: use new value if provided, otherwise keep existing
        const mergedPreferences = {
          intensity: preferences.intensity !== undefined ? preferences.intensity : existing.intensity,
          intensitySource: preferences.intensity !== undefined 
            ? (preferences.intensitySource || 'explicit')
            : existing.intensitySource,
          muscleTargets: preferences.muscleTargets !== undefined
            ? preferences.muscleTargets 
            : existing.muscleTargets,
          muscleLessens: preferences.muscleLessens !== undefined
            ? preferences.muscleLessens
            : existing.muscleLessens,
          includeExercises: preferences.includeExercises !== undefined
            ? preferences.includeExercises
            : existing.includeExercises,
          avoidExercises: preferences.avoidExercises !== undefined
            ? preferences.avoidExercises
            : existing.avoidExercises,
          avoidJoints: preferences.avoidJoints !== undefined
            ? preferences.avoidJoints
            : existing.avoidJoints,
          sessionGoal: preferences.sessionGoal !== undefined 
            ? preferences.sessionGoal 
            : existing.sessionGoal,
          sessionGoalSource: preferences.sessionGoal !== undefined
            ? (preferences.sessionGoalSource || 'explicit')
            : existing.sessionGoalSource,
        };

        await db
          .update(WorkoutPreferences)
          .set(mergedPreferences)
          .where(eq(WorkoutPreferences.id, existing.id));
        
        logger.info("Updated existing preferences with merge", {
          userId,
          sessionId,
          existing: {
            intensity: existing.intensity,
            includeExercisesCount: existing.includeExercises?.length || 0,
          },
          new: {
            intensity: preferences.intensity,
            includeExercisesCount: preferences.includeExercises?.length || 0,
          },
          merged: {
            intensity: mergedPreferences.intensity,
            includeExercisesCount: mergedPreferences.includeExercises?.length || 0,
          }
        });
      } else {
        // Insert new preferences
        const valuesToInsert = {
          userId,
          trainingSessionId: sessionId,
          businessId,
          intensity: preferences.intensity || 'moderate', // Default to moderate if not provided
          intensitySource: preferences.intensity !== undefined 
            ? (preferences.intensitySource || 'explicit') 
            : 'default',
          muscleTargets: preferences.muscleTargets,
          muscleLessens: preferences.muscleLessens,
          includeExercises: preferences.includeExercises,
          avoidExercises: preferences.avoidExercises,
          avoidJoints: preferences.avoidJoints,
          sessionGoal: preferences.sessionGoal,
          sessionGoalSource: preferences.sessionGoal !== undefined
            ? (preferences.sessionGoalSource || 'explicit')
            : 'default',
          collectionMethod: "sms",
        };
        
        console.log("[WorkoutPreferenceService.savePreferences] About to INSERT new preferences");
        
        logger.info("Inserting new preferences", {
          userId,
          sessionId,
          exerciseCounts: {
            avoidExercises: preferences.avoidExercises?.length || 0,
            includeExercises: preferences.includeExercises?.length || 0,
          },
          fullValues: valuesToInsert
        });
        
        await db.insert(WorkoutPreferences).values(valuesToInsert);
        
        console.log("[WorkoutPreferenceService.savePreferences] INSERT completed successfully");
      }

      // Update check-in to mark preferences collection step
      await db
        .update(UserTrainingSession)
        .set({ preferenceCollectionStep: step })
        .where(
          and(
            eq(UserTrainingSession.userId, userId),
            eq(UserTrainingSession.trainingSessionId, sessionId)
          )
        );

      console.log("[WorkoutPreferenceService.savePreferences] SUCCESS - Preferences saved", {
        userId,
        sessionId,
        step,
        wasUpdate: !!existing,
        includeExercisesCount: preferences.includeExercises?.length || 0
      });
      
      logger.info("Preferences saved successfully", { userId, sessionId, step, isUpdate: !!existing });
      
      // Invalidate blueprint cache when preferences change
      const { WorkoutBlueprintService } = await import("./workout-blueprint-service");
      await WorkoutBlueprintService.invalidateCache(sessionId);
      logger.info("Blueprint cache invalidated for session", { sessionId });
      
      // SSE broadcast removed - will be replaced with Supabase Realtime
      logger.info("Preference update completed (real-time updates temporarily disabled)", { 
        userId, 
        sessionId
      });
    } catch (error) {
      console.error("[WorkoutPreferenceService.savePreferences] ERROR:", {
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
        userId,
        sessionId
      });
      
      logger.error("Error saving preferences:", error);
      throw error;
    }
  }

  static async getPreferences(sessionId: string): Promise<ParsedPreferences | null> {
    try {
      const [preference] = await db
        .select()
        .from(WorkoutPreferences)
        .where(eq(WorkoutPreferences.trainingSessionId, sessionId))
        .orderBy(desc(WorkoutPreferences.collectedAt))
        .limit(1);

      if (!preference) {
        return null;
      }

      return {
        intensity: preference.intensity as ParsedPreferences["intensity"],
        intensitySource: preference.intensitySource as ParsedPreferences["intensitySource"],
        muscleTargets: preference.muscleTargets || [],
        muscleLessens: preference.muscleLessens || [],
        includeExercises: preference.includeExercises || [],
        avoidExercises: preference.avoidExercises || [],
        avoidJoints: preference.avoidJoints || [],
        sessionGoal: preference.sessionGoal as ParsedPreferences["sessionGoal"],
        sessionGoalSource: preference.sessionGoalSource as ParsedPreferences["sessionGoalSource"],
      };
    } catch (error) {
      logger.error("Error getting preferences:", error);
      return null;
    }
  }
}