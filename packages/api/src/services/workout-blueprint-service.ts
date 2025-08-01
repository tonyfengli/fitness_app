import { db } from "@acme/db/client";
import { eq, and } from "@acme/db";
import { 
  TrainingSession, 
  UserTrainingSession, 
  WorkoutPreferences, 
  UserProfile,
  user
} from "@acme/db/schema";
import { 
  generateGroupWorkoutBlueprint,
  type ClientContext,
  type GroupContext,
  type ScoredExercise,
  type Exercise
} from "@acme/ai";
import { ExerciseFilterService, type WorkoutGenerationInput } from "./exercise-filter-service";
import { createLogger } from "../utils/logger";
import { Redis } from "ioredis";

const logger = createLogger("WorkoutBlueprintService");

// Initialize Redis client for caching (optional)
let redis: Redis | null = null;

// Only initialize Redis if configuration is provided
if (process.env.REDIS_HOST || process.env.REDIS_URL) {
  try {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn("Redis connection failed after 3 attempts, blueprint caching disabled");
          return null;
        }
        return Math.min(times * 100, 2000);
      }
    });

    // Attempt to connect to Redis
    redis.connect().catch((err) => {
      logger.warn("Redis connection failed, blueprint caching will be disabled", { error: err.message });
      redis = null;
    });
  } catch (error) {
    logger.warn("Failed to initialize Redis client", { error });
    redis = null;
  }
} else {
  logger.info("Redis not configured, blueprint caching disabled");
}

interface BlueprintSetupResult {
  clientContexts: ClientContext[];
  preScoredExercises: Map<string, ScoredExercise[]>;
  exercisePool: Exercise[];
  groupContext: GroupContext;
}

interface BlueprintCacheEntry {
  blueprint: any;
  timestamp: number;
  clientCount: number;
  templateType: string;
}

export class WorkoutBlueprintService {
  private static readonly CACHE_TTL = 300; // 5 minutes in seconds
  private static readonly CACHE_PREFIX = "blueprint:";

  /**
   * Prepare clients and their contexts for blueprint generation
   * This is the shared setup logic used by multiple endpoints
   */
  static async prepareClientsForBlueprint(
    sessionId: string,
    businessId: string,
    userId: string
  ): Promise<BlueprintSetupResult> {
    logger.info("Preparing clients for blueprint generation", { sessionId, businessId });

    // Get session details
    const [session] = await db
      .select({
        id: TrainingSession.id,
        templateType: TrainingSession.templateType
      })
      .from(TrainingSession)
      .where(eq(TrainingSession.id, sessionId))
      .limit(1);

    if (!session) {
      throw new Error("Session not found");
    }

    // Get all checked-in clients with their names
    const checkedInClients = await db
      .select({
        userId: UserTrainingSession.userId,
        userName: user.name,
        status: UserTrainingSession.status
      })
      .from(UserTrainingSession)
      .innerJoin(
        user,
        eq(user.id, UserTrainingSession.userId)
      )
      .where(
        and(
          eq(UserTrainingSession.trainingSessionId, sessionId),
          eq(UserTrainingSession.status, "checked_in")
        )
      );

    if (checkedInClients.length === 0) {
      throw new Error("No checked-in clients found");
    }

    // Get preferences and profiles for all clients
    const clientsWithData = await Promise.all(
      checkedInClients.map(async (client) => {
        const [preferences] = await db
          .select()
          .from(WorkoutPreferences)
          .where(
            and(
              eq(WorkoutPreferences.userId, client.userId),
              eq(WorkoutPreferences.trainingSessionId, sessionId)
            )
          )
          .limit(1);

        const [userProfile] = await db
          .select()
          .from(UserProfile)
          .where(
            and(
              eq(UserProfile.userId, client.userId),
              eq(UserProfile.businessId, businessId)
            )
          )
          .limit(1);

        return { ...client, preferences, userProfile };
      })
    );

    // Create client contexts
    const clientContexts: ClientContext[] = clientsWithData.map(client => ({
      user_id: client.userId,
      name: client.userName ?? 'Unknown',
      strength_capacity: (client.userProfile?.strengthLevel ?? 'moderate') as "very_low" | "low" | "moderate" | "high",
      skill_capacity: (client.userProfile?.skillLevel ?? 'moderate') as "very_low" | "low" | "moderate" | "high",
      primary_goal: (client.preferences?.sessionGoal ?? 'general_fitness') as any,
      intensity: (client.preferences?.intensity ?? 'moderate') as "low" | "moderate" | "high",
      muscle_target: client.preferences?.muscleTargets || [],
      muscle_lessen: client.preferences?.muscleLessens || [],
      exercise_requests: {
        include: client.preferences?.includeExercises || [],
        avoid: client.preferences?.avoidExercises || []
      },
      avoid_joints: client.preferences?.avoidJoints || [],
      default_sets: 10
    }));

    // Process exercises for each client using ExerciseFilterService
    const filterService = new ExerciseFilterService(db);
    const preScoredExercises = new Map<string, ScoredExercise[]>();
    const exercisePool: Exercise[] = [];
    const seenExerciseIds = new Set<string>();

    for (let i = 0; i < clientContexts.length; i++) {
      const client = clientsWithData[i];
      const clientContext = clientContexts[i];
      
      if (!client || !clientContext) {
        logger.warn("Skipping client due to missing data", { index: i });
        continue;
      }

      const filterInput: WorkoutGenerationInput = {
        clientId: client.userId,
        sessionGoal: (clientContext.primary_goal === 'strength' ? 'strength' : 'stability') as "strength" | "stability",
        intensity: clientContext.intensity || 'moderate',
        template: 'full_body' as "standard" | "circuit" | "full_body", // Always use full_body for BMF
        includeExercises: clientContext.exercise_requests?.include || [],
        avoidExercises: clientContext.exercise_requests?.avoid || [],
        muscleTarget: clientContext.muscle_target || [],
        muscleLessen: clientContext.muscle_lessen || [],
        avoidJoints: clientContext.avoid_joints || [],
        debug: false,
      };

      // Run Phase 1 & 2 using the filter service
      const filteredResult = await filterService.filterForWorkoutGeneration(filterInput, {
        userId,
        businessId
      });

      // Store pre-scored exercises for this client
      preScoredExercises.set(clientContext.user_id, filteredResult.exercises);

      // Build exercise pool (without duplicates)
      for (const exercise of filteredResult.exercises) {
        if (!seenExerciseIds.has(exercise.id)) {
          seenExerciseIds.add(exercise.id);
          const { score, scoreBreakdown, ...cleanExercise } = exercise;
          exercisePool.push(cleanExercise as Exercise);
        }
      }
    }

    // Create group context
    const groupContext: GroupContext = {
      clients: clientContexts,
      sessionId,
      businessId,
      templateType: (session.templateType || 'full_body_bmf') as 'full_body_bmf'
    };

    logger.info("Client preparation completed", {
      sessionId,
      clientCount: clientContexts.length,
      exercisePoolSize: exercisePool.length
    });

    return {
      clientContexts,
      preScoredExercises,
      exercisePool,
      groupContext
    };
  }

