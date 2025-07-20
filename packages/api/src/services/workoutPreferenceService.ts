import { db } from "@acme/db/client";
import { WorkoutPreferences, UserTrainingSession, TrainingSession, user } from "@acme/db/schema";
import { eq, and, or } from "@acme/db";
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
}

// Type for the broadcast function - will be injected from the API layer
let broadcastPreferenceUpdate: ((sessionId: string, preferenceData: {
  userId: string;
  preferences: {
    intensity?: string | null;
    muscleTargets?: string[] | null;
    muscleLessens?: string[] | null;
    includeExercises?: string[] | null;
    avoidExercises?: string[] | null;
    avoidJoints?: string[] | null;
    sessionGoal?: string | null;
  };
}) => void) | null = null;

export function setPreferenceBroadcastFunction(fn: typeof broadcastPreferenceUpdate) {
  broadcastPreferenceUpdate = fn;
}

export class WorkoutPreferenceService {
  static readonly PREFERENCE_PROMPT = "How are you feeling today? Is there anything I should know before building your workout?";

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
              eq(UserTrainingSession.preferenceCollectionStep, "followup_sent")
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

      // Broadcast update if available
      if (broadcastPreferenceUpdate) {
        broadcastPreferenceUpdate(sessionId, {
          userId,
          preferences: {
            intensity: preferences.intensity || null,
            muscleTargets: preferences.muscleTargets || null,
            muscleLessens: preferences.muscleLessens || null,
            avoidJoints: preferences.avoidJoints || null,
            sessionGoal: preferences.sessionGoal || null,
          }
        });
      }
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
    step: "initial_collected" | "disambiguation_pending" | "disambiguation_resolved" | "followup_sent" | "preferences_active" = "initial_collected"
  ): Promise<void> {
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

      if (existing) {
        // Update existing preferences (merge with new data)
        await db
          .update(WorkoutPreferences)
          .set({
            intensity: preferences.intensity || existing.intensity,
            muscleTargets: preferences.muscleTargets || existing.muscleTargets,
            muscleLessens: preferences.muscleLessens || existing.muscleLessens,
            includeExercises: preferences.includeExercises || existing.includeExercises,
            avoidExercises: preferences.avoidExercises || existing.avoidExercises,
            avoidJoints: preferences.avoidJoints || existing.avoidJoints,
            sessionGoal: preferences.sessionGoal || existing.sessionGoal,
          })
          .where(eq(WorkoutPreferences.id, existing.id));
      } else {
        // Insert new preferences
        const valuesToInsert = {
          userId,
          trainingSessionId: sessionId,
          businessId,
          intensity: preferences.intensity,
          muscleTargets: preferences.muscleTargets,
          muscleLessens: preferences.muscleLessens,
          includeExercises: preferences.includeExercises,
          avoidExercises: preferences.avoidExercises,
          avoidJoints: preferences.avoidJoints,
          sessionGoal: preferences.sessionGoal,
          collectionMethod: "sms",
        };
        
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

      logger.info("Preferences saved successfully", { userId, sessionId, step, isUpdate: !!existing });
      
      // Broadcast preference update if broadcast function is available
      if (broadcastPreferenceUpdate) {
        broadcastPreferenceUpdate(sessionId, {
          userId,
          preferences: {
            intensity: preferences.intensity || null,
            muscleTargets: preferences.muscleTargets || null,
            muscleLessens: preferences.muscleLessens || null,
            includeExercises: preferences.includeExercises || null,
            avoidExercises: preferences.avoidExercises || null,
            avoidJoints: preferences.avoidJoints || null,
            sessionGoal: preferences.sessionGoal || null,
          }
        });
        logger.info("Broadcasted preference update", { userId, sessionId });
      }
    } catch (error) {
      logger.error("Error saving preferences:", error);
      throw error;
    }
  }

}