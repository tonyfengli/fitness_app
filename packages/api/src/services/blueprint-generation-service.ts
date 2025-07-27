import { db } from "@acme/db/client";
import { TrainingSession, UserTrainingSession, WorkoutPreferences, exercises, user as userTable } from "@acme/db/schema";
import { eq, and, inArray } from "@acme/db";
import { 
  generateGroupWorkoutBlueprint, 
  filterExercises, 
  scoreAndSortExercises,
  type ClientContext,
  type GroupContext,
  type ScoredExercise,
  type Exercise
} from "@acme/ai";
import { groupWorkoutTestDataLogger } from "../utils/groupWorkoutTestDataLogger";
import { createLogger } from "../utils/logger";

const logger = createLogger("BlueprintGenerationService");

export class BlueprintGenerationService {
  /**
   * Generate and store blueprint for a session if it doesn't exist
   */
  static async ensureBlueprintExists(sessionId: string): Promise<boolean> {
    try {
      // Check if blueprint already exists
      const [session] = await db
        .select({
          templateConfig: TrainingSession.templateConfig,
          templateType: TrainingSession.templateType,
          businessId: TrainingSession.businessId
        })
        .from(TrainingSession)
        .where(eq(TrainingSession.id, sessionId))
        .limit(1);

      if (!session) {
        logger.error("Session not found", { sessionId });
        return false;
      }

      // Check if we already have a full blueprint (not just summary)
      const config = session.templateConfig as any;
      if (config?.blueprint?.blocks) {
        logger.info("Blueprint already exists", { sessionId });
        return true;
      }

      // Get all checked-in clients with preferences
      const clientsData = await db
        .select({
          userId: UserTrainingSession.userId,
          user: userTable,
          preferences: WorkoutPreferences
        })
        .from(UserTrainingSession)
        .innerJoin(
          userTable,
          eq(userTable.id, UserTrainingSession.userId)
        )
        .leftJoin(
          WorkoutPreferences,
          and(
            eq(WorkoutPreferences.userId, UserTrainingSession.userId),
            eq(WorkoutPreferences.trainingSessionId, UserTrainingSession.trainingSessionId)
          )
        )
        .where(eq(UserTrainingSession.trainingSessionId, sessionId));

      if (clientsData.length === 0) {
        logger.warn("No clients checked in", { sessionId });
        return false;
      }

      logger.info("Generating blueprint for session", { 
        sessionId, 
        clientCount: clientsData.length 
      });

      // Get all exercises (no business filtering for now)
      const businessExercises = await db
        .select()
        .from(exercises);

      if (businessExercises.length === 0) {
        logger.error("No exercises found for business", { businessId: session.businessId });
        return false;
      }

      // Process each client
      const clientProcessingResults = await Promise.all(
        clientsData.map(async (client) => {
          const prefs = client.preferences;
          
          // Filter exercises
          const filterInput = {
            strengthCapacity: 'moderate' as any, // Default for now
            skillCapacity: 'moderate' as any, // Default for now
            intensity: (prefs?.intensity || 'moderate') as any,
            sessionGoal: prefs?.sessionGoal || 'general_fitness',
            muscleTarget: prefs?.muscleTargets || [],
            muscleLessen: prefs?.muscleLessens || [],
            includeExercises: prefs?.includeExercises || [],
            avoidExercises: prefs?.avoidExercises || [],
            avoidJoints: prefs?.avoidJoints || []
          };

          const filteredResult = filterExercises({
            exercises: businessExercises as Exercise[],
            clientContext: filterInput,
            includeScoring: false
          });

          // Check if we have exercises to score
          const exercisesToScore = filteredResult.exercises || [];
          
          // Score exercises only if we have some
          const scoredExercises = exercisesToScore.length > 0 
            ? scoreAndSortExercises(filterInput, exercisesToScore)
            : [];

          // Create ClientContext
          const clientContext: ClientContext = {
            user_id: client.userId,
            name: client.user.name || client.user.email || 'Client',
            strength_capacity: filterInput.strengthCapacity,
            skill_capacity: filterInput.skillCapacity,
            intensity: filterInput.intensity,
            primary_goal: filterInput.sessionGoal,
            muscle_target: filterInput.muscleTarget,
            muscle_lessen: filterInput.muscleLessen,
            exercise_requests: {
              include: filterInput.includeExercises,
              avoid: filterInput.avoidExercises
            },
            avoid_joints: filterInput.avoidJoints,
          };

          return {
            clientContext,
            filteredExercises: scoredExercises
          };
        })
      );

      // Create pre-scored exercise map
      const preScoredExercises = new Map<string, ScoredExercise[]>();
      const exercisePool: Exercise[] = [];
      const seenExerciseIds = new Set<string>();

      for (const result of clientProcessingResults) {
        preScoredExercises.set(result.clientContext.user_id, result.filteredExercises);
        
        // Build exercise pool
        for (const exercise of result.filteredExercises) {
          if (!seenExerciseIds.has(exercise.id)) {
            seenExerciseIds.add(exercise.id);
            const { score, scoreBreakdown, ...cleanExercise } = exercise;
            exercisePool.push(cleanExercise as Exercise);
          }
        }
      }

      // Create GroupContext
      const groupContext: GroupContext = {
        clients: clientProcessingResults.map(r => r.clientContext),
        sessionId,
        businessId: session.businessId,
        templateType: (session.templateType || 'full_body_bmf') as any
      };

      // Generate blueprint
      const blueprint = await generateGroupWorkoutBlueprint(
        groupContext,
        exercisePool,
        preScoredExercises
      );

      // Store full blueprint in templateConfig
      await db
        .update(TrainingSession)
        .set({
          templateConfig: {
            blueprint,
            generatedAt: new Date().toISOString(),
            clientCount: clientsData.length
          }
        })
        .where(eq(TrainingSession.id, sessionId));

      logger.info("Blueprint stored successfully", { sessionId });
      return true;

    } catch (error) {
      logger.error("Error generating blueprint", error);
      return false;
    }
  }
}