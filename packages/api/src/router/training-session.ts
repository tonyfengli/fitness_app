import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import type {
  ClientContext,
  Exercise,
  GroupContext,
  ScoredExercise,
} from "@acme/ai";
import { generateGroupWorkoutBlueprint } from "@acme/ai";
import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  CreateTrainingSessionSchema,
  CreateUserTrainingSessionSchema,
  exercises,
  FavoriteSessions,
  TrainingSession,
  user,
  UserProfile,
  user as userTable,
  UserTrainingSession,
  Workout,
  WorkoutExercise,
  workoutExerciseSwaps,
  WorkoutPreferences,
} from "@acme/db/schema";

import type { SessionUser } from "../types/auth";
import { protectedProcedure, publicProcedure } from "../trpc";
import { calculateRoundOrganization, calculateBundleSkeletons, type RoundOrganizationResult } from "../utils/roundOrganization";
import { assignExerciseTiers, type ExerciseWithTier } from "../utils/exerciseTiers";
import { buildAllowedSlots, type AllowedSlotsResult } from "../utils/buildAllowedSlots";
import { getBusinessEquipmentCapacity, type EquipmentCapacityMap } from "../config/equipmentCapacity";
import { WorkoutGenerationService } from "../services/workout-generation-service";
import { generateMinimalMusicConfig } from "../services/music-selection-service";

// Helper function to calculate score distribution
function calculateScoreDistribution(
  exercises: ScoredExercise[],
): { range: string; count: number }[] {
  const ranges = [
    { range: "0-2", min: 0, max: 2, count: 0 },
    { range: "2-4", min: 2, max: 4, count: 0 },
    { range: "4-6", min: 4, max: 6, count: 0 },
    { range: "6-8", min: 6, max: 8, count: 0 },
    { range: "8+", min: 8, max: Infinity, count: 0 },
  ];

  for (const exercise of exercises) {
    const score = exercise.score || 0;
    for (const range of ranges) {
      if (score >= range.min && score < range.max) {
        range.count++;
        break;
      }
    }
  }

  return ranges.map((r) => ({ range: r.range, count: r.count }));
}

// Helper to get equipment needs from exercise name
function getEquipmentFromExercise(exerciseName: string): string[] {
  const name = exerciseName.toLowerCase();
  const equipment: string[] = [];

  // Barbells
  if (name.includes("barbell") && !name.includes("dumbbell")) {
    equipment.push("barbell");
  }

  // Benches
  if (name.includes("bench") || name.includes("incline")) {
    equipment.push("bench");
  }

  // Dumbbells
  if (name.includes("dumbbell") || name.includes("db ")) {
    equipment.push("DB");
  }

  // Kettlebells
  if (name.includes("kettlebell") || name.includes("goblet")) {
    equipment.push("KB");
  }

  // Cable
  if (name.includes("cable") || name.includes("lat pulldown")) {
    equipment.push("cable");
  }

  // Bands
  if (name.includes("band")) {
    equipment.push("band");
  }

  // Landmine
  if (name.includes("landmine")) {
    equipment.push("landmine");
  }

  // Medicine ball
  if (name.includes("medicine ball") || name.includes("med ball")) {
    equipment.push("med ball");
  }

  // Row machine
  if (name.includes("row machine")) {
    equipment.push("row machine");
  }

  // Floor exercises
  if (
    name.includes("plank") ||
    name.includes("dead bug") ||
    name.includes("bird dog") ||
    name.includes("bear crawl") ||
    name.includes("push-up")
  ) {
    equipment.push("none");
  }

  // Swiss ball
  if (name.includes("swiss ball") || name.includes("stability ball")) {
    equipment.push("swiss ball");
  }

  return equipment.length > 0 ? equipment : ["none"];
}

/**
 * Preprocesses Phase 2 data for improved LLM performance
 * This function reorganizes and structures the workout data before sending to LLM
 * 
 * @param ctx - Database context
 * @param sessionId - Training session ID
 * @returns Preprocessed data ready for LLM input or visualization
 */
async function preprocessPhase2Data(
  ctx: any,
  sessionId: string
): Promise<{
  clients: Array<{
    clientId: string;
    clientName: string;
    exerciseCount: number;
  }>;
  totalExercises: number;
  preprocessedAt: string;
  roundOrganization: RoundOrganizationResult;
  exercisesWithTiers: ExerciseWithTier[];
  allowedSlots: AllowedSlotsResult;
  businessId: string;
  equipmentCapacity: EquipmentCapacityMap;
}> {
  // Get session details to get business ID
  const session = await ctx.db.query.TrainingSession.findFirst({
    where: eq(TrainingSession.id, sessionId),
  });

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Get all workouts for this session
  const workouts = await ctx.db.query.Workout.findMany({
    where: eq(Workout.trainingSessionId, sessionId),
  });

  // Get exercises with details and user info for each workout
  const clientsDataWithExercises = await Promise.all(
    workouts.map(async (workout: typeof Workout.$inferSelect) => {
      // Get workout exercises with full exercise details
      const workoutExercises = await ctx.db
        .select({
          id: WorkoutExercise.id,
          exerciseId: WorkoutExercise.exerciseId,
          exercise: exercises,
        })
        .from(WorkoutExercise)
        .innerJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .where(eq(WorkoutExercise.workoutId, workout.id));

      // Get user info
      const user = await ctx.db.query.user.findFirst({
        where: eq(userTable.id, workout.userId),
      });

      return {
        clientId: workout.userId,
        clientName: user?.name || user?.email?.split('@')[0] || "Unknown",
        exerciseCount: workoutExercises.length,
        exercises: workoutExercises.map((we: typeof workoutExercises[number]) => ({
          exerciseId: we.exerciseId,
          clientId: workout.userId,
          name: we.exercise.name,
          movementPattern: we.exercise.movementPattern,
          equipment: we.exercise.equipment,
          functionTags: we.exercise.functionTags,
          primaryMuscle: we.exercise.primaryMuscle,
          modality: we.exercise.modality,
          fatigueProfile: we.exercise.fatigueProfile,
        })),
      };
    }),
  );

  // Extract client data for round organization
  const clientsData = clientsDataWithExercises.map(({ clientId, clientName, exerciseCount }) => ({
    clientId,
    clientName,
    exerciseCount,
  }));

  // Collect all exercises across all clients
  const allExercises = clientsDataWithExercises.flatMap(client => client.exercises);
  
  
  // Assign tiers to all exercises
  const exercisesWithTiers = assignExerciseTiers(allExercises);

  // Calculate total exercises
  const totalExercises = clientsData.reduce((sum, client) => sum + client.exerciseCount, 0);

  // Calculate round organization
  let roundOrganization = calculateRoundOrganization(
    clientsData.map(client => ({
      clientId: client.clientId,
      exerciseCount: client.exerciseCount,
    }))
  );

  // Calculate bundle skeletons
  roundOrganization = calculateBundleSkeletons(roundOrganization);

  // Get equipment capacity for the business
  const equipmentCapacity = getBusinessEquipmentCapacity(session.businessId);

  // Build allowed slots using equipment constraints
  const allowedSlots = buildAllowedSlots(
    exercisesWithTiers,
    roundOrganization.perClientPlan,
    equipmentCapacity,
    roundOrganization.majorityRounds
  );

  return {
    clients: clientsData,
    totalExercises,
    preprocessedAt: new Date().toISOString(),
    roundOrganization,
    exercisesWithTiers,
    allowedSlots,
    businessId: session.businessId,
    equipmentCapacity,
  };
}

