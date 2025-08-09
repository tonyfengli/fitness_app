import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";

import { desc, eq, and, gte, lte, or, sql, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { 
  TrainingSession, 
  UserTrainingSession,
  WorkoutPreferences,
  UserProfile,
  Workout,
  WorkoutExercise,
  CreateTrainingSessionSchema,
  CreateUserTrainingSessionSchema,
  user as userTable,
  user as User,
  exercises,
  workoutExerciseSwaps
} from "@acme/db/schema";
import { 
  generateGroupWorkoutBlueprint,
  type GroupContext,
  type ClientContext,
  type ScoredExercise,
  type Exercise
} from "@acme/ai";

import { protectedProcedure, publicProcedure } from "../trpc";
import type { SessionUser } from "../types/auth";

// Helper function to calculate score distribution
function calculateScoreDistribution(exercises: ScoredExercise[]): { range: string; count: number }[] {
  const ranges = [
    { range: '0-2', min: 0, max: 2, count: 0 },
    { range: '2-4', min: 2, max: 4, count: 0 },
    { range: '4-6', min: 4, max: 6, count: 0 },
    { range: '6-8', min: 6, max: 8, count: 0 },
    { range: '8+', min: 8, max: Infinity, count: 0 }
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
  
  return ranges.map(r => ({ range: r.range, count: r.count }));
}

// Helper to get equipment needs from exercise name
function getEquipmentFromExercise(exerciseName: string): string[] {
  const name = exerciseName.toLowerCase();
  const equipment: string[] = [];
  
  // Barbells
  if (name.includes('barbell') && !name.includes('dumbbell')) {
    equipment.push('barbell');
  }
  
  // Benches
  if (name.includes('bench') || name.includes('incline')) {
    equipment.push('bench');
  }
  
  // Dumbbells
  if (name.includes('dumbbell') || name.includes('db ')) {
    equipment.push('DB');
  }
  
  // Kettlebells
  if (name.includes('kettlebell') || name.includes('goblet')) {
    equipment.push('KB');
  }
  
  // Cable
  if (name.includes('cable') || name.includes('lat pulldown')) {
    equipment.push('cable');
  }
  
  // Bands
  if (name.includes('band')) {
    equipment.push('band');
  }
  
  // Landmine
  if (name.includes('landmine')) {
    equipment.push('landmine');
  }
  
  // Medicine ball
  if (name.includes('medicine ball') || name.includes('med ball')) {
    equipment.push('med ball');
  }
  
  // Row machine
  if (name.includes('row machine')) {
    equipment.push('row machine');
  }
  
  // Floor exercises
  if (name.includes('plank') || name.includes('dead bug') || name.includes('bird dog') || 
      name.includes('bear crawl') || name.includes('push-up')) {
    equipment.push('none');
  }
  
  // Swiss ball
  if (name.includes('swiss ball') || name.includes('stability ball')) {
    equipment.push('swiss ball');
  }
  
  return equipment.length > 0 ? equipment : ['none'];
}

export const trainingSessionRouter = {
  // Get deterministic exercise selections for a session
  getDeterministicSelections: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid()
    }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      
      // Get session with template config
      const [session] = await ctx.db
        .select({
          id: TrainingSession.id,
          templateConfig: TrainingSession.templateConfig,
          templateType: TrainingSession.templateType
        })
        .from(TrainingSession)
        .where(eq(TrainingSession.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found'
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
        const selections = clientPool.preAssigned.map((preAssigned: any, index: number) => ({
          roundId: `Round${index + 1}`,
          roundName: preAssigned.source || `Round ${index + 1}`,
          exercise: {
            name: preAssigned.exercise.name,
            movementPattern: preAssigned.exercise.movementPattern,
            primaryMuscle: preAssigned.exercise.primaryMuscle
          }
        }));

        return {
          selections,
          templateType: session.templateType,
          hasBlueprint: true,
          blueprintType: 'standard'
        };
      }

      // Handle BMF blueprints (original logic)
      if (!blueprint.blocks) {
        return { selections: [] };
      }

      // Extract deterministic selections for the requesting user
      const selections = [];
      
      for (const block of blueprint.blocks) {
        if (block.selectionStrategy === 'deterministic') {
          // Check individual candidates for this user
          const userCandidates = block.individualCandidates?.[user.id];
          if (userCandidates?.exercises?.length > 0) {
            selections.push({
              roundId: block.blockId,
              roundName: block.name,
              exercise: {
                name: userCandidates.exercises[0].name,
                movementPattern: userCandidates.exercises[0].movementPattern,
                primaryMuscle: userCandidates.exercises[0].primaryMuscle
              }
            });
          } else if (block.sharedCandidates?.length > 0) {
            // Fall back to shared candidates
            selections.push({
              roundId: block.blockId,
              roundName: block.name,
              exercise: {
                name: block.sharedCandidates[0].name,
                movementPattern: block.sharedCandidates[0].movementPattern,
                primaryMuscle: block.sharedCandidates[0].primaryMuscle
              }
            });
          }
        }
      }

      return { 
        selections,
        templateType: session.templateType,
        hasBlueprint: !!blueprint,
        blueprintType: 'bmf'
      };
    }),
  // Create a new training session (trainers only)
  create: protectedProcedure
    .input(CreateTrainingSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can create training sessions
      if (user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can create training sessions',
        });
      }
      
      // Ensure trainer creates sessions for their own business
      if (input.businessId !== user.businessId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only create sessions for your own business',
        });
      }
      
      // Check if there's already an open session for this business
      const existingOpenSession = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.businessId, user.businessId),
          eq(TrainingSession.status, 'open')
        ),
      });
      
      if (existingOpenSession) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'There is already an open session for this business. Please close it before creating a new one.',
        });
      }
      
      const [session] = await ctx.db
        .insert(TrainingSession)
        .values({
          ...input,
          trainerId: user.id,
          status: 'open', // Explicitly set to open
        })
        .returning();
        
      return session;
    }),

  // List all sessions (filtered by business)
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      // Optional filters
      trainerId: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
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
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId)
        ),
      });
      
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }
      
      // Get checked-in and ready users
      const checkedInUsers = await ctx.db
        .select()
        .from(UserTrainingSession)
        .where(and(
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          or(
            eq(UserTrainingSession.status, 'checked_in'),
            eq(UserTrainingSession.status, 'ready')
          )
        ))
        .orderBy(desc(UserTrainingSession.checkedInAt));
      
      // Get user details and preferences for each checked-in user
      const usersWithDetails = await Promise.all(
        checkedInUsers.map(async (checkin) => {
          const userInfo = await ctx.db.query.user.findFirst({
            where: eq(userTable.id, checkin.userId)
          });
          
          // Get workout preferences if collected
          const [preferences] = await ctx.db
            .select()
            .from(WorkoutPreferences)
            .where(and(
              eq(WorkoutPreferences.userId, checkin.userId),
              eq(WorkoutPreferences.trainingSessionId, input.sessionId)
            ))
            .limit(1);
          
          return {
            userId: checkin.userId,
            status: checkin.status,
            checkedInAt: checkin.checkedInAt,
            userName: userInfo?.name || null,
            userEmail: userInfo?.email || "",
            preferenceCollectionStep: checkin.preferenceCollectionStep,
            preferences: preferences ? {
              intensity: preferences.intensity,
              muscleTargets: preferences.muscleTargets,
              muscleLessens: preferences.muscleLessens,
              includeExercises: preferences.includeExercises,
              avoidExercises: preferences.avoidExercises,
              avoidJoints: preferences.avoidJoints,
              sessionGoal: preferences.sessionGoal,
              workoutType: preferences.workoutType,
              notes: preferences.notes
            } : null
          };
        })
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
          eq(TrainingSession.businessId, user.businessId)
        ),
      });
      
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Training session not found',
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
    .input(z.object({
      sessionId: z.string().uuid(),
      userId: z.string().optional(), // If not provided, add current user
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      const targetUserId = input.userId || user.id;
      
      // Verify session exists and belongs to user's business
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId)
        ),
      });
      
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Training session not found',
        });
      }
      
      // Check if already registered
      const existing = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, targetUserId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId)
        ),
      });
      
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User already registered for this session',
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
            code: 'CONFLICT',
            message: 'Session is full',
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
    .input(z.object({
      sessionId: z.string().uuid(),
      userId: z.string().optional(), // If not provided, remove current user
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      const targetUserId = input.userId || user.id;
      
      // Only trainers can remove other users
      if (input.userId && input.userId !== user.id && user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can remove other participants',
        });
      }
      
      await ctx.db
        .delete(UserTrainingSession)
        .where(and(
          eq(UserTrainingSession.userId, targetUserId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId)
        ));
        
      return { success: true };
    }),

  // Get session with template config (blueprint)
  getWithTemplateConfig: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId)
        ),
        with: {
          trainer: true,
        },
      });
      
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Training session not found',
        });
      }
      
      // Only trainers can see the template config
      if (user.role !== 'trainer') {
        return {
          ...session,
          templateConfig: undefined
        };
      }
      
      return session;
    }),

  // Get past sessions for current user
  myPast: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
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
          eq(UserTrainingSession.trainingSessionId, TrainingSession.id)
        )
        .where(and(
          eq(UserTrainingSession.userId, user.id),
          eq(TrainingSession.businessId, user.businessId),
          lte(TrainingSession.scheduledAt, now)
        ))
        .orderBy(desc(TrainingSession.scheduledAt))
        .limit(input.limit)
        .offset(input.offset);
        
      return sessions.map(s => s.session);
    }),

  // Start a session (open -> in_progress)
  startSession: protectedProcedure
    .input(z.object({ 
      sessionId: z.string().uuid() 
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can start sessions
      if (user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can start sessions',
        });
      }
      
      // Get the session
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId)
        ),
      });
      
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }
      
      // Validate current status
      if (session.status !== 'open') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot start session. Current status is ${session.status}. Session must be 'open' to start.`,
        });
      }
      
      // Update status
      const [updatedSession] = await ctx.db
        .update(TrainingSession)
        .set({ status: 'in_progress' })
        .where(eq(TrainingSession.id, input.sessionId))
        .returning();
        
      return updatedSession;
    }),

  // Complete a session (in_progress -> completed)
  completeSession: protectedProcedure
    .input(z.object({ 
      sessionId: z.string().uuid() 
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can complete sessions
      if (user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can complete sessions',
        });
      }
      
      // Get the session
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId)
        ),
      });
      
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }
      
      // Validate current status
      if (session.status !== 'in_progress') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot complete session. Current status is ${session.status}. Session must be 'in_progress' to complete.`,
        });
      }
      
      // Update status
      const [updatedSession] = await ctx.db
        .update(TrainingSession)
        .set({ status: 'completed' })
        .where(eq(TrainingSession.id, input.sessionId))
        .returning();
        
      return updatedSession;
    }),

  // Cancel a session (open -> cancelled)
  cancelSession: protectedProcedure
    .input(z.object({ 
      sessionId: z.string().uuid() 
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can cancel sessions
      if (user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can cancel sessions',
        });
      }
      
      // Get the session
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId)
        ),
      });
      
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }
      
      // Validate current status - can only cancel open sessions
      if (session.status !== 'open') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot cancel session. Current status is ${session.status}. Only 'open' sessions can be cancelled.`,
        });
      }
      
      // Update status
      const [updatedSession] = await ctx.db
        .update(TrainingSession)
        .set({ status: 'cancelled' })
        .where(eq(TrainingSession.id, input.sessionId))
        .returning();
        
      return updatedSession;
    }),

  // Delete a session and all associated data
  deleteSession: protectedProcedure
    .input(z.object({ 
      sessionId: z.string().uuid() 
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can delete sessions
      if (user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can delete sessions',
        });
      }
      
      // Get the session to verify it exists and belongs to the business
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId)
        ),
      });
      
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }
      
      // Delete in the correct order to respect foreign key constraints
      // 1. First get all workouts for this session
      const workouts = await ctx.db.query.Workout.findMany({
        where: eq(Workout.trainingSessionId, input.sessionId),
      });
      
      // 2. Delete workout exercises for all workouts
      if (workouts.length > 0) {
        const workoutIds = workouts.map(w => w.id);
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
        console.error('[deleteSession] Error deleting workout exercise swaps:', error);
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
    .input(z.object({
      sessionId: z.string().uuid()
    }))
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
    .input(z.object({
      sessionId: z.string().uuid(),
      options: z.object({
        includeDiagnostics: z.boolean().default(false),
        phase1Only: z.boolean().default(false),
      }).optional()
    }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can generate blueprints
      if (user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can generate group workout blueprints',
        });
      }

      // Import and use the new service
      const { WorkoutGenerationService } = await import("../services/workout-generation-service");
      const service = new WorkoutGenerationService(ctx);
      
      try {
        const result = await service.generateBlueprint(input.sessionId, input.options);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate blueprint',
        });
      }
    }),

  /**
   * Generate and create group workouts (full orchestration)
   * This is the production endpoint that generates blueprint + LLM + creates workouts
   */
  generateAndCreateGroupWorkouts: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      options: z.object({
        skipBlueprintCache: z.boolean().default(false),
        dryRun: z.boolean().default(false),
        includeDiagnostics: z.boolean().default(false),
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const mutationStartTime = new Date().toISOString();
      console.log(`[Timestamp] generateAndCreateGroupWorkouts mutation started at: ${mutationStartTime}`);
      console.log(`[Timestamp] Session ID: ${input.sessionId}`);
      
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can generate workouts
      if (user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can generate group workouts',
        });
      }

      // Import and use the new service
      const { WorkoutGenerationService } = await import("../services/workout-generation-service");
      const service = new WorkoutGenerationService(ctx);
      
      try {
        const result = await service.generateAndCreateWorkouts(input.sessionId, input.options);
        
        const mutationEndTime = new Date().toISOString();
        console.log(`[Timestamp] generateAndCreateGroupWorkouts mutation completed at: ${mutationEndTime}`);
        console.log(`[Timestamp] Total duration: ${Date.now() - Date.parse(mutationStartTime)}ms`);
        
        return result;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate and create workouts',
        });
      }
    }),

  // Get active training session for a user
  getActiveSessionForUser: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1, "User ID is required"),
      })
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

          if (!targetUser[0] || targetUser[0].businessId !== viewer[0].businessId) {
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
            eq(UserTrainingSession.trainingSessionId, TrainingSession.id)
          )
          .where(
            and(
              eq(UserTrainingSession.userId, input.userId),
              gte(TrainingSession.scheduledAt, today)
            )
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
      })
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
              eq(TrainingSession.businessId, ctx.session.user.businessId!)
            )
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
              eq(UserTrainingSession.status, "checked_in")
            )
          );

        if (checkedInClients.length === 0) {
          return {
            success: true,
            sentCount: 0,
            message: "No checked-in clients to send messages to",
          };
        }

        // Import required services
        const { WorkoutBlueprintService } = await import("../services/workout-blueprint-service");
        const { twilioClient } = await import("../services/twilio");
        const { getWorkoutTemplate } = await import("@acme/ai");
        const { messages } = await import("@acme/db/schema");
        const { WorkoutPreferenceService } = await import("../services/workoutPreferenceService");

        // Get template configuration
        const template = session.templateType ? getWorkoutTemplate(session.templateType) : null;
        const showDeterministicSelections = template?.smsConfig?.showDeterministicSelections;
        
        console.log("[sendSessionStartMessages] Template check:", {
          sessionId: input.sessionId,
          templateType: session.templateType,
          hasTemplate: !!template,
          showDeterministicSelections,
          smsConfig: template?.smsConfig,
          checkedInClientsCount: checkedInClients.length
        });

        // For BMF templates, auto-populate includeExercises with deterministic selections
        console.log("[sendSessionStartMessages] Checking auto-population conditions:", {
          showDeterministicSelections,
          templateType: session.templateType,
          shouldAutoPopulate: showDeterministicSelections && session.templateType
        });
        
        if (showDeterministicSelections && session.templateType) {
          try {
            console.log("[sendSessionStartMessages] Starting auto-population for BMF template", {
              sessionId: session.id,
              timestamp: new Date().toISOString(),
              checkedInClientsCount: checkedInClients.length
            });
            
            // Generate blueprint using shared service
            const blueprintStart = Date.now();
            const blueprint = await WorkoutBlueprintService.generateBlueprintWithCache(
              input.sessionId,
              session.businessId,
              ctx.session.user.id
            );
            const blueprintTime = Date.now() - blueprintStart;
            
            console.log("[sendSessionStartMessages] Blueprint generation completed", {
              sessionId: session.id,
              timeMs: blueprintTime,
              hasBlueprint: !!blueprint,
              blockCount: blueprint?.blocks?.length || 0
            });
            
            if (!blueprint) {
              console.error("[sendSessionStartMessages] Blueprint generation failed");
              // Continue anyway - we'll still send messages even if blueprint generation fails
            } else {
              console.log("[sendSessionStartMessages] Blueprint generated successfully:", {
                blockCount: blueprint.blocks?.length || 0,
                blockIds: blueprint.blocks?.map((b: any) => b.blockId) || []
              });
              
              // Find Round1 and Round2 blocks
              const round1Block = blueprint.blocks.find((b: any) => b.blockId === 'Round1');
              const round2Block = blueprint.blocks.find((b: any) => b.blockId === 'Round2');
              
              // Get all checked-in clients
              const clientsToProcess = await db
                .select({
                  userId: UserTrainingSession.userId
                })
                .from(UserTrainingSession)
                .where(
                  and(
                    eq(UserTrainingSession.trainingSessionId, input.sessionId),
                    eq(UserTrainingSession.status, "checked_in")
                  )
                );

              // For each client, create/update WorkoutPreferences with includeExercises
              for (const client of clientsToProcess) {
                try {
                  const exercisesToInclude: string[] = [];
                  
                  // Extract Round 1 exercise from blueprint
                  const round1Exercises = round1Block?.individualCandidates?.[client.userId]?.exercises;
                  if (round1Exercises && round1Exercises.length > 0) {
                    const exerciseName = round1Exercises[0].name;
                    exercisesToInclude.push(exerciseName);
                    console.log(`Found Round1 exercise for ${client.userId}:`, exerciseName);
                  }
                  
                  // Extract Round 2 exercise from blueprint
                  const round2Exercises = round2Block?.individualCandidates?.[client.userId]?.exercises;
                  if (round2Exercises && round2Exercises.length > 0) {
                    const exerciseName = round2Exercises[0].name;
                    exercisesToInclude.push(exerciseName);
                    console.log(`Found Round2 exercise for ${client.userId}:`, exerciseName);
                  }

                  if (exercisesToInclude.length > 0) {
                    // Save these exercises to includeExercises
                    try {
                      console.log(`[sendSessionStartMessages] Attempting to save preferences for ${client.userId}`, {
                        userId: client.userId,
                        sessionId: input.sessionId,
                        businessId: session.businessId,
                        exercisesToInclude
                      });
                      
                      await WorkoutPreferenceService.savePreferences(
                        client.userId,
                        input.sessionId,
                        session.businessId,
                        {
                          includeExercises: exercisesToInclude
                        },
                        "preferences_active"
                      );
                      
                      console.log(`[sendSessionStartMessages] Successfully auto-populated includeExercises for ${client.userId}:`, exercisesToInclude);
                    } catch (saveError) {
                      console.error(`[sendSessionStartMessages] Failed to save preferences for ${client.userId}:`, saveError);
                      throw saveError; // Re-throw to be caught by outer try-catch
                    }
                    
                    // Verify the preferences were saved
                    const [savedPrefs] = await db
                      .select()
                      .from(WorkoutPreferences)
                      .where(
                        and(
                          eq(WorkoutPreferences.userId, client.userId),
                          eq(WorkoutPreferences.trainingSessionId, input.sessionId)
                        )
                      )
                      .limit(1);
                    
                    console.log(`[sendSessionStartMessages] Verified saved preferences for ${client.userId}:`, {
                      exists: !!savedPrefs,
                      includeExercises: savedPrefs?.includeExercises
                    });
                  } else {
                    console.warn(`No exercises found to auto-populate for ${client.userId}`);
                  }
                } catch (error) {
                  console.error(`Error auto-populating preferences for ${client.userId}:`, error);
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
            const baseUrl = process.env.SMS_BASE_URL || process.env.NEXTAUTH_URL || 'http://192.168.68.133:3000';
            const preferenceLink = `${baseUrl}/preferences/client/${session.id}/${client.userId}`;
            
            // Simple message for all templates
            const messageBody = `Your workout preferences are ready to customize: 
${preferenceLink}

Set your goals and preferences for today's session.`;

            // Create message record in database for all clients
            await db.insert(messages).values({
              userId: client.userId,
              businessId: session.businessId,
              direction: 'outbound' as const,
              channel: client.userPhone ? 'sms' : 'in_app',
              content: messageBody,
              phoneNumber: client.userPhone || null,
              metadata: {
                sentBy: ctx.session.user.id,
                checkInResult: {
                  success: true,
                  sessionId: session.id
                }
              },
              status: 'sent',
            });

            // Send via Twilio if phone number exists
            if (client.userPhone && twilioClient) {
              await twilioClient.messages.create({
                body: messageBody,
                to: client.userPhone,
                from: process.env.TWILIO_PHONE_NUMBER,
              });
              console.log(`Sent SMS to ${client.userName} (${client.userPhone})`);
            } else {
              console.log(`Created in-app message for ${client.userName} (no phone)`);
            }

            return { success: true, userId: client.userId, channel: client.userPhone ? 'sms' : 'in_app' };
          } catch (error) {
            console.error(`Failed to send to ${client.userId}:`, error);
            return { success: false, userId: client.userId, error: error instanceof Error ? error.message : "Unknown error" };
          }
        });

        const results = await Promise.all(sendPromises);
        const successCount = results.filter(r => r.success).length;

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
          confirmedExercises: z.array(z.object({
            name: z.string(),
            confirmed: z.boolean()
          })).optional(),
          muscleFocus: z.array(z.string()).optional(),
          muscleAvoidance: z.array(z.string()).optional(),
          otherNotes: z.string().optional(),
        })
      })
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
            code: 'NOT_FOUND',
            message: 'Session not found'
          });
        }
        
        // Find existing preferences
        const [existingPref] = await db
          .select()
          .from(WorkoutPreferences)
          .where(
            and(
              eq(WorkoutPreferences.userId, input.userId),
              eq(WorkoutPreferences.trainingSessionId, input.sessionId)
            )
          )
          .limit(1);

        if (existingPref) {
          // Update existing preferences
          await db
            .update(WorkoutPreferences)
            .set({
              muscleTargets: input.preferences.muscleFocus,
              muscleLessens: input.preferences.muscleAvoidance,
              notes: input.preferences.otherNotes ? [input.preferences.otherNotes] : []
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
            notes: input.preferences.otherNotes ? [input.preferences.otherNotes] : [],
          });
        }

        // Invalidate blueprint cache
        const { WorkoutBlueprintService } = await import("../services/workout-blueprint-service");
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
    .input(z.object({
      sessionId: z.string().uuid(),
      userId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      // Verify that the user belongs to this session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          or(
            eq(UserTrainingSession.status, 'checked_in'),
            eq(UserTrainingSession.status, 'ready')
          )
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid session or user not checked in',
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
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Get existing preferences if any
      const [preferences] = await ctx.db
        .select()
        .from(WorkoutPreferences)
        .where(and(
          eq(WorkoutPreferences.userId, input.userId),
          eq(WorkoutPreferences.trainingSessionId, input.sessionId)
        ))
        .limit(1);

      return {
        user: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          checkedInAt: userSession.checkedInAt,
          preferences: preferences ? {
            intensity: preferences.intensity,
            muscleTargets: preferences.muscleTargets,
            muscleLessens: preferences.muscleLessens,
            includeExercises: preferences.includeExercises,
            avoidExercises: preferences.avoidExercises,
            avoidJoints: preferences.avoidJoints,
            sessionGoal: preferences.sessionGoal,
            workoutType: preferences.workoutType,
            notes: preferences.notes,
          } : null,
        }
      };
    }),

  getClientDeterministicSelections: publicProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      userId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      // Verify user belongs to session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          or(
            eq(UserTrainingSession.status, 'checked_in'),
            eq(UserTrainingSession.status, 'ready')
          )
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid session or user not checked in',
        });
      }

      // Get session with business ID
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }

      // For BMF template, get exercises from preferences or generate blueprint
      if (session.templateType === 'full_body_bmf') {
        try {
          // Get user preferences
          const [preferences] = await ctx.db
            .select()
            .from(WorkoutPreferences)
            .where(and(
              eq(WorkoutPreferences.userId, input.userId),
              eq(WorkoutPreferences.trainingSessionId, input.sessionId)
            ))
            .limit(1);

          // If includeExercises is populated, use those directly
          if (preferences?.includeExercises && preferences.includeExercises.length >= 2) {
            const selections = [];
            
            // Get exercise details from database
            const exerciseDetails = await ctx.db
              .select()
              .from(exercises)
              .where(inArray(exercises.name, preferences.includeExercises || []));
            
            // First exercise is Round1
            const round1Exercise = exerciseDetails.find(e => e.name === preferences.includeExercises?.[0]);
            if (round1Exercise) {
              selections.push({
                roundId: 'Round1',
                roundName: 'Round 1',
                exercise: {
                  name: round1Exercise.name,
                  movementPattern: round1Exercise.movementPattern,
                  primaryMuscle: round1Exercise.primaryMuscle
                }
              });
            }
            
            // Second exercise is Round2
            const round2Exercise = exerciseDetails.find(e => e.name === preferences.includeExercises?.[1]);
            if (round2Exercise) {
              selections.push({
                roundId: 'Round2',
                roundName: 'Round 2',
                exercise: {
                  name: round2Exercise.name,
                  movementPattern: round2Exercise.movementPattern,
                  primaryMuscle: round2Exercise.primaryMuscle
                }
              });
            }
            
            // Generate blueprint to get recommendations
            try {
              const { WorkoutBlueprintService } = await import("../services/workout-blueprint-service");
              const blueprint = await WorkoutBlueprintService.generateBlueprintWithCache(
                input.sessionId,
                session.businessId,
                input.userId
              );
              
              
              // Extract recommendations from blueprint
              const recommendations: any[] = [];
              if (blueprint?.blocks) {
                const round1Block = blueprint.blocks.find((b: any) => b.blockId === 'Round1');
                const round2Block = blueprint.blocks.find((b: any) => b.blockId === 'Round2');
                
                // Get ALL Round1 candidates
                if (round1Block?.individualCandidates?.[input.userId]) {
                  const candidateData = round1Block.individualCandidates[input.userId];
                  // Use allFilteredExercises if available, otherwise fall back to exercises
                  const exerciseList = candidateData.allFilteredExercises || candidateData.exercises || [];
                  
                  exerciseList.forEach((exercise: any) => {
                    if (exercise.name !== preferences.includeExercises?.[0]) {
                      recommendations.push({
                        ...exercise,
                        roundId: 'Round1',
                        roundName: 'Round 1'
                      });
                    }
                  });
                }
                
                // Get ALL Round2 candidates
                if (round2Block?.individualCandidates?.[input.userId]) {
                  const candidateData = round2Block.individualCandidates[input.userId];
                  // Use allFilteredExercises if available, otherwise fall back to exercises
                  const exerciseList = candidateData.allFilteredExercises || candidateData.exercises || [];
                  
                  exerciseList.forEach((exercise: any) => {
                    if (exercise.name !== preferences.includeExercises?.[1]) {
                      recommendations.push({
                        ...exercise,
                        roundId: 'Round2',
                        roundName: 'Round 2'
                      });
                    }
                  });
                }
              }
              
              return {
                selections: selections,
                recommendations: recommendations
              };
            } catch (error) {
              console.error('Failed to get recommendations:', error);
              // Return without recommendations if blueprint generation fails
              return {
                selections: selections,
                recommendations: []
              };
            }
          }

          // Get user profile
          const [userProfile] = await ctx.db
            .select()
            .from(UserProfile)
            .where(and(
              eq(UserProfile.userId, input.userId),
              eq(UserProfile.businessId, session.businessId)
            ))
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
            name: user?.name ?? 'Unknown',
            strength_capacity: (userProfile?.strengthLevel ?? 'moderate') as "very_low" | "low" | "moderate" | "high",
            skill_capacity: (userProfile?.skillLevel ?? 'moderate') as "very_low" | "low" | "moderate" | "high",
            primary_goal: preferences?.sessionGoal === 'strength' ? 'strength' as const : 'general_fitness' as const,
            intensity: (preferences?.intensity ?? 'moderate') as "low" | "moderate" | "high",
            muscle_target: preferences?.muscleTargets ?? [],
            muscle_lessen: preferences?.muscleLessens ?? [],
            exercise_requests: {
              include: preferences?.includeExercises ?? [],
              avoid: preferences?.avoidExercises ?? []
            },
            avoid_joints: preferences?.avoidJoints ?? [],
            business_id: session.businessId,
            templateType: session.templateType as "standard" | "circuit" | "full_body_bmf" | undefined,
            default_sets: userProfile?.defaultSets ?? 20
          };

          // Generate blueprint using shared service
          const { WorkoutBlueprintService } = await import("../services/workout-blueprint-service");
          
          const blueprint = await WorkoutBlueprintService.generateBlueprintWithCache(
            input.sessionId,
            session.businessId,
            input.userId  // Use the client's userId for this single-client context
          );

          // Extract exercises from Round1 and Round2
          const selections: any[] = [];
          const recommendations: any[] = [];
          const round1Block = blueprint.blocks.find((b: any) => b.blockId === 'Round1');
          const round2Block = blueprint.blocks.find((b: any) => b.blockId === 'Round2');
          
          if (round1Block?.individualCandidates?.[input.userId]?.exercises?.[0]) {
            selections.push({
              roundId: 'Round1',
              roundName: 'Round 1',
              exercise: {
                name: round1Block.individualCandidates[input.userId].exercises[0].name,
                movementPattern: round1Block.individualCandidates[input.userId].exercises[0].movementPattern,
                primaryMuscle: round1Block.individualCandidates[input.userId].exercises[0].primaryMuscle
              }
            });
          }
          
          if (round2Block?.individualCandidates?.[input.userId]?.exercises?.[0]) {
            selections.push({
              roundId: 'Round2',
              roundName: 'Round 2',
              exercise: {
                name: round2Block.individualCandidates[input.userId].exercises[0].name,
                movementPattern: round2Block.individualCandidates[input.userId].exercises[0].movementPattern,
                primaryMuscle: round2Block.individualCandidates[input.userId].exercises[0].primaryMuscle
              }
            });
          }
          
          // Collect all candidate exercises from Round1 and Round2 for recommendations
          // Use allFilteredExercises to get the full list, not just top 6
          const selectedExerciseNames = selections.map(s => s.exercise.name);
          
          if (round1Block?.individualCandidates?.[input.userId]) {
            const candidateData = round1Block.individualCandidates[input.userId];
            // Use allFilteredExercises if available, otherwise fall back to exercises
            const exerciseList = candidateData.allFilteredExercises || candidateData.exercises || [];
            
            exerciseList.forEach((exercise: any) => {
              if (!selectedExerciseNames.includes(exercise.name)) {
                recommendations.push({
                  ...exercise,
                  roundId: 'Round1',
                  roundName: 'Round 1'
                });
              }
            });
          }
          
          if (round2Block?.individualCandidates?.[input.userId]) {
            const candidateData = round2Block.individualCandidates[input.userId];
            // Use allFilteredExercises if available, otherwise fall back to exercises
            const exerciseList = candidateData.allFilteredExercises || candidateData.exercises || [];
            
            exerciseList.forEach((exercise: any) => {
              if (!selectedExerciseNames.includes(exercise.name)) {
                recommendations.push({
                  ...exercise,
                  roundId: 'Round2',
                  roundName: 'Round 2'
                });
              }
            });
          }
          
          // Sort recommendations by score (highest first)
          // Don't limit here - let the frontend handle display limits
          recommendations.sort((a, b) => b.score - a.score);
          
          return { selections, recommendations };
        } catch (error) {
          console.error('Error generating blueprint for client:', error);
          return { selections: [], recommendations: [] };
        }
      }

      // For non-BMF templates, return empty
      return { selections: [], recommendations: [] };
    }),

  // Get exercise recommendations for a specific client
  getClientExerciseRecommendations: publicProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      userId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify user belongs to session and get session data
      const userSessionData = await ctx.db
        .select({
          userId: UserTrainingSession.userId,
          sessionId: UserTrainingSession.trainingSessionId,
          templateType: TrainingSession.templateType,
          businessId: TrainingSession.businessId
        })
        .from(UserTrainingSession)
        .innerJoin(
          TrainingSession,
          eq(UserTrainingSession.trainingSessionId, TrainingSession.id)
        )
        .where(
          and(
            eq(UserTrainingSession.userId, input.userId),
            eq(UserTrainingSession.trainingSessionId, input.sessionId),
            or(
              eq(UserTrainingSession.status, 'checked_in'),
              eq(UserTrainingSession.status, 'ready')
            )
          )
        )
        .limit(1);

      if (!userSessionData || userSessionData.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid session or user not checked in',
        });
      }

      const sessionData = userSessionData[0];
      if (!sessionData) {
        return { recommendations: [] };
      }

      // Only process for BMF templates
      if (sessionData.templateType !== 'full_body_bmf') {
        return { recommendations: [] };
      }

      try {
        // Get the cached blueprint
        const { WorkoutBlueprintService } = await import("../services/workout-blueprint-service");
        
        // Try to get cached blueprint first, but generate if not available
        // This ensures clients can see recommendations even before session starts
        const blueprint = await WorkoutBlueprintService.generateBlueprintWithCache(
          input.sessionId,
          sessionData!.businessId,
          input.userId,
          false // Don't force regenerate - will generate if not cached
        );
        
        console.log('[getClientExerciseRecommendations] Blueprint check:', {
          sessionId: input.sessionId,
          hasBlueprint: !!blueprint,
          hasBlocks: !!blueprint?.blocks,
          blockCount: blueprint?.blocks?.length || 0
        });
        
        if (!blueprint?.blocks) {
          console.log('[getClientExerciseRecommendations] No blueprint available yet for session:', input.sessionId);
          return { recommendations: [] };
        }
        
        console.log('[getClientExerciseRecommendations] Blueprint blocks found:', blueprint.blocks.length);

        // Extract recommendations from blueprint
        const recommendations: any[] = [];
        const round1Block = blueprint.blocks.find((b: any) => b.blockId === 'Round1');
        const round2Block = blueprint.blocks.find((b: any) => b.blockId === 'Round2');
        
        console.log('[getClientExerciseRecommendations] Debugging blueprint structure:', {
          hasRound1Block: !!round1Block,
          hasRound2Block: !!round2Block,
          round1HasIndividualCandidates: !!round1Block?.individualCandidates,
          round2HasIndividualCandidates: !!round2Block?.individualCandidates,
          round1CandidateKeys: round1Block?.individualCandidates ? Object.keys(round1Block.individualCandidates) : [],
          round2CandidateKeys: round2Block?.individualCandidates ? Object.keys(round2Block.individualCandidates) : [],
          requestedUserId: input.userId,
          round1SharedCandidatesCount: round1Block?.sharedCandidates?.length || 0,
          round2SharedCandidatesCount: round2Block?.sharedCandidates?.length || 0
        });
        
        // Get Round1 candidates - check both individual and shared
        if (round1Block) {
          if (round1Block.individualCandidates?.[input.userId]) {
            const candidateData = round1Block.individualCandidates[input.userId];
            const exerciseList = candidateData.allFilteredExercises || candidateData.exercises || [];
            
            console.log('[getClientExerciseRecommendations] Round1 individual exercises found:', exerciseList.length);
            
            exerciseList.forEach((exercise: any) => {
              recommendations.push({
                ...exercise,
                roundId: 'Round1',
                roundName: 'Round 1'
              });
            });
          } else if (round1Block.sharedCandidates?.length > 0) {
            // Fall back to shared candidates if no individual candidates
            console.log('[getClientExerciseRecommendations] Using Round1 shared candidates:', round1Block.sharedCandidates.length);
            
            round1Block.sharedCandidates.forEach((exercise: any) => {
              recommendations.push({
                ...exercise,
                roundId: 'Round1',
                roundName: 'Round 1'
              });
            });
          } else {
            console.log('[getClientExerciseRecommendations] No Round1 candidates (individual or shared) for user:', input.userId);
          }
        }
        
        // Get Round2 candidates - check both individual and shared
        if (round2Block) {
          if (round2Block.individualCandidates?.[input.userId]) {
            const candidateData = round2Block.individualCandidates[input.userId];
            const exerciseList = candidateData.allFilteredExercises || candidateData.exercises || [];
            
            console.log('[getClientExerciseRecommendations] Round2 individual exercises found:', exerciseList.length);
            
            exerciseList.forEach((exercise: any) => {
              recommendations.push({
                ...exercise,
                roundId: 'Round2',
                roundName: 'Round 2'
              });
            });
          } else if (round2Block.sharedCandidates?.length > 0) {
            // Fall back to shared candidates if no individual candidates
            console.log('[getClientExerciseRecommendations] Using Round2 shared candidates:', round2Block.sharedCandidates.length);
            
            round2Block.sharedCandidates.forEach((exercise: any) => {
              recommendations.push({
                ...exercise,
                roundId: 'Round2',
                roundName: 'Round 2'
              });
            });
          } else {
            console.log('[getClientExerciseRecommendations] No Round2 candidates (individual or shared) for user:', input.userId);
          }
        }
        
        // Sort by score (highest first)
        recommendations.sort((a, b) => (b.score || 0) - (a.score || 0));
        
        console.log('[getClientExerciseRecommendations] Final recommendations:', {
          count: recommendations.length,
          sampleRecommendations: recommendations.slice(0, 3).map(r => ({
            name: r.name,
            score: r.score,
            roundId: r.roundId
          }))
        });
        
        return { recommendations };
      } catch (error) {
        console.error('[getClientExerciseRecommendations] Error:', {
          sessionId: input.sessionId,
          userId: input.userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Return empty recommendations if blueprint generation fails
        // This can happen if the session hasn't been started yet
        return { recommendations: [] };
      }
    }),

  // Public mutation for replacing client exercise selection
  replaceClientExercisePublic: publicProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      userId: z.string(),
      round: z.enum(['Round1', 'Round2']),
      newExerciseName: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user belongs to session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          eq(UserTrainingSession.status, 'checked_in')
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid session or user not checked in',
        });
      }

      // Get session to get business ID
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }

      // Get or create workout preferences
      const existingPrefs = await ctx.db.query.WorkoutPreferences.findFirst({
        where: and(
          eq(WorkoutPreferences.userId, input.userId),
          eq(WorkoutPreferences.trainingSessionId, input.sessionId)
        ),
      });

      if (existingPrefs) {
        // Update existing preferences - replace the exercise for the specific round
        const currentIncludes = existingPrefs.includeExercises || [];
        const currentExcludes = existingPrefs.avoidExercises || [];
        const updatedIncludes = [...currentIncludes];
        
        // Round1 = index 0, Round2 = index 1
        const roundIndex = input.round === 'Round1' ? 0 : 1;
        const oldExerciseName = updatedIncludes[roundIndex];
        
        // Update the include array with the new exercise
        updatedIncludes[roundIndex] = input.newExerciseName;
        
        // Add the old exercise to the exclude array if it exists and isn't already excluded
        const updatedExcludes = [...currentExcludes];
        if (oldExerciseName && !updatedExcludes.includes(oldExerciseName)) {
          updatedExcludes.push(oldExerciseName);
        }
        
        console.log('[replaceClientExercisePublic] Updating preferences:', {
          userId: input.userId,
          sessionId: input.sessionId,
          round: input.round,
          roundIndex,
          oldExercise: oldExerciseName,
          newExercise: input.newExerciseName,
          currentIncludes,
          updatedIncludes,
          currentExcludes,
          updatedExcludes
        });
        
        await ctx.db
          .update(WorkoutPreferences)
          .set({ 
            includeExercises: updatedIncludes,
            avoidExercises: updatedExcludes
          })
          .where(and(
            eq(WorkoutPreferences.userId, input.userId),
            eq(WorkoutPreferences.trainingSessionId, input.sessionId)
          ));
      } else {
        // Create new preferences with the exercise
        const includeArray = input.round === 'Round1' 
          ? [input.newExerciseName, ''] 
          : ['', input.newExerciseName];
          
        await ctx.db.insert(WorkoutPreferences).values({
          userId: input.userId,
          trainingSessionId: input.sessionId,
          businessId: session.businessId,
          includeExercises: includeArray,
          intensity: 'moderate',
          muscleTargets: [],
          muscleLessens: [],
          avoidJoints: [],
          avoidExercises: [],
        });
      }

      // Invalidate blueprint cache when exercise is changed
      const { WorkoutBlueprintService } = await import("../services/workout-blueprint-service");
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
          confirmedExercises: z.array(z.object({
            name: z.string(),
            confirmed: z.boolean()
          })).optional(),
          muscleFocus: z.array(z.string()).optional(),
          muscleAvoidance: z.array(z.string()).optional(),
          otherNotes: z.string().optional(),
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify user belongs to session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          eq(UserTrainingSession.status, 'checked_in')
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid session or user not checked in',
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
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }

      // Find or create preferences
      const [existingPref] = await ctx.db
        .select()
        .from(WorkoutPreferences)
        .where(
          and(
            eq(WorkoutPreferences.userId, input.userId),
            eq(WorkoutPreferences.trainingSessionId, input.sessionId)
          )
        )
        .limit(1);

      if (existingPref) {
        // Update existing preferences
        await ctx.db
          .update(WorkoutPreferences)
          .set({
            muscleTargets: input.preferences.muscleFocus,
            muscleLessens: input.preferences.muscleAvoidance,
            notes: input.preferences.otherNotes ? [input.preferences.otherNotes] : []
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
          notes: input.preferences.otherNotes ? [input.preferences.otherNotes] : [],
        });
      }

      // Invalidate blueprint cache
      const { WorkoutBlueprintService } = await import("../services/workout-blueprint-service");
      await WorkoutBlueprintService.invalidateCache(input.sessionId);
      
      // Real-time updates will be handled by Supabase Realtime

      return { success: true };
    }),

  // Add exercise to client's include list
  addClientExercise: publicProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      userId: z.string(),
      exerciseName: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user belongs to session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          eq(UserTrainingSession.status, 'checked_in')
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid session or user not checked in',
        });
      }

      // Get session to get business ID
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }

      // Find or create preferences
      const [existingPref] = await ctx.db
        .select()
        .from(WorkoutPreferences)
        .where(
          and(
            eq(WorkoutPreferences.userId, input.userId),
            eq(WorkoutPreferences.trainingSessionId, input.sessionId)
          )
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
            includeExercises: [...currentIncludeExercises, input.exerciseName]
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
      const { WorkoutBlueprintService } = await import("../services/workout-blueprint-service");
      await WorkoutBlueprintService.invalidateCache(input.sessionId);
      
      // Real-time updates will be handled by Supabase Realtime

      return { success: true };
    }),
    
  /**
   * Update client ready status
   */
  updateClientReadyStatus: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      userId: z.string(),
      isReady: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the session exists and user has access
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });
      
      if (!session) {
        throw new TRPCError({ 
          code: "NOT_FOUND", 
          message: "Training session not found" 
        });
      }
      
      // Check if user is trainer for this business
      const isTrainer = ctx.session.user.businessId === session.businessId;
      const isOwnStatus = ctx.session.user.id === input.userId;
      
      if (!isTrainer && !isOwnStatus) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Not authorized to update this status" 
        });
      }
      
      // Get current user training session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          eq(UserTrainingSession.userId, input.userId)
        ),
      });
      
      if (!userSession) {
        throw new TRPCError({ 
          code: "NOT_FOUND", 
          message: "User not found in this training session" 
        });
      }
      
      // Only allow ready status if currently checked_in or ready
      if (userSession.status !== 'checked_in' && userSession.status !== 'ready') {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "User must be checked in to mark as ready" 
        });
      }
      
      // Update status
      const newStatus = input.isReady ? 'ready' : 'checked_in';
      await ctx.db
        .update(UserTrainingSession)
        .set({ status: newStatus })
        .where(eq(UserTrainingSession.id, userSession.id));
      
      return { 
        success: true, 
        newStatus,
        userId: input.userId 
      };
    }),
    
  /**
   * Update client ready status - PUBLIC version for clients
   */
  updateClientReadyStatusPublic: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      userId: z.string(),
      isReady: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user belongs to session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          or(
            eq(UserTrainingSession.status, 'checked_in'),
            eq(UserTrainingSession.status, 'ready')
          )
        ),
      });

      if (!userSession) {
        throw new TRPCError({ 
          code: "NOT_FOUND", 
          message: "User session not found or user not checked in" 
        });
      }
      
      // Update the user's ready status
      const newStatus = input.isReady ? 'ready' : 'checked_in';
      
      await ctx.db
        .update(UserTrainingSession)
        .set({ status: newStatus })
        .where(eq(UserTrainingSession.id, userSession.id));
      
      return { 
        success: true, 
        newStatus,
        userId: input.userId 
      };
    }),
    
  /**
   * Mark all clients as ready (trainer only)
   */
  markAllClientsReady: protectedProcedure
    .input(z.object({
      sessionId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the session exists and user is trainer
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });
      
      if (!session) {
        throw new TRPCError({ 
          code: "NOT_FOUND", 
          message: "Training session not found" 
        });
      }
      
      // Check if user is trainer for this business
      if (ctx.session.user.businessId !== session.businessId) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Only trainers can mark all clients as ready" 
        });
      }
      
      // Update all checked_in clients to ready
      const result = await ctx.db
        .update(UserTrainingSession)
        .set({ status: 'ready' })
        .where(
          and(
            eq(UserTrainingSession.trainingSessionId, input.sessionId),
            eq(UserTrainingSession.status, 'checked_in')
          )
        );
      
      // Get count of updated clients
      const allUserSessions = await ctx.db.query.UserTrainingSession.findMany({
        where: eq(UserTrainingSession.trainingSessionId, input.sessionId),
      });
      
      const readyCount = allUserSessions.filter(us => us.status === 'ready').length;
      const totalCount = allUserSessions.length;
      
      return { 
        success: true,
        readyCount,
        totalCount
      };
    }),

  /**
   * Save visualization data to template config
   */
  saveVisualizationData: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      visualizationData: z.object({
        blueprint: z.any(),
        groupContext: z.any(),
        llmResult: z.any().optional(),
        summary: z.any().optional(),
        llmData: z.any().optional(),
        exerciseMetadata: z.any().optional(),
        sharedExerciseIds: z.array(z.string()).optional()
      })
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can save visualization data
      if (user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can save visualization data',
        });
      }

      // Verify session exists and belongs to trainer's business
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId)
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }

      // Build the template config structure
      const templateConfig = {
        ...(session.templateConfig as any || {}),
        visualizationData: {
          ...input.visualizationData,
          savedAt: new Date().toISOString()
        }
      };
      
      // Log what we're saving for debugging
      console.log('💾 SAVING VISUALIZATION DATA TO DB:', {
        sessionId: input.sessionId,
        hasBlueprint: !!input.visualizationData.blueprint,
        hasClientPools: !!input.visualizationData.blueprint?.clientExercisePools,
        bucketedSelections: input.visualizationData.blueprint?.clientExercisePools ? 
          Object.entries(input.visualizationData.blueprint.clientExercisePools).map(([clientId, pool]: [string, any]) => ({
            clientId,
            hasBucketedSelection: !!pool.bucketedSelection,
            bucketedCount: pool.bucketedSelection?.exercises?.length || 0
          })) : []
      });

      // Update the session with the visualization data
      await ctx.db
        .update(TrainingSession)
        .set({ 
          templateConfig,
          updatedAt: new Date()
        })
        .where(eq(TrainingSession.id, input.sessionId));

      return { success: true };
    }),

  /**
   * Get saved visualization data
   */
  getSavedVisualizationData: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid()
    }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can get visualization data
      if (user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can get visualization data',
        });
      }

      // Get session with template config
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId)
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }

      const templateConfig = session.templateConfig as any;
      const visualizationData = templateConfig?.visualizationData;

      if (!visualizationData) {
        return null;
      }

      // Check if data is stale (older than 30 minutes)
      const savedAt = new Date(visualizationData.savedAt);
      const now = new Date();
      const diffMinutes = (now.getTime() - savedAt.getTime()) / (1000 * 60);
      
      if (diffMinutes > 30) {
        return null; // Force regeneration if data is too old
      }

      return visualizationData;
    }),

  /**
   * Get saved visualization data - PUBLIC version for clients
   */
  getSavedVisualizationDataPublic: publicProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      userId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      // Verify user belongs to session
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.userId),
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          or(
            eq(UserTrainingSession.status, 'checked_in'),
            eq(UserTrainingSession.status, 'ready')
          )
        ),
      });

      if (!userSession) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User is not checked into this session',
        });
      }

      // Get session with template config
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }

      const templateConfig = session.templateConfig as any;
      const visualizationData = templateConfig?.visualizationData;

      if (!visualizationData) {
        return null;
      }

      // Check if data is stale (older than 30 minutes)
      const savedAt = new Date(visualizationData.savedAt);
      const now = new Date();
      const diffMinutes = (now.getTime() - savedAt.getTime()) / (1000 * 60);
      
      if (diffMinutes > 30) {
        return null; // Force regeneration if data is too old
      }

      return visualizationData;
    }),

  /**
   * Start workout - runs Phase 2 organization and prepares workout for live session
   */
  startWorkout: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const mutationStartTime = new Date().toISOString();
      console.log(`[Timestamp] startWorkout mutation started at: ${mutationStartTime}`);
      console.log(`[Timestamp] Session ID: ${input.sessionId}`);
      
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can start workouts
      if (user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can start workouts',
        });
      }

      // Get session
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId)
        ),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }

      // Check if workout organization already exists
      if (session.workoutOrganization) {
        return { 
          success: true, 
          message: 'Workout already organized',
          alreadyOrganized: true 
        };
      }

      // Get saved visualization data (contains Phase 1 selections)
      const templateConfig = session.templateConfig as any;
      const visualizationData = templateConfig?.visualizationData;

      if (!visualizationData?.llmResult?.exerciseSelection) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No exercise selections found. Please generate workouts first.',
        });
      }

      console.log('[startWorkout] ✅ Step 1 Complete: All validations passed');
      console.log('[startWorkout] Session ID:', input.sessionId);
      console.log('[startWorkout] Template type:', session.templateType);
      console.log('[startWorkout] Has visualization data:', !!visualizationData);
      console.log('[startWorkout] Has exercise selection:', !!visualizationData?.llmResult?.exerciseSelection);

      // Check if this template uses Phase 2 LLM organization
      const isStandardTemplate = session.templateType === 'standard' || session.templateType === 'standard_strength';
      
      if (!isStandardTemplate) {
        console.log('[startWorkout] Non-standard template detected. Skipping Phase 2 LLM organization.');
        
        // For BMF and other templates, the workout is already organized
        // Just return success without additional processing
        return { 
          success: true, 
          message: 'Workout ready (no Phase 2 organization needed)',
          templateType: session.templateType
        };
      }

      // Step 2: Phase 2 LLM Organization (Standard templates only)
      try {
        console.log('[startWorkout] Starting Step 2: Phase 2 LLM Organization for Standard template');
        
        // 2.1: Gather workout data with exercise metadata
        console.log('[startWorkout] Fetching workouts and exercise data...');
        
        // Get all workouts for this session
        const workouts = await ctx.db.query.Workout.findMany({
          where: eq(Workout.trainingSessionId, input.sessionId)
        });
        
        // For each workout, get exercises with full metadata
        const workoutsWithExercises = await Promise.all(
          workouts.map(async (workout) => {
            // Get workout exercises
            const workoutExercises = await ctx.db.query.WorkoutExercise.findMany({
              where: eq(WorkoutExercise.workoutId, workout.id)
            });
            
            // Get full exercise metadata for each
            const exercisesWithMetadata = await Promise.all(
              workoutExercises.map(async (we) => {
                const exercise = await ctx.db.query.exercises.findFirst({
                  where: eq(exercises.id, we.exerciseId)
                });
                return {
                  ...we,
                  exercise: exercise
                };
              })
            );
            
            return {
              workout,
              exercises: exercisesWithMetadata
            };
          })
        );
        
        console.log(`[startWorkout] Found ${workoutsWithExercises.length} workouts with exercises`);
        
        // 2.2: Extract client context from visualization data
        const groupContext = visualizationData.groupContext;
        const exerciseSelection = visualizationData.llmResult.exerciseSelection;
        
        // 2.3: Prepare data for LLM
        const phase2Input = {
          templateType: session.templateType,
          clients: workoutsWithExercises.map(({ workout, exercises }) => {
            const client = groupContext.clients.find((c: any) => c.user_id === workout.userId);
            return {
              clientId: workout.userId,
              clientName: client?.name || 'Unknown',
              fitnessGoal: client?.primary_goal || 'general_fitness',
              intensity: client?.intensity || 'moderate',
              exercises: exercises.map(e => ({
                exerciseId: e.exerciseId,
                exerciseName: e.exercise?.name || '',
                primaryMuscle: e.exercise?.primaryMuscle || '',
                secondaryMuscles: e.exercise?.secondaryMuscles || [],
                movementPattern: e.exercise?.movementPattern || '',
                equipment: e.exercise?.equipment || [],
                complexityLevel: e.exercise?.complexityLevel || '',
                fatigueProfile: e.exercise?.fatigueProfile || '',
                isShared: e.isShared,
                sharedWithClients: e.sharedWithClients
              }))
            };
          }),
          sharedExercises: exerciseSelection.sharedExercises || []
        };
        
        console.log('[startWorkout] Prepared Phase 2 input:', JSON.stringify(phase2Input, null, 2));
        
        // 2.4: Create custom LLM prompt with new v2 schema
        console.log(`[Timestamp] Phase 2 prompt building started at: ${new Date().toISOString()}`);
        
        // Get equipment inventory (could be passed from session data in future)
        const equipmentInventory = {
          "barbell_rack": 2,
          "barbell": 4,
          "dumbbell": 10,
          "kettlebell": 6,
          "cable_station": 2,
          "pull_up_bar": 3,
          "bench": 4,
          "box": 4
        };

        // Check if any client wants finisher
        const anyClientWantsFinisher = phase2Input.clients.some(client => 
          // For now, assume high intensity clients want finishers
          client.intensity === 'high'
        );

        const phase2Prompt = `Inputs:
clients: ${JSON.stringify(phase2Input.clients.map(client => ({
  id: client.clientId,
  name: client.clientName,
  goal: client.fitnessGoal,
  intensity: client.intensity,
  wantsFinisher: client.intensity === 'high',
  exercises: client.exercises.map(e => ({
    exerciseId: e.exerciseId,
    exerciseName: e.exerciseName
  }))
})), null, 2)}

equipment: ${JSON.stringify(equipmentInventory, null, 2)}

constraints:
- fixed phase order: main_strength → accessory → core → power_conditioning
- equipment rules: If a shared exercise has one set of required equipment → set sharedPolicy: "alternate". If multiple sets exist → set sharedPolicy: "together"
- session timing guidance: 45-60 minutes total

Hard Constraints:
1. Phase order is fixed: main_strength → accessory → core → power_conditioning
2. Main Strength should start with compound lower-body movement when available
3. Rounds are flexible (2–4). Choose what best fits the provided exercises
4. Use only the provided exercises. Do not invent new ones
5. Exact IDs: Always reference the exact exerciseId values provided
6. Clients with fewer exercises finish early—no filler
7. Equipment conflict policy as stated above
8. Rep-based rounds include sets + reps only; no rest fields
9. Time-based rounds include work/rest/rounds
10. Include finisher only if at least one client's wantsFinisher is true
11. Total duration should be 45-60 minutes

Return only JSON using this structure:
{
  "schemaVersion": "2.0",
  "rounds": [
    {
      "roundNumber": 1,
      "phase": "main_strength",
      "name": "Round 1 – Main Strength",
      "modality": "reps",
      "estimatedDuration": "10-12 min",
      "rotation": {
        "type": "paired",
        "sharedPolicy": "together",
        "notes": "Use together if multiple sets exist; alternate if single set."
      },
      "exercisesByClient": {
        "<clientId>": [
          {
            "exerciseId": "uuid",
            "exerciseName": "Barbell Back Squat",
            "scheme": {
              "type": "reps",
              "sets": 3,
              "reps": "6-8"
            },
            "shared": {
              "isShared": true,
              "with": ["<otherClientId>"]
            },
            "equipment": {
              "name": "barbell_rack",
              "setsAvailable": 2,
              "conflictResolution": "together"
            },
            "reasoning": "Controlled eccentric, drive through mid-foot."
          }
        ]
      }
    }
  ],
  "finisher": {
    "included": ${anyClientWantsFinisher ? 'true' : 'false'},
    "reason": "${anyClientWantsFinisher ? 'client_requested' : 'no_client_requested'}",
    "phase": "power_conditioning",
    "name": "Finisher – Shared High Energy",
    "format": "EMOM | AMRAP | For Time",
    "estimatedDuration": "6-8 min",
    "exercisesByClient": {}
  },
  "clientSessionStatus": {
    "<clientId>": {
      "willFinishEarly": true,
      "reason": "fewer_exercises_than_group"
    }
  },
  "totalDuration": "~45 min",
  "workoutNotes": "Follow phase order: main_strength → accessory → core → power_conditioning."
}`;

        console.log(`[Timestamp] Phase 2 prompt building completed at: ${new Date().toISOString()}`);
        console.log(`[Phase 2 Prompt Analysis]`, {
          promptLength: phase2Prompt.length,
          systemPromptLength: systemPrompt.length,
          userPromptLength: phase2Prompt.length,
          totalPromptLength: systemPrompt.length + phase2Prompt.length,
          clientCount: phase2Input.clients.length,
          totalExerciseCount: phase2Input.clients.reduce((sum, c) => sum + c.exercises.length, 0),
          equipmentTypes: Object.keys(equipmentInventory).length
        });

        // 2.5: Call LLM
        console.log('[startWorkout] Calling Phase 2 LLM...');
        console.log(`[Timestamp] Phase 2 LLM preparation started at: ${new Date().toISOString()}`);
        
        // Import LLM client
        const { createLLM } = await import("@acme/ai");
        const { HumanMessage, SystemMessage } = await import("@langchain/core/messages");
        
        const llm = createLLM({
          modelName: "gpt-5",
          // temperature: 0.7, // GPT-5 only supports default temperature of 1
          maxTokens: 4000,
          // GPT-5 specific parameters
          reasoning_effort: "high", // Complex multi-client round organization
          verbosity: "normal"
        });
        
        console.log(`[Timestamp] Phase 2 LLM preparation completed at: ${new Date().toISOString()}`);
        
        const systemPrompt = `SYSTEM PROMPT — Group Workout Orchestrator (JSON v2)
You are a group workout programmer. Given per-client exercises and constraints, output a single JSON object (schema v2) that sequences a group session into rounds with clear prescriptions and equipment-aware rotation.

Inputs (you will receive)
clients: array of clients with:

id, name, goal, intensity, wantsFinisher (boolean), and exercises (4–7 items):

each exercise: { exerciseId, exerciseName }

equipment: inventory with counts (e.g., { "barbell_rack": 1, "kettlebell": 2, ... })

constraints:

fixed phase order: main_strength → accessory → core → power_conditioning

equipment rules (see below)

session timing guidance (derive from client with most exercises)

Hard Constraints
Phase order is fixed across the session: main_strength → accessory → core → power_conditioning. When using 2-3 rounds, you may use a subset of phases but must maintain this order.

Main Strength should start with a compound lower-body movement when available; if not, sub a compound upper push or pull.

Rounds are flexible (2–4). Choose what best fits the provided exercises while preserving phase order.

Use only the provided exercises for each client. Do not invent new ones.

Exact IDs: Always reference the exact exerciseId values provided.

Clients with fewer exercises finish early—no filler, no extra sets, no standby tasks. In later rounds, these clients may be omitted from exercisesByClient entirely, which is valid and expected.

Equipment conflict policy:

If a shared exercise has one set of required equipment → set sharedPolicy: "alternate" for that station.

If multiple sets exist → set sharedPolicy: "together" so clients perform it simultaneously.

Schemes:

Rep-based rounds (strength/accessory/core) include sets + reps only; no rest fields in rep schemes.

Time-based rounds (power/conditioning) include work/rest/rounds; rest is only allowed here.

Finisher rule:

Include a finisher only if at least one client's wantsFinisher is true.

If included and it's shared, prefer a fun/high-energy station (e.g., EMOM/AMRAP).

Repetition across rounds is allowed when it serves programming balance; variation (tempo/angle/grip) is optional. An exercise may appear in multiple rounds for the same client.

Total duration should be 45-60 minutes, derived from the client with the most exercises.

Programming Logic & Flow
Round selection (2–4 total) should reflect available exercises per client and keep the fixed phase order.

Main Strength: prioritize big lower-body compound patterns (squat/hinge) early while clients are fresh.

Accessory: upper push/pull pairing is encouraged for balance and flow.

Core: stability/anti-rotation/positional core fits well here; can be shared or individualized.

Power & Conditioning: time-based metabolic/power work to close the session. This phase may exist as a regular round even if no finisher is requested. However, a high-energy shared station in the final round should only be included when at least one client has wantsFinisher=true.

Shared exercises: May appear in any round. If creating a high-energy shared finisher station in the final round, do this only when at least one client has wantsFinisher=true.

Rotation & Equipment
For each round, specify:

rotation.type: "paired" | "circuit" | "stations"

rotation.sharedPolicy: "together" or "alternate" per equipment availability

Use equipment.setsAvailable and equipment.conflictResolution on each exercise to make the policy explicit.

Validation Checklist (the model must self-check before returning)
Phase order is not violated: main_strength → accessory → core → power_conditioning (using a subset of phases in order is valid).

2–4 rounds chosen appropriately for the provided exercises.

No invented exercises; all exerciseIds match inputs.

No rest fields in rep-based schemes (strength/accessory/core); rest only present in time-based schemes (power/conditioning).

Equipment conflicts resolved with correct sharedPolicy and conflictResolution.

finisher.included respects wantsFinisher flags.

totalDuration is 45-60 minutes and reflects the client with the most exercises.

Any client with fewer exercises is correctly flagged under clientSessionStatus (no filler work added).

Clients finishing early are validly omitted from later rounds' exercisesByClient.

Style & Output Rules
Output JSON only, no prose.

Be succinct but complete in notes.

Favor group flow and fun when equipment allows clients to work together.`;

        // Log the raw system prompt
        console.log('[Phase 2 System Prompt]', systemPrompt);
        console.log('[Phase 2 System Prompt Length]', systemPrompt.length, 'characters');
        
        const messages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(phase2Prompt)
        ];
        
        const llmStartTime = Date.now();
        const llmStartISO = new Date().toISOString();
        console.log(`[Timestamp] Phase 2 LLM call started at: ${llmStartISO}`);
        
        const response = await llm.invoke(messages);
        
        const llmEndTime = Date.now();
        const llmEndISO = new Date().toISOString();
        console.log(`[Timestamp] Phase 2 LLM call completed at: ${llmEndISO}`);
        
        // Log LLM metrics
        console.log('[Phase 2 LLM Metrics]', {
          modelName: 'gpt-5',
          reasoning_effort: 'high',
          verbosity: 'normal',
          max_completion_tokens: 4000,
          executionTime: `${llmEndTime - llmStartTime}ms`,
          startTime: llmStartISO,
          endTime: llmEndISO,
          response_metadata: response.response_metadata,
          usage_metadata: response.usage_metadata
        });
        
        // Parse the response
        console.log(`[Timestamp] Phase 2 response parsing started at: ${new Date().toISOString()}`);
        
        let roundOrganization;
        try {
          // Extract JSON from the response content
          let content = response.content;
          
          // Remove markdown code blocks if present
          if (typeof content === 'string') {
            // Remove ```json and ``` markers
            content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          }
          
          roundOrganization = JSON.parse(content);
          console.log(`[Timestamp] Phase 2 response parsing completed at: ${new Date().toISOString()}`);
          console.log(`[Phase 2 Response Analysis] Response length: ${content.length} characters`);
          console.log(`[Phase 2 Response Analysis] Number of rounds: ${roundOrganization.rounds?.length || 0}`);
        } catch (parseError) {
          console.error('[startWorkout] Failed to parse LLM response:', parseError);
          console.error('[startWorkout] Raw content:', response.content);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to parse workout organization'
          });
        }
        
        // Validate schema version
        if (roundOrganization.schemaVersion !== "2.0") {
          console.error(`[startWorkout] Invalid schema version: ${roundOrganization.schemaVersion}`);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Invalid schema version. Expected 2.0, got ${roundOrganization.schemaVersion}`
          });
        }
        
        // Validate round count
        if (roundOrganization.rounds.length > 4) {
          console.error(`[startWorkout] LLM created ${roundOrganization.rounds.length} rounds, but maximum is 4`);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Invalid workout organization: Too many rounds (${roundOrganization.rounds.length}). Maximum is 4 rounds.`
          });
        }
        
        // Validate that every round includes every client (unless they finish early)
        const clientIds = phase2Input.clients.map(c => c.clientId);
        const earlyFinishClients = new Set(
          Object.entries(roundOrganization.clientSessionStatus || {})
            .filter(([_, status]: [string, any]) => status.willFinishEarly)
            .map(([clientId]) => clientId)
        );
        
        for (const round of roundOrganization.rounds) {
          const roundClientIds = Object.keys(round.exercisesByClient);
          const missingClients = clientIds.filter(id => 
            !roundClientIds.includes(id) && !earlyFinishClients.has(id)
          );
          
          if (missingClients.length > 0) {
            console.error(`[startWorkout] Round ${round.roundNumber} is missing clients:`, missingClients);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Round ${round.roundNumber} does not include all clients. Missing: ${missingClients.join(', ')}`
            });
          }
        }
        
        console.log('[startWorkout] ✅ Validation passed: All rounds include expected clients');
        
        // Log which exercises are used/unused for debugging (but don't fail)
        for (const client of phase2Input.clients) {
          const usedExerciseIds = new Set<string>();
          
          // Collect all exercise IDs used in rounds for this client
          for (const round of roundOrganization.rounds) {
            const clientExercises = round.exercisesByClient[client.clientId] || [];
            clientExercises.forEach((ex: any) => usedExerciseIds.add(ex.exerciseId));
          }
          
          const unusedExercises = client.exercises.filter(ex => !usedExerciseIds.has(ex.exerciseId));
          if (unusedExercises.length > 0) {
            console.log(`[startWorkout] Client ${client.clientName} has ${unusedExercises.length} unused exercises:`, 
              unusedExercises.map(ex => ex.exerciseName).join(', '));
          } else {
            console.log(`[startWorkout] Client ${client.clientName}: All exercises assigned to rounds`);
          }
        }
        
        // Step 3: Database Updates
        console.log('[startWorkout] Starting Step 3: Database Updates');
        console.log(`[Timestamp] Database updates started at: ${new Date().toISOString()}`);
        
        // 3.1: Store the round organization in TrainingSession
        const dbUpdateStartTime = Date.now();
        await ctx.db
          .update(TrainingSession)
          .set({ 
            workoutOrganization: roundOrganization,
            updatedAt: new Date()
          })
          .where(eq(TrainingSession.id, input.sessionId));
        
        console.log('[startWorkout] Saved round organization to session');
        console.log(`[Timestamp] Round organization saved at: ${new Date().toISOString()}`);
        console.log(`[Timestamp] DB update took: ${Date.now() - dbUpdateStartTime}ms`);
        
        // 3.2: First, reset all workout exercises to clear any previous round assignments
        console.log('[startWorkout] Resetting all workout exercises...');
        console.log(`[Timestamp] Workout exercise reset started at: ${new Date().toISOString()}`);
        const resetStartTime = Date.now();
        
        for (const { workout } of workoutsWithExercises) {
          await ctx.db
            .update(WorkoutExercise)
            .set({ 
              groupName: null,
              orderIndex: 999
            })
            .where(eq(WorkoutExercise.workoutId, workout.id));
        }
        
        console.log(`[Timestamp] Workout exercise reset completed at: ${new Date().toISOString()}`);
        console.log(`[Timestamp] Reset took: ${Date.now() - resetStartTime}ms`);
        
        // 3.3: Update workout_exercise records with round information
        console.log(`[Timestamp] Round assignment started at: ${new Date().toISOString()}`);
        const assignmentStartTime = Date.now();
        let totalUpdates = 0;
        let exerciseOrderAcrossRounds = 0; // Global counter for exercise order
        
        for (const round of roundOrganization.rounds) {
          const roundName = round.name;
          const roundPhase = round.phase;
          const roundNumber = round.roundNumber;
          
          console.log(`[startWorkout] Processing ${roundName} (${roundPhase})...`);
          
          // For each client in this round
          for (const [clientId, exercises] of Object.entries(round.exercisesByClient) as [string, any][]) {
            // Find the workout for this client
            const clientWorkout = workoutsWithExercises.find(w => w.workout.userId === clientId);
            if (!clientWorkout) {
              console.warn(`[startWorkout] No workout found for client ${clientId}`);
              continue;
            }
            
            // Update each exercise in this round
            for (let exerciseIndex = 0; exerciseIndex < exercises.length; exerciseIndex++) {
              const roundExercise = exercises[exerciseIndex];
              
              // Find the matching workout_exercise record
              const workoutExercise = clientWorkout.exercises.find(
                we => we.exerciseId === roundExercise.exerciseId
              );
              
              if (workoutExercise) {
                // Use global order index to ensure proper ordering across all rounds
                const orderIndex = exerciseOrderAcrossRounds++;
                
                // Extract sets from scheme
                const setsCompleted = roundExercise.scheme.sets || roundExercise.scheme.rounds || 1;
                
                await ctx.db
                  .update(WorkoutExercise)
                  .set({ 
                    groupName: roundName,
                    setsCompleted: setsCompleted,
                    orderIndex: orderIndex,
                    phase: roundPhase,
                    scheme: roundExercise.scheme,
                    reasoning: roundExercise.reasoning
                  })
                  .where(eq(WorkoutExercise.id, workoutExercise.id));
                
                totalUpdates++;
                console.log(`[startWorkout] Updated ${roundExercise.exerciseName} for ${clientId}: ${roundName}, Phase: ${roundPhase}, Sets: ${setsCompleted}, Order: ${orderIndex}`);
              } else {
                console.warn(`[startWorkout] Exercise ${roundExercise.exerciseId} not found in workout`);
              }
            }
          }
        }
        
        // 3.4: Log summary of exercises not included in rounds
        for (const { workout, exercises } of workoutsWithExercises) {
          const unassignedExercises = exercises.filter(e => e.orderIndex === 999);
          if (unassignedExercises.length > 0) {
            console.log(`[startWorkout] Client ${workout.userId} has ${unassignedExercises.length} exercises not assigned to rounds:`, 
              unassignedExercises.map(e => e.exercise?.name).join(', '));
          }
        }
        
        console.log(`[Timestamp] Round assignment completed at: ${new Date().toISOString()}`);
        console.log(`[Timestamp] Assignment took: ${Date.now() - assignmentStartTime}ms`);
        console.log(`[startWorkout] ✅ Step 3 Complete: Updated ${totalUpdates} workout exercises`);
        console.log(`[Timestamp] Database updates completed at: ${new Date().toISOString()}`);
        console.log(`[Timestamp] Total database operations took: ${Date.now() - dbUpdateStartTime}ms`);
        
        const mutationEndTime = new Date().toISOString();
        console.log(`[Timestamp] startWorkout mutation completed at: ${mutationEndTime}`);
        console.log(`[Timestamp] Total duration from start: ${Date.now() - Date.parse(mutationStartTime)}ms`);
        
        return { 
          success: true, 
          message: 'Workout organized successfully',
          roundCount: roundOrganization.rounds?.length || 0,
          totalDuration: roundOrganization.totalDuration || '~45 min',
          schemaVersion: roundOrganization.schemaVersion,
          finisherIncluded: roundOrganization.finisher?.included || false
        };
        
      } catch (error) {
        console.error('[startWorkout] Error in Phase 2:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to organize workout',
        });
      }
    }),
} satisfies TRPCRouterRecord;