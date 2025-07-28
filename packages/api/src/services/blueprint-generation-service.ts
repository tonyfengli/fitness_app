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
   * Generate blueprint for a session and return it (no DB storage)
   */
  static async generateBlueprint(sessionId: string): Promise<any | null> {
    console.log("[BlueprintGenerationService] generateBlueprint called!", { sessionId });
    
    try {
      console.log("[BlueprintGenerationService] Inside try block");
      
      // Log the calling context
      const stack = new Error().stack;
      const caller = stack?.split('\n')[3]?.trim() || 'unknown';
      
      console.log("[BlueprintGenerationService] About to log with logger");
      logger.info("Starting blueprint generation", { 
        sessionId,
        caller,
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV
      });
      console.log("[BlueprintGenerationService] Logger call completed");
      
      // Get the session
      console.log("[BlueprintGenerationService] About to query session");
      const [session] = await db
        .select({
          templateType: TrainingSession.templateType,
          businessId: TrainingSession.businessId
        })
        .from(TrainingSession)
        .where(eq(TrainingSession.id, sessionId))
        .limit(1);
      console.log("[BlueprintGenerationService] Session query result:", session);

      if (!session) {
        logger.error("Session not found", { sessionId });
        return null;
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
      logger.info("About to query exercises from database", {
        sessionId,
        dbClient: !!db,
        exercisesTable: !!exercises
      });
      
      const startQuery = Date.now();
      const businessExercises = await db
        .select()
        .from(exercises);
      const queryTime = Date.now() - startQuery;

      logger.info("Exercise query results", { 
        exerciseCount: businessExercises.length,
        sessionId,
        queryTimeMs: queryTime,
        firstFewExercises: businessExercises.slice(0, 3).map(e => ({ 
          id: e.id, 
          name: e.name,
          strengthLevel: e.strengthLevel,
          complexityLevel: e.complexityLevel,
          primaryMuscle: e.primaryMuscle
        })),
        sampleFieldCheck: businessExercises[0] ? Object.keys(businessExercises[0]) : []
      });

      if (businessExercises.length === 0) {
        logger.error("No exercises found for business", { businessId: session.businessId });
        return null;
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

          logger.info("About to call filterExercises", {
            clientId: client.userId,
            exerciseCount: businessExercises.length,
            filterInput,
            firstExerciseBeforeFilter: businessExercises[0] ? { id: businessExercises[0].id, name: businessExercises[0].name } : null
          });

          const filterStart = Date.now();
          
          // Log the exact data being passed to filterExercises
          logger.info("Calling filterExercises with data", {
            clientId: client.userId,
            exerciseArrayLength: (businessExercises as Exercise[]).length,
            isArray: Array.isArray(businessExercises),
            exerciseType: typeof businessExercises,
            sampleExercise: businessExercises[0] ? {
              ...businessExercises[0],
              hasStrengthLevel: 'strengthLevel' in businessExercises[0],
              hasComplexityLevel: 'complexityLevel' in businessExercises[0]
            } : null
          });
          
          const filteredResult = await filterExercises({
            exercises: businessExercises as Exercise[],
            clientContext: filterInput,
            includeScoring: false
          });
          const filterTime = Date.now() - filterStart;

          // filterExercises returns an array directly
          const exercisesToScore = filteredResult || [];
          
          logger.info("Client filter results", {
            clientId: client.userId,
            exercisesBeforeFilter: (businessExercises as Exercise[]).length,
            exercisesAfterFilter: exercisesToScore.length,
            filteredResultType: Array.isArray(filteredResult) ? 'array' : typeof filteredResult,
            filterTimeMs: filterTime,
            firstFilteredExercise: exercisesToScore[0] ? { id: exercisesToScore[0].id, name: exercisesToScore[0].name } : null
          });
          
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

      logger.info("Blueprint generated successfully", { 
        sessionId,
        blockCount: blueprint.blocks.length
      });

      return blueprint;

    } catch (error) {
      console.error("[BlueprintGenerationService] Error in generateBlueprint:", error);
      logger.error("Error generating blueprint", {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        sessionId
      });
      return null;
    }
  }
}