export const trainingSessionRouter = {
  // Get deterministic exercise selections for a session
  getDeterministicSelections: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;

      // Get session with template config
      const [session] = await ctx.db
        .select({
          id: TrainingSession.id,
          templateConfig: TrainingSession.templateConfig,
          templateType: TrainingSession.templateType,
        })
        .from(TrainingSession)
        .where(eq(TrainingSession.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      const templateConfig = session.templateConfig as any;
      const blueprint = templateConfig?.blueprint;

      if (!blueprint) {
        return { selections: [] };
      }

      // Handle Standard blueprints (two-phase)
      if (blueprint.clientExercisePools) {
        const clientPool = blueprint.clientExercisePools[user.id];
        if (!clientPool) {
          return { selections: [] };
        }

        // Return pre-assigned exercises from Standard blueprint
        const selections = clientPool.preAssigned.map(
          (preAssigned: any, index: number) => ({
            roundId: `Round${index + 1}`,
            roundName: preAssigned.source || `Round ${index + 1}`,
            exercise: {
              name: preAssigned.exercise.name,
              movementPattern: preAssigned.exercise.movementPattern,
              primaryMuscle: preAssigned.exercise.primaryMuscle,
            },
          }),
        );

        return {
          selections,
          templateType: session.templateType,
          hasBlueprint: true,
          blueprintType: "standard",
        };
      }

      // Handle BMF blueprints (original logic)
      if (!blueprint.blocks) {
        return { selections: [] };
      }

      // Extract deterministic selections for the requesting user
      const selections = [];

      for (const block of blueprint.blocks) {
        if (block.selectionStrategy === "deterministic") {
          // Check individual candidates for this user
          const userCandidates = block.individualCandidates?.[user.id];
          if (userCandidates?.exercises?.length > 0) {
            selections.push({
              roundId: block.blockId,
              roundName: block.name,
              exercise: {
                name: userCandidates.exercises[0].name,
                movementPattern: userCandidates.exercises[0].movementPattern,
                primaryMuscle: userCandidates.exercises[0].primaryMuscle,
              },
            });
          } else if (block.sharedCandidates?.length > 0) {
            // Fall back to shared candidates
            selections.push({
              roundId: block.blockId,
              roundName: block.name,
              exercise: {
                name: block.sharedCandidates[0].name,
                movementPattern: block.sharedCandidates[0].movementPattern,
                primaryMuscle: block.sharedCandidates[0].primaryMuscle,
              },
            });
          }
        }
      }

      return {
        selections,
        templateType: session.templateType,
        hasBlueprint: !!blueprint,
        blueprintType: "bmf",
      };
    }),
  // Create a new training session (trainers only)
  create: protectedProcedure
    .input(CreateTrainingSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;

      // Only trainers can create training sessions
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can create training sessions",
        });
      }

      // Ensure trainer creates sessions for their own business
      if (input.businessId !== user.businessId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only create sessions for your own business",
        });
      }

      // Add default circuit config if creating a circuit session
      const sessionData = {
        ...input,
        trainerId: user.id,
        status: "open" as const, // Explicitly set to open
      };

      // Add default circuit config for circuit templates
      if (input.templateType === "circuit") {
        const { DEFAULT_CIRCUIT_CONFIG } = await import("@acme/db");

        // Add music config to each round template
        const roundTemplatesWithMusic = DEFAULT_CIRCUIT_CONFIG.config.roundTemplates.map(rt => ({
          ...rt,
          music: generateMinimalMusicConfig(rt.template),
        }));

        sessionData.templateConfig = {
          ...DEFAULT_CIRCUIT_CONFIG,
          config: {
            ...DEFAULT_CIRCUIT_CONFIG.config,
            roundTemplates: roundTemplatesWithMusic,
          },
          lastUpdated: new Date(),
          updatedBy: user.id,
        };
      }

      const [session] = await ctx.db
        .insert(TrainingSession)
        .values(sessionData)
        .returning();

      return session;
    }),

  // List all sessions (filtered by business)
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        // Optional filters
        trainerId: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      const conditions = [eq(TrainingSession.businessId, user.businessId)];

      if (input.trainerId) {
        conditions.push(eq(TrainingSession.trainerId, input.trainerId));
      }

      if (input.startDate) {
        conditions.push(gte(TrainingSession.scheduledAt, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(TrainingSession.scheduledAt, input.endDate));
      }

      const sessions = await ctx.db
        .select()
        .from(TrainingSession)
        .where(and(...conditions))
        .orderBy(
          // Order by status priority: in_progress (1), open (2), completed (3), others (4)
          sql`CASE 
            WHEN ${TrainingSession.status} = 'in_progress' THEN 1
            WHEN ${TrainingSession.status} = 'open' THEN 2
            WHEN ${TrainingSession.status} = 'completed' THEN 3
            ELSE 4 
          END`,
          // Then by scheduledAt descending (most recent first)
          desc(TrainingSession.scheduledAt)
        )
        .limit(input.limit)
        .offset(input.offset);

      return sessions;
    }),

  // Get checked-in clients for a session
  getCheckedInClients: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;


      // Verify session belongs to user's business

      // First check if session exists at all
      const sessionExists = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });


      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId),
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: sessionExists
            ? `Session belongs to different business (session business: ${sessionExists.businessId}, user business: ${user.businessId})`
            : "Session not found",
        });
      }

      // Get checked-in and ready users
      
      // First, let's see ALL users in this session regardless of status
      const allUsers = await ctx.db
        .select()
        .from(UserTrainingSession)
        .where(eq(UserTrainingSession.trainingSessionId, input.sessionId));
      
      
      const checkedInUsers = await ctx.db
        .select()
        .from(UserTrainingSession)
        .where(
          and(
            eq(UserTrainingSession.trainingSessionId, input.sessionId),
            or(
              eq(UserTrainingSession.status, "checked_in"),
              eq(UserTrainingSession.status, "ready"),
              eq(UserTrainingSession.status, "workout_ready"),
            ),
          ),
        )
        .orderBy(desc(UserTrainingSession.checkedInAt));
      

      // Get user details and preferences for each checked-in user
      const usersWithDetails = await Promise.all(
        checkedInUsers.map(async (checkin) => {
          const userInfo = await ctx.db.query.user.findFirst({
            where: eq(userTable.id, checkin.userId),
          });

          // Get workout preferences if collected
          const [preferences] = await ctx.db
            .select()
            .from(WorkoutPreferences)
            .where(
              and(
                eq(WorkoutPreferences.userId, checkin.userId),
                eq(WorkoutPreferences.trainingSessionId, input.sessionId),
              ),
            )
            .limit(1);

          return {
            userId: checkin.userId,
            status: checkin.status,
            checkedInAt: checkin.checkedInAt,
            userName: userInfo?.name || null,
            userEmail: userInfo?.email || "",
            preferenceCollectionStep: checkin.preferenceCollectionStep,
            preferences: preferences
              ? {
                  intensity: preferences.intensity,
                  muscleTargets: preferences.muscleTargets,
                  muscleLessens: preferences.muscleLessens,
                  includeExercises: preferences.includeExercises,
                  avoidExercises: preferences.avoidExercises,
                  avoidJoints: preferences.avoidJoints,
                  sessionGoal: preferences.sessionGoal,
                  workoutType: preferences.workoutType,
                  notes: preferences.notes,
                }
              : null,
          };
        }),
      );

      return usersWithDetails;
    }),

  // Get session by ID with participants
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;

      // Get the session
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.id),
          eq(TrainingSession.businessId, user.businessId),
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }

      // Get participants
      const participants = await ctx.db
        .select({
          userId: UserTrainingSession.userId,
          joinedAt: UserTrainingSession.createdAt,
        })
        .from(UserTrainingSession)
        .where(eq(UserTrainingSession.trainingSessionId, input.id));

      return {
        ...session,
        status: session.status === 'cancelled' ? 'draft' as const : session.status,
        participants,
      };
    }),

  // Add participant to session
  addParticipant: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string().optional(), // If not provided, add current user
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      const targetUserId = input.userId || user.id;

      // Verify session exists and belongs to user's business
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId),
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }

      // Check if already exists and what status
      const existing = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, targetUserId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
        ),
      });

      console.log(`[addParticipant] Adding user ${targetUserId} to session ${input.sessionId}`);
      console.log(`[addParticipant] Existing registration:`, existing);

      const now = new Date();

      if (existing) {
        // If already checked-in, ready, or workout_ready, don't allow duplicate
        if (existing.status === "checked_in" || existing.status === "ready" || existing.status === "workout_ready") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User already checked into this session",
          });
        }

        // If only registered, update to checked_in
        if (existing.status === "registered") {
          console.log(`[addParticipant] Updating existing registration from 'registered' to 'checked_in'`);
          
          const [updatedRegistration] = await ctx.db
            .update(UserTrainingSession)
            .set({
              status: "checked_in",
              checkedInAt: now,
            })
            .where(eq(UserTrainingSession.id, existing.id))
            .returning();

          if (updatedRegistration) {
            console.log(`[addParticipant] Updated registration:`, {
              id: updatedRegistration.id,
              userId: updatedRegistration.userId,
              sessionId: updatedRegistration.trainingSessionId,
              status: updatedRegistration.status,
              checkedInAt: updatedRegistration.checkedInAt,
            });
          }

          return updatedRegistration;
        }
      }

      // Check max participants limit for new registrations
      if (session.maxParticipants) {
        const currentCount = await ctx.db
          .select({ count: UserTrainingSession.id })
          .from(UserTrainingSession)
          .where(eq(UserTrainingSession.trainingSessionId, input.sessionId));

        if (currentCount.length >= session.maxParticipants) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Session is full",
          });
        }
      }

      // Create new checked-in registration
      console.log(`[addParticipant] Creating new checked-in registration`);
      
      const insertResult = await ctx.db
        .insert(UserTrainingSession)
        .values({
          userId: targetUserId,
          trainingSessionId: input.sessionId,
          status: "checked_in",  // Mark as checked_in immediately
          checkedInAt: now,      // Set check-in timestamp
        })
        .returning();

      const [registration] = insertResult;
      if (registration) {
        console.log(`[addParticipant] Created new registration:`, {
          id: registration.id,
          userId: registration.userId,
          sessionId: registration.trainingSessionId,
          status: registration.status,
          checkedInAt: registration.checkedInAt,
        });
      }

      return registration;
    }),

  // Remove participant from session
  removeParticipant: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string().optional(), // If not provided, remove current user
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      const targetUserId = input.userId || user.id;

      console.log(`[removeParticipant] Removing user ${targetUserId} from session ${input.sessionId}`);

      // Only trainers can remove other users
      if (input.userId && input.userId !== user.id && user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can remove other participants",
        });
      }

      // Check if user is actually in the session
      const existing = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, targetUserId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
        ),
      });

      console.log(`[removeParticipant] Found existing registration:`, existing);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not registered for this session",
        });
      }

      // Remove the participant (works for any status: registered, checked_in, ready, etc.)
      const result = await ctx.db
        .delete(UserTrainingSession)
        .where(
          and(
            eq(UserTrainingSession.userId, targetUserId),
            eq(UserTrainingSession.trainingSessionId, input.sessionId),
          ),
        )
        .returning();

      console.log(`[removeParticipant] Removed registration:`, {
        userId: targetUserId,
        sessionId: input.sessionId,
        previousStatus: existing.status,
        removedCount: result.length,
      });

      return { 
        success: true, 
        removedUser: targetUserId,
        previousStatus: existing.status 
      };
    }),

  // Get session with template config (blueprint)
  getWithTemplateConfig: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;

      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId),
        ),
        with: {
          trainer: true,
        },
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }

      // Only trainers can see the template config
      if (user.role !== "trainer") {
        return {
          ...session,
          templateConfig: undefined,
        };
      }

      return session;
    }),

  // Get past sessions for current user
  myPast: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      const now = new Date();

      const sessions = await ctx.db
        .select({
          session: TrainingSession,
        })
        .from(TrainingSession)
        .innerJoin(
          UserTrainingSession,
          eq(UserTrainingSession.trainingSessionId, TrainingSession.id),
        )
        .where(
          and(
            eq(UserTrainingSession.userId, user.id),
            eq(TrainingSession.businessId, user.businessId),
            lte(TrainingSession.scheduledAt, now),
          ),
        )
        .orderBy(desc(TrainingSession.scheduledAt))
        .limit(input.limit)
        .offset(input.offset);

      return sessions.map((s) => s.session);
    }),

  // Start a session (open -> in_progress)
  startSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;

      // Only trainers can start sessions
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can start sessions",
        });
      }

      // Get the session
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId),
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Validate current status
      if (session.status !== "open") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot start session. Current status is ${session.status}. Session must be 'open' to start.`,
        });
      }

      // Update status
      const [updatedSession] = await ctx.db
        .update(TrainingSession)
        .set({ status: "in_progress" })
        .where(eq(TrainingSession.id, input.sessionId))
        .returning();

      return updatedSession;
    }),

  // Complete a session (in_progress -> completed)
  completeSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[completeSession] Starting with input:", input);
      console.log("[completeSession] Input type:", typeof input);
      console.log("[completeSession] Input keys:", Object.keys(input));
      
      const user = ctx.session?.user as SessionUser;
      console.log("[completeSession] User:", { id: user.id, role: user.role, businessId: user.businessId });

      // Only trainers can complete sessions
      if (user.role !== "trainer") {
        console.log("[completeSession] User is not a trainer, throwing error");
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can complete sessions",
        });
      }

      // Get the session
      console.log("[completeSession] Fetching session from database...");
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId),
        ),
      });
      
      console.log("[completeSession] Session found:", !!session);
      if (session) {
        console.log("[completeSession] Session details:", {
          id: session.id,
          status: session.status,
          businessId: session.businessId,
          scheduledAt: session.scheduledAt,
          scheduledAtType: typeof session.scheduledAt,
          scheduledAtIsDate: session.scheduledAt instanceof Date,
        });
      }

      if (!session) {
        console.log("[completeSession] Session not found, throwing error");
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Validate current status
      console.log("[completeSession] Validating session status:", session.status);
      if (session.status !== "in_progress" && session.status !== "open") {
        console.log("[completeSession] Invalid status for completion");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot complete session. Current status is ${session.status}. Session must be 'open' or 'in_progress' to complete.`,
        });
      }

      // Update status
      console.log("[completeSession] Updating session status to completed...");
      try {
        // Use raw SQL to avoid any serialization issues
        await ctx.db.execute(
          sql`UPDATE training_session SET status = 'completed' WHERE id = ${input.sessionId}`
        );
        console.log("[completeSession] Update successful");
      } catch (error) {
        console.error("[completeSession] Error during update:", error);
        throw error;
      }

      const returnValue = { success: true, sessionId: input.sessionId };
      console.log("[completeSession] Returning:", returnValue);
      console.log("[completeSession] Return value type:", typeof returnValue);
      console.log("[completeSession] Return value keys:", Object.keys(returnValue));
      
      return returnValue;
    }),

  // Complete session with name update
  completeSessionWithName: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[completeSessionWithName] Starting with input:", input);
      
      const user = ctx.session?.user as SessionUser;
      console.log("[completeSessionWithName] User:", { id: user.id, role: user.role, businessId: user.businessId });

      // Only trainers can complete sessions
      if (user.role !== "trainer") {
        console.log("[completeSessionWithName] User is not a trainer, throwing error");
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can complete sessions",
        });
      }

      // Get the session
      console.log("[completeSessionWithName] Fetching session from database...");
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId),
        ),
      });
      
      console.log("[completeSessionWithName] Session found:", !!session);

      if (!session) {
        console.log("[completeSessionWithName] Session not found, throwing error");
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Validate current status
      console.log("[completeSessionWithName] Validating session status:", session.status);
      if (session.status !== "in_progress" && session.status !== "open") {
        console.log("[completeSessionWithName] Invalid status for completion");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot complete session. Current status is ${session.status}. Session must be 'open' or 'in_progress' to complete.`,
        });
      }

      // Update status and name
      console.log("[completeSessionWithName] Updating session status to completed and name to:", input.name);
      try {
        if (input.name) {
          // Update both status and name
          await ctx.db.execute(
            sql`UPDATE training_session SET status = 'completed', name = ${input.name} WHERE id = ${input.sessionId}`
          );
        } else {
          // Just update status
          await ctx.db.execute(
            sql`UPDATE training_session SET status = 'completed' WHERE id = ${input.sessionId}`
          );
        }
        console.log("[completeSessionWithName] Update successful");
      } catch (error) {
        console.error("[completeSessionWithName] Error during update:", error);
        throw error;
      }

      // Send feedback form links to all checked-in clients
      console.log("[completeSessionWithName] ===== STARTING SMS SENDING PROCESS =====");
      console.log("[completeSessionWithName] Session ID:", input.sessionId);
      console.log("[completeSessionWithName] Business ID:", user.businessId);
      
      try {
        // First, let's see ALL clients in this session regardless of status
        console.log("[completeSessionWithName] Checking ALL clients in session for debugging...");
        const allSessionClients = await db
          .select({
            userId: UserTrainingSession.userId,
            status: UserTrainingSession.status,
            userName: userTable.name,
            userPhone: userTable.phone,
          })
          .from(UserTrainingSession)
          .innerJoin(userTable, eq(UserTrainingSession.userId, userTable.id))
          .where(eq(UserTrainingSession.trainingSessionId, input.sessionId));
        
        console.log("[completeSessionWithName] ALL clients in session:", allSessionClients.length);
        console.log("[completeSessionWithName] Client statuses:", allSessionClients.map(c => ({
          userName: c.userName,
          status: c.status,
          hasPhone: !!c.userPhone
        })));

        // Get all checked-in clients with their phone numbers
        console.log("[completeSessionWithName] Now querying for checked-in clients only...");
        const checkedInClients = await db
          .select({
            userId: UserTrainingSession.userId,
            userName: userTable.name,
            userPhone: userTable.phone,
          })
          .from(UserTrainingSession)
          .innerJoin(userTable, eq(UserTrainingSession.userId, userTable.id))
          .where(
            and(
              eq(UserTrainingSession.trainingSessionId, input.sessionId),
              eq(UserTrainingSession.status, "checked_in")
            )
          );

        console.log("[completeSessionWithName] Found checked-in clients:", checkedInClients.length);
        console.log("[completeSessionWithName] Client details:", checkedInClients.map(c => ({
          userId: c.userId,
          userName: c.userName,
          hasPhone: !!c.userPhone,
          phoneLength: c.userPhone?.length
        })));
        
        // If no checked-in clients found, let's try using all session participants
        const clientsToMessage = checkedInClients.length > 0 ? checkedInClients : 
          (allSessionClients.length > 0 ? allSessionClients.map(c => ({
            userId: c.userId,
            userName: c.userName,
            userPhone: c.userPhone
          })) : []);
          
        if (checkedInClients.length === 0 && allSessionClients.length > 0) {
          console.log("[completeSessionWithName] WARNING: No checked-in clients found, using all session participants instead");
        }

        // Import required services
        console.log("[completeSessionWithName] Importing Twilio and messages...");
        const { twilioClient } = await import("../services/twilio");
        const { messages } = await import("@acme/db/schema");
        
        console.log("[completeSessionWithName] Twilio client exists:", !!twilioClient);
        console.log("[completeSessionWithName] Environment variables:");
        console.log("  - SMS_BASE_URL:", process.env.SMS_BASE_URL || "NOT SET");
        console.log("  - NEXTAUTH_URL:", process.env.NEXTAUTH_URL || "NOT SET");
        console.log("  - TWILIO_PHONE_NUMBER:", process.env.TWILIO_PHONE_NUMBER || "NOT SET");
        console.log("  - TWILIO_ACCOUNT_SID exists:", !!process.env.TWILIO_ACCOUNT_SID);
        console.log("  - TWILIO_AUTH_TOKEN exists:", !!process.env.TWILIO_AUTH_TOKEN);

        // Send messages to all clients to message
        const sendPromises = clientsToMessage.map(async (client, index) => {
          console.log(`[completeSessionWithName] Processing client ${index + 1}/${clientsToMessage.length}:`, {
            userName: client.userName,
            userId: client.userId,
            phone: client.userPhone
          });
          
          try {
            // Generate feedback link - use SMS_BASE_URL for mobile access
            const baseUrl = process.env.SMS_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
            const feedbackUrl = `${baseUrl}/feedback/client/${input.sessionId}/${client.userId}`;
            console.log(`[completeSessionWithName] Generated feedback URL for ${client.userName}:`, feedbackUrl);
            
            const messageBody = `Thanks for completing today's workout! Please rate the exercises to help us improve your future workouts: ${feedbackUrl}`;
            console.log(`[completeSessionWithName] Message length for ${client.userName}:`, messageBody.length);
            
            // Store message in database
            console.log(`[completeSessionWithName] Inserting message to database for ${client.userName}...`);
            const insertedMessage = await db.insert(messages).values({
              userId: client.userId,
              businessId: user.businessId,
              direction: "outbound",
              channel: "sms",
              content: messageBody,
              phoneNumber: client.userPhone,
              metadata: {
                sentBy: user.id,
              } as any,
              status: "sent",
            });
            console.log(`[completeSessionWithName] Database insert successful for ${client.userName}`);

            // Send via Twilio if phone number exists
            if (client.userPhone && twilioClient) {
              console.log(`[completeSessionWithName] Attempting Twilio SMS send for ${client.userName}...`);
              console.log(`[completeSessionWithName] To: ${client.userPhone}, From: ${process.env.TWILIO_PHONE_NUMBER}`);
              
              try {
                const twilioResponse = await twilioClient.messages.create({
                  body: messageBody,
                  to: client.userPhone,
                  from: process.env.TWILIO_PHONE_NUMBER,
                });
                console.log(`[completeSessionWithName] ✅ Twilio SMS sent successfully to ${client.userName}:`, {
                  sid: twilioResponse.sid,
                  status: twilioResponse.status,
                  to: twilioResponse.to,
                  from: twilioResponse.from
                });
              } catch (twilioError) {
                console.error(`[completeSessionWithName] ❌ Twilio SMS failed for ${client.userName}:`, {
                  error: twilioError instanceof Error ? twilioError.message : twilioError,
                  errorCode: (twilioError as any)?.code,
                  moreInfo: (twilioError as any)?.moreInfo
                });
                throw twilioError;
              }
            } else {
              console.log(`[completeSessionWithName] Skipping SMS for ${client.userName}:`, {
                hasPhone: !!client.userPhone,
                hasTwilioClient: !!twilioClient
              });
            }

            return {
              success: true,
              userId: client.userId,
              userName: client.userName,
              phone: client.userPhone,
            };
          } catch (error) {
            console.error(`[completeSessionWithName] ❌ Failed to process client ${client.userName}:`, {
              error: error instanceof Error ? error.message : error,
              stack: error instanceof Error ? error.stack : undefined
            });
            return {
              success: false,
              userId: client.userId,
              userName: client.userName,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        });

        console.log("[completeSessionWithName] Waiting for all SMS operations to complete...");
        const results = await Promise.allSettled(sendPromises);
        
        const successResults = results.filter(r => r.status === "fulfilled" && r.value.success);
        const failureResults = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success));
        
        console.log("[completeSessionWithName] ===== SMS SENDING SUMMARY =====");
        console.log(`[completeSessionWithName] Total clients: ${clientsToMessage.length}`);
        console.log(`[completeSessionWithName] Successful: ${successResults.length}`);
        console.log(`[completeSessionWithName] Failed: ${failureResults.length}`);
        
        if (successResults.length > 0) {
          console.log("[completeSessionWithName] Successful sends:", successResults.map(r => 
            r.status === "fulfilled" ? r.value.userName : "unknown"
          ));
        }
        
        if (failureResults.length > 0) {
          console.log("[completeSessionWithName] Failed sends:", failureResults.map(r => {
            if (r.status === "rejected") {
              return { reason: r.reason };
            } else if (r.status === "fulfilled") {
              return { userName: r.value.userName, error: r.value.error };
            }
          }));
        }
        
      } catch (error) {
        // Log error but don't fail the completion
        console.error("[completeSessionWithName] ❌ CRITICAL ERROR in SMS sending process:", {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined
        });
      }

      const returnValue = { success: true, sessionId: input.sessionId };
      console.log("[completeSessionWithName] Returning:", returnValue);
      
      return returnValue;
    }),

  // Cancel a session (open -> cancelled)
  cancelSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;

      // Only trainers can cancel sessions
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can cancel sessions",
        });
      }

      // Get the session
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId),
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Validate current status - can only cancel open sessions
      if (session.status !== "open") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot cancel session. Current status is ${session.status}. Only 'open' sessions can be cancelled.`,
        });
      }

      // Update status
      const [updatedSession] = await ctx.db
        .update(TrainingSession)
        .set({ status: "cancelled" })
        .where(eq(TrainingSession.id, input.sessionId))
        .returning();

      return updatedSession;
    }),

  // Delete a session and all associated data
  deleteSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;

      // Only trainers can delete sessions
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can delete sessions",
        });
      }

      // Get the session to verify it exists and belongs to the business
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId),
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Delete in the correct order to respect foreign key constraints
      // 1. First get all workouts for this session
      const workouts = await ctx.db.query.Workout.findMany({
        where: eq(Workout.trainingSessionId, input.sessionId),
      });

      // 2. Delete workout exercises for all workouts
      if (workouts.length > 0) {
        const workoutIds = workouts.map((w) => w.id);
        await ctx.db
          .delete(WorkoutExercise)
          .where(inArray(WorkoutExercise.workoutId, workoutIds));
      }

      // 3. Delete workouts
      await ctx.db
        .delete(Workout)
        .where(eq(Workout.trainingSessionId, input.sessionId));

      // 4. Delete workout preferences
      await ctx.db
        .delete(WorkoutPreferences)
        .where(eq(WorkoutPreferences.trainingSessionId, input.sessionId));

      // 5. Delete user training sessions (registrations/check-ins)
      await ctx.db
        .delete(UserTrainingSession)
        .where(eq(UserTrainingSession.trainingSessionId, input.sessionId));

      // 6. Delete workout exercise swaps
      try {
        await ctx.db
          .delete(workoutExerciseSwaps)
          .where(eq(workoutExerciseSwaps.trainingSessionId, input.sessionId));
      } catch (error) {
        console.error(
          "[deleteSession] Error deleting workout exercise swaps:",
          error,
        );
        // Continue with deletion even if this fails since the table might be empty
      }

      // 7. Finally delete the training session
      await ctx.db
        .delete(TrainingSession)
        .where(eq(TrainingSession.id, input.sessionId));

      return { success: true, deletedSessionId: input.sessionId };
    }),

  /**
   * Check if blueprint exists (without generating)
   */
  checkBlueprintExists: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // For now, just return false - we're not caching blueprints anymore
      // This endpoint exists to prevent the preferences page from generating
      return { exists: false };
    }),

  /**
   * Generate group workout blueprint only (for visualization/testing)
   * This is the modular endpoint that just generates the blueprint without side effects
   */
  generateGroupWorkoutBlueprint: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        options: z
          .object({
            includeDiagnostics: z.boolean().default(false),
            phase1Only: z.boolean().default(false),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;

      // Only trainers can generate blueprints
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can generate group workout blueprints",
        });
      }

      // Import and use the new service
      const { WorkoutGenerationService } = await import(
        "../services/workout-generation-service"
      );
      const service = new WorkoutGenerationService(ctx);

      try {
        const result = await service.generateBlueprint(
          input.sessionId,
          input.options,
        );
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to generate blueprint",
        });
      }
    }),

  /**
   * Generate and create group workouts (full orchestration)
   * This is the production endpoint that generates blueprint + LLM + creates workouts
   */
  regenerateCircuitSetlist: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Setlist regeneration is disabled - music will use local MP3 files
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "Setlist regeneration is not available. Music uses local MP3 files.",
      });
    }),

  generateAndCreateGroupWorkouts: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        options: z
          .object({
            skipBlueprintCache: z.boolean().default(false),
            dryRun: z.boolean().default(false),
            includeDiagnostics: z.boolean().default(false),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mutationStartTime = new Date().toISOString();
      console.log(
        `[Timestamp] generateAndCreateGroupWorkouts mutation started at: ${mutationStartTime}`,
      );
      console.log(`[Timestamp] Session ID: ${input.sessionId}`);

      const user = ctx.session?.user as SessionUser;

      // Only trainers can generate workouts
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can generate group workouts",
        });
      }

      // Import and use the new service
      const { WorkoutGenerationService } = await import(
        "../services/workout-generation-service"
      );
      const service = new WorkoutGenerationService(ctx);

      try {
        const result = await service.generateAndCreateWorkouts(
          input.sessionId,
          input.options,
        );

        const mutationEndTime = new Date().toISOString();
        const totalDurationMs = Date.now() - Date.parse(mutationStartTime);
        
        console.log(
          `[Timestamp] generateAndCreateGroupWorkouts mutation completed at: ${mutationEndTime}`,
        );
        console.log(
          `[Timestamp] Total duration: ${totalDurationMs}ms`,
        );

        // Add total process timing to the result
        return {
          ...result,
          totalProcessTiming: {
            start: mutationStartTime,
            end: mutationEndTime,
            durationMs: totalDurationMs,
            durationSeconds: (totalDurationMs / 1000).toFixed(1)
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to generate and create workouts",
        });
      }
    }),

  // Get active training session for a user
  getActiveSessionForUser: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1, "User ID is required"),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check if the current user is authorized to view this data
        const viewer = await db
          .select()
          .from(userTable)
          .where(eq(userTable.id, ctx.session.user.id))
          .limit(1);

        if (!viewer[0]) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        // If viewer is not the user themselves, must be a trainer in the same business
        if (ctx.session.user.id !== input.userId) {
          const targetUser = await db
            .select()
            .from(userTable)
            .where(eq(userTable.id, input.userId))
            .limit(1);

          if (
            !targetUser[0] ||
            targetUser[0].businessId !== viewer[0].businessId
          ) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Can only view sessions for users in your business",
            });
          }

          if (viewer[0].role !== "trainer") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Only trainers can view other users' sessions",
            });
          }
        }

        // Find active session for the user
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeSessions = await db
          .select({
            id: TrainingSession.id,
            name: TrainingSession.name,
            date: TrainingSession.scheduledAt,
            templateType: TrainingSession.templateType,
            businessId: TrainingSession.businessId,
          })
          .from(TrainingSession)
          .innerJoin(
            UserTrainingSession,
            eq(UserTrainingSession.trainingSessionId, TrainingSession.id),
          )
          .where(
            and(
              eq(UserTrainingSession.userId, input.userId),
              gte(TrainingSession.scheduledAt, today),
            ),
          )
          .orderBy(desc(TrainingSession.createdAt))
          .limit(1);

        if (!activeSessions || activeSessions.length === 0) {
          return null;
        }

        // Ensure we return a plain object
        const session = activeSessions[0];
        if (!session) {
          return null;
        }

        return {
          id: session.id,
          name: session.name,
          date: session.date,
          templateType: session.templateType,
          businessId: session.businessId,
        };
      } catch (error) {
        console.error("Error in getActiveSessionForUser:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch active session",
        });
      }
    }),

  sendSessionStartMessages: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify trainer has access to this session
        const [session] = await db
          .select()
          .from(TrainingSession)
          .where(
            and(
              eq(TrainingSession.id, input.sessionId),
              eq(TrainingSession.businessId, ctx.session.user.businessId!),
            ),
          )
          .limit(1);

        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Session not found",
          });
        }

        // Get all checked-in clients with their phone numbers
        const checkedInClients = await db
          .select({
            userId: UserTrainingSession.userId,
            userName: userTable.name,
            userPhone: userTable.phone,
            status: UserTrainingSession.status,
          })
          .from(UserTrainingSession)
          .innerJoin(userTable, eq(UserTrainingSession.userId, userTable.id))
          .where(
            and(
              eq(UserTrainingSession.trainingSessionId, input.sessionId),
              eq(UserTrainingSession.status, "checked_in"),
            ),
          );

        if (checkedInClients.length === 0) {
          return {
            success: true,
            sentCount: 0,
            message: "No checked-in clients to send messages to",
          };
        }

        // Import required services
        const { WorkoutBlueprintService } = await import(
          "../services/workout-blueprint-service"
        );
        const { twilioClient } = await import("../services/twilio");
        const { getWorkoutTemplate } = await import("@acme/ai");
        const { messages } = await import("@acme/db/schema");
        const { WorkoutPreferenceService } = await import(
          "../services/workoutPreferenceService"
        );

        // Get template configuration
        const template = session.templateType
          ? getWorkoutTemplate(session.templateType)
          : null;
        const showDeterministicSelections =
          template?.smsConfig?.showDeterministicSelections;


        // For BMF templates, auto-populate includeExercises with deterministic selections

        if (showDeterministicSelections && session.templateType) {
          try {

            // Generate blueprint using shared service
            const blueprintStart = Date.now();
            const blueprint =
              await WorkoutBlueprintService.generateBlueprintWithCache(
                input.sessionId,
                session.businessId,
                ctx.session.user.id,
              );
            const blueprintTime = Date.now() - blueprintStart;

            if (!blueprint) {
              // Continue anyway - we'll still send messages even if blueprint generation fails
            } else {

              // Find Round1 and Round2 blocks
              const round1Block = blueprint.blocks.find(
                (b: any) => b.blockId === "Round1",
              );
              const round2Block = blueprint.blocks.find(
                (b: any) => b.blockId === "Round2",
              );

              // Get all checked-in clients
              const clientsToProcess = await db
                .select({
                  userId: UserTrainingSession.userId,
                })
                .from(UserTrainingSession)
                .where(
                  and(
                    eq(UserTrainingSession.trainingSessionId, input.sessionId),
                    eq(UserTrainingSession.status, "checked_in"),
                  ),
                );

              // For each client, create/update WorkoutPreferences with includeExercises
              for (const client of clientsToProcess) {
                try {
                  const exercisesToInclude: string[] = [];

                  // Extract Round 1 exercise from blueprint
                  const round1Exercises =
                    round1Block?.individualCandidates?.[client.userId]
                      ?.exercises;
                  if (round1Exercises && round1Exercises.length > 0) {
                    const exerciseName = round1Exercises[0].name;
                    exercisesToInclude.push(exerciseName);
                    console.log(
                      `Found Round1 exercise for ${client.userId}:`,
                      exerciseName,
                    );
                  }

                  // Extract Round 2 exercise from blueprint
                  const round2Exercises =
                    round2Block?.individualCandidates?.[client.userId]
                      ?.exercises;
                  if (round2Exercises && round2Exercises.length > 0) {
                    const exerciseName = round2Exercises[0].name;
                    exercisesToInclude.push(exerciseName);
                    console.log(
                      `Found Round2 exercise for ${client.userId}:`,
                      exerciseName,
                    );
                  }

                  if (exercisesToInclude.length > 0) {
                    // Save these exercises to includeExercises
                    try {

                      await WorkoutPreferenceService.savePreferences(
                        client.userId,
                        input.sessionId,
                        session.businessId,
                        {
                          includeExercises: exercisesToInclude,
                        },
                        "preferences_active",
                      );

                    } catch (saveError) {
                      throw saveError; // Re-throw to be caught by outer try-catch
                    }

                    // Verify the preferences were saved
                    const [savedPrefs] = await db
                      .select()
                      .from(WorkoutPreferences)
                      .where(
                        and(
                          eq(WorkoutPreferences.userId, client.userId),
                          eq(
                            WorkoutPreferences.trainingSessionId,
                            input.sessionId,
                          ),
                        ),
                      )
                      .limit(1);

                  } else {
                    console.warn(
                      `No exercises found to auto-populate for ${client.userId}`,
                    );
                  }
                } catch (error) {
                  console.error(
                    `Error auto-populating preferences for ${client.userId}:`,
                    error,
                  );
                }
              }
            }
          } catch (error) {
            console.error("Error auto-populating includeExercises:", error);
          }
        }

        // Send messages to all checked-in clients
        const sendPromises = checkedInClients.map(async (client) => {
          try {
            // Skip sending messages for circuit sessions - they already got the config link at check-in
            if (session.templateType === "circuit") {
              return {
                success: true,
                userId: client.userId,
                channel: "skipped",
                reason: "circuit session - link sent at check-in"
              };
            }
            
            // Generate appropriate link based on template type
            const baseUrl =
              process.env.SMS_BASE_URL ||
              process.env.NEXTAUTH_URL ||
              "http://192.168.68.133:3000";
            
            const preferenceLink = `${baseUrl}/preferences/client/${session.id}/${client.userId}`;
            const messageBody = `Your workout preferences are ready to customize: 
${preferenceLink}

Set your goals and preferences for today's session.`;

            // Create message record in database for all clients
            await db.insert(messages).values({
              userId: client.userId,
              businessId: session.businessId,
              direction: "outbound" as const,
              channel: client.userPhone ? "sms" : "in_app",
              content: messageBody,
              phoneNumber: client.userPhone || null,
              metadata: {
                sentBy: ctx.session.user.id,
                checkInResult: {
                  success: true,
                  sessionId: session.id,
                },
              },
              status: "sent",
            });

            // Send via Twilio if phone number exists
            if (client.userPhone && twilioClient) {
              await twilioClient.messages.create({
                body: messageBody,
                to: client.userPhone,
                from: process.env.TWILIO_PHONE_NUMBER,
              });
              console.log(
                `Sent SMS to ${client.userName} (${client.userPhone})`,
              );
            } else {
              console.log(
                `Created in-app message for ${client.userName} (no phone)`,
              );
            }

            return {
              success: true,
              userId: client.userId,
              channel: client.userPhone ? "sms" : "in_app",
            };
          } catch (error) {
            console.error(`Failed to send to ${client.userId}:`, error);
            return {
              success: false,
              userId: client.userId,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        });

        const results = await Promise.all(sendPromises);
        const successCount = results.filter((r) => r.success).length;

        return {
          success: true,
          sentCount: successCount,
          totalClients: checkedInClients.length,
          results,
          message: `Sent messages to ${successCount} out of ${checkedInClients.length} clients`,
        };
      } catch (error) {
        console.error("Error in sendSessionStartMessages:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send session start messages",
        });
      }
    }),

  updateClientPreferences: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        userId: z.string(),
        preferences: z.object({
          confirmedExercises: z
            .array(
              z.object({
                name: z.string(),
                confirmed: z.boolean(),
              }),
            )
            .optional(),
          muscleFocus: z.array(z.string()).optional(),
          muscleAvoidance: z.array(z.string()).optional(),
          otherNotes: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // For MVP, we'll store preferences in the WorkoutPreferences table
        // In the future, this should validate that the user owns this preference

        // Get session for businessId
        const [session] = await db
          .select()
          .from(TrainingSession)
          .where(eq(TrainingSession.id, input.sessionId))
          .limit(1);

        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Session not found",
          });
        }

        // Find existing preferences
        const [existingPref] = await db
          .select()
          .from(WorkoutPreferences)
          .where(
            and(
              eq(WorkoutPreferences.userId, input.userId),
              eq(WorkoutPreferences.trainingSessionId, input.sessionId),
            ),
          )
          .limit(1);

        if (existingPref) {
          // Update existing preferences
          await db
            .update(WorkoutPreferences)
            .set({
              muscleTargets: input.preferences.muscleFocus,
              muscleLessens: input.preferences.muscleAvoidance,
              notes: input.preferences.otherNotes
                ? [input.preferences.otherNotes]
                : [],
            })
            .where(eq(WorkoutPreferences.id, existingPref.id));
        } else {
          // Create new preferences
          await db.insert(WorkoutPreferences).values({
            userId: input.userId,
            trainingSessionId: input.sessionId,
            businessId: session.businessId,
            muscleTargets: input.preferences.muscleFocus || [],
            muscleLessens: input.preferences.muscleAvoidance || [],
            notes: input.preferences.otherNotes
              ? [input.preferences.otherNotes]
              : [],
          });
        }

        // Invalidate blueprint cache
        const { WorkoutBlueprintService } = await import(
          "../services/workout-blueprint-service"
        );
        await WorkoutBlueprintService.invalidateCache(input.sessionId);

        // Real-time updates will be handled by Supabase Realtime

        return { success: true };
      } catch (error) {
        console.error("Error updating client preferences:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update preferences",
        });
      }
    }),

  // Public procedures for client preferences (no auth required)
  getClientPreferenceData: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify that the user belongs to this session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          or(
            eq(UserTrainingSession.status, "checked_in"),
            eq(UserTrainingSession.status, "ready"),
            eq(UserTrainingSession.status, "workout_ready"),
          ),
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid session or user not checked in",
        });
      }

      // Get user info
      const [user] = await ctx.db
        .select({
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
        })
        .from(userTable)
        .where(eq(userTable.id, input.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Get existing preferences if any
      const [preferences] = await ctx.db
        .select()
        .from(WorkoutPreferences)
        .where(
          and(
            eq(WorkoutPreferences.userId, input.userId),
            eq(WorkoutPreferences.trainingSessionId, input.sessionId),
          ),
        )
        .limit(1);

      return {
        user: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          checkedInAt: userSession.checkedInAt,
          preferences: preferences
            ? {
                intensity: preferences.intensity,
                muscleTargets: preferences.muscleTargets,
                muscleLessens: preferences.muscleLessens,
                includeExercises: preferences.includeExercises,
                avoidExercises: preferences.avoidExercises,
                avoidJoints: preferences.avoidJoints,
                sessionGoal: preferences.sessionGoal,
                workoutType: preferences.workoutType,
                notes: preferences.notes,
              }
            : null,
        },
      };
    }),

  getClientDeterministicSelections: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify user belongs to session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          or(
            eq(UserTrainingSession.status, "checked_in"),
            eq(UserTrainingSession.status, "ready"),
            eq(UserTrainingSession.status, "workout_ready"),
          ),
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid session or user not checked in",
        });
      }

      // Get session with business ID
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // For BMF template, get exercises from preferences or generate blueprint
      if (session.templateType === "full_body_bmf") {
        try {
          // Get user preferences
          const [preferences] = await ctx.db
            .select()
            .from(WorkoutPreferences)
            .where(
              and(
                eq(WorkoutPreferences.userId, input.userId),
                eq(WorkoutPreferences.trainingSessionId, input.sessionId),
              ),
            )
            .limit(1);

          // If includeExercises is populated, use those directly
          if (
            preferences?.includeExercises &&
            preferences.includeExercises.length >= 2
          ) {
            const selections = [];

            // Get exercise details from database
            const exerciseDetails = await ctx.db
              .select()
              .from(exercises)
              .where(
                inArray(exercises.name, preferences.includeExercises || []),
              );

            // First exercise is Round1
            const round1Exercise = exerciseDetails.find(
              (e) => e.name === preferences.includeExercises?.[0],
            );
            if (round1Exercise) {
              selections.push({
                roundId: "Round1",
                roundName: "Round 1",
                exercise: {
                  name: round1Exercise.name,
                  movementPattern: round1Exercise.movementPattern,
                  primaryMuscle: round1Exercise.primaryMuscle,
                },
              });
            }

            // Second exercise is Round2
            const round2Exercise = exerciseDetails.find(
              (e) => e.name === preferences.includeExercises?.[1],
            );
            if (round2Exercise) {
              selections.push({
                roundId: "Round2",
                roundName: "Round 2",
                exercise: {
                  name: round2Exercise.name,
                  movementPattern: round2Exercise.movementPattern,
                  primaryMuscle: round2Exercise.primaryMuscle,
                },
              });
            }

            // Generate blueprint to get recommendations
            try {
              const { WorkoutBlueprintService } = await import(
                "../services/workout-blueprint-service"
              );
              const blueprint =
                await WorkoutBlueprintService.generateBlueprintWithCache(
                  input.sessionId,
                  session.businessId,
                  input.userId,
                );

              // Extract recommendations from blueprint
              const recommendations: any[] = [];
              if (blueprint?.blocks) {
                const round1Block = blueprint.blocks.find(
                  (b: any) => b.blockId === "Round1",
                );
                const round2Block = blueprint.blocks.find(
                  (b: any) => b.blockId === "Round2",
                );

                // Get ALL Round1 candidates
                if (round1Block?.individualCandidates?.[input.userId]) {
                  const candidateData =
                    round1Block.individualCandidates[input.userId];
                  // Use allFilteredExercises if available, otherwise fall back to exercises
                  const exerciseList =
                    candidateData.allFilteredExercises ||
                    candidateData.exercises ||
                    [];

                  exerciseList.forEach((exercise: any) => {
                    if (exercise.name !== preferences.includeExercises?.[0]) {
                      recommendations.push({
                        ...exercise,
                        roundId: "Round1",
                        roundName: "Round 1",
                      });
                    }
                  });
                }

                // Get ALL Round2 candidates
                if (round2Block?.individualCandidates?.[input.userId]) {
                  const candidateData =
                    round2Block.individualCandidates[input.userId];
                  // Use allFilteredExercises if available, otherwise fall back to exercises
                  const exerciseList =
                    candidateData.allFilteredExercises ||
                    candidateData.exercises ||
                    [];

                  exerciseList.forEach((exercise: any) => {
                    if (exercise.name !== preferences.includeExercises?.[1]) {
                      recommendations.push({
                        ...exercise,
                        roundId: "Round2",
                        roundName: "Round 2",
                      });
                    }
                  });
                }
              }

              return {
                selections: selections,
                recommendations: recommendations,
              };
            } catch (error) {
              console.error("Failed to get recommendations:", error);
              // Return without recommendations if blueprint generation fails
              return {
                selections: selections,
                recommendations: [],
              };
            }
          }

          // Get user profile
          const [userProfile] = await ctx.db
            .select()
            .from(UserProfile)
            .where(
              and(
                eq(UserProfile.userId, input.userId),
                eq(UserProfile.businessId, session.businessId),
              ),
            )
            .limit(1);

          // Get user info
          const [user] = await ctx.db
            .select({
              name: userTable.name,
            })
            .from(userTable)
            .where(eq(userTable.id, input.userId))
            .limit(1);

          // Create minimal client context for blueprint generation
          const clientContext = {
            user_id: input.userId,
            name: user?.name ?? "Unknown",
            strength_capacity: (userProfile?.strengthLevel ?? "moderate") as
              | "very_low"
              | "low"
              | "moderate"
              | "high",
            skill_capacity: (userProfile?.skillLevel ?? "moderate") as
              | "very_low"
              | "low"
              | "moderate"
              | "high",
            primary_goal:
              preferences?.sessionGoal === "strength"
                ? ("strength" as const)
                : ("general_fitness" as const),
            intensity: (preferences?.intensity ?? "moderate") as
              | "low"
              | "moderate"
              | "high",
            muscle_target: preferences?.muscleTargets ?? [],
            muscle_lessen: preferences?.muscleLessens ?? [],
            exercise_requests: {
              include: preferences?.includeExercises ?? [],
              avoid: preferences?.avoidExercises ?? [],
            },
            avoid_joints: preferences?.avoidJoints ?? [],
            business_id: session.businessId,
            templateType: session.templateType as
              | "standard"
              | "circuit"
              | "full_body_bmf"
              | undefined,
            default_sets: userProfile?.defaultSets ?? 20,
          };

          // Generate blueprint using shared service
          const { WorkoutBlueprintService } = await import(
            "../services/workout-blueprint-service"
          );

          const blueprint =
            await WorkoutBlueprintService.generateBlueprintWithCache(
              input.sessionId,
              session.businessId,
              input.userId, // Use the client's userId for this single-client context
            );

          // Extract exercises from Round1 and Round2
          const selections: any[] = [];
          const recommendations: any[] = [];
          const round1Block = blueprint.blocks.find(
            (b: any) => b.blockId === "Round1",
          );
          const round2Block = blueprint.blocks.find(
            (b: any) => b.blockId === "Round2",
          );

          if (
            round1Block?.individualCandidates?.[input.userId]?.exercises?.[0]
          ) {
            selections.push({
              roundId: "Round1",
              roundName: "Round 1",
              exercise: {
                name: round1Block.individualCandidates[input.userId]
                  .exercises[0].name,
                movementPattern:
                  round1Block.individualCandidates[input.userId].exercises[0]
                    .movementPattern,
                primaryMuscle:
                  round1Block.individualCandidates[input.userId].exercises[0]
                    .primaryMuscle,
              },
            });
          }

          if (
            round2Block?.individualCandidates?.[input.userId]?.exercises?.[0]
          ) {
            selections.push({
              roundId: "Round2",
              roundName: "Round 2",
              exercise: {
                name: round2Block.individualCandidates[input.userId]
                  .exercises[0].name,
                movementPattern:
                  round2Block.individualCandidates[input.userId].exercises[0]
                    .movementPattern,
                primaryMuscle:
                  round2Block.individualCandidates[input.userId].exercises[0]
                    .primaryMuscle,
              },
            });
          }

          // Collect all candidate exercises from Round1 and Round2 for recommendations
          // Use allFilteredExercises to get the full list, not just top 6
          const selectedExerciseNames = selections.map((s) => s.exercise.name);

          if (round1Block?.individualCandidates?.[input.userId]) {
            const candidateData =
              round1Block.individualCandidates[input.userId];
            // Use allFilteredExercises if available, otherwise fall back to exercises
            const exerciseList =
              candidateData.allFilteredExercises ||
              candidateData.exercises ||
              [];

            exerciseList.forEach((exercise: any) => {
              if (!selectedExerciseNames.includes(exercise.name)) {
                recommendations.push({
                  ...exercise,
                  roundId: "Round1",
                  roundName: "Round 1",
                });
              }
            });
          }

          if (round2Block?.individualCandidates?.[input.userId]) {
            const candidateData =
              round2Block.individualCandidates[input.userId];
            // Use allFilteredExercises if available, otherwise fall back to exercises
            const exerciseList =
              candidateData.allFilteredExercises ||
              candidateData.exercises ||
              [];

            exerciseList.forEach((exercise: any) => {
              if (!selectedExerciseNames.includes(exercise.name)) {
                recommendations.push({
                  ...exercise,
                  roundId: "Round2",
                  roundName: "Round 2",
                });
              }
            });
          }

          // Sort recommendations by score (highest first)
          // Don't limit here - let the frontend handle display limits
          recommendations.sort((a, b) => b.score - a.score);

          return { selections, recommendations };
        } catch (error) {
          console.error("Error generating blueprint for client:", error);
          return { selections: [], recommendations: [] };
        }
      }

      // For non-BMF templates, return empty
      return { selections: [], recommendations: [] };
    }),

  // Get exercise recommendations for a specific client
  getClientExerciseRecommendations: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify user belongs to session and get session data
      const userSessionData = await ctx.db
        .select({
          userId: UserTrainingSession.userId,
          sessionId: UserTrainingSession.trainingSessionId,
          templateType: TrainingSession.templateType,
          businessId: TrainingSession.businessId,
        })
        .from(UserTrainingSession)
        .innerJoin(
          TrainingSession,
          eq(UserTrainingSession.trainingSessionId, TrainingSession.id),
        )
        .where(
          and(
            eq(UserTrainingSession.userId, input.userId),
            eq(UserTrainingSession.trainingSessionId, input.sessionId),
            or(
              eq(UserTrainingSession.status, "checked_in"),
              eq(UserTrainingSession.status, "ready"),
              eq(UserTrainingSession.status, "workout_ready"),
            ),
          ),
        )
        .limit(1);

      if (!userSessionData || userSessionData.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid session or user not checked in",
        });
      }

      const sessionData = userSessionData[0];
      if (!sessionData) {
        return { recommendations: [] };
      }

      // Only process for BMF templates
      if (sessionData.templateType !== "full_body_bmf") {
        return { recommendations: [] };
      }

      try {
        // Get the cached blueprint
        const { WorkoutBlueprintService } = await import(
          "../services/workout-blueprint-service"
        );

        // Try to get cached blueprint first, but generate if not available
        // This ensures clients can see recommendations even before session starts
        const blueprint =
          await WorkoutBlueprintService.generateBlueprintWithCache(
            input.sessionId,
            sessionData!.businessId,
            input.userId,
            false, // Don't force regenerate - will generate if not cached
          );

        console.log("[getClientExerciseRecommendations] Blueprint check:", {
          sessionId: input.sessionId,
          hasBlueprint: !!blueprint,
          hasBlocks: !!blueprint?.blocks,
          blockCount: blueprint?.blocks?.length || 0,
        });

        if (!blueprint?.blocks) {
          console.log(
            "[getClientExerciseRecommendations] No blueprint available yet for session:",
            input.sessionId,
          );
          return { recommendations: [] };
        }

        console.log(
          "[getClientExerciseRecommendations] Blueprint blocks found:",
          blueprint.blocks.length,
        );

        // Extract recommendations from blueprint
        const recommendations: any[] = [];
        const round1Block = blueprint.blocks.find(
          (b: any) => b.blockId === "Round1",
        );
        const round2Block = blueprint.blocks.find(
          (b: any) => b.blockId === "Round2",
        );

        console.log(
          "[getClientExerciseRecommendations] Debugging blueprint structure:",
          {
            hasRound1Block: !!round1Block,
            hasRound2Block: !!round2Block,
            round1HasIndividualCandidates: !!round1Block?.individualCandidates,
            round2HasIndividualCandidates: !!round2Block?.individualCandidates,
            round1CandidateKeys: round1Block?.individualCandidates
              ? Object.keys(round1Block.individualCandidates)
              : [],
            round2CandidateKeys: round2Block?.individualCandidates
              ? Object.keys(round2Block.individualCandidates)
              : [],
            requestedUserId: input.userId,
            round1SharedCandidatesCount:
              round1Block?.sharedCandidates?.length || 0,
            round2SharedCandidatesCount:
              round2Block?.sharedCandidates?.length || 0,
          },
        );

        // Get Round1 candidates - check both individual and shared
        if (round1Block) {
          if (round1Block.individualCandidates?.[input.userId]) {
            const candidateData =
              round1Block.individualCandidates[input.userId];
            const exerciseList =
              candidateData.allFilteredExercises ||
              candidateData.exercises ||
              [];

            console.log(
              "[getClientExerciseRecommendations] Round1 individual exercises found:",
              exerciseList.length,
            );

            exerciseList.forEach((exercise: any) => {
              recommendations.push({
                ...exercise,
                roundId: "Round1",
                roundName: "Round 1",
              });
            });
          } else if (round1Block.sharedCandidates?.length > 0) {
            // Fall back to shared candidates if no individual candidates
            console.log(
              "[getClientExerciseRecommendations] Using Round1 shared candidates:",
              round1Block.sharedCandidates.length,
            );

            round1Block.sharedCandidates.forEach((exercise: any) => {
              recommendations.push({
                ...exercise,
                roundId: "Round1",
                roundName: "Round 1",
              });
            });
          } else {
            console.log(
              "[getClientExerciseRecommendations] No Round1 candidates (individual or shared) for user:",
              input.userId,
            );
          }
        }

        // Get Round2 candidates - check both individual and shared
        if (round2Block) {
          if (round2Block.individualCandidates?.[input.userId]) {
            const candidateData =
              round2Block.individualCandidates[input.userId];
            const exerciseList =
              candidateData.allFilteredExercises ||
              candidateData.exercises ||
              [];

            console.log(
              "[getClientExerciseRecommendations] Round2 individual exercises found:",
              exerciseList.length,
            );

            exerciseList.forEach((exercise: any) => {
              recommendations.push({
                ...exercise,
                roundId: "Round2",
                roundName: "Round 2",
              });
            });
          } else if (round2Block.sharedCandidates?.length > 0) {
            // Fall back to shared candidates if no individual candidates
            console.log(
              "[getClientExerciseRecommendations] Using Round2 shared candidates:",
              round2Block.sharedCandidates.length,
            );

            round2Block.sharedCandidates.forEach((exercise: any) => {
              recommendations.push({
                ...exercise,
                roundId: "Round2",
                roundName: "Round 2",
              });
            });
          } else {
            console.log(
              "[getClientExerciseRecommendations] No Round2 candidates (individual or shared) for user:",
              input.userId,
            );
          }
        }

        // Sort by score (highest first)
        recommendations.sort((a, b) => (b.score || 0) - (a.score || 0));

        console.log(
          "[getClientExerciseRecommendations] Final recommendations:",
          {
            count: recommendations.length,
            sampleRecommendations: recommendations.slice(0, 3).map((r) => ({
              name: r.name,
              score: r.score,
              roundId: r.roundId,
            })),
          },
        );

        return { recommendations };
      } catch (error) {
        console.error("[getClientExerciseRecommendations] Error:", {
          sessionId: input.sessionId,
          userId: input.userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Return empty recommendations if blueprint generation fails
        // This can happen if the session hasn't been started yet
        return { recommendations: [] };
      }
    }),

  // Public mutation for replacing client exercise selection
  replaceClientExercisePublic: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string(),
        round: z.enum(["Round1", "Round2"]),
        newExerciseName: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user belongs to session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          eq(UserTrainingSession.status, "checked_in"),
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid session or user not checked in",
        });
      }

      // Get session to get business ID
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Get or create workout preferences
      const existingPrefs = await ctx.db.query.WorkoutPreferences.findFirst({
        where: and(
          eq(WorkoutPreferences.userId, input.userId),
          eq(WorkoutPreferences.trainingSessionId, input.sessionId),
        ),
      });

      if (existingPrefs) {
        // Update existing preferences - replace the exercise for the specific round
        const currentIncludes = existingPrefs.includeExercises || [];
        const currentExcludes = existingPrefs.avoidExercises || [];
        const updatedIncludes = [...currentIncludes];

        // Round1 = index 0, Round2 = index 1
        const roundIndex = input.round === "Round1" ? 0 : 1;
        const oldExerciseName = updatedIncludes[roundIndex];

        // Update the include array with the new exercise
        updatedIncludes[roundIndex] = input.newExerciseName;

        // Add the old exercise to the exclude array if it exists and isn't already excluded
        const updatedExcludes = [...currentExcludes];
        if (oldExerciseName && !updatedExcludes.includes(oldExerciseName)) {
          updatedExcludes.push(oldExerciseName);
        }

        console.log("[replaceClientExercisePublic] Updating preferences:", {
          userId: input.userId,
          sessionId: input.sessionId,
          round: input.round,
          roundIndex,
          oldExercise: oldExerciseName,
          newExercise: input.newExerciseName,
          currentIncludes,
          updatedIncludes,
          currentExcludes,
          updatedExcludes,
        });

        await ctx.db
          .update(WorkoutPreferences)
          .set({
            includeExercises: updatedIncludes,
            avoidExercises: updatedExcludes,
          })
          .where(
            and(
              eq(WorkoutPreferences.userId, input.userId),
              eq(WorkoutPreferences.trainingSessionId, input.sessionId),
            ),
          );
      } else {
        // Create new preferences with the exercise
        const includeArray =
          input.round === "Round1"
            ? [input.newExerciseName, ""]
            : ["", input.newExerciseName];

        await ctx.db.insert(WorkoutPreferences).values({
          userId: input.userId,
          trainingSessionId: input.sessionId,
          businessId: session.businessId,
          includeExercises: includeArray,
          intensity: "moderate",
          muscleTargets: [],
          muscleLessens: [],
          avoidJoints: [],
          avoidExercises: [],
        });
      }

      // Invalidate blueprint cache when exercise is changed
      const { WorkoutBlueprintService } = await import(
        "../services/workout-blueprint-service"
      );
      await WorkoutBlueprintService.invalidateCache(input.sessionId);

      // Real-time updates will be handled by Supabase Realtime

      return { success: true };
    }),

  updateClientPreferencesPublic: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        userId: z.string(),
        preferences: z.object({
          confirmedExercises: z
            .array(
              z.object({
                name: z.string(),
                confirmed: z.boolean(),
              }),
            )
            .optional(),
          muscleFocus: z.array(z.string()).optional(),
          muscleAvoidance: z.array(z.string()).optional(),
          otherNotes: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Verify user belongs to session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          eq(UserTrainingSession.status, "checked_in"),
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid session or user not checked in",
        });
      }

      // Get session to find businessId
      const [session] = await ctx.db
        .select({ businessId: TrainingSession.businessId })
        .from(TrainingSession)
        .where(eq(TrainingSession.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Find or create preferences
      const [existingPref] = await ctx.db
        .select()
        .from(WorkoutPreferences)
        .where(
          and(
            eq(WorkoutPreferences.userId, input.userId),
            eq(WorkoutPreferences.trainingSessionId, input.sessionId),
          ),
        )
        .limit(1);

      if (existingPref) {
        // Update existing preferences
        await ctx.db
          .update(WorkoutPreferences)
          .set({
            muscleTargets: input.preferences.muscleFocus,
            muscleLessens: input.preferences.muscleAvoidance,
            notes: input.preferences.otherNotes
              ? [input.preferences.otherNotes]
              : [],
          })
          .where(eq(WorkoutPreferences.id, existingPref.id));
      } else {
        // Create new preferences
        await ctx.db.insert(WorkoutPreferences).values({
          userId: input.userId,
          trainingSessionId: input.sessionId,
          businessId: session.businessId,
          muscleTargets: input.preferences.muscleFocus || [],
          muscleLessens: input.preferences.muscleAvoidance || [],
          notes: input.preferences.otherNotes
            ? [input.preferences.otherNotes]
            : [],
        });
      }

      // Invalidate blueprint cache
      const { WorkoutBlueprintService } = await import(
        "../services/workout-blueprint-service"
      );
      await WorkoutBlueprintService.invalidateCache(input.sessionId);

      // Real-time updates will be handled by Supabase Realtime

      return { success: true };
    }),

  // Add exercise to client's include list
  addClientExercise: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string(),
        exerciseName: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user belongs to session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          eq(UserTrainingSession.status, "checked_in"),
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid session or user not checked in",
        });
      }

      // Get session to get business ID
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Find or create preferences
      const [existingPref] = await ctx.db
        .select()
        .from(WorkoutPreferences)
        .where(
          and(
            eq(WorkoutPreferences.userId, input.userId),
            eq(WorkoutPreferences.trainingSessionId, input.sessionId),
          ),
        )
        .limit(1);

      if (existingPref) {
        // Get current includeExercises
        const currentIncludeExercises = existingPref.includeExercises || [];

        // Check if exercise already exists
        if (currentIncludeExercises.includes(input.exerciseName)) {
          return { success: true }; // Already included
        }

        // Update existing preferences
        await ctx.db
          .update(WorkoutPreferences)
          .set({
            includeExercises: [...currentIncludeExercises, input.exerciseName],
          })
          .where(eq(WorkoutPreferences.id, existingPref.id));
      } else {
        // Create new preferences with the exercise
        await ctx.db.insert(WorkoutPreferences).values({
          userId: input.userId,
          trainingSessionId: input.sessionId,
          businessId: session.businessId,
          includeExercises: [input.exerciseName],
        });
      }

      // Invalidate blueprint cache
      const { WorkoutBlueprintService } = await import(
        "../services/workout-blueprint-service"
      );
      await WorkoutBlueprintService.invalidateCache(input.sessionId);

      // Real-time updates will be handled by Supabase Realtime

      return { success: true };
    }),

  /**
   * Update client ready status
   */
  updateClientReadyStatus: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        userId: z.string(),
        isReady: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the session exists and user has access
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }

      // Check if user is trainer for this business
      const isTrainer = ctx.session.user.businessId === session.businessId;
      const isOwnStatus = ctx.session.user.id === input.userId;

      if (!isTrainer && !isOwnStatus) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to update this status",
        });
      }

      // Get current user training session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          eq(UserTrainingSession.userId, input.userId),
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in this training session",
        });
      }

      // Only allow ready status if currently checked_in or ready
      if (
        userSession.status !== "checked_in" &&
        userSession.status !== "ready"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User must be checked in to mark as ready",
        });
      }

      // Update status
      const newStatus = input.isReady ? "ready" : "checked_in";
      await ctx.db
        .update(UserTrainingSession)
        .set({ status: newStatus })
        .where(eq(UserTrainingSession.id, userSession.id));

      return {
        success: true,
        newStatus,
        userId: input.userId,
      };
    }),

  /**
   * Update client ready status - PUBLIC version for clients
   */
  updateClientReadyStatusPublic: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        userId: z.string(),
        isReady: z.boolean(),
        targetStatus: z.enum(["ready", "workout_ready"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user belongs to session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          or(
            eq(UserTrainingSession.status, "checked_in"),
            eq(UserTrainingSession.status, "ready"),
            eq(UserTrainingSession.status, "workout_ready"),
          ),
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User session not found or user not checked in",
        });
      }

      // Update the user's ready status
      // This mutation is called from preferences page and workout overview page
      // From preferences: isReady: true = "ready" (client confirmed preferences)
      // From workout overview: targetStatus: "workout_ready" = "workout_ready" (client ready from workout overview)
      // isReady: false = "checked_in" (client went back)
      let newStatus: string;
      if (!input.isReady) {
        newStatus = "checked_in";
      } else if (input.targetStatus) {
        newStatus = input.targetStatus;
      } else {
        newStatus = "ready";
      }

      await ctx.db
        .update(UserTrainingSession)
        .set({ status: newStatus })
        .where(eq(UserTrainingSession.id, userSession.id));

      return {
        success: true,
        newStatus,
        userId: input.userId,
      };
    }),

  /**
   * Mark all clients as ready (trainer only)
   */
  markAllClientsReady: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the session exists and user is trainer
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }

      // Check if user is trainer for this business
      if (ctx.session.user.businessId !== session.businessId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can mark all clients as ready",
        });
      }

      // Update all checked_in clients to ready
      const result = await ctx.db
        .update(UserTrainingSession)
        .set({ status: "ready" })
        .where(
          and(
            eq(UserTrainingSession.trainingSessionId, input.sessionId),
            eq(UserTrainingSession.status, "checked_in"),
          ),
        );

      // Get count of updated clients
      const allUserSessions = await ctx.db.query.UserTrainingSession.findMany({
        where: eq(UserTrainingSession.trainingSessionId, input.sessionId),
      });

      const readyCount = allUserSessions.filter(
        (us) => us.status === "ready",
      ).length;
      const totalCount = allUserSessions.length;

      return {
        success: true,
        readyCount,
        totalCount,
      };
    }),

  /**
   * Save visualization data to template config
   */
  saveVisualizationData: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        visualizationData: z.object({
          blueprint: z.any(),
          groupContext: z.any(),
          llmResult: z.any().optional(),
          summary: z.any().optional(),
          llmData: z.any().optional(),
          exerciseMetadata: z.any().optional(),
          sharedExerciseIds: z.array(z.string()).optional(),
          timings: z.object({
            processStart: z.string(),
            processEnd: z.string(),
            llmCalls: z.record(z.string(), z.object({
              start: z.string(),
              end: z.string(),
              durationMs: z.number(),
            })),
          }).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;

      // Only trainers can save visualization data
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can save visualization data",
        });
      }

      // Verify session exists and belongs to trainer's business
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId),
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Build the template config structure
      const templateConfig = {
        ...((session.templateConfig as any) || {}),
        visualizationData: {
          ...input.visualizationData,
          savedAt: new Date().toISOString(),
        },
      };

      // Log what we're saving for debugging
      console.log("💾 SAVING VISUALIZATION DATA TO DB:", {
        sessionId: input.sessionId,
        hasBlueprint: !!input.visualizationData.blueprint,
        hasClientPools:
          !!input.visualizationData.blueprint?.clientExercisePools,
        bucketedSelections: input.visualizationData.blueprint
          ?.clientExercisePools
          ? Object.entries(
              input.visualizationData.blueprint.clientExercisePools,
            ).map(([clientId, pool]: [string, any]) => ({
              clientId,
              hasBucketedSelection: !!pool.bucketedSelection,
              bucketedCount: pool.bucketedSelection?.exercises?.length || 0,
            }))
          : [],
      });
      
      // Log the LLM debug data being saved
      console.log("🔍 LLM DEBUG DATA BEING SAVED:", {
        hasLlmResult: !!input.visualizationData.llmResult,
        hasDebug: !!input.visualizationData.llmResult?.debug,
        debugKeys: input.visualizationData.llmResult?.debug ? Object.keys(input.visualizationData.llmResult.debug) : [],
        systemPromptsByClientKeys: input.visualizationData.llmResult?.debug?.systemPromptsByClient ? 
          Object.keys(input.visualizationData.llmResult.debug.systemPromptsByClient) : [],
        llmResponsesByClientKeys: input.visualizationData.llmResult?.debug?.llmResponsesByClient ? 
          Object.keys(input.visualizationData.llmResult.debug.llmResponsesByClient) : []
      });

      // Update the session with the visualization data
      await ctx.db
        .update(TrainingSession)
        .set({
          templateConfig,
          updatedAt: new Date(),
        })
        .where(eq(TrainingSession.id, input.sessionId));

      return { success: true };
    }),

  /**
   * Get saved visualization data
   */
  getSavedVisualizationData: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;

      // Only trainers can get visualization data
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can get visualization data",
        });
      }

      // Get session with template config
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId),
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      const templateConfig = session.templateConfig as any;
      const visualizationData = templateConfig?.visualizationData;

      if (!visualizationData) {
        return null;
      }

      // Visualization data is never stale - once generated, it represents 
      // the workout blueprint for this session and should always be accessible

      // Add detailed logging for debug data
      console.log("🔍 [getSavedVisualizationData] LLM DEBUG DATA CHECK:", {
        hasLlmResult: !!visualizationData.llmResult,
        hasDebug: !!visualizationData.llmResult?.debug,
        debugKeys: visualizationData.llmResult?.debug ? Object.keys(visualizationData.llmResult.debug) : [],
        systemPromptsByClientKeys: visualizationData.llmResult?.debug?.systemPromptsByClient ? 
          Object.keys(visualizationData.llmResult?.debug?.systemPromptsByClient) : [],
        llmResponsesByClientKeys: visualizationData.llmResult?.debug?.llmResponsesByClient ? 
          Object.keys(visualizationData.llmResult?.debug?.llmResponsesByClient) : [],
        // Also check if they're at the top level (old format)
        hasTopLevelSystemPrompts: !!visualizationData.llmResult?.systemPromptsByClient,
        hasTopLevelLlmResponses: !!visualizationData.llmResult?.llmResponsesByClient,
        topLevelSystemPromptsKeys: visualizationData.llmResult?.systemPromptsByClient ? 
          Object.keys(visualizationData.llmResult?.systemPromptsByClient) : [],
        topLevelLlmResponsesKeys: visualizationData.llmResult?.llmResponsesByClient ? 
          Object.keys(visualizationData.llmResult?.llmResponsesByClient) : []
      });

      return visualizationData;
    }),

  /**
   * Get saved visualization data - PUBLIC version for clients
   */
  getSavedVisualizationDataPublic: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify user belongs to session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          or(
            eq(UserTrainingSession.status, "checked_in"),
            eq(UserTrainingSession.status, "ready"),
            eq(UserTrainingSession.status, "workout_ready"),
          ),
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not checked into this session",
        });
      }

      // Get session with template config
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      const templateConfig = session.templateConfig as any;
      const visualizationData = templateConfig?.visualizationData;

      if (!visualizationData) {
        return null;
      }

      // Visualization data is never stale - once generated, it represents 
      // the workout blueprint for this session and should always be accessible

      // Add detailed logging for debug data
      console.log("🔍 [getSavedVisualizationData] LLM DEBUG DATA CHECK:", {
        hasLlmResult: !!visualizationData.llmResult,
        hasDebug: !!visualizationData.llmResult?.debug,
        debugKeys: visualizationData.llmResult?.debug ? Object.keys(visualizationData.llmResult.debug) : [],
        systemPromptsByClientKeys: visualizationData.llmResult?.debug?.systemPromptsByClient ? 
          Object.keys(visualizationData.llmResult?.debug?.systemPromptsByClient) : [],
        llmResponsesByClientKeys: visualizationData.llmResult?.debug?.llmResponsesByClient ? 
          Object.keys(visualizationData.llmResult?.debug?.llmResponsesByClient) : [],
        // Also check if they're at the top level (old format)
        hasTopLevelSystemPrompts: !!visualizationData.llmResult?.systemPromptsByClient,
        hasTopLevelLlmResponses: !!visualizationData.llmResult?.llmResponsesByClient,
        topLevelSystemPromptsKeys: visualizationData.llmResult?.systemPromptsByClient ? 
          Object.keys(visualizationData.llmResult?.systemPromptsByClient) : [],
        topLevelLlmResponsesKeys: visualizationData.llmResult?.llmResponsesByClient ? 
          Object.keys(visualizationData.llmResult?.llmResponsesByClient) : []
      });

      return visualizationData;
    }),

  /**
   * Start workout - TV-optimized version that returns full organization data
   * This is the new standard implementation that returns workout organization details
   */
  startWorkout: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log(
        `[startWorkout-v2] START - Session: ${input.sessionId} at ${new Date().toISOString()}`,
      );

      const user = ctx.session?.user as SessionUser;

      // Only trainers can start workouts
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can start workouts",
        });
      }

      // Get session to check if already organized
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId),
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Check if workout organization already exists
      if (session.workoutOrganization) {
        // Already organized - fetch and return full data
        // Use direct queries to avoid Drizzle relation issues
        const workouts = await ctx.db.query.Workout.findMany({
          where: eq(Workout.trainingSessionId, input.sessionId),
        });

        // For each workout, get exercises with full metadata
        const workoutsWithExercises = await Promise.all(
          workouts.map(async (workout) => {
            const workoutExercises =
              await ctx.db.query.WorkoutExercise.findMany({
                where: eq(WorkoutExercise.workoutId, workout.id),
              });

            const exercisesWithMetadata = await Promise.all(
              workoutExercises.map(async (we) => {
                const exercise = we.exerciseId 
                  ? await ctx.db.query.exercises.findFirst({
                      where: eq(exercises.id, we.exerciseId),
                    })
                  : null;
                return {
                  ...we,
                  exercise: exercise,
                };
              }),
            );

            // Get user info
            const userSession =
              await ctx.db.query.UserTrainingSession.findFirst({
                where: and(
                  eq(UserTrainingSession.userId, workout.userId),
                  eq(UserTrainingSession.trainingSessionId, input.sessionId),
                ),
              });

            const user = await ctx.db.query.user.findFirst({
              where: eq(userTable.id, workout.userId),
            });

            return {
              id: workout.id,
              userId: workout.userId,
              userName: user?.name || null,
              userEmail: user?.email ?? "",
              exercises: exercisesWithMetadata,
            };
          }),
        );

        // Extract unique clients
        const uniqueClients = new Map();
        workoutsWithExercises.forEach((workout) => {
          if (!uniqueClients.has(workout.userId)) {
            uniqueClients.set(workout.userId, {
              userId: workout.userId,
              name: workout.userName,
              email: workout.userEmail,
            });
          }
        });

        return {
          success: true,
          message: "Workout already organized",
          alreadyOrganized: true,
          workoutOrganization: session.workoutOrganization,
          workouts: workoutsWithExercises,
          clients: Array.from(uniqueClients.values()),
          templateType: session.templateType,
        };
      }

      // For all templates, the workout is already organized
      console.log(
        `[startWorkout-v2] SKIP Phase 2 - Template: ${session.templateType}`,
      );

      // Fetch and return the data using direct queries
      const workouts = await ctx.db.query.Workout.findMany({
        where: eq(Workout.trainingSessionId, input.sessionId),
      });

      // For each workout, get exercises with full metadata
      const workoutsWithExercises = await Promise.all(
        workouts.map(async (workout) => {
          const workoutExercises =
            await ctx.db.query.WorkoutExercise.findMany({
              where: eq(WorkoutExercise.workoutId, workout.id),
            });

          const exercisesWithMetadata = await Promise.all(
            workoutExercises.map(async (we) => {
              const exercise = we.exerciseId
                ? await ctx.db.query.exercises.findFirst({
                    where: eq(exercises.id, we.exerciseId),
                  })
                : null;
              return {
                ...we,
                exercise: exercise,
              };
            }),
          );

          // Get user info
          const user = await ctx.db.query.user.findFirst({
            where: eq(userTable.id, workout.userId),
          });

          return {
            id: workout.id,
            userId: workout.userId,
            userName: user?.name || null,
            userEmail: user?.email || "",
            exercises: exercisesWithMetadata,
          };
        }),
      );

      // Extract unique clients
      const uniqueClients = new Map();
      workoutsWithExercises.forEach((workout) => {
        if (!uniqueClients.has(workout.userId)) {
          uniqueClients.set(workout.userId, {
            userId: workout.userId,
            name: workout.userName,
            email: workout.userEmail,
          });
        }
      });

      return {
        success: true,
        message: "Workout ready (no Phase 2 organization needed)",
        templateType: session.templateType,
        workoutOrganization: session.workoutOrganization,
        workouts: workoutsWithExercises,
        clients: Array.from(uniqueClients.values()),
      };
    }),

  // Temporary endpoint for testing Phase 2 preprocessing
  previewPhase2Data: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const data = await preprocessPhase2Data(ctx, input.sessionId);
      
      // Get session to check for saved workout organization
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });
      
      // Check if Phase 2 has already been run by looking at workout exercises
      const workouts = await ctx.db.query.Workout.findMany({
        where: eq(Workout.trainingSessionId, input.sessionId),
      });
      
      // Get workout exercises with exercise details
      const workoutsWithExercises = await Promise.all(
        workouts.map(async (workout) => {
          const workoutExercises = await ctx.db
            .select({
              id: WorkoutExercise.id,
              exerciseId: WorkoutExercise.exerciseId,
              orderIndex: WorkoutExercise.orderIndex,
              groupName: WorkoutExercise.groupName,
              exercise: exercises,
            })
            .from(WorkoutExercise)
            .innerJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
            .where(eq(WorkoutExercise.workoutId, workout.id));
            
          return {
            userId: workout.userId,
            workoutExercises: workoutExercises.map(we => ({
              ...we,
              name: we.exercise.name,
              orderIndex: we.orderIndex,
              groupName: we.groupName,
            })),
          };
        })
      );
      
      // Check if any exercises have been assigned to rounds (orderIndex 1-5)
      let hasPhase2Data = false;
      let savedRoundNames: Record<string, string> = {};
      
      for (const workout of workoutsWithExercises) {
        for (const exercise of workout.workoutExercises) {
          if (exercise.orderIndex >= 1 && exercise.orderIndex <= 5) {
            hasPhase2Data = true;
            // Extract round names from groupName (format: "Round X - Name")
            if (exercise.groupName) {
              const match = exercise.groupName.match(/Round (\d+) - (.+)/);
              if (match && match[1] && match[2]) {
                savedRoundNames[match[1]] = match[2];
              }
            }
          }
        }
      }
      
      // Get saved LLM data from session if it exists
      let savedLlmData = null;
      let generatedAt = null;
      if (hasPhase2Data && session?.workoutOrganization) {
        const workoutOrg = session.workoutOrganization as any;
        savedLlmData = workoutOrg.llmData || null;
        generatedAt = workoutOrg.generatedAt || null;
      }
      
      // Enhance fixed assignments with exercise names and shared info
      const enhancedFixedAssignments = data.allowedSlots.fixedAssignments.map(fa => {
        // Find the exercise details from exercisesWithTiers
        const exercise = data.exercisesWithTiers.find(ex => 
          ex.exerciseId === fa.exerciseId && ex.clientId === fa.clientId
        );
        
        // Check if this exercise is shared with other clients
        const sharedWithClients = data.allowedSlots.fixedAssignments
          .filter(otherFa => 
            otherFa.exerciseId === fa.exerciseId && 
            otherFa.clientId !== fa.clientId &&
            otherFa.round === fa.round
          )
          .map(otherFa => otherFa.clientId);
        
        return {
          ...fa,
          exerciseName: exercise?.name || 'Unknown Exercise',
          isShared: sharedWithClients.length > 0,
          sharedWithClients: sharedWithClients
        };
      });
      
      return {
        ...data,
        allowedSlots: {
          ...data.allowedSlots,
          fixedAssignments: enhancedFixedAssignments
        },
        hasPhase2Data,
        savedRoundNames: hasPhase2Data ? savedRoundNames : null,
        workouts: hasPhase2Data ? workoutsWithExercises : undefined,
        savedLlmData: savedLlmData,
        generatedAt: generatedAt,
      };
    }),

  generatePhase2Selections: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { sessionId } = input;
      
      // Record start time
      const startTime = new Date();
      
      // Get preprocessing data
      const preprocessData = await preprocessPhase2Data(ctx, sessionId);
      
      // Get session and template config
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, sessionId),
      });
      
      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }
      
      // Get workouts and exercises for metadata
      const workouts = await ctx.db.query.Workout.findMany({
        where: eq(Workout.trainingSessionId, sessionId),
      });
      
      // Get all exercises with metadata - they're already in preprocessData
      const exercisesWithMetadata = preprocessData.exercisesWithTiers;
      
      // Get client plans from roundOrganization
      const clientPlans = preprocessData.roundOrganization.perClientPlan;
      
      // Import and create StandardWorkoutGenerator
      const { StandardWorkoutGenerator } = await import("@acme/ai");
      const generator = new StandardWorkoutGenerator();
      
      // Filter and transform client plans to ensure bundleSkeleton is defined
      const validClientPlans = clientPlans
        .filter(plan => plan.bundleSkeleton !== undefined)
        .map(plan => ({
          clientId: plan.clientId,
          bundleSkeleton: plan.bundleSkeleton!
        }));
      
      // Call Phase 2 selection
      const phase2Result = await generator.selectRemainingExercises(
        preprocessData.allowedSlots,
        exercisesWithMetadata,
        preprocessData.roundOrganization.majorityRounds,
        validClientPlans
      );
      
      // Record end time
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      
      return {
        success: true,
        systemPrompt: phase2Result.systemPrompt,
        humanMessage: phase2Result.humanMessage,
        llmResponse: phase2Result.llmResponse,
        selections: phase2Result.selections,
        timing: {
          startedAt: startTime.toISOString(),
          completedAt: endTime.toISOString(),
          durationMs: durationMs,
          durationSeconds: Number((durationMs / 1000).toFixed(1)),
        },
      };
    }),

  updatePhase2Exercises: protectedProcedure
    .input(z.object({ 
      sessionId: z.string().uuid(),
      placements: z.array(z.tuple([z.string(), z.number()])),
      roundNames: z.record(z.string(), z.string()),
      fixedAssignments: z.array(z.object({
        exerciseId: z.string(),
        clientId: z.string(),
        round: z.number(),
      })).optional(),
      llmData: z.object({
        systemPrompt: z.string(),
        humanMessage: z.string(),
        llmResponse: z.string(),
        timing: z.object({
          startedAt: z.string(),
          completedAt: z.string(),
          durationMs: z.number(),
          durationSeconds: z.number(),
        }),
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { sessionId, placements, roundNames, fixedAssignments, llmData } = input;
      
      // Get all workouts for this session
      const workouts = await ctx.db.query.Workout.findMany({
        where: eq(Workout.trainingSessionId, sessionId),
      });
      
      // Create a map of userId to workoutId
      const userWorkoutMap = new Map<string, string>();
      workouts.forEach(w => userWorkoutMap.set(w.userId, w.id));
      
      // Process fixed assignments first
      if (fixedAssignments && fixedAssignments.length > 0) {
        for (const fixed of fixedAssignments) {
          const workoutId = userWorkoutMap.get(fixed.clientId);
          if (!workoutId) continue;
          
          // Find the workout exercise matching this fixed assignment
          const workoutExercise = await ctx.db.query.WorkoutExercise.findFirst({
            where: and(
              eq(WorkoutExercise.workoutId, workoutId),
              eq(WorkoutExercise.exerciseId, fixed.exerciseId)
            ),
          });
          
          if (workoutExercise) {
            const roundName = roundNames[fixed.round.toString()] || `Round ${fixed.round}`;
            const groupName = `Round ${fixed.round} - ${roundName}`;
            
            await ctx.db
              .update(WorkoutExercise)
              .set({
                orderIndex: fixed.round,
                groupName: groupName,
                phase: groupName,
              })
              .where(eq(WorkoutExercise.id, workoutExercise.id));
          }
        }
      }
      
      // Process each placement
      for (const [placementId, round] of placements) {
        // Extract clientId from the placement ID (format: "clientId_exercise_name")
        const splitResult = placementId.split('_');
        const clientId = splitResult[0] || '';
        const exerciseName = placementId.replace(clientId + '_', '').replace(/_/g, ' ');
        
        const workoutId = userWorkoutMap.get(clientId);
        if (!workoutId) continue;
        
        // Find the workout exercise by matching exercise name
        const workoutExercises = await ctx.db.query.WorkoutExercise.findMany({
          where: eq(WorkoutExercise.workoutId, workoutId),
        });
        
        for (const we of workoutExercises) {
          const exercise = we.exerciseId
            ? await ctx.db.query.exercises.findFirst({
                where: eq(exercises.id, we.exerciseId),
              })
            : null;
          
          if (exercise?.name.toLowerCase() === exerciseName.toLowerCase()) {
            // Update this workout exercise
            const roundName = roundNames[round.toString()] || `Round ${round}`;
            const groupName = `Round ${round} - ${roundName}`;
            
            await ctx.db
              .update(WorkoutExercise)
              .set({
                orderIndex: round,
                groupName: groupName,
                phase: groupName,
              })
              .where(eq(WorkoutExercise.id, we.id));
            
            break;
          }
        }
      }
      
      // Handle shared exercises - find exercises that appear in multiple placements
      const exerciseOccurrences = new Map<string, string[]>();
      
      for (const [placementId, round] of placements) {
        const splitResult = placementId.split('_');
        const clientId = splitResult[0] || '';
        const exerciseName = placementId.replace(clientId + '_', '').replace(/_/g, ' ');
        
        const key = `${exerciseName}_${round}`;
        if (!exerciseOccurrences.has(key)) {
          exerciseOccurrences.set(key, []);
        }
        exerciseOccurrences.get(key)!.push(clientId);
      }
      
      // Update shared_with_clients for exercises that appear for multiple clients
      for (const [key, clientIds] of exerciseOccurrences) {
        if (clientIds.length > 1) {
          const splitKey = key.split('_');
          const exerciseName = splitKey[0] || '';
          const roundStr = splitKey[1] || '';
          
          for (const clientId of clientIds) {
            const workoutId = userWorkoutMap.get(clientId);
            if (!workoutId) continue;
            
            const workoutExercises = await ctx.db.query.WorkoutExercise.findMany({
              where: eq(WorkoutExercise.workoutId, workoutId),
            });
            
            for (const we of workoutExercises) {
              const exercise = we.exerciseId
                ? await ctx.db.query.exercises.findFirst({
                    where: eq(exercises.id, we.exerciseId),
                  })
                : null;
              
              if (exercise?.name.toLowerCase() === exerciseName.toLowerCase()) {
                // Update with other client IDs
                const otherClients = clientIds.filter(id => id !== clientId);
                
                await ctx.db
                  .update(WorkoutExercise)
                  .set({
                    sharedWithClients: otherClients,
                  })
                  .where(eq(WorkoutExercise.id, we.id));
                
                break;
              }
            }
          }
        }
      }
      
      // Update the session with workout organization to mark Phase 2 as complete
      // This allows the TV app to skip Phase 2 generation on subsequent "Start Workout" clicks
      console.log('[updatePhase2Exercises] llmData received:', {
        hasLlmData: !!llmData,
        hasSystemPrompt: !!llmData?.systemPrompt,
        hasHumanMessage: !!llmData?.humanMessage,
        hasLlmResponse: !!llmData?.llmResponse,
        hasTiming: !!llmData?.timing,
        systemPromptLength: llmData?.systemPrompt?.length,
        humanMessageLength: llmData?.humanMessage?.length,
        llmResponseLength: llmData?.llmResponse?.length,
      });
      
      const workoutOrganization = {
        llmData: llmData || undefined,
        placements: placements,
        fixedAssignments: fixedAssignments || [],
        roundNames: roundNames,
        generatedAt: new Date().toISOString(),
      };
      
      console.log('[updatePhase2Exercises] workoutOrganization to save:', {
        hasLlmData: !!workoutOrganization.llmData,
        placementsCount: workoutOrganization.placements.length,
        fixedAssignmentsCount: workoutOrganization.fixedAssignments.length,
        roundNamesCount: Object.keys(workoutOrganization.roundNames).length,
      });
      
      await ctx.db
        .update(TrainingSession)
        .set({
          workoutOrganization: workoutOrganization,
          updatedAt: new Date(),
        })
        .where(eq(TrainingSession.id, sessionId));
      
      return {
        success: true,
        message: "Workout exercises updated with Phase 2 selections",
        workoutOrganization: workoutOrganization,
      };
    }),

  getSession: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.id),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Transform cancelled status to draft for frontend
      return {
        ...session,
        status: session.status === 'cancelled' ? 'draft' as const : session.status,
      };
    }),

  // Check if workout exists for session (public - no auth required)
  hasWorkoutForSession: publicProcedure
    .input(z.object({ 
      sessionId: z.string().uuid() 
    }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(Workout)
        .where(
          and(
            eq(Workout.trainingSessionId, input.sessionId),
            or(
              eq(Workout.status, "draft"),
              eq(Workout.status, "ready"),
              eq(Workout.status, "completed")
            )
          )
        );
      
      return (result[0]?.count ?? 0) > 0;
    }),

  // List circuit sessions (public - no auth required)
  listCircuitSessions: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        // Optional filters
        businessId: z.string().uuid().optional(),
        trainerId: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: z.enum(['completed', 'active', 'draft']).optional(), // 'active' means not completed, 'draft' means cancelled
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(TrainingSession.templateType, "circuit")];

      // Only filter by businessId if provided
      if (input.businessId) {
        conditions.push(eq(TrainingSession.businessId, input.businessId));
      }

      if (input.trainerId) {
        conditions.push(eq(TrainingSession.trainerId, input.trainerId));
      }

      if (input.startDate) {
        conditions.push(gte(TrainingSession.scheduledAt, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(TrainingSession.scheduledAt, input.endDate));
      }

      // Filter by status
      if (input.status === 'completed') {
        conditions.push(eq(TrainingSession.status, 'completed'));
      } else if (input.status === 'active') {
        // Active means any status except completed and cancelled
        conditions.push(sql`${TrainingSession.status} NOT IN ('completed', 'cancelled')`);
      } else if (input.status === 'draft') {
        // Draft means cancelled status
        conditions.push(eq(TrainingSession.status, 'cancelled'));
      }

      // Get sessions with participant counts
      const sessions = await ctx.db
        .select({
          id: TrainingSession.id,
          businessId: TrainingSession.businessId,
          trainerId: TrainingSession.trainerId,
          name: TrainingSession.name,
          scheduledAt: TrainingSession.scheduledAt,
          durationMinutes: TrainingSession.durationMinutes,
          maxParticipants: TrainingSession.maxParticipants,
          status: TrainingSession.status,
          program: TrainingSession.program,
          templateType: TrainingSession.templateType,
          templateConfig: TrainingSession.templateConfig,
          workoutOrganization: TrainingSession.workoutOrganization,
          createdAt: TrainingSession.createdAt,
          updatedAt: TrainingSession.updatedAt,
          participantCount: sql<number>`COUNT(${UserTrainingSession.userId})`.as('participantCount'),
        })
        .from(TrainingSession)
        .leftJoin(UserTrainingSession, eq(UserTrainingSession.trainingSessionId, TrainingSession.id))
        .where(and(...conditions))
        .groupBy(TrainingSession.id)
        .orderBy(
          // Order by status priority: in_progress (1), open (2), completed (3), others (4)
          sql`CASE 
            WHEN ${TrainingSession.status} = 'in_progress' THEN 1
            WHEN ${TrainingSession.status} = 'open' THEN 2
            WHEN ${TrainingSession.status} = 'completed' THEN 3
            ELSE 4 
          END`,
          // Then by scheduledAt descending (most recent first)
          desc(TrainingSession.scheduledAt)
        )
        .limit(input.limit)
        .offset(input.offset);

      // Transform cancelled status to draft for frontend
      return sessions.map(session => ({
        ...session,
        status: session.status === 'cancelled' ? 'draft' as const : session.status,
      }));
    }),

  createWorkoutsFromBlueprint: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        blueprintData: z.object({
          blueprint: z.any(),
          groupContext: z.any(),
          llmResult: z.any(),
          summary: z.any(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionId, blueprintData } = input;
      
      
      // Initialize the workout generation service
      const workoutGenerationService = new WorkoutGenerationService(ctx);
      
      // Get the exercise pool from the blueprint
      const exercisePool: Exercise[] = [];
      if (blueprintData.blueprint.blocks) {
        // For BMF/Circuit style blueprints
        blueprintData.blueprint.blocks.forEach((block: any) => {
          // Add shared exercises
          if (block.sharedCandidates?.exercises) {
            exercisePool.push(...block.sharedCandidates.exercises);
          }
          // Add individual exercises
          Object.values(block.individualCandidates || {}).forEach((clientData: any) => {
            if (clientData.exercises) {
              exercisePool.push(...clientData.exercises);
            }
          });
        });
      }
      
      // Remove duplicates
      const uniqueExercisePool = Array.from(
        new Map(exercisePool.map(ex => [ex.id, ex])).values()
      );
      
      
      // Create workouts using the blueprint's LLM result
      const workoutIds = await workoutGenerationService.createWorkouts(
        sessionId,
        blueprintData.llmResult,
        blueprintData.groupContext,
        uniqueExercisePool
      );
      
      
      return {
        success: true,
        workoutIds,
        message: "Workouts created successfully",
      };
    }),

  /**
   * Update session status (for navigation state management)
   */
  updateSessionStatus: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        status: z.enum(["open", "in_progress", "draft"]).transform(val => 
          val === "draft" ? "cancelled" : val
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;

      // Get the session to verify ownership and current status
      const [session] = await ctx.db
        .select()
        .from(TrainingSession)
        .where(eq(TrainingSession.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Verify session belongs to user's business
      if (session.businessId !== user.businessId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update sessions from your own business",
        });
      }

      // If trying to set to in_progress, check if there's already one
      if (input.status === "in_progress") {
        const [existingInProgress] = await ctx.db
          .select()
          .from(TrainingSession)
          .where(
            and(
              eq(TrainingSession.businessId, user.businessId),
              eq(TrainingSession.status, "in_progress"),
              // Exclude current session
              sql`${TrainingSession.id} != ${input.sessionId}`,
            ),
          )
          .limit(1);

        if (existingInProgress) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "There is already a session in progress. Please complete or close it before opening another.",
          });
        }
      }

      // Update the session status
      await ctx.db
        .update(TrainingSession)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(TrainingSession.id, input.sessionId));

      console.log(`[updateSessionStatus] Session ${input.sessionId} status updated to: ${input.status}`);

      return {
        success: true,
        sessionId: input.sessionId,
        newStatus: input.status === "cancelled" ? "draft" : input.status,
      };
    }),

  /**
   * Update session name (public route)
   */
  updateSessionName: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        name: z.string().min(1, "Session name is required").max(255, "Session name too long"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get the session to verify it exists
      const [session] = await ctx.db
        .select()
        .from(TrainingSession)
        .where(eq(TrainingSession.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Update the session name
      const [updatedSession] = await ctx.db
        .update(TrainingSession)
        .set({
          name: input.name.trim(),
          updatedAt: new Date(),
        })
        .where(eq(TrainingSession.id, input.sessionId))
        .returning();

      console.log(`[updateSessionName] Session ${input.sessionId} name updated to: ${input.name}`);

      return updatedSession;
    }),


  // New endpoint specifically for getting a single favorite's template config
  getFavoriteTemplateConfig: publicProcedure
    .input(
      z.object({
        favoriteId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      console.log(`[getFavoriteTemplateConfig] Fetching template config for favorite: ${input.favoriteId}`);

      // Get the favorite session with its template config
      const favoriteSession = await ctx.db
        .select({
          id: FavoriteSessions.id,
          trainingSession: {
            id: TrainingSession.id,
            name: TrainingSession.name,
            templateConfig: TrainingSession.templateConfig,
          },
        })
        .from(FavoriteSessions)
        .innerJoin(
          TrainingSession,
          eq(FavoriteSessions.trainingSessionId, TrainingSession.id),
        )
        .where(eq(FavoriteSessions.id, input.favoriteId))
        .limit(1)
        .then((res) => res[0]);

      if (!favoriteSession) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Favorite session not found",
        });
      }

      return {
        id: favoriteSession.trainingSession.id,
        name: favoriteSession.trainingSession.name,
        templateConfig: favoriteSession.trainingSession.templateConfig,
      };
    }),

  // Get complete template data including exercises for preview
  getFavoriteTemplateWithExercises: publicProcedure
    .input(
      z.object({
        favoriteId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      console.log(`[getFavoriteTemplateWithExercises] Fetching complete template for favorite: ${input.favoriteId}`);

      // Get the favorite with full training session data
      const favorite = await ctx.db.query.FavoriteSessions.findFirst({
        where: eq(FavoriteSessions.id, input.favoriteId),
        with: {
          trainingSession: true,
        },
      });

      if (!favorite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Favorite session not found",
        });
      }

      const trainingSession = favorite.trainingSession;
      const templateConfig = trainingSession.templateConfig as any;
      const configData = templateConfig?.config || templateConfig; // Handle nested config structure
      
      // Find a workout for this session to get exercises
      // For templates, we just need ANY workout - they all have the same exercises for circuits
      const workout = await ctx.db.query.Workout.findFirst({
        where: and(
          eq(Workout.trainingSessionId, trainingSession.id),
          // Accept any status for historical data
          or(
            eq(Workout.status, "draft"),
            eq(Workout.status, "ready"),
            eq(Workout.status, "completed"),
          ),
        ),
      });

      // If no workout found, return template without exercises
      if (!workout) {
        console.log(`[getFavoriteTemplateWithExercises] No workout found for session ${trainingSession.id}`);
        return {
          favorite: {
            id: favorite.id,
          },
          session: {
            id: trainingSession.id,
            name: trainingSession.name,
            scheduledAt: trainingSession.scheduledAt,
            durationMinutes: trainingSession.durationMinutes,
          },
          templateConfig,
          exercises: [],
          rounds: [],
          workoutId: null, // No workout ID if no workout found
        };
      }

      // Get all exercises for this workout
      const workoutExercises = await ctx.db
        .select({
          we: WorkoutExercise,
          exercise: exercises,
        })
        .from(WorkoutExercise)
        .leftJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .where(eq(WorkoutExercise.workoutId, workout.id))
        .orderBy(asc(WorkoutExercise.orderIndex));

      // Transform exercises for template display
      const exerciseList = workoutExercises.map((row) => ({
        id: row.we.id,
        exerciseId: row.we.exerciseId,
        exerciseName: (row.we.custom_exercise as any)?.customName || row.exercise?.name || 'Unknown Exercise',
        orderIndex: row.we.orderIndex,
        groupName: row.we.groupName || 'Round 1',
        stationIndex: row.we.stationIndex,
        template: row.we.template,
        repsPlanned: row.we.repsPlanned,
      }));

      // Group exercises by round for easier display
      const roundsMap = new Map<string, any[]>();
      exerciseList.forEach((exercise) => {
        const round = exercise.groupName;
        if (!roundsMap.has(round)) {
          roundsMap.set(round, []);
        }
        roundsMap.get(round)!.push(exercise);
      });

      // Convert to array and sort by round name
      const rounds = Array.from(roundsMap.entries())
        .map(([roundName, exercises]) => {
          const roundNum = parseInt(roundName.replace('Round ', ''));
          console.log(`[getFavoriteTemplateWithExercises] Processing ${roundName}:`, {
            roundNum,
            roundTemplates: configData?.roundTemplates,
            matchingTemplate: configData?.roundTemplates?.find((rt: any) => rt.roundNumber === roundNum),
          });
          
          const roundType = configData?.roundTemplates?.find((rt: any) => 
            rt.roundNumber === roundNum
          )?.template?.type || 'circuit_round';
          
          console.log(`[getFavoriteTemplateWithExercises] Round ${roundNum} type: ${roundType}`);
          
          return {
            roundName,
            exercises: exercises.sort((a, b) => a.orderIndex - b.orderIndex),
            roundType,
          };
        })
        .sort((a, b) => {
          // Sort by round number
          const aNum = parseInt(a.roundName.replace('Round ', ''));
          const bNum = parseInt(b.roundName.replace('Round ', ''));
          return aNum - bNum;
        });

      console.log(`[getFavoriteTemplateWithExercises] Found ${exerciseList.length} exercises in ${rounds.length} rounds`);
      console.log('[getFavoriteTemplateWithExercises] Returning workout ID:', workout.id);

      return {
        favorite: {
          id: favorite.id,
        },
        session: {
          id: trainingSession.id,
          name: trainingSession.name,
          scheduledAt: trainingSession.scheduledAt,
          durationMinutes: trainingSession.durationMinutes,
        },
        templateConfig,
        exercises: exerciseList,
        rounds,
        workoutId: workout.id, // Include the workout ID for template creation
      };
    }),

  // New endpoint to get training session template with exercises (bypasses favorites)
  getSessionTemplateWithExercises: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      console.log(`[getSessionTemplateWithExercises] Fetching complete template for session: ${input.sessionId}`);

      // Get the training session directly
      const trainingSession = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!trainingSession) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }

      const templateConfig = trainingSession.templateConfig as any;
      const configData = templateConfig?.config || templateConfig; // Handle nested config structure
      
      // Find a workout for this session to get exercises
      // For templates, we just need ANY workout - they all have the same exercises for circuits
      const workout = await ctx.db.query.Workout.findFirst({
        where: and(
          eq(Workout.trainingSessionId, trainingSession.id),
          // Accept any status for historical data
          or(
            eq(Workout.status, "draft"),
            eq(Workout.status, "ready"),
            eq(Workout.status, "completed"),
          ),
        ),
      });

      // If no workout found, return template without exercises
      if (!workout) {
        console.log(`[getSessionTemplateWithExercises] No workout found for session ${trainingSession.id}`);
        return {
          session: {
            id: trainingSession.id,
            name: trainingSession.name,
            scheduledAt: trainingSession.scheduledAt,
            durationMinutes: trainingSession.durationMinutes,
          },
          templateConfig,
          exercises: [],
          rounds: [],
          workoutId: null, // No workout ID if no workout found
        };
      }

      // Get all exercises for this workout
      const workoutExercises = await ctx.db
        .select({
          we: WorkoutExercise,
          exercise: exercises,
        })
        .from(WorkoutExercise)
        .leftJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .where(eq(WorkoutExercise.workoutId, workout.id))
        .orderBy(asc(WorkoutExercise.orderIndex));

      // Transform exercises for template display
      const exerciseList = workoutExercises.map((row) => ({
        id: row.we.id,
        exerciseId: row.we.exerciseId,
        exerciseName: (row.we.custom_exercise as any)?.customName || row.exercise?.name || 'Unknown Exercise',
        orderIndex: row.we.orderIndex,
        groupName: row.we.groupName || 'Round 1',
        stationIndex: row.we.stationIndex,
        template: row.we.template,
        repsPlanned: row.we.repsPlanned,
      }));

      // Group exercises by round for easier display
      const roundsMap = new Map<string, any[]>();
      exerciseList.forEach((exercise) => {
        const round = exercise.groupName;
        if (!roundsMap.has(round)) {
          roundsMap.set(round, []);
        }
        roundsMap.get(round)!.push(exercise);
      });

      // Convert to array and sort by round name
      const rounds = Array.from(roundsMap.entries())
        .map(([roundName, exercises]) => {
          const roundNum = parseInt(roundName.replace('Round ', ''));
          console.log(`[getSessionTemplateWithExercises] Processing ${roundName}:`, {
            roundNum,
            roundTemplates: configData?.roundTemplates,
            matchingTemplate: configData?.roundTemplates?.find((rt: any) => rt.roundNumber === roundNum),
          });
          
          const roundType = configData?.roundTemplates?.find((rt: any) => 
            rt.roundNumber === roundNum
          )?.template?.type || 'circuit_round';
          
          console.log(`[getSessionTemplateWithExercises] Round ${roundNum} type: ${roundType}`);
          
          return {
            roundName,
            exercises: exercises.sort((a, b) => a.orderIndex - b.orderIndex),
            roundType,
          };
        })
        .sort((a, b) => {
          // Sort by round number
          const aNum = parseInt(a.roundName.replace('Round ', ''));
          const bNum = parseInt(b.roundName.replace('Round ', ''));
          return aNum - bNum;
        });

      console.log(`[getSessionTemplateWithExercises] Found ${exerciseList.length} exercises in ${rounds.length} rounds`);
      console.log('[getSessionTemplateWithExercises] Returning workout ID:', workout.id);

      return {
        session: {
          id: trainingSession.id,
          name: trainingSession.name,
          scheduledAt: trainingSession.scheduledAt,
          durationMinutes: trainingSession.durationMinutes,
        },
        templateConfig,
        exercises: exerciseList,
        rounds,
        workoutId: workout.id, // Include the workout ID for template creation
      };
    }),

  // Generate circuit workout without checked-in users
  generateCircuitWorkoutPublic: publicProcedure
    .input(z.object({ 
      sessionId: z.string().uuid(),
      sessionDetails: z.object({
        name: z.string().optional(),
        scheduledAt: z.date().optional(),
        program: z.enum(["h4h_5am", "h4h_5pm", "saturday_cg", "monday_cg", "coach_frank", "coach_steph", "coach_kyle", "unassigned"]).optional(),
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Get session with circuit config
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      if (session.templateType !== "circuit") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not a circuit training session",
        });
      }

      // Update session details if provided
      if (input.sessionDetails) {
        const updateData: Partial<{
          name: string;
          scheduledAt: Date;
          program: "h4h_5am" | "h4h_5pm" | "saturday_cg" | "monday_cg" | "coach_frank" | "coach_steph" | "coach_kyle" | "unassigned";
          updatedAt: Date;
        }> = {
          updatedAt: new Date(),
        };

        if (input.sessionDetails.name !== undefined) {
          updateData.name = input.sessionDetails.name;
        }
        if (input.sessionDetails.scheduledAt !== undefined) {
          updateData.scheduledAt = input.sessionDetails.scheduledAt;
        }
        if (input.sessionDetails.program !== undefined) {
          updateData.program = input.sessionDetails.program;
        }

        // Only update if there are actual fields to update (beyond updatedAt)
        if (Object.keys(updateData).length > 1) {
          await ctx.db
            .update(TrainingSession)
            .set(updateData)
            .where(eq(TrainingSession.id, input.sessionId));
        }
      }

      // Check if workout already exists
      const existingWorkout = await ctx.db.query.Workout.findFirst({
        where: eq(Workout.trainingSessionId, input.sessionId),
      });

      if (existingWorkout) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Workout already exists for this session",
        });
      }

      // Get circuit configuration
      const circuitConfig = session.templateConfig as any;
      // Allow empty configurations for custom "start from scratch" workflows
      const hasRounds = circuitConfig?.config?.roundTemplates && circuitConfig.config.roundTemplates.length > 0;
      
      if (!circuitConfig?.config?.roundTemplates) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Circuit configuration not found. Please configure the circuit first.",
        });
      }

      // Hardcoded trainer ID for master workout
      const MASTER_TRAINER_ID = 'v4dxeCHAJ31kgL3To8NygjuNNZXZGf9W';

      // Check if this is from a template (has sourceWorkoutId)
      const sourceWorkoutId = circuitConfig.config.sourceWorkoutId;
      let templateExercises: any[] = [];

      console.log(`[generateCircuitWorkout] Circuit config:`, {
        hasSourceWorkoutId: !!sourceWorkoutId,
        sourceWorkoutId,
        roundTemplates: circuitConfig.config.roundTemplates?.length,
      });

      if (sourceWorkoutId) {
        console.log(`[generateCircuitWorkout] Using template workout: ${sourceWorkoutId}`);
        
        // Get exercises from the source workout
        const sourceExercises = await ctx.db
          .select({
            we: WorkoutExercise,
            exercise: exercises,
          })
          .from(WorkoutExercise)
          .leftJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
          .where(eq(WorkoutExercise.workoutId, sourceWorkoutId))
          .orderBy(asc(WorkoutExercise.orderIndex));

        templateExercises = sourceExercises.map((row) => ({
          exerciseId: row.we.exerciseId,
          exerciseName: (row.we.custom_exercise as any)?.customName || row.exercise?.name,
          customExercise: row.we.custom_exercise,
          groupName: row.we.groupName,
          orderIndex: row.we.orderIndex,
          stationIndex: row.we.stationIndex,
          template: row.we.template,
          repsPlanned: row.we.repsPlanned,
        }));

        console.log(`[generateCircuitWorkout] Found ${templateExercises.length} exercises from template`);
      }

      // Get a pool of exercises for circuit training (fallback for when no template)
      const exercisePool = await ctx.db
        .select()
        .from(exercises)
        .limit(100);

      // Start transaction to create workout and exercises
      const result = await ctx.db.transaction(async (tx) => {
        // Create the master workout
        const [workout] = await tx
          .insert(Workout)
          .values({
            trainingSessionId: input.sessionId,
            userId: MASTER_TRAINER_ID,
            businessId: session.businessId,
            createdByTrainerId: MASTER_TRAINER_ID,
            notes: "Circuit Training Master Workout",
            workoutType: "circuit",
            totalPlannedSets: 0,
            llmOutput: {
              circuitConfig: circuitConfig.config,
              generatedAt: new Date().toISOString(),
              isTemplate: true,
            },
            context: "group",
            status: "ready",
          })
          .returning();

        // Generate workout exercises based on circuit configuration
        const workoutExercises = [];
        let orderIndex = 0;

        // If we have template exercises, organize them by round
        const exercisesByRound = new Map<string, any[]>();
        if (templateExercises.length > 0) {
          for (const exercise of templateExercises) {
            const round = exercise.groupName || 'Round 1';
            if (!exercisesByRound.has(round)) {
              exercisesByRound.set(round, []);
            }
            exercisesByRound.get(round)!.push(exercise);
          }
        }

        for (const roundTemplate of circuitConfig.config.roundTemplates) {
          const roundNumber = roundTemplate.roundNumber;
          const template = roundTemplate.template;
          const exercisesPerRound = template.exercisesPerRound || 6;
          const roundName = `Round ${roundNumber}`;


          // Get template exercises for this round (if available)
          const roundTemplateExercises = exercisesByRound.get(roundName) || [];

          // For stations rounds, we need to create stations with multiple exercises each
          if (template.type === 'stations_round') {
            // When using a template, preserve the station structure
            if (roundTemplateExercises.length > 0 && sourceWorkoutId) {
              // For station rounds from templates, group by orderIndex to determine stations
              const exercisesByOrderIndex = new Map<number, any[]>();
              const orderIndexes = new Set<number>();
              
              for (const exercise of roundTemplateExercises) {
                const orderIdx = exercise.orderIndex;
                orderIndexes.add(orderIdx);
                
                if (!exercisesByOrderIndex.has(orderIdx)) {
                  exercisesByOrderIndex.set(orderIdx, []);
                }
                exercisesByOrderIndex.get(orderIdx)!.push(exercise);
              }
              
              // Sort order indexes to get stations in sequence
              const sortedOrderIndexes = Array.from(orderIndexes).sort((a, b) => a - b);
              
              
              // Create exercises preserving the station structure based on orderIndex grouping
              sortedOrderIndexes.forEach((origOrderIndex, stationIdx) => {
                const stationExercises = exercisesByOrderIndex.get(origOrderIndex) || [];
                
                // Sort exercises within station by stationIndex for consistent ordering
                stationExercises.sort((a, b) => (a.stationIndex ?? 0) - (b.stationIndex ?? 0));
                
                // All exercises in this station share the same orderIndex
                const stationOrderIndex = orderIndex + stationIdx;
                
                for (let i = 0; i < stationExercises.length; i++) {
                  const templateEx = stationExercises[i];
                  const exerciseToInsert = {
                    workoutId: workout!.id,
                    exerciseId: templateEx.exerciseId,
                    custom_exercise: templateEx.customExercise,
                    repsPlanned: templateEx.repsPlanned,
                    orderIndex: stationOrderIndex, // Same orderIndex for all exercises in this station
                    stationIndex: i, // Sequential stationIndex within the station (0, 1, 2...)
                    groupName: roundName,
                    isShared: true, // Stations are shared
                    selectionSource: 'trainer' as const,
                    setsCompleted: 0,
                  };
                  
                  workoutExercises.push(exerciseToInsert);
                }
              });
              
              // Update orderIndex to account for all stations created
              orderIndex += sortedOrderIndexes.length;
            } else {
              // No template - use user's selected station count
              const stationsCount = exercisesPerRound;
              const exercisesPerStation = Math.ceil(exercisesPerRound / stationsCount);

              for (let stationIndex = 0; stationIndex < stationsCount; stationIndex++) {
                // Add exercises for this station
                for (let exerciseInStation = 0; exerciseInStation < exercisesPerStation; exerciseInStation++) {
                  const exerciseIndex = stationIndex * exercisesPerStation + exerciseInStation;
                  
                  const randomExercise = exercisePool[Math.floor(Math.random() * exercisePool.length)];
                  const exerciseData = {
                    exerciseId: randomExercise?.id ?? null,
                    custom_exercise: !randomExercise ? {
                      customName: `Station ${stationIndex + 1} Exercise ${exerciseInStation + 1}`,
                      originalExerciseId: undefined,
                    } : null,
                    repsPlanned: null,
                  };
                  
                  workoutExercises.push({
                    workoutId: workout!.id,
                    ...exerciseData,
                    orderIndex: orderIndex + stationIndex,
                    stationIndex: exerciseInStation, // Position within the station (0, 1, 2...)
                    groupName: roundName,
                    isShared: true, // Stations are shared
                    selectionSource: 'trainer' as const,
                    setsCompleted: 0,
                  });
                }
              }
              orderIndex += stationsCount;
            }
          } else {
            // Circuit rounds and AMRAP rounds - one exercise per slot
            for (let i = 0; i < exercisesPerRound; i++) {
              // Use template exercise if available, otherwise use random
              let exerciseData;
              let templateStationIndex = null;
              
              if (i < roundTemplateExercises.length) {
                const templateEx = roundTemplateExercises[i];
                exerciseData = {
                  exerciseId: templateEx.exerciseId,
                  custom_exercise: templateEx.customExercise,
                  repsPlanned: templateEx.repsPlanned,
                };
                templateStationIndex = templateEx.stationIndex;
              } else {
                const randomExercise = exercisePool[Math.floor(Math.random() * exercisePool.length)];
                exerciseData = {
                  exerciseId: randomExercise?.id ?? null,
                  custom_exercise: !randomExercise ? {
                    customName: `Exercise ${i + 1}`,
                    originalExerciseId: undefined,
                  } : null,
                  repsPlanned: null,
                };
              }
              
              workoutExercises.push({
                workoutId: workout!.id,
                ...exerciseData,
                orderIndex: orderIndex++,
                stationIndex: templateStationIndex, // PRESERVE STATION INDEX IF FROM TEMPLATE!
                groupName: roundName,
                isShared: false, // Circuit exercises are not shared
                selectionSource: 'trainer' as const,
                setsCompleted: 0,
              });
            }
          }
        }

        // Insert all workout exercises (only if there are any)
        if (workoutExercises.length > 0) {
          await tx.insert(WorkoutExercise).values(workoutExercises);
        }

        return {
          workoutId: workout!.id,
          exerciseCount: workoutExercises.length,
          rounds: circuitConfig.config.rounds,
        };
      });

      return result;
    }),

  /**
   * Public endpoint to create a new circuit session
   * Used by the circuit-config page for new session creation flow
   * Creates a session with hardcoded business and trainer IDs
   */
  createCircuitSessionPublic: publicProcedure
    .input(
      z.object({
        workoutType: z.enum(['custom', 'template']).optional(),
        startFromScratch: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Hardcoded values for public circuit session creation
      const HARDCODED_BUSINESS_ID = "d33b41e2-f700-4a08-9489-cb6e3daa7f20"; // Same as used in circuit-sessions page
      const HARDCODED_TRAINER_ID = "v4dxeCHAJ31kgL3To8NygjuNNZXZGf9W"; // Tony Li trainer ID
      
      const now = new Date();
      const sessionName = `Circuit Session - ${now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`;

      // Import circuit configs based on startFromScratch parameter
      const { DEFAULT_CIRCUIT_CONFIG, EMPTY_CIRCUIT_CONFIG } = await import("@acme/db");
      const selectedConfig = input.startFromScratch ? EMPTY_CIRCUIT_CONFIG : DEFAULT_CIRCUIT_CONFIG;

      // Add music config to round templates (if any exist)
      const roundTemplatesWithMusic = selectedConfig.config.roundTemplates.map(rt => ({
        ...rt,
        music: generateMinimalMusicConfig(rt.template),
      }));

      // Create the session data
      const sessionData = {
        businessId: HARDCODED_BUSINESS_ID,
        trainerId: HARDCODED_TRAINER_ID,
        name: sessionName,
        scheduledAt: now,
        durationMinutes: 60, // Default 60 minutes
        maxParticipants: 20, // Default 20 participants
        status: "open" as const,
        templateType: "circuit" as const,
        templateConfig: {
          ...selectedConfig,
          config: {
            ...selectedConfig.config,
            roundTemplates: roundTemplatesWithMusic,
          },
          lastUpdated: new Date(),
          updatedBy: HARDCODED_TRAINER_ID,
        }
      };

      try {
        const result = await ctx.db
          .insert(TrainingSession)
          .values(sessionData)
          .returning();

        if (!result[0]) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create session - no data returned",
          });
        }

        return {
          success: true,
          sessionId: result[0].id,
          workoutType: input.workoutType ?? 'custom'
        };
      } catch (error) {
        console.error('[CreateCircuitSessionPublic] Error creating session:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create circuit session",
        });
      }
    }),

  /**
   * Delete a training session (public route)
   * Uses hardcoded business and trainer IDs for authorization
   */
  deleteSessionPublic: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Hardcoded values for public circuit session operations
      const HARDCODED_BUSINESS_ID = "d33b41e2-f700-4a08-9489-cb6e3daa7f20";
      const HARDCODED_TRAINER_ID = "v4dxeCHAJ31kgL3To8NygjuNNZXZGf9W";

      // Get the session to verify it exists and belongs to the hardcoded business
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, HARDCODED_BUSINESS_ID),
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Delete in the correct order to respect foreign key constraints
      // 1. First get all workouts for this session
      const workouts = await ctx.db.query.Workout.findMany({
        where: eq(Workout.trainingSessionId, input.sessionId),
      });

      // 2. Delete workout exercises for all workouts
      if (workouts.length > 0) {
        const workoutIds = workouts.map((w) => w.id);
        await ctx.db
          .delete(WorkoutExercise)
          .where(inArray(WorkoutExercise.workoutId, workoutIds));
      }

      // 3. Delete workouts
      await ctx.db
        .delete(Workout)
        .where(eq(Workout.trainingSessionId, input.sessionId));

      // 4. Delete workout preferences
      await ctx.db
        .delete(WorkoutPreferences)
        .where(eq(WorkoutPreferences.trainingSessionId, input.sessionId));

      // 5. Delete user training sessions (registrations/check-ins)
      await ctx.db
        .delete(UserTrainingSession)
        .where(eq(UserTrainingSession.trainingSessionId, input.sessionId));

      // 6. Delete workout exercise swaps
      try {
        await ctx.db
          .delete(workoutExerciseSwaps)
          .where(eq(workoutExerciseSwaps.trainingSessionId, input.sessionId));
      } catch (error) {
        console.error(
          "[deleteSessionPublic] Error deleting workout exercise swaps:",
          error,
        );
        // Continue with deletion even if this fails since the table might be empty
      }

      // 7. Finally delete the training session
      await ctx.db
        .delete(TrainingSession)
        .where(eq(TrainingSession.id, input.sessionId));

      console.log(`[deleteSessionPublic] Session ${input.sessionId} deleted successfully`);

      return { success: true, deletedSessionId: input.sessionId };
    }),

  /**
   * Update session status (public route)
   * Uses hardcoded business and trainer IDs for authorization
   */
  updateSessionStatusPublic: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        status: z.enum(["open", "in_progress", "completed", "cancelled", "draft"]).transform(val => 
          val === "draft" ? "cancelled" : val
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Hardcoded values for public circuit session operations
      const HARDCODED_BUSINESS_ID = "d33b41e2-f700-4a08-9489-cb6e3daa7f20";
      const HARDCODED_TRAINER_ID = "v4dxeCHAJ31kgL3To8NygjuNNZXZGf9W";

      // Get the session to verify it exists and belongs to the hardcoded business
      const [session] = await ctx.db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.id, input.sessionId),
            eq(TrainingSession.businessId, HARDCODED_BUSINESS_ID),
          ),
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // If setting to in_progress, first update any other in_progress sessions to open
      if (input.status === "in_progress") {
        await ctx.db
          .update(TrainingSession)
          .set({
            status: "open",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(TrainingSession.businessId, HARDCODED_BUSINESS_ID),
              eq(TrainingSession.status, "in_progress"),
              // Exclude the current session
              sql`${TrainingSession.id} != ${input.sessionId}`,
            ),
          );

        console.log(`[updateSessionStatusPublic] Updated other in_progress sessions to open before setting ${input.sessionId} to in_progress`);
      }

      // Update the session status
      const [updatedSession] = await ctx.db
        .update(TrainingSession)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(TrainingSession.id, input.sessionId))
        .returning();

      console.log(`[updateSessionStatusPublic] Session ${input.sessionId} status updated to: ${input.status}`);

      return {
        success: true,
        sessionId: updatedSession!.id,
        newStatus: updatedSession!.status === "cancelled" ? "draft" : updatedSession!.status,
        session: {
          ...updatedSession,
          status: updatedSession!.status === "cancelled" ? "draft" : updatedSession!.status,
        } as typeof updatedSession,
      };
    }),

  /**
   * Check in a client - PUBLIC endpoint for clients
   * Uses the same logic as SMS check-in but with hardcoded business ID
   */
  checkInPublic: publicProcedure
    .input(
      z.object({
        phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
        businessId: z.string().uuid().default("d33b41e2-f700-4a08-9489-cb6e3daa7f20"), // Tony Gym
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Import the existing check-in service logic
      const { processCheckIn } = await import("../services/checkInService");
      
      // Call the same logic as SMS check-in
      const result = await processCheckIn(input.phoneNumber);
      
      // The result already has the proper structure from checkInService
      return result;
    }),

  /**
   * Update session scheduled date (public route)
   */
  updateScheduledDate: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        scheduledAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Hardcoded values for public circuit session operations
      const HARDCODED_BUSINESS_ID = "d33b41e2-f700-4a08-9489-cb6e3daa7f20";

      // Get the session to verify it exists and belongs to the business
      const [session] = await ctx.db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.id, input.sessionId),
            eq(TrainingSession.businessId, HARDCODED_BUSINESS_ID)
          )
        );

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or access denied",
        });
      }

      // Update the scheduled date
      const [updatedSession] = await ctx.db
        .update(TrainingSession)
        .set({
          scheduledAt: input.scheduledAt,
          updatedAt: new Date(),
        })
        .where(eq(TrainingSession.id, input.sessionId))
        .returning();

      console.log(`[updateScheduledDate] Session ${input.sessionId} scheduled date updated to: ${input.scheduledAt}`);

      return {
        success: true,
        sessionId: updatedSession!.id,
        scheduledAt: updatedSession!.scheduledAt,
        session: updatedSession,
      };
    }),

  updateSessionProgram: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        program: z.enum(["h4h_5am", "h4h_5pm", "saturday_cg", "monday_cg", "coach_frank", "coach_steph", "coach_kyle", "unassigned"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Hardcoded values for public circuit session operations
      const HARDCODED_BUSINESS_ID = "d33b41e2-f700-4a08-9489-cb6e3daa7f20";

      // Get the session to verify it exists and belongs to the business
      const [session] = await ctx.db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.id, input.sessionId),
            eq(TrainingSession.businessId, HARDCODED_BUSINESS_ID)
          )
        );

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or access denied",
        });
      }

      // Update the program assignment
      const [updatedSession] = await ctx.db
        .update(TrainingSession)
        .set({
          program: input.program,
          updatedAt: new Date(),
        })
        .where(eq(TrainingSession.id, input.sessionId))
        .returning();

      console.log(`[updateSessionProgram] Session ${input.sessionId} program updated to: ${input.program}`);

      return {
        success: true,
        sessionId: updatedSession!.id,
        program: updatedSession!.program,
        session: updatedSession,
      };
    }),

  // New endpoint to get available programs (excluding unassigned)
  getAvailablePrograms: publicProcedure
    .input(
      z.object({
        businessId: z.string().uuid(),
      }),
    )
    .query(({ input }) => {

      // Return all possible program values except 'unassigned'
      const programs = [
        { id: 'h4h_5am', label: 'Coach Will' },
        { id: 'h4h_5pm', label: 'Coach Tony' },
        { id: 'saturday_cg', label: 'Saturday CG' },
        { id: 'monday_cg', label: 'Monday CG' },
        { id: 'coach_frank', label: 'Coach Frank' },
        { id: 'coach_steph', label: 'Coach Steph' },
        { id: 'coach_kyle', label: 'Coach Kyle' },
      ];

      return programs;
    }),

  // New endpoint to get training sessions by program (replaces getFavoritesByCategory)
  getSessionsByProgram: publicProcedure
    .input(
      z.object({
        businessId: z.string().uuid(),
        program: z.enum(["h4h_5am", "h4h_5pm", "saturday_cg", "monday_cg", "coach_frank", "coach_steph", "coach_kyle"]),
        includeTemplateConfig: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      console.log(`[getSessionsByProgram] Fetching sessions for business: ${input.businessId}, program: ${input.program}, includeTemplateConfig: ${input.includeTemplateConfig}`);

      // Query training sessions directly by program
      const trainingSessions = await ctx.db
        .select({
          id: TrainingSession.id,
          businessId: TrainingSession.businessId,
          trainerId: TrainingSession.trainerId,
          name: TrainingSession.name,
          scheduledAt: TrainingSession.scheduledAt,
          durationMinutes: TrainingSession.durationMinutes,
          maxParticipants: TrainingSession.maxParticipants,
          status: TrainingSession.status,
          program: TrainingSession.program,
          templateType: TrainingSession.templateType,
          // Only include templateConfig if explicitly requested
          ...(input.includeTemplateConfig && { templateConfig: TrainingSession.templateConfig as any }),
          createdAt: TrainingSession.createdAt,
          updatedAt: TrainingSession.updatedAt,
        })
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.businessId, input.businessId),
            eq(TrainingSession.program, input.program),
          ),
        )
        .orderBy(desc(TrainingSession.createdAt));

      console.log(`[getSessionsByProgram] Found ${trainingSessions.length} training sessions for program: ${input.program}`);

      // Transform to match the expected format from getFavoritesByCategory
      return trainingSessions.map((session) => ({
        id: `program-${session.id}`, // Unique ID for the "favorite" concept
        category: input.program, // Map program to category for compatibility
        trainingSession: session,
      }));
    }),

  // Add training session to business favorites (global)
  addToFavorites: publicProcedure
    .input(
      z.object({
        businessId: z.string().uuid(),
        trainingSessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log(`[addToFavorites] Adding session ${input.trainingSessionId} to business favorites for business ${input.businessId}`);

      // Check if session is already favorited for this business
      const existingFavorite = await ctx.db
        .select()
        .from(FavoriteSessions)
        .where(
          and(
            eq(FavoriteSessions.businessId, input.businessId),
            eq(FavoriteSessions.trainingSessionId, input.trainingSessionId),
          ),
        )
        .limit(1);

      if (existingFavorite.length > 0) {
        console.log(`[addToFavorites] Session is already favorited`);
        throw new TRPCError({
          code: "CONFLICT", 
          message: "Session is already in favorites",
        });
      }

      try {
        const [favorite] = await ctx.db
          .insert(FavoriteSessions)
          .values({
            trainingSessionId: input.trainingSessionId,
            businessId: input.businessId,
            category: "other", // Always use "other" for new favorites
          })
          .returning();

        console.log(`[addToFavorites] Successfully added favorite: ${favorite?.id}`);
        return { success: true, favoriteId: favorite?.id };
      } catch (error) {
        console.log(`[addToFavorites] Error adding favorite: ${error}`);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to add favorite",
        });
      }
    }),

  // Remove training session from business favorites (global)
  removeFromFavorites: publicProcedure
    .input(
      z.object({
        businessId: z.string().uuid(),
        trainingSessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log(`[removeFromFavorites] Removing session ${input.trainingSessionId} from business favorites for business ${input.businessId}`);

      const deleted = await ctx.db
        .delete(FavoriteSessions)
        .where(
          and(
            eq(FavoriteSessions.trainingSessionId, input.trainingSessionId),
            eq(FavoriteSessions.businessId, input.businessId),
          ),
        )
        .returning();

      console.log(`[removeFromFavorites] Deleted ${deleted.length} favorite(s)`);
      return { success: true, removed: deleted.length > 0 };
    }),

  // Get business favorite training sessions (global)
  getBusinessFavorites: publicProcedure
    .input(
      z.object({
        businessId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      console.log(`[getBusinessFavorites] Fetching favorites for business ${input.businessId}`);

      const favorites = await ctx.db
        .select({
          id: FavoriteSessions.id,
          trainingSessionId: FavoriteSessions.trainingSessionId,
          category: FavoriteSessions.category,
          createdAt: FavoriteSessions.createdAt,
          trainingSession: {
            id: TrainingSession.id,
            name: TrainingSession.name,
            program: TrainingSession.program,
            scheduledAt: TrainingSession.scheduledAt,
            durationMinutes: TrainingSession.durationMinutes,
            maxParticipants: TrainingSession.maxParticipants,
            status: TrainingSession.status,
            templateType: TrainingSession.templateType,
            createdAt: TrainingSession.createdAt,
          },
        })
        .from(FavoriteSessions)
        .innerJoin(
          TrainingSession,
          eq(FavoriteSessions.trainingSessionId, TrainingSession.id),
        )
        .where(eq(FavoriteSessions.businessId, input.businessId))
        .orderBy(desc(FavoriteSessions.createdAt));

      console.log(`[getBusinessFavorites] Found ${favorites.length} favorites`);
      return favorites;
    }),

  // Check if specific sessions are favorited for business (global)
  checkFavoriteStatus: publicProcedure
    .input(
      z.object({
        businessId: z.string().uuid(),
        trainingSessionIds: z.array(z.string().uuid()),
      }),
    )
    .query(async ({ ctx, input }) => {
      console.log(`[checkFavoriteStatus] Checking favorite status for ${input.trainingSessionIds.length} sessions in business ${input.businessId}`);

      const favorites = await ctx.db
        .select({
          trainingSessionId: FavoriteSessions.trainingSessionId,
        })
        .from(FavoriteSessions)
        .where(
          and(
            eq(FavoriteSessions.businessId, input.businessId),
            inArray(FavoriteSessions.trainingSessionId, input.trainingSessionIds),
          ),
        );

      // Return a map of sessionId -> boolean
      const favoriteMap: Record<string, boolean> = {};
      for (const sessionId of input.trainingSessionIds) {
        favoriteMap[sessionId] = favorites.some(f => f.trainingSessionId === sessionId);
      }

      console.log(`[checkFavoriteStatus] Returning status for ${Object.keys(favoriteMap).length} sessions`);
      return favoriteMap;
    }),

  // Update training session name
  updateTrainingSessionName: publicProcedure
    .input(
      z.object({
        businessId: z.string().uuid(),
        trainingSessionId: z.string().uuid(),
        newName: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log(`[updateTrainingSessionName] Updating session ${input.trainingSessionId} name to: ${input.newName}`);

      try {
        const [updatedSession] = await ctx.db
          .update(TrainingSession)
          .set({
            name: input.newName,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(TrainingSession.id, input.trainingSessionId),
              eq(TrainingSession.businessId, input.businessId),
            ),
          )
          .returning({
            id: TrainingSession.id,
            name: TrainingSession.name,
            updatedAt: TrainingSession.updatedAt,
          });

        if (!updatedSession) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Training session not found",
          });
        }

        console.log(`[updateTrainingSessionName] Successfully updated session name: ${updatedSession.name}`);
        return { 
          success: true, 
          session: updatedSession 
        };
      } catch (error) {
        console.log(`[updateTrainingSessionName] Error updating session name: ${error}`);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update session name",
        });
      }
    }),

  // Get all favorites across all programs
  getAllFavorites: publicProcedure
    .input(
      z.object({
        businessId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        console.log(`[getAllFavorites] Fetching all favorites for business: ${input.businessId}`);

        // Get all favorites with their training session details
        const favorites = await ctx.db
          .select({
            id: FavoriteSessions.id,
            trainingSession: TrainingSession,
          })
          .from(FavoriteSessions)
          .innerJoin(
            TrainingSession,
            eq(FavoriteSessions.trainingSessionId, TrainingSession.id)
          )
          .where(
            and(
              eq(TrainingSession.businessId, input.businessId),
              eq(FavoriteSessions.businessId, input.businessId)
            )
          )
          .orderBy(desc(TrainingSession.createdAt));

        console.log(`[getAllFavorites] Found ${favorites.length} favorite sessions`);
        return favorites;
      } catch (error) {
        console.error("[getAllFavorites] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch favorites",
        });
      }
    }),
} satisfies TRPCRouterRecord;