  /**
   * Generate blueprint with caching support
   */
  static async generateBlueprintWithCache(
    sessionId: string,
    businessId: string,
    userId: string,
    forceRegenerate: boolean = false
  ): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}${sessionId}`;

    // Try to get from cache if not forcing regeneration
    if (!forceRegenerate && redis && redis.status === 'ready') {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const cacheEntry: BlueprintCacheEntry = JSON.parse(cached);
          const age = Date.now() - cacheEntry.timestamp;
          
          logger.info("Blueprint cache hit", {
            sessionId,
            ageMs: age,
            clientCount: cacheEntry.clientCount
          });

          return cacheEntry.blueprint;
        }
      } catch (error) {
        logger.warn("Error reading from cache", { error, sessionId });
      }
    }

    // Generate new blueprint
    logger.info("Generating new blueprint", { sessionId, forceRegenerate });
    
    const setup = await this.prepareClientsForBlueprint(sessionId, businessId, userId);
    
    const blueprint = await generateGroupWorkoutBlueprint(
      setup.groupContext,
      setup.exercisePool,
      setup.preScoredExercises
    );

    // Cache the blueprint if Redis is available
    if (redis && redis.status === 'ready') {
      try {
        const cacheEntry: BlueprintCacheEntry = {
          blueprint,
          timestamp: Date.now(),
          clientCount: setup.clientContexts.length,
          templateType: setup.groupContext.templateType || 'workout'
        };

        await redis.setex(
          cacheKey,
          this.CACHE_TTL,
          JSON.stringify(cacheEntry)
        );

        logger.info("Blueprint cached", { sessionId, ttl: this.CACHE_TTL });
      } catch (error) {
        logger.warn("Error caching blueprint", { error, sessionId });
      }
    }

    return blueprint;
  }

  /**
   * Invalidate blueprint cache for a session
   * Called when preferences are updated
   */
  static async invalidateCache(sessionId: string): Promise<void> {
    if (!redis || redis.status !== 'ready') {
      return;
    }

    const cacheKey = `${this.CACHE_PREFIX}${sessionId}`;
    
    try {
      await redis.del(cacheKey);
      logger.info("Blueprint cache invalidated", { sessionId });
    } catch (error) {
      logger.warn("Error invalidating cache", { error, sessionId });
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  static async getCacheStats(): Promise<{
    connected: boolean;
    cachedSessions: number;
  }> {
    if (!redis || redis.status !== 'ready') {
      return { connected: false, cachedSessions: 0 };
    }

    try {
      const keys = await redis.keys(`${this.CACHE_PREFIX}*`);
      return {
        connected: true,
        cachedSessions: keys.length
      };
    } catch (error) {
      logger.warn("Error getting cache stats", { error });
      return { connected: false, cachedSessions: 0 };
    }
  }

  /**
   * Cleanup expired cache entries (called periodically)
   */
  static async cleanupCache(): Promise<void> {
    if (!redis || redis.status !== 'ready') {
      return;
    }

    try {
      const keys = await redis.keys(`${this.CACHE_PREFIX}*`);
      let cleaned = 0;

      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl === -1) {
          // Key exists but has no TTL, remove it
          await redis.del(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info("Cache cleanup completed", { cleaned });
      }
    } catch (error) {
      logger.warn("Error during cache cleanup", { error });
    }
  }
}