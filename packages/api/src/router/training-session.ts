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
  
  // Log sample exercises to check if fatigueProfile is present
  console.log('=== PHASE 2 PREPROCESSING - SAMPLE EXERCISES ===');
  allExercises.slice(0, 3).forEach(ex => {
    console.log(`Exercise: ${ex.name}`);
    console.log(`  - Equipment: ${JSON.stringify(ex.equipment)}`);
    console.log(`  - Movement Pattern: ${ex.movementPattern}`);
    console.log(`  - Function Tags: ${JSON.stringify(ex.functionTags)}`);
    console.log(`  - Fatigue Profile: ${ex.fatigueProfile || 'MISSING'}`);
  });
  
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

      // Check if there's already an open session for this business
      const existingOpenSession = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.businessId, user.businessId),
          eq(TrainingSession.status, "open"),
        ),
      });

      if (existingOpenSession) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "There is already an open session for this business. Please close it before creating a new one.",
        });
      }

      const [session] = await ctx.db
        .insert(TrainingSession)
        .values({
          ...input,
          trainerId: user.id,
          status: "open", // Explicitly set to open
        })
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
        .orderBy(desc(TrainingSession.scheduledAt))
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
      console.log(
        "[API] getCheckedInClients - User:",
        user.email,
        "BusinessId:",
        user.businessId,
      );
      console.log(
        "[API] getCheckedInClients - Looking for session:",
        input.sessionId,
      );

      // First check if session exists at all
      const sessionExists = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (sessionExists) {
        console.log(
          "[API] Session found with businessId:",
          sessionExists.businessId,
        );
        console.log("[API] User businessId:", user.businessId);
        console.log(
          "[API] Match:",
          sessionExists.businessId === user.businessId,
        );
      } else {
        console.log("[API] Session does not exist in database");
      }

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
      console.log(
        "[API] getCheckedInClients - Fetching users with statuses: checked_in, ready, workout_ready"
      );
      
      // First, let's see ALL users in this session for debugging
      const allUsersInSession = await ctx.db
        .select()
        .from(UserTrainingSession)
        .where(eq(UserTrainingSession.trainingSessionId, input.sessionId));
      
      console.log(
        "[API] getCheckedInClients - ALL users in session:",
        allUsersInSession.map(u => ({
          userId: u.userId,
          status: u.status,
          checkedInAt: u.checkedInAt
        }))
      );
      
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
        
      console.log(
        "[API] getCheckedInClients - Filtered users count:",
        checkedInUsers.length
      );
      console.log(
        "[API] getCheckedInClients - Filtered users:",
        checkedInUsers.map(u => ({
          userId: u.userId,
          status: u.status
        }))
      );

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

      console.log(
        "[API] getCheckedInClients - Final return data:",
        usersWithDetails.map(u => ({
          userId: u.userId,
          status: u.status,
          userName: u.userName
        }))
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

      // Check if already registered
      const existing = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, targetUserId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already registered for this session",
        });
      }

      // Check max participants limit
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

      // Add participant
      const [registration] = await ctx.db
        .insert(UserTrainingSession)
        .values({
          userId: targetUserId,
          trainingSessionId: input.sessionId,
        })
        .returning();

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

      // Only trainers can remove other users
      if (input.userId && input.userId !== user.id && user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can remove other participants",
        });
      }

      await ctx.db
        .delete(UserTrainingSession)
        .where(
          and(
            eq(UserTrainingSession.userId, targetUserId),
            eq(UserTrainingSession.trainingSessionId, input.sessionId),
          ),
        );

      return { success: true };
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

        console.log("[sendSessionStartMessages] Template check:", {
          sessionId: input.sessionId,
          templateType: session.templateType,
          hasTemplate: !!template,
          showDeterministicSelections,
          smsConfig: template?.smsConfig,
          checkedInClientsCount: checkedInClients.length,
        });

        // For BMF templates, auto-populate includeExercises with deterministic selections
        console.log(
          "[sendSessionStartMessages] Checking auto-population conditions:",
          {
            showDeterministicSelections,
            templateType: session.templateType,
            shouldAutoPopulate:
              showDeterministicSelections && session.templateType,
          },
        );

        if (showDeterministicSelections && session.templateType) {
          try {
            console.log(
              "[sendSessionStartMessages] Starting auto-population for BMF template",
              {
                sessionId: session.id,
                timestamp: new Date().toISOString(),
                checkedInClientsCount: checkedInClients.length,
              },
            );

            // Generate blueprint using shared service
            const blueprintStart = Date.now();
            const blueprint =
              await WorkoutBlueprintService.generateBlueprintWithCache(
                input.sessionId,
                session.businessId,
                ctx.session.user.id,
              );
            const blueprintTime = Date.now() - blueprintStart;

            console.log(
              "[sendSessionStartMessages] Blueprint generation completed",
              {
                sessionId: session.id,
                timeMs: blueprintTime,
                hasBlueprint: !!blueprint,
                blockCount: blueprint?.blocks?.length || 0,
              },
            );

            if (!blueprint) {
              console.error(
                "[sendSessionStartMessages] Blueprint generation failed",
              );
              // Continue anyway - we'll still send messages even if blueprint generation fails
            } else {
              console.log(
                "[sendSessionStartMessages] Blueprint generated successfully:",
                {
                  blockCount: blueprint.blocks?.length || 0,
                  blockIds: blueprint.blocks?.map((b: any) => b.blockId) || [],
                },
              );

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
                      console.log(
                        `[sendSessionStartMessages] Attempting to save preferences for ${client.userId}`,
                        {
                          userId: client.userId,
                          sessionId: input.sessionId,
                          businessId: session.businessId,
                          exercisesToInclude,
                        },
                      );

                      await WorkoutPreferenceService.savePreferences(
                        client.userId,
                        input.sessionId,
                        session.businessId,
                        {
                          includeExercises: exercisesToInclude,
                        },
                        "preferences_active",
                      );

                      console.log(
                        `[sendSessionStartMessages] Successfully auto-populated includeExercises for ${client.userId}:`,
                        exercisesToInclude,
                      );
                    } catch (saveError) {
                      console.error(
                        `[sendSessionStartMessages] Failed to save preferences for ${client.userId}:`,
                        saveError,
                      );
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

                    console.log(
                      `[sendSessionStartMessages] Verified saved preferences for ${client.userId}:`,
                      {
                        exists: !!savedPrefs,
                        includeExercises: savedPrefs?.includeExercises,
                      },
                    );
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
            // Generate preference link - use SMS_BASE_URL for mobile access (e.g., ngrok URL)
            const baseUrl =
              process.env.SMS_BASE_URL ||
              process.env.NEXTAUTH_URL ||
              "http://192.168.68.133:3000";
            const preferenceLink = `${baseUrl}/preferences/client/${session.id}/${client.userId}`;

            // Simple message for all templates
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
        console.log("[getSavedVisualizationData] No saved visualization data found", {
          sessionId: input.sessionId,
          sessionStatus: session.status,
          hasTemplateConfig: !!templateConfig,
          templateConfigKeys: templateConfig ? Object.keys(templateConfig) : [],
        });
        return null;
      }

      // Check if data is stale (older than 30 minutes)
      // For completed sessions, always return saved data regardless of age
      if (session.status !== "completed") {
        const savedAt = new Date(visualizationData.savedAt);
        const now = new Date();
        const diffMinutes = (now.getTime() - savedAt.getTime()) / (1000 * 60);

        if (diffMinutes > 30) {
          console.log("[getSavedVisualizationData] Data is stale, forcing regeneration", {
            sessionId: input.sessionId,
            savedAt,
            diffMinutes,
          });
          return null; // Force regeneration if data is too old
        }
      }

      console.log("[getSavedVisualizationData] Returning saved data", {
        sessionId: input.sessionId,
        sessionStatus: session.status,
        hasSavedData: !!visualizationData,
        savedAt: visualizationData.savedAt,
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
        console.log("[getSavedVisualizationData] No saved visualization data found", {
          sessionId: input.sessionId,
          sessionStatus: session.status,
          hasTemplateConfig: !!templateConfig,
          templateConfigKeys: templateConfig ? Object.keys(templateConfig) : [],
        });
        return null;
      }

      // Check if data is stale (older than 30 minutes)
      // For completed sessions, always return saved data regardless of age
      if (session.status !== "completed") {
        const savedAt = new Date(visualizationData.savedAt);
        const now = new Date();
        const diffMinutes = (now.getTime() - savedAt.getTime()) / (1000 * 60);

        if (diffMinutes > 30) {
          console.log("[getSavedVisualizationData] Data is stale, forcing regeneration", {
            sessionId: input.sessionId,
            savedAt,
            diffMinutes,
          });
          return null; // Force regeneration if data is too old
        }
      }

      console.log("[getSavedVisualizationData] Returning saved data", {
        sessionId: input.sessionId,
        sessionStatus: session.status,
        hasSavedData: !!visualizationData,
        savedAt: visualizationData.savedAt,
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
                const exercise = await ctx.db.query.exercises.findFirst({
                  where: eq(exercises.id, we.exerciseId),
                });
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
              const exercise = await ctx.db.query.exercises.findFirst({
                where: eq(exercises.id, we.exerciseId),
              });
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
      return data;
    }),

  generatePhase2Selections: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { sessionId } = input;
      
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
      
      // Call Phase 2 selection
      const phase2Result = await generator.selectRemainingExercises(
        preprocessData.allowedSlots,
        exercisesWithMetadata,
        preprocessData.roundOrganization.majorityRounds,
        clientPlans
      );
      
      return {
        success: true,
        systemPrompt: phase2Result.systemPrompt,
        humanMessage: phase2Result.humanMessage,
        llmResponse: phase2Result.llmResponse,
        selections: phase2Result.selections,
      };
    }),
} satisfies TRPCRouterRecord;
