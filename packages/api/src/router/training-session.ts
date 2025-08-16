import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";

import { desc, eq, and, gte, lte, or, sql, inArray, asc } from "@acme/db";
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
  user,
  user as userTable,
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
   * @deprecated Use startWorkout for new implementations. This legacy version returns minimal data.
   */
  startWorkoutLegacy: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const mutationStartTime = Date.now();
      console.log(`[startWorkout] START - Session: ${input.sessionId} at ${new Date().toISOString()}`);
      
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

      // Remove redundant logging - we already have session ID from start
      console.log(`[startWorkout] Template: ${session.templateType}, Already organized: ${!!session.workoutOrganization}`);

      // Check if this template uses Phase 2 LLM organization
      const isStandardTemplate = session.templateType === 'standard' || session.templateType === 'standard_strength';
      
      if (!isStandardTemplate) {
        // For BMF and other templates, the workout is already organized
        console.log(`[startWorkout] SKIP Phase 2 - Non-standard template: ${session.templateType}`);
        return { 
          success: true, 
          message: 'Workout ready (no Phase 2 organization needed)',
          templateType: session.templateType
        };
      }

      // Step 2: Phase 2 LLM Organization (Standard templates only)
      try {
        console.log('[startWorkout] Phase 2 START');
        
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
        
        console.log(`[startWorkout] Found ${workoutsWithExercises.length} clients, ${workoutsWithExercises.reduce((sum, w) => sum + w.exercises.length, 0)} total exercises`);
        
        // 2.2: Extract client context from visualization data
        const groupContext = visualizationData.groupContext;
        const exerciseSelection = visualizationData.llmResult.exerciseSelection;
        
        // 2.3: Prepare data for LLM
        // First, create exercise catalog (each exercise listed once)
        const exerciseCatalog = new Map();
        workoutsWithExercises.forEach(({ exercises }) => {
          exercises.forEach(e => {
            if (!exerciseCatalog.has(e.exerciseId)) {
              exerciseCatalog.set(e.exerciseId, {
                id: e.exerciseId,
                name: e.exercise?.name || '',
                movementPattern: e.exercise?.movementPattern || '',
                primaryMuscle: e.exercise?.primaryMuscle || '',
                secondaryMuscles: e.exercise?.secondaryMuscles || [],
                equipment: e.exercise?.equipment || []
              });
            }
          });
        });

        const phase2Input = {
          templateType: session.templateType,
          // Exercise catalog - each exercise listed once
          exerciseCatalog: Array.from(exerciseCatalog.values()),
          // Clients with exercise IDs only
          clients: workoutsWithExercises.map(({ workout, exercises }) => {
            const client = groupContext.clients.find((c: any) => c.user_id === workout.userId);
            return {
              clientId: workout.userId,
              clientName: client?.name || 'Unknown',
              fitnessGoal: client?.primary_goal || 'general_fitness',
              intensity: client?.intensity || 'moderate',
              wantsFinisher: client?.workoutType === 'full_body_with_finisher' || client?.workoutType === 'targeted_with_finisher',
              exercises: exercises.map(e => e.exerciseId) // Just IDs - names are in catalog
            };
          }),
          sharedExercises: exerciseSelection.sharedExercises || []
        };
        
        // Remove verbose JSON logging - just log the summary
        console.log(`[startWorkout] Phase 2 input: ${phase2Input.clients.length} clients, ${phase2Input.exerciseCatalog.length} unique exercises`);
        
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
        const anyClientWantsFinisher = phase2Input.clients.some(client => client.wantsFinisher);

        const phase2Prompt = `exerciseCatalog:${JSON.stringify(phase2Input.exerciseCatalog)}
clients:${JSON.stringify(phase2Input.clients)}
equipment:${JSON.stringify(equipmentInventory)}
finisher:${anyClientWantsFinisher}

Build rounds per rules. Output JSON only.`;

        // 2.5: Call LLM
        
        // Import LLM client
        const { createLLM } = await import("@acme/ai");
        const { HumanMessage, SystemMessage } = await import("@langchain/core/messages");
        
        const llmConfig = {
          modelName: "gpt-5",
          // temperature: 0.7, // GPT-5 only supports default temperature of 1
          maxTokens: 2500,
          // GPT-5 specific parameters
          reasoning_effort: "low" as const
        };
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[startWorkout] Creating LLM with config:', llmConfig);
        }
        
        const llm = createLLM(llmConfig);
        
        
        const systemPrompt = `Abbreviations:
- ph: phase → MS=Main Strength, AC=Accessory, CO=Core, PC=Power/Conditioning
- rot: rotation → PAI=Pair, CIR=Circuit, STA=Station
- pol: policy → SOLO=Single Client, ALT=Alternate, TOG=Together
- mov: movement; prim: primary muscle; sec: secondary; eq: equipment
- se: sets; rp: reps; wk: work; rt: rest; rd: number of rounds

SYSTEM — Group Workout Orchestrator (v2.6.2)
Role: Build group rounds from given clients/exercises/inventory. Return the smallest valid JSON.

Abbreviations:
- ph: phase → MS=Main Strength, AC=Accessory, CO=Core, PC=Power/Conditioning
- mov: movementPattern; se: sets; rp: reps; wk: work; rt: rest

GLOBAL PER-ROUND CONSTRAINT
- Each client may appear at most once per round. Never output two assignments for the same (clientId, round).

HARD RULES — priority order

1) Mandatory coverage (highest)
- Every exercise in each client's \`exercises\` list MUST appear exactly once per occurrence (count duplicates).
- Duplicate IDs for a client = separate assignments in different rounds (same phase). No omissions.

2) Block logic & mixed finisher policy
- Classify by movementPattern:
  • PC = conditioning/power intervals (finisher/capacity).
  • NON-PC = everything else (MS, AC, CO).
- Mixed finisher handling (per client):
  • If \`wantsFinisher=false\`: schedule ALL items (MS, AC, CO) entirely in Block A; they do NOT appear in Block B.
  • If \`wantsFinisher=true\`:
      – Let \`coreCount\` be the number of CO items in their list.
      – If \`intensity!="high"\`:
          ▸ **Defer exactly ONE** CO item to Block B (choose the most mergeable/common or highest-intensity core for finisher flow).
          ▸ Keep any remaining CO items for that client in Block A.
      – If \`intensity=="high"\`:
          ▸ You may **defer multiple** CO items to Block B (all, if station/time allows).
- Compute \`nonPcRounds = max NON-PC count across clients\` **after** applying the deferral above (duplicates count).

Block A — NON-PC (rounds 1..nonPcRounds)
- Mix MS + AC + CO (but CO for finisher clients is included here only if it was **not deferred** by the rule above). Do NOT serialize MS before AC/CO.
- **Round 1 priority:** If available, assign each client's heaviest lower-body compound (squat/hinge/lunge; barbell preferred) in Round 1, capacity permitting.
- Breadth-first packing: in each Block-A round, assign exactly ONE pending NON-PC exercise per active client.
- **Programming practices (when choosing among a client's eligible options):**
  1) Alternate movement patterns across rounds for that client (avoid same pattern back-to-back).
  2) Prefer Lower → Upper alternation across rounds when their list allows.
  3) Heavy before accessory (choose compound/multi-joint before isolation) unless doing so violates 1 or 2.
- If multiple clients have the same exerciseId in a round, they share ONE station.
- Clients with no remaining NON-PC drop out of later Block-A rounds (no filler).
- **Anti-solo:** If the final Block-A round would contain a single client, move that client's remaining NON-PC into the earliest prior Block-A round where they do not already have NON-PC. If none, allow that client TWO NON-PC assignments in the last multi-client round (but still one per client per round overall).

Block B — Finisher / capacity (REQUIRED iff any \`wantsFinisher=true\`)
- Round number = \`nonPcRounds + 1\` (add Block-B-2 only if needed; see below).
- Participants: ONLY finisher clients who have at least one **deferred CO** or an explicit **PC** item.
- Contents:
  • Include each participating client's **deferred CO** and any explicit **PC** items from the catalog.
  • **One assignment per client per Block-B round.** If a client has >1 deferred CO:
      – Default: choose ONE as their station and convert remaining core volume to **+rounds** (if time-based) or **+sets** (if reps-based) on that station.
      – If \`intensity=="high"\` and distinct movements are desired, open a second Block-B round (Block-B-2) and place one core per client per round (still max one per client per round).
- **Baseline dose:** In each Block-B round, all participating clients share the SAME time scheme (e.g., work "30–40s", rest "15–20s", rounds 3–4).
- **Extra capacity:** Only for clients with higher workload (> group median total exercises) or \`intensity:"high"\`. Prefer +1 round/set over adding stations.

3) Phase labeling
- Label each assignment by phase:
  • MS: compound squat/hinge/lunge/push/pull; barbell multi-joint rows
  • AC: isolation/assistance (shoulder/leg/arm isolates; dumbbell/bench/bird-dog/TRX rows)
  • CO: core/anti_rotation/anti_extension
  • PC: conditioning/power intervals

4) Participation & capacity
- Maximize clients per round in Block A. Avoid single-client rounds (see anti-solo).
- Per-round stations ≤ active clients that round.

5) Schemes
- MS/AC/CO default to **reps-only** (no rest). If a catalog core item is explicitly time-based, time is allowed.
- PC and all Block-B rounds are **time-based** (work+rest+rounds).

6) Other constraints
- Use only provided exercise IDs; no inventions.
- Early finishers: a client may skip later rounds only AFTER all their listed exercises are scheduled.
- Target duration: 45–60 min (based on the client with the most exercises).

Inputs:
- exerciseCatalog: [{id, name, movementPattern, primaryMuscle, secondaryMuscles[], equipment[]}]
- clients: [{clientId, clientName, fitnessGoal, intensity, wantsFinisher, exercises:[exerciseId, ...]}]
- equipment: {barbell_rack: 2, kettlebell: 6, ...}

Output Format (v2.6.2-compact):
{
  "schemaVersion": "2.6.2",
  "assignments": [
    {
      "clientId": "uuid",
      "exerciseId": "uuid",
      "round": 1,
      "phase": "main_strength|accessory|core|power_conditioning",
      "scheme": {"type":"reps","sets":3,"reps":"8-10"} | {"type":"time","work":"30s","rest":"15s","rounds":3},
      "reasoning": ""
    }
  ]
}

Validation (single pass before output)
- For each client, count(assignments matching their \`exercises\`, counting duplicates) == length of that array.
- No duplicate (clientId, round). If found, consolidate per Block-B rules or open Block-B-2 if \`intensity=="high"\`.
- If any missing, append minimal additional assignments in the correct block, then output.

Brevity
- Use the fewest tokens possible. Prefer \`reasoning: ""\`.

Decision
- Be decisive. First valid solution only. No alternatives.
- JSON only. Stop after JSON. End with: END`;

        // Log prompt sizes for debugging token usage
        console.log(`[startWorkout] Phase 2 Prompt - System: ${systemPrompt.length} chars, User: ${phase2Prompt.length} chars, Total: ${systemPrompt.length + phase2Prompt.length} chars`);
        
        // Log the full prompts for debugging during development
        if (process.env.NODE_ENV === 'development') {
          console.log('[startWorkout] Phase 2 System Prompt:', systemPrompt);
          console.log('[startWorkout] Phase 2 User Prompt:', phase2Prompt);
        }
        
        const messages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(phase2Prompt)
        ];
        
        const llmStartTime = Date.now();
        console.log(`[startWorkout] Phase 2 LLM call START`);
        
        const response = await llm.invoke(messages);
        
        const llmEndTime = Date.now();
        console.log(`[startWorkout] Phase 2 LLM call END - Duration: ${llmEndTime - llmStartTime}ms`);
        
        // Log LLM metrics - focus on what matters for debugging
        if (response.usage_metadata) {
          console.log(`[startWorkout] Phase 2 LLM Usage - Input: ${response.usage_metadata.input_tokens}, Output: ${response.usage_metadata.output_tokens}, Reasoning: ${response.usage_metadata.reasoning_tokens || 0}, Total: ${response.usage_metadata.total_tokens}`);
        }
        
        // Log full response metadata for debugging token discrepancy
        if (process.env.NODE_ENV === 'development') {
          console.log('[startWorkout] Full response metadata:', JSON.stringify(response.response_metadata, null, 2));
          console.log('[startWorkout] Full usage metadata:', JSON.stringify(response.usage_metadata, null, 2));
          
          // Log the actual response type and structure
          console.log('[startWorkout] Response type:', typeof response.content);
          console.log('[startWorkout] Response length:', response.content?.length);
        }
        
        // Parse the response
        let parsedResponse;
        try {
          // Extract JSON from the response content
          let content = response.content;
          
          // Remove markdown code blocks if present
          if (typeof content === 'string') {
            // Remove ```json and ``` markers
            content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            
            // Remove END token if present
            if (content.endsWith('END')) {
              content = content.slice(0, -3).trim();
            }
          }
          
          parsedResponse = JSON.parse(content);
          console.log(`[startWorkout] Phase 2 Response - Schema: ${parsedResponse.schemaVersion}, Assignments: ${parsedResponse.assignments?.length || 0}, Size: ${content.length} chars`);
          
          // Log the raw response in development for debugging
          if (process.env.NODE_ENV === 'development') {
            console.log('[startWorkout] Phase 2 Raw Response:', content);
          }
        } catch (parseError) {
          console.error('[startWorkout] Failed to parse LLM response:', parseError);
          console.error('[startWorkout] Raw content:', response.content);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to parse workout organization'
          });
        }
        
        // Fix exercise ID typos/hallucinations before validation
        if (parsedResponse.schemaVersion === '2.6.2' || parsedResponse.schemaVersion === '2.6') {
          console.log('[startWorkout] Checking for exercise ID typos...');
          
          // Create a map of all valid exercise IDs for quick lookup
          const validExerciseIds = new Set(phase2Input.exerciseCatalog.map(e => e.id));
          let typoCount = 0;
          
          // Helper function to calculate string similarity (Levenshtein distance)
          const getLevenshteinDistance = (a: string, b: string): number => {
            const matrix = [];
            for (let i = 0; i <= b.length; i++) {
              matrix[i] = [i];
            }
            for (let j = 0; j <= a.length; j++) {
              matrix[0][j] = j;
            }
            for (let i = 1; i <= b.length; i++) {
              for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                  matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                  matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                  );
                }
              }
            }
            return matrix[b.length][a.length];
          };
          
          // Fix typos in assignments
          for (const assignment of parsedResponse.assignments) {
            if (!validExerciseIds.has(assignment.exerciseId)) {
              // Find the closest matching exercise ID
              let bestMatch = null;
              let bestDistance = Infinity;
              
              for (const validId of validExerciseIds) {
                const distance = getLevenshteinDistance(assignment.exerciseId, validId);
                // Only consider matches with very small edit distance (1-2 characters)
                if (distance < bestDistance && distance <= 2) {
                  bestDistance = distance;
                  bestMatch = validId;
                }
              }
              
              if (bestMatch) {
                const exerciseInfo = phase2Input.exerciseCatalog.find(e => e.id === bestMatch);
                console.warn(`[startWorkout] Fixed exercise ID typo for ${assignment.clientId}: "${assignment.exerciseId}" → "${bestMatch}" (${exerciseInfo?.name})`);
                assignment.exerciseId = bestMatch;
                typoCount++;
              } else {
                console.error(`[startWorkout] Could not fix invalid exercise ID for ${assignment.clientId}: "${assignment.exerciseId}"`);
              }
            }
          }
          
          if (typoCount > 0) {
            console.log(`[startWorkout] Fixed ${typoCount} exercise ID typos`);
          }
          
          // Now validate that all exercises were assigned (after fixing typos)
          console.log('[startWorkout] Validating exercise assignments...');
          
          // Build a map of assigned exercises per client
          const assignedByClient = new Map<string, string[]>();
          for (const assignment of parsedResponse.assignments) {
            if (!assignedByClient.has(assignment.clientId)) {
              assignedByClient.set(assignment.clientId, []);
            }
            assignedByClient.get(assignment.clientId)!.push(assignment.exerciseId);
          }
          
          // Check each client for missing exercises
          let missingCount = 0;
          for (const client of phase2Input.clients) {
            const expectedExercises = client.exercises;
            const assignedExercises = assignedByClient.get(client.clientId) || [];
            
            // Count occurrences of each exercise
            const expectedCounts = new Map<string, number>();
            const assignedCounts = new Map<string, number>();
            
            for (const exerciseId of expectedExercises) {
              expectedCounts.set(exerciseId, (expectedCounts.get(exerciseId) || 0) + 1);
            }
            
            for (const exerciseId of assignedExercises) {
              assignedCounts.set(exerciseId, (assignedCounts.get(exerciseId) || 0) + 1);
            }
            
            // Find missing exercises
            for (const [exerciseId, expectedCount] of expectedCounts) {
              const assignedCount = assignedCounts.get(exerciseId) || 0;
              const missingInstances = expectedCount - assignedCount;
              
              if (missingInstances > 0) {
                const exerciseInfo = phase2Input.exerciseCatalog.find(e => e.id === exerciseId);
                console.error(`[startWorkout] CRITICAL: Client ${client.clientName} missing ${missingInstances} instance(s) of exercise ${exerciseId} (${exerciseInfo?.name}) - This should not happen after typo fixes!`);
                missingCount += missingInstances;
              }
            }
          }
          
          if (missingCount > 0) {
            console.error(`[startWorkout] WARNING: ${missingCount} exercises still missing after typo fixes - LLM may have completely omitted some exercises`);
          }
        }
        
        // Transform v2.1/v2.2/v2.3/v2.5/v2.6/v2.6.2 format into the existing round structure for backward compatibility
        let roundOrganization;
        if (parsedResponse.schemaVersion === '2.1' || parsedResponse.schemaVersion === '2.2' || parsedResponse.schemaVersion === '2.3' || parsedResponse.schemaVersion === '2.5' || parsedResponse.schemaVersion === '2.6' || parsedResponse.schemaVersion === '2.6.2') {
          console.log(`[startWorkout] Transforming v${parsedResponse.schemaVersion} format to legacy format...`);
          
          // First pass: group by round and track unique exercises per round
          const roundsMap = new Map();
          const exerciseOrderMap = new Map(); // Map of "round-exerciseId" to orderIndex
          
          parsedResponse.assignments.forEach((assignment: any) => {
            const roundNum = assignment.round;
            if (!roundsMap.has(roundNum)) {
              roundsMap.set(roundNum, {
                roundNumber: roundNum,
                name: `Round ${roundNum}`,
                phase: assignment.phase,
                exercisesByClient: {},
                uniqueExercises: new Set() // Track unique exercises in this round
              });
            }
            
            const round = roundsMap.get(roundNum);
            
            // Initialize client array if not exists
            if (!round.exercisesByClient[assignment.clientId]) {
              round.exercisesByClient[assignment.clientId] = [];
            }
            
            // Track unique exercises for orderIndex assignment
            round.uniqueExercises.add(assignment.exerciseId);
          });
          
          // Assign orderIndex to each unique exercise in each round
          roundsMap.forEach((round) => {
            const exercisesArray = Array.from(round.uniqueExercises);
            exercisesArray.forEach((exerciseId, index) => {
              const key = `${round.roundNumber}-${exerciseId}`;
              exerciseOrderMap.set(key, index);
            });
          });
          
          // Second pass: add exercises with calculated orderIndex
          parsedResponse.assignments.forEach((assignment: any) => {
            const round = roundsMap.get(assignment.round);
            const exerciseInfo = phase2Input.exerciseCatalog.find((e: any) => e.id === assignment.exerciseId);
            const orderKey = `${assignment.round}-${assignment.exerciseId}`;
            const orderIndex = exerciseOrderMap.get(orderKey) || 0;
            
            // Add exercise to client's list for this round
            round.exercisesByClient[assignment.clientId].push({
              exerciseId: assignment.exerciseId,
              exerciseName: exerciseInfo?.name || 'Unknown Exercise',
              orderIndex: orderIndex, // Use calculated orderIndex
              scheme: assignment.scheme,
              reasoning: assignment.reasoning
            });
          });
          
          // Convert map to array and sort by round number
          const rounds = Array.from(roundsMap.values()).sort((a, b) => a.roundNumber - b.roundNumber);
          
          // Update round names based on phase
          rounds.forEach(round => {
            const phaseNames = {
              'main_strength': 'Main Strength',
              'accessory': 'Accessory',
              'core': 'Core',
              'power_conditioning': 'Power/Conditioning'
            };
            round.name = `Round ${round.roundNumber} - ${phaseNames[round.phase as keyof typeof phaseNames] || round.phase}`;
          });
          
          roundOrganization = {
            schemaVersion: '2.0',
            rounds: rounds,
            totalDuration: '~45 min',
            finisher: {
              included: rounds.some(r => r.phase === 'power_conditioning')
            }
          };
          
          console.log(`[startWorkout] Transformed into ${rounds.length} rounds`);
        } else {
          // Use existing format as-is
          roundOrganization = parsedResponse;
        }
        
        // Add validation to check if all exercises were assigned
        const totalExercisesProvided = phase2Input.clients.reduce((sum, c) => sum + c.exercises.length, 0);
        const totalExercisesAssigned = (parsedResponse.schemaVersion === '2.1' || parsedResponse.schemaVersion === '2.2' || parsedResponse.schemaVersion === '2.3' || parsedResponse.schemaVersion === '2.5' || parsedResponse.schemaVersion === '2.6' || parsedResponse.schemaVersion === '2.6.2')
          ? parsedResponse.assignments.length
          : roundOrganization.rounds.reduce((sum: number, round: any) => {
              return sum + Object.values(round.exercisesByClient).reduce((rSum: number, exercises: any) => rSum + exercises.length, 0);
            }, 0);
        
        if (totalExercisesProvided !== totalExercisesAssigned) {
          console.warn(`[startWorkout] WARNING: Exercise count mismatch - Provided: ${totalExercisesProvided}, Assigned: ${totalExercisesAssigned}`);
        }
        
        // Step 3: Database Updates
        console.log('[startWorkout] Database updates START');
        const dbUpdateStartTime = Date.now();
        
        // 3.1: Store the round organization in TrainingSession
        await ctx.db
          .update(TrainingSession)
          .set({ 
            workoutOrganization: roundOrganization,
            updatedAt: new Date()
          })
          .where(eq(TrainingSession.id, input.sessionId));
        
        // 3.2: First, reset all workout exercises to clear any previous round assignments
        for (const { workout } of workoutsWithExercises) {
          await ctx.db
            .update(WorkoutExercise)
            .set({ 
              groupName: null,
              orderIndex: 999
            })
            .where(eq(WorkoutExercise.workoutId, workout.id));
        }
        
        // 3.3: Update workout_exercise records with round information
        let totalUpdates = 0;
        
        // First, calculate the maximum orderIndex used in each round
        let globalOrderCounter = 0;
        const roundOrderOffsets = new Map<number, number>();
        
        for (const round of roundOrganization.rounds) {
          // Find the max orderIndex in this round
          let maxOrderInRound = -1;
          for (const exercises of Object.values(round.exercisesByClient) as any[]) {
            for (const exercise of exercises) {
              maxOrderInRound = Math.max(maxOrderInRound, exercise.orderIndex);
            }
          }
          
          // Store the offset for this round
          roundOrderOffsets.set(round.roundNumber, globalOrderCounter);
          
          // Update counter for next round
          globalOrderCounter += maxOrderInRound + 1;
        }
        
        // Now update the database with correct global orderIndex values
        for (const round of roundOrganization.rounds) {
          const roundName = round.name;
          const roundPhase = round.phase;
          const roundNumber = round.roundNumber;
          const roundOffset = roundOrderOffsets.get(roundNumber) || 0;
          
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
              // Need to handle duplicates - find all matching exercises
              const matchingExercises = clientWorkout.exercises.filter(
                we => we.exerciseId === roundExercise.exerciseId
              );
              
              // Find one that hasn't been updated yet (orderIndex still 999)
              const workoutExercise = matchingExercises.find(
                we => we.orderIndex === 999
              ) || matchingExercises[0]; // Fallback to first if all updated
              
              if (workoutExercise) {
                // Calculate global orderIndex: round offset + local orderIndex
                const orderIndex = roundOffset + roundExercise.orderIndex;
                
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
              } else {
                console.warn(`[startWorkout] Exercise ${roundExercise.exerciseId} not found in workout`);
              }
            }
          }
        }
        
        console.log(`[startWorkout] Database updates END - Updated ${totalUpdates} exercises in ${Date.now() - dbUpdateStartTime}ms`);
        
        console.log(`[startWorkout] END - Total duration: ${Date.now() - mutationStartTime}ms`);
        
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

  /**
   * Start workout - TV-optimized version that returns full organization data
   * This is the new standard implementation that returns workout organization details
   */
  startWorkout: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const mutationStartTime = Date.now();
      console.log(`[startWorkout-v2] START - Session: ${input.sessionId} at ${new Date().toISOString()}`);
      
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can start workouts
      if (user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can start workouts',
        });
      }

      // Get session to check if already organized
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
        // Already organized - fetch and return full data
        const fullSession = await ctx.db.query.TrainingSession.findFirst({
          where: eq(TrainingSession.id, input.sessionId),
          with: {
            workouts: {
              with: {
                exercises: {
                  with: {
                    exercise: true
                  }
                }
              }
            }
          }
        });

        const clients = await ctx.db.query.UserTrainingSession.findMany({
          where: and(
            eq(UserTrainingSession.trainingSessionId, input.sessionId),
            eq(UserTrainingSession.status, 'checked_in')
          ),
          with: {
            user: true
          }
        });

        return { 
          success: true, 
          message: 'Workout already organized',
          alreadyOrganized: true,
          workoutOrganization: fullSession?.workoutOrganization,
          workouts: fullSession?.workouts || [],
          clients: clients.map(c => ({
            userId: c.userId,
            name: c.user?.name || null,
            email: c.user?.email || ''
          })),
          templateType: session.templateType
        };
      }

      // If not organized, we need to run the Phase 2 organization
      // We'll run the same logic as the legacy endpoint but return full data
      
      // Get saved visualization data (contains Phase 1 selections)
      const templateConfig = session.templateConfig as any;
      const visualizationData = templateConfig?.visualizationData;

      if (!visualizationData?.llmResult?.exerciseSelection) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No exercise selections found. Please generate workouts first.',
        });
      }

      // Check if this template uses Phase 2 LLM organization
      const isStandardTemplate = session.templateType === 'standard' || session.templateType === 'standard_strength';
      
      if (!isStandardTemplate) {
        // For BMF and other templates, the workout is already organized
        console.log(`[startWorkout-v2] SKIP Phase 2 - Non-standard template: ${session.templateType}`);
        
        // Fetch and return the data
        const fullSession = await ctx.db.query.TrainingSession.findFirst({
          where: eq(TrainingSession.id, input.sessionId),
          with: {
            workouts: {
              with: {
                exercises: {
                  with: {
                    exercise: true
                  }
                }
              }
            }
          }
        });

        const clients = await ctx.db.query.UserTrainingSession.findMany({
          where: and(
            eq(UserTrainingSession.trainingSessionId, input.sessionId),
            eq(UserTrainingSession.status, 'checked_in')
          ),
          with: {
            user: true
          }
        });

        return { 
          success: true, 
          message: 'Workout ready (no Phase 2 organization needed)',
          templateType: session.templateType,
          workoutOrganization: fullSession?.workoutOrganization,
          workouts: fullSession?.workouts || [],
          clients: clients.map(c => ({
            userId: c.userId,
            name: c.user?.name || null,
            email: c.user?.email || ''
          }))
        };
      }

      // For standard templates, we need to run Phase 2
      console.log('[startWorkout-v2] Starting Phase 2 organization for standard template');
      
      // Get saved visualization data (contains Phase 1 selections)
      const sessionTemplateConfig = session.templateConfig as any;
      const sessionVisualizationData = sessionTemplateConfig?.visualizationData;

      if (!sessionVisualizationData?.llmResult?.exerciseSelection) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No exercise selections found. Please generate workouts first.',
        });
      }
      
      try {
        // Step 1: Get all workouts and exercises for this session
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
        
        console.log(`[startWorkout-v2] Found ${workoutsWithExercises.length} clients, ${workoutsWithExercises.reduce((sum, w) => sum + w.exercises.length, 0)} total exercises`);
        
        // Step 2: Extract client context and prepare for LLM
        const groupContext = sessionVisualizationData.groupContext;
        const exerciseSelection = sessionVisualizationData.llmResult.exerciseSelection;
        
        // Create exercise catalog (each exercise listed once)
        const exerciseCatalog = new Map();
        workoutsWithExercises.forEach(({ exercises }) => {
          exercises.forEach(e => {
            if (!exerciseCatalog.has(e.exerciseId)) {
              exerciseCatalog.set(e.exerciseId, {
                id: e.exerciseId,
                name: e.exercise?.name || '',
                movementPattern: e.exercise?.movementPattern || '',
                primaryMuscle: e.exercise?.primaryMuscle || '',
                secondaryMuscles: e.exercise?.secondaryMuscles || [],
                equipment: e.exercise?.equipment || []
              });
            }
          });
        });

        const phase2Input = {
          templateType: session.templateType,
          exerciseCatalog: Array.from(exerciseCatalog.values()),
          clients: workoutsWithExercises.map(({ workout, exercises }) => {
            const client = groupContext.clients.find((c: any) => c.user_id === workout.userId);
            return {
              clientId: workout.userId,
              clientName: client?.name || 'Unknown',
              fitnessGoal: client?.primary_goal || 'general_fitness',
              intensity: client?.intensity || 'moderate',
              wantsFinisher: client?.workoutType === 'full_body_with_finisher' || client?.workoutType === 'targeted_with_finisher',
              exercises: exercises.map(e => e.exerciseId)
            };
          }),
          sharedExercises: exerciseSelection.sharedExercises || []
        };
        
        console.log(`[startWorkout-v2] Phase 2 input: ${phase2Input.clients.length} clients, ${phase2Input.exerciseCatalog.length} unique exercises`);
        
        // Step 3: Call Phase 2 LLM
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

        const anyClientWantsFinisher = phase2Input.clients.some(client => client.wantsFinisher);

        const phase2Prompt = `exerciseCatalog:${JSON.stringify(phase2Input.exerciseCatalog)}
clients:${JSON.stringify(phase2Input.clients)}
equipment:${JSON.stringify(equipmentInventory)}
finisher:${anyClientWantsFinisher}

Build rounds per rules. Output JSON only.`;

        // Import LLM client
        const { createLLM } = await import("@acme/ai");
        const { HumanMessage, SystemMessage } = await import("@langchain/core/messages");
        
        const llmConfig = {
          modelName: "gpt-5",
          maxTokens: 2500,
          reasoning_effort: "low" as const
        };
        
        const llm = createLLM(llmConfig);
        
        // Use the same system prompt from legacy endpoint
        const systemPrompt = `Abbreviations:
- ph: phase → MS=Main Strength, AC=Accessory, CO=Core, PC=Power/Conditioning
- rot: rotation → PAI=Pair, CIR=Circuit, STA=Station
- pol: policy → SOLO=Single Client, ALT=Alternate, TOG=Together
- mov: movement; prim: primary muscle; sec: secondary; eq: equipment
- se: sets; rp: reps; wk: work; rt: rest; rd: number of rounds

SYSTEM — Group Workout Orchestrator (v2.6.2)
Role: Build group rounds from given clients/exercises/inventory. Return the smallest valid JSON.

Abbreviations:
- ph: phase → MS=Main Strength, AC=Accessory, CO=Core, PC=Power/Conditioning
- mov: movementPattern; se: sets; rp: reps; wk: work; rt: rest

GLOBAL PER-ROUND CONSTRAINT
- Each client may appear at most once per round. Never output two assignments for the same (clientId, round).

HARD RULES — priority order

1) Mandatory coverage (highest)
- Every exercise in each client's \`exercises\` list MUST appear exactly once per occurrence (count duplicates).
- Duplicate IDs for a client = separate assignments in different rounds (same phase). No omissions.

2) Block logic & mixed finisher policy
- Classify by movementPattern:
  • PC = conditioning/power intervals (finisher/capacity).
  • NON-PC = everything else (MS, AC, CO).
- Mixed finisher handling (per client):
  • If \`wantsFinisher=false\`: schedule ALL items (MS, AC, CO) entirely in Block A; they do NOT appear in Block B.
  • If \`wantsFinisher=true\`:
      – Let \`coreCount\` be the number of CO items in their list.
      – If \`intensity!="high"\`:
          ▸ **Defer exactly ONE** CO item to Block B (choose the most mergeable/common or highest-intensity core for finisher flow).
          ▸ Keep any remaining CO items for that client in Block A.
      – If \`intensity=="high"\`:
          ▸ You may **defer multiple** CO items to Block B (all, if station/time allows).
- Compute \`nonPcRounds = max NON-PC count across clients\` **after** applying the deferral above (duplicates count).

Block A — NON-PC (rounds 1..nonPcRounds)
- Mix MS + AC + CO (but CO for finisher clients is included here only if it was **not deferred** by the rule above). Do NOT serialize MS before AC/CO.
- **Round 1 priority:** If available, assign each client's heaviest lower-body compound (squat/hinge/lunge; barbell preferred) in Round 1, capacity permitting.
- Breadth-first packing: in each Block-A round, assign exactly ONE pending NON-PC exercise per active client.
- **Programming practices (when choosing among a client's eligible options):**
  1) Alternate movement patterns across rounds for that client (avoid same pattern back-to-back).
  2) Prefer Lower → Upper alternation across rounds when their list allows.
  3) Heavy before accessory (choose compound/multi-joint before isolation) unless doing so violates 1 or 2.
- If multiple clients have the same exerciseId in a round, they share ONE station.
- Clients with no remaining NON-PC drop out of later Block-A rounds (no filler).
- **Anti-solo:** If the final Block-A round would contain a single client, move that client's remaining NON-PC into the earliest prior Block-A round where they do not already have NON-PC. If none, allow that client TWO NON-PC assignments in the last multi-client round (but still one per client per round overall).

Block B — Finisher / capacity (REQUIRED iff any \`wantsFinisher=true\`)
- Round number = \`nonPcRounds + 1\` (add Block-B-2 only if needed; see below).
- Participants: ONLY finisher clients who have at least one **deferred CO** or an explicit **PC** item.
- Contents:
  • Include each participating client's **deferred CO** and any explicit **PC** items from the catalog.
  • **One assignment per client per Block-B round.** If a client has >1 deferred CO:
      – Default: choose ONE as their station and convert remaining core volume to **+rounds** (if time-based) or **+sets** (if reps-based) on that station.
      – If \`intensity=="high"\` and distinct movements are desired, open a second Block-B round (Block-B-2) and place one core per client per round (still max one per client per round).
- **Baseline dose:** In each Block-B round, all participating clients share the SAME time scheme (e.g., work "30–40s", rest "15–20s", rounds 3–4).
- **Extra capacity:** Only for clients with higher workload (> group median total exercises) or \`intensity:"high"\`. Prefer +1 round/set over adding stations.

3) Phase labeling
- Label each assignment by phase:
  • MS: compound squat/hinge/lunge/push/pull; barbell multi-joint rows
  • AC: isolation/assistance (shoulder/leg/arm isolates; dumbbell/bench/bird-dog/TRX rows)
  • CO: core/anti_rotation/anti_extension
  • PC: conditioning/power intervals

4) Participation & capacity
- Maximize clients per round in Block A. Avoid single-client rounds (see anti-solo).
- Per-round stations ≤ active clients that round.

5) Schemes
- MS/AC/CO default to **reps-only** (no rest). If a catalog core item is explicitly time-based, time is allowed.
- PC and all Block-B rounds are **time-based** (work+rest+rounds).

6) Other constraints
- Use only provided exercise IDs; no inventions.
- Early finishers: a client may skip later rounds only AFTER all their listed exercises are scheduled.
- Target duration: 45–60 min (based on the client with the most exercises).

Inputs:
- exerciseCatalog: [{id, name, movementPattern, primaryMuscle, secondaryMuscles[], equipment[]}]
- clients: [{clientId, clientName, fitnessGoal, intensity, wantsFinisher, exercises:[exerciseId, ...]}]
- equipment: {barbell_rack: 2, kettlebell: 6, ...}

Output Format (v2.6.2-compact):
{
  "schemaVersion": "2.6.2",
  "assignments": [
    {
      "clientId": "uuid",
      "exerciseId": "uuid",
      "round": 1,
      "phase": "main_strength|accessory|core|power_conditioning",
      "scheme": {"type":"reps","sets":3,"reps":"8-10"} | {"type":"time","work":"30s","rest":"15s","rounds":3},
      "reasoning": ""
    }
  ]
}

Validation (single pass before output)
- For each client, count(assignments matching their \`exercises\`, counting duplicates) == length of that array.
- No duplicate (clientId, round). If found, consolidate per Block-B rules or open Block-B-2 if \`intensity=="high"\`.
- If any missing, append minimal additional assignments in the correct block, then output.

Brevity
- Use the fewest tokens possible. Prefer \`reasoning: ""\`.

Decision
- Be decisive. First valid solution only. No alternatives.
- JSON only. Stop after JSON. End with: END`;

        const messages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(phase2Prompt)
        ];
        
        const llmStartTime = Date.now();
        console.log(`[startWorkout-v2] Phase 2 LLM call START`);
        
        const response = await llm.invoke(messages);
        
        const llmEndTime = Date.now();
        console.log(`[startWorkout-v2] Phase 2 LLM call END - Duration: ${llmEndTime - llmStartTime}ms`);
        
        // Parse the response
        let parsedResponse;
        try {
          let content = response.content;
          
          if (typeof content === 'string') {
            content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            if (content.endsWith('END')) {
              content = content.slice(0, -3).trim();
            }
          }
          
          parsedResponse = JSON.parse(content);
          console.log(`[startWorkout-v2] Phase 2 Response - Schema: ${parsedResponse.schemaVersion}, Assignments: ${parsedResponse.assignments?.length || 0}`);
        } catch (parseError) {
          console.error('[startWorkout-v2] Failed to parse LLM response:', parseError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to parse workout organization'
          });
        }
        
        // Step 4: Transform assignments into round organization
        let roundOrganization;
        if (parsedResponse.schemaVersion === '2.6.2' || parsedResponse.schemaVersion === '2.6') {
          // Transform flat assignments into round structure
          const roundsMap = new Map();
          
          for (const assignment of parsedResponse.assignments) {
            const roundKey = assignment.round;
            
            if (!roundsMap.has(roundKey)) {
              roundsMap.set(roundKey, {
                roundNumber: assignment.round,
                name: `Round ${assignment.round}`,
                phase: assignment.phase,
                scheme: assignment.scheme,
                exercisesByClient: {}
              });
            }
            
            const round = roundsMap.get(roundKey);
            if (!round.exercisesByClient[assignment.clientId]) {
              round.exercisesByClient[assignment.clientId] = [];
            }
            
            // Find exercise info from catalog
            const exerciseInfo = phase2Input.exerciseCatalog.find(e => e.id === assignment.exerciseId);
            
            round.exercisesByClient[assignment.clientId].push({
              exerciseId: assignment.exerciseId,
              exerciseName: exerciseInfo?.name || 'Unknown',
              scheme: assignment.scheme,
              orderIndex: round.exercisesByClient[assignment.clientId].length,
              reasoning: assignment.reasoning || ''
            });
          }
          
          const rounds = Array.from(roundsMap.values()).sort((a, b) => a.roundNumber - b.roundNumber);
          
          // Update round names based on phase
          rounds.forEach(round => {
            const phaseNames = {
              'main_strength': 'Main Strength',
              'accessory': 'Accessory',
              'core': 'Core',
              'power_conditioning': 'Power/Conditioning'
            };
            round.name = `Round ${round.roundNumber} - ${phaseNames[round.phase as keyof typeof phaseNames] || round.phase}`;
          });
          
          roundOrganization = {
            schemaVersion: '2.0',
            rounds: rounds,
            totalDuration: '~45 min',
            finisher: {
              included: rounds.some(r => r.phase === 'power_conditioning')
            }
          };
          
          console.log(`[startWorkout-v2] Transformed into ${rounds.length} rounds`);
        } else {
          // Use existing format as-is
          roundOrganization = parsedResponse;
        }
        
        // Step 5: Update database with organization
        console.log('[startWorkout-v2] Database updates START');
        const dbUpdateStartTime = Date.now();
        
        // Store the round organization in TrainingSession
        await ctx.db
          .update(TrainingSession)
          .set({ 
            workoutOrganization: roundOrganization,
            updatedAt: new Date()
          })
          .where(eq(TrainingSession.id, input.sessionId));
        
        // Reset all workout exercises first
        for (const { workout } of workoutsWithExercises) {
          await ctx.db
            .update(WorkoutExercise)
            .set({ 
              groupName: null,
              orderIndex: 999
            })
            .where(eq(WorkoutExercise.workoutId, workout.id));
        }
        
        // Update workout_exercise records with round information
        let totalUpdates = 0;
        let globalOrderCounter = 0;
        const roundOrderOffsets = new Map<number, number>();
        
        // Calculate order offsets for each round
        for (const round of roundOrganization.rounds) {
          let maxOrderInRound = -1;
          for (const exercises of Object.values(round.exercisesByClient) as any[]) {
            for (const exercise of exercises) {
              maxOrderInRound = Math.max(maxOrderInRound, exercise.orderIndex);
            }
          }
          roundOrderOffsets.set(round.roundNumber, globalOrderCounter);
          globalOrderCounter += maxOrderInRound + 1;
        }
        
        // Update exercises with round information
        for (const round of roundOrganization.rounds) {
          const roundName = round.name;
          const roundPhase = round.phase;
          const roundNumber = round.roundNumber;
          const roundOffset = roundOrderOffsets.get(roundNumber) || 0;
          
          for (const [clientId, exercises] of Object.entries(round.exercisesByClient) as [string, any][]) {
            const clientWorkout = workoutsWithExercises.find(w => w.workout.userId === clientId);
            if (!clientWorkout) continue;
            
            for (let exerciseIndex = 0; exerciseIndex < exercises.length; exerciseIndex++) {
              const roundExercise = exercises[exerciseIndex];
              
              // Find matching workout_exercise record that hasn't been updated
              const matchingExercises = clientWorkout.exercises.filter(
                we => we.exerciseId === roundExercise.exerciseId
              );
              
              const workoutExercise = matchingExercises.find(
                we => we.orderIndex === 999
              ) || matchingExercises[0];
              
              if (workoutExercise) {
                const orderIndex = roundOffset + roundExercise.orderIndex;
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
              }
            }
          }
        }
        
        console.log(`[startWorkout-v2] Database updates END - Updated ${totalUpdates} exercises in ${Date.now() - dbUpdateStartTime}ms`);
        
        // Extract unique clients from workoutsWithExercises
        // This avoids the Drizzle query issues and uses data we already have
        const uniqueClients = new Map();
        
        // Extract unique client info from workouts
        for (const { workout } of workoutsWithExercises) {
          if (!uniqueClients.has(workout.userId)) {
            // Find the client name from the phase2Input.clients array
            const clientInfo = phase2Input.clients.find(c => c.clientId === workout.userId);
            uniqueClients.set(workout.userId, {
              userId: workout.userId,
              user: {
                name: clientInfo?.clientName || null,
                email: '' // We don't have email in phase2Input, but that's okay
              }
            });
          }
        }
        
        const clients = Array.from(uniqueClients.values());
        console.log(`[startWorkout-v2] Extracted ${clients.length} unique clients from workouts`);
        
        console.log(`[startWorkout-v2] END - Total duration: ${Date.now() - mutationStartTime}ms`);
        
        // Debug: Test each part separately to find circular reference
        try {
          console.log('[startWorkout-v2] Testing roundOrganization serialization...');
          JSON.stringify(roundOrganization);
          console.log('[startWorkout-v2] roundOrganization OK');
        } catch (e) {
          console.error('[startWorkout-v2] roundOrganization has circular reference:', e);
        }
        
        try {
          console.log('[startWorkout-v2] Testing workoutsWithExercises serialization...');
          JSON.stringify(workoutsWithExercises);
          console.log('[startWorkout-v2] workoutsWithExercises OK');
        } catch (e) {
          console.error('[startWorkout-v2] workoutsWithExercises has circular reference:', e);
        }
        
        // Return with full data for efficient TV loading
        return { 
          success: true, 
          message: 'Workout organized successfully',
          alreadyOrganized: false,
          templateType: session.templateType,
          workoutOrganization: roundOrganization,
          workouts: workoutsWithExercises.map(w => ({
            id: w.workout.id,
            userId: w.workout.userId,
            trainingSessionId: w.workout.trainingSessionId,
            businessId: w.workout.businessId,
            exercises: w.exercises.map(e => ({
              id: e.id,
              workoutId: e.workoutId,
              exerciseId: e.exerciseId,
              orderIndex: e.orderIndex,
              setsCompleted: e.setsCompleted,
              groupName: e.groupName,
              phase: e.phase,
              scheme: e.scheme,
              isShared: e.isShared,
              sharedWithClients: e.sharedWithClients,
              exercise: {
                id: e.exercise?.id,
                name: e.exercise?.name,
                primaryMuscle: e.exercise?.primaryMuscle,
                movementPattern: e.exercise?.movementPattern,
                equipment: e.exercise?.equipment,
                secondaryMuscles: e.exercise?.secondaryMuscles
              }
            }))
          })),
          clients: clients.map(c => ({
            userId: c.userId,
            name: c.user?.name || null,
            email: c.user?.email || ''
          }))
        };
        
      } catch (error) {
        console.error('[startWorkout-v2] Error in Phase 2:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to organize workout',
        });
      }
    }),
} satisfies TRPCRouterRecord;