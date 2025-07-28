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
  exercises
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
      
      if (!blueprint?.blocks) {
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
        hasBlueprint: !!blueprint
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
      
      // Get checked-in users
      const checkedInUsers = await ctx.db
        .select()
        .from(UserTrainingSession)
        .where(and(
          eq(UserTrainingSession.trainingSessionId, input.sessionId),
          eq(UserTrainingSession.status, 'checked_in')
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
              sessionGoal: preferences.sessionGoal
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
      // 1. Delete workout preferences
      await ctx.db
        .delete(WorkoutPreferences)
        .where(eq(WorkoutPreferences.trainingSessionId, input.sessionId));
      
      // 2. Delete user training sessions (registrations/check-ins)
      await ctx.db
        .delete(UserTrainingSession)
        .where(eq(UserTrainingSession.trainingSessionId, input.sessionId));
      
      // 3. Finally delete the training session
      await ctx.db
        .delete(TrainingSession)
        .where(eq(TrainingSession.id, input.sessionId));
        
      return { success: true, deletedSessionId: input.sessionId };
    }),

  // Add test clients to session (development only)
  addTestClients: protectedProcedure
    .input(z.object({ 
      sessionId: z.string().uuid() 
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can add test clients
      if (user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can add test clients',
        });
      }
      
      // Verify session exists and belongs to user's business
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, user.businessId),
          eq(TrainingSession.status, 'open')
        ),
      });
      
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Open session not found',
        });
      }
      
      // Get existing clients who are not already in this session
      const existingCheckIns = await ctx.db
        .select({ userId: UserTrainingSession.userId })
        .from(UserTrainingSession)
        .where(eq(UserTrainingSession.trainingSessionId, input.sessionId));
      
      const checkedInUserIds = existingCheckIns.map(c => c.userId);
      
      // Find 3 clients from this business who aren't already checked in
      const whereConditions = [
        eq(userTable.businessId, user.businessId),
        eq(userTable.role, 'client')
      ];
      
      if (checkedInUserIds.length > 0) {
        whereConditions.push(
          sql`${userTable.id} NOT IN (${sql.join(checkedInUserIds.map(id => sql`${id}`), sql`, `)})`
        );
      }
      
      const availableClients = await ctx.db
        .select()
        .from(userTable)
        .where(and(...whereConditions))
        .limit(3);
      
      if (availableClients.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No available clients found to add to the session',
        });
      }
      
      const addedClients = [];
      
      // Fetch actual exercises from the database
      const availableExercises = await ctx.db
        .select({
          id: exercises.id,
          name: exercises.name,
          primaryMuscle: exercises.primaryMuscle,
          secondaryMuscles: exercises.secondaryMuscles,
        })
        .from(exercises)
        .limit(50);
      
      if (availableExercises.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No exercises found for this business. Please seed exercises first.',
        });
      }
      
      // Extract unique muscle groups from actual exercises
      const muscleGroupsSet = new Set<string>();
      availableExercises.forEach(exercise => {
        // Add primary muscle
        if (exercise.primaryMuscle) {
          muscleGroupsSet.add(exercise.primaryMuscle.toLowerCase());
        }
        // Add secondary muscles
        if (exercise.secondaryMuscles && Array.isArray(exercise.secondaryMuscles)) {
          exercise.secondaryMuscles.forEach(muscle => {
            if (muscle) {
              muscleGroupsSet.add(muscle.toLowerCase());
            }
          });
        }
      });
      let muscleOptions = Array.from(muscleGroupsSet);
      
      // If no muscle groups found, use defaults
      if (muscleOptions.length === 0) {
        muscleOptions = ['chest', 'back', 'shoulders', 'legs', 'core'];
      }
      
      // Get exercise names for include/exclude options
      const exerciseNames = availableExercises
        .map(e => e.name)
        .filter(name => name && name.length > 0);
      
      // Random preference options for testing
      const intensityOptions = ['low', 'moderate', 'high'];
      const jointOptions = ['knees', 'shoulders', 'lower back', 'wrists', 'ankles', 'elbows', 'hips'];
      const goalOptions = ['strength', 'mobility', 'general_fitness'];
      
      // Add each client to the session and check them in
      for (const client of availableClients) {
        try {
          await ctx.db
            .insert(UserTrainingSession)
            .values({
              userId: client.id,
              trainingSessionId: input.sessionId,
              status: 'checked_in',
              checkedInAt: new Date(),
              preferenceCollectionStep: 'ACTIVE',
            });
          
          // Generate random preferences
          let randomIntensity = intensityOptions[Math.floor(Math.random() * intensityOptions.length)];
          const randomGoal = goalOptions[Math.floor(Math.random() * goalOptions.length)];
        
        // For the first client, ensure specific test conditions
        let randomMuscleTargets: string[] = [];
        if (addedClients.length === 0 && muscleOptions.includes('upper_back')) {
          // First client gets specific settings for testing
          randomIntensity = 'moderate'; // Force moderate intensity
          randomMuscleTargets.push('upper_back');
          // Maybe add a second muscle target (50% chance)
          if (Math.random() < 0.5) {
            const otherMuscles = muscleOptions.filter(m => m !== 'upper_back' && m !== 'calves');
            if (otherMuscles.length > 0) {
              const muscle = otherMuscles[Math.floor(Math.random() * otherMuscles.length)];
              if (muscle) {
                randomMuscleTargets.push(muscle);
              }
            }
          }
        } else {
          // Other clients get random muscle targets
          const numMuscleTargets = Math.floor(Math.random() * 2) + 1;
          for (let i = 0; i < numMuscleTargets; i++) {
            const muscle = muscleOptions[Math.floor(Math.random() * muscleOptions.length)];
            if (muscle && !randomMuscleTargets.includes(muscle)) {
              randomMuscleTargets.push(muscle);
            }
          }
        }
        
        // Sometimes add muscle lessens (30% chance)
        let randomMuscleLessens: string[] = [];
        if (addedClients.length === 0 && muscleOptions.includes('calves')) {
          // First client always gets calves as muscle lessen for testing
          randomMuscleLessens = ['calves'];
        } else if (Math.random() < 0.3 && muscleOptions.length > 0) {
          // Other clients: Pick a muscle that's not already in targets
          const availableMusclesForLessen = muscleOptions.filter(m => !randomMuscleTargets.includes(m));
          if (availableMusclesForLessen.length > 0) {
            const lessenMuscle = availableMusclesForLessen[Math.floor(Math.random() * availableMusclesForLessen.length)];
            if (lessenMuscle) {
              randomMuscleLessens = [lessenMuscle];
            }
          }
        }
        
        // Sometimes add joint avoidance (20% chance)
        const randomAvoidJoints: string[] = [];
        if (Math.random() < 0.2 && jointOptions.length > 0) {
          const joint = jointOptions[Math.floor(Math.random() * jointOptions.length)];
          if (joint) {
            randomAvoidJoints.push(joint);
          }
        }
        
        // Sometimes add exercise preferences (40% chance for includes, 30% for avoids)
        const randomIncludeExercises: string[] = [];
        if (Math.random() < 0.4 && exerciseNames.length > 0) {
          const includeExercise = exerciseNames[Math.floor(Math.random() * exerciseNames.length)];
          if (includeExercise) {
            randomIncludeExercises.push(includeExercise);
          }
        }
          
        let randomAvoidExercises: string[] = [];
        if (Math.random() < 0.3 && exerciseNames.length > 1) {
          // Pick an exercise that's not already in includes
          const availableExercisesForAvoid = exerciseNames.filter(e => !randomIncludeExercises.includes(e));
          if (availableExercisesForAvoid.length > 0) {
            const avoidExercise = availableExercisesForAvoid[Math.floor(Math.random() * availableExercisesForAvoid.length)];
            if (avoidExercise) {
              randomAvoidExercises = [avoidExercise];
            }
          }
        }
        
        // Insert preferences
        const preferenceValues = {
          userId: client.id,
          trainingSessionId: input.sessionId,
          businessId: user.businessId,
          intensity: randomIntensity as "low" | "moderate" | "high",
          muscleTargets: randomMuscleTargets.length > 0 ? randomMuscleTargets : undefined,
          muscleLessens: randomMuscleLessens.length > 0 ? randomMuscleLessens : undefined,
          includeExercises: randomIncludeExercises.length > 0 ? randomIncludeExercises : undefined,
          avoidExercises: randomAvoidExercises.length > 0 ? randomAvoidExercises : undefined,
          avoidJoints: randomAvoidJoints.length > 0 ? randomAvoidJoints : undefined,
          sessionGoal: randomGoal,
          intensitySource: 'explicit' as const,
          sessionGoalSource: 'explicit' as const,
          collectionMethod: 'manual' as const
        };
        
        await ctx.db
          .insert(WorkoutPreferences)
          .values(preferenceValues);
        
          addedClients.push({
            userId: client.id,
            name: client.name,
            email: client.email,
            checkedInAt: new Date(),
          });
        } catch (error) {
          console.error('Error adding test client:', error);
          // Continue with next client
        }
      }
      
      return {
        success: true,
        message: `Successfully added ${addedClients.length} clients`,
        clients: addedClients,
      };
    }),

  // Visualize group workout phases A & B (for testing/development)
  visualizeGroupWorkout: protectedProcedure
    .input(z.object({ 
      sessionId: z.string().uuid() 
    }))
    .query(async ({ ctx, input }) => {
      console.log('🎯 visualizeGroupWorkout called with:', { sessionId: input.sessionId });
      
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can visualize group workouts
      if (user.role !== 'trainer') {
        console.error('❌ User is not a trainer:', user.role);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can visualize group workouts',
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
      
      // Get checked-in clients with their preferences
      console.log('📋 Fetching checked-in clients...');
      const checkedInClients = await ctx.db
        .select({
          userId: userTable.id,
          userName: userTable.name,
          userEmail: userTable.email,
          checkedInAt: UserTrainingSession.checkedInAt,
          sessionUserId: UserTrainingSession.id,
        })
        .from(UserTrainingSession)
        .innerJoin(userTable, eq(UserTrainingSession.userId, userTable.id))
        .where(
          and(
            eq(UserTrainingSession.trainingSessionId, input.sessionId),
            eq(UserTrainingSession.status, 'checked_in')
          )
        );
      
      // Get preferences and user profile for each client
      const clientsWithPreferences = await Promise.all(
        checkedInClients.map(async (client) => {
          const [preferences] = await ctx.db
            .select()
            .from(WorkoutPreferences)
            .where(and(
              eq(WorkoutPreferences.userId, client.userId),
              eq(WorkoutPreferences.trainingSessionId, input.sessionId)
            ))
            .limit(1);
            
          const [userProfile] = await ctx.db
            .select()
            .from(UserProfile)
            .where(and(
              eq(UserProfile.userId, client.userId),
              eq(UserProfile.businessId, user.businessId)
            ))
            .limit(1);
            
          return { ...client, preferences, userProfile };
        })
      );
      
      console.log(`✅ Found ${clientsWithPreferences.length} checked-in clients with preferences`);
      
      if (clientsWithPreferences.length < 2) {
        console.error('❌ Not enough clients:', clientsWithPreferences.length);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Need at least 2 checked-in clients for group workout visualization',
        });
      }
      
      // Import what we need
      console.log('[visualizeGroupWorkout] Starting import and exercise filtering', {
        sessionId: input.sessionId,
        timestamp: new Date().toISOString()
      });
      
      const { WorkoutBlueprintService } = await import("../services/workout-blueprint-service");
      const { groupWorkoutTestDataLogger } = await import("../utils/groupWorkoutTestDataLogger");
      
      // Use shared service to prepare clients and generate blueprint
      const phase1_2StartTime = Date.now();
      
      const { clientContexts, preScoredExercises, exercisePool, groupContext } = 
        await WorkoutBlueprintService.prepareClientsForBlueprint(
          input.sessionId,
          user.businessId,
          user.id
        );
      
      const phase1_2Time = Date.now() - phase1_2StartTime;
      
      // Initialize test data logging
      groupWorkoutTestDataLogger.initSession(input.sessionId, groupContext);
      groupWorkoutTestDataLogger.updateTiming(input.sessionId, 'phase1_2', phase1_2Time);
      
      console.log(`✅ Total unique exercises across all clients: ${exercisePool.length}`);
      
      // Debug: Verify each client maintains their own scores
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Verifying individual client scores are preserved:');
        for (const [clientId, exercises] of preScoredExercises) {
          const client = clientContexts.find(c => c.user_id === clientId);
          const sampleExercise = exercises.find(ex => ex.name === 'Landmine Shoulder Press' || ex.name === 'Deadlift');
          if (sampleExercise) {
            console.log(`  Client: ${client?.name} (${client?.intensity}) - ${sampleExercise.name}: ${sampleExercise.score}`);
          }
        }
      }
      
      // Run Phase A & B to generate blueprint
      console.log('🚀 Running Phase A & B with GroupContext:', {
        clientCount: groupContext.clients.length,
        templateType: groupContext.templateType
      });
      
      try {
        // Pass pre-scored exercises to avoid re-processing
        const blueprint = await generateGroupWorkoutBlueprint(
          groupContext, 
          exercisePool,
          preScoredExercises
        );
        console.log('✅ Blueprint generated successfully:', {
          blockCount: blueprint.blocks.length,
          warnings: blueprint.validationWarnings
        });
        
        // Save the test data
        await groupWorkoutTestDataLogger.saveGroupWorkoutData(input.sessionId);
      
        return {
          groupContext,
          blueprint,
          summary: {
            totalClients: clientContexts.length,
            totalBlocks: blueprint.blocks.length,
            cohesionWarnings: blueprint.validationWarnings || [],
          },
        };
      } catch (error) {
        console.error('❌ Error generating blueprint:', error);
        
        // Log detailed error information
        if (error instanceof Error) {
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
          groupWorkoutTestDataLogger.addError(input.sessionId, `${error.name}: ${error.message}`);
        } else {
          console.error('Unknown error type:', error);
          groupWorkoutTestDataLogger.addError(input.sessionId, 'Unknown error');
        }
        
        // Save whatever test data we have so far
        await groupWorkoutTestDataLogger.saveGroupWorkoutData(input.sessionId);
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate group workout blueprint',
        });
      }
    }),
    
  /**
   * Generate complete group workout with LLM
   * This builds on visualizeGroupWorkout but adds the LLM generation step
   */
  generateGroupWorkout: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid()
    }))
    .query(async ({ ctx, input }) => {
      console.log('🎯 generateGroupWorkout called with:', { sessionId: input.sessionId });
      
      const user = ctx.session?.user as SessionUser;
      
      // Only trainers can generate group workouts
      if (user.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can generate group workouts',
        });
      }
      
      try {
        // Get the actual session data by running the same logic as visualizeGroupWorkout
        const session = await ctx.db
          .select()
          .from(TrainingSession)
          .where(eq(TrainingSession.id, input.sessionId))
          .leftJoin(UserTrainingSession, eq(UserTrainingSession.trainingSessionId, TrainingSession.id))
          .then(rows => {
            if (rows.length === 0) return null;
            const session = rows[0]!.training_session;
            const trainees = rows
              .filter(row => row.user_training_session?.userId)
              .map(row => ({ userId: row.user_training_session!.userId, checkedInAt: row.user_training_session!.checkedInAt }));
            return { ...session, trainees };
          });
        
        if (!session) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Session not found',
          });
        }
        
        if (session.trainerId !== user.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only view your own sessions',
          });
        }
        
        const clientIds = session.trainees.map(t => t.userId);
        
        // Get client details and preferences
        const [clientsData, preferencesData] = await Promise.all([
          ctx.db
            .select()
            .from(User)
            .leftJoin(UserProfile, eq(UserProfile.userId, User.id))
            .where(inArray(User.id, clientIds))
            .then(rows => rows.map(row => ({
              ...row.user,
              userProfile: row.user_profile
            }))),
          ctx.db
            .select()
            .from(WorkoutPreferences)
            .where(and(
              eq(WorkoutPreferences.trainingSessionId, input.sessionId),
              inArray(WorkoutPreferences.userId, clientIds)
            ))
        ]);
        
        // Map preferences by userId
        const preferencesByUserId = Object.fromEntries(
          preferencesData.map(p => [p.userId, p])
        );
        
        // Create ClientContext for each client
        const clientsWithPreferences = clientsData.map(client => {
          const prefs = preferencesByUserId[client.id];
          const profile = client.userProfile;
          
          return {
            user_id: client.id,
            name: client.name || 'Unknown',
            strength_capacity: (profile?.strengthLevel ?? 'moderate') as 'very_low' | 'low' | 'moderate' | 'high',
            skill_capacity: (profile?.skillLevel ?? 'moderate') as 'very_low' | 'low' | 'moderate' | 'high',
            primary_goal: (prefs?.sessionGoal || 'strength') as 'mobility' | 'strength' | 'general_fitness' | 'hypertrophy' | 'burn_fat',
            intensity: (prefs?.intensity || 'moderate') as 'low' | 'moderate' | 'high',
            muscle_target: prefs?.muscleTargets || [],
            muscle_lessen: prefs?.muscleLessens || [],
            exercise_requests: {
              include: prefs?.includeExercises || [],
              avoid: prefs?.avoidExercises || []
            },
            avoid_joints: prefs?.avoidJoints || [],
            default_sets: profile?.defaultSets ?? 20
          };
        });
        
        // Import what we need
        const { generateGroupWorkoutBlueprint, createLLM, WorkoutPromptBuilder } = await import("@acme/ai");
        const { ExerciseFilterService } = await import("../services/exercise-filter-service");
        const { HumanMessage, SystemMessage } = await import("@langchain/core/messages");
        
        // Get exercises for this business
        const filterService = new ExerciseFilterService(ctx.db);
        const exercisePool = await filterService.fetchBusinessExercises(user.businessId);
        
        // Create GroupContext
        const groupContext = {
          clients: clientsWithPreferences,
          sessionId: input.sessionId,
          businessId: user.businessId,
          templateType: 'full_body_bmf' as const // Using BMF template for testing
        };
        
        // Generate the blueprint
        const blueprint = await generateGroupWorkoutBlueprint(
          groupContext as GroupContext,
          exercisePool
        );
        
        // Get actual exercise selections for rounds 1-2 from the blueprint
        const round1Block = blueprint.blocks.find(b => b.blockId === 'Round1');
        const round2Block = blueprint.blocks.find(b => b.blockId === 'Round2');
        
        if (!round1Block || !round2Block) {
          throw new Error('Round1 and Round2 blocks are required');
        }
        
        // We'll create workouts after LLM generation
        
        // Extract top exercise for each client from Round 1, checking for overrides
        const round1Assignments = clientsWithPreferences.map(client => {
          const clientData = round1Block.individualCandidates[client.user_id];
          let selectedExercise = clientData?.exercises?.[0]; // Default to top candidate
          
          // Check if client has an override for Round1
          if (client.preferences?.includeExercises && client.preferences.includeExercises.length > 0) {
            // Look for a lower body exercise in their includes
            const lowerBodyOverride = clientData?.exercises?.find(ex => 
              client.preferences.includeExercises.some(included => 
                included.toLowerCase() === ex.name.toLowerCase()
              ) && ['squat', 'hinge', 'lunge'].includes(ex.movementPattern || '')
            );
            
            if (lowerBodyOverride) {
              selectedExercise = lowerBodyOverride;
            }
          }
          
          if (!selectedExercise) {
            throw new Error(`No Round 1 exercise found for client ${client.name}`);
          }
          
          return {
            clientId: client.user_id,
            clientName: client.name,
            exercise: selectedExercise.name,
            equipment: getEquipmentFromExercise(selectedExercise.name)
          };
        });
        
        // Extract top exercise for each client from Round 2, checking for overrides
        const round2Assignments = clientsWithPreferences.map(client => {
          const clientData = round2Block.individualCandidates[client.user_id];
          let selectedExercise = clientData?.exercises?.[0]; // Default to top candidate
          
          // Check if client has an override for Round2
          if (client.preferences?.includeExercises && client.preferences.includeExercises.length > 0) {
            // Look for a pull exercise in their includes
            const pullOverride = clientData?.exercises?.find(ex => 
              client.preferences.includeExercises.some(included => 
                included.toLowerCase() === ex.name.toLowerCase()
              ) && ['vertical_pull', 'horizontal_pull'].includes(ex.movementPattern || '')
            );
            
            if (pullOverride) {
              selectedExercise = pullOverride;
            }
          }
          
          if (!selectedExercise) {
            throw new Error(`No Round 2 exercise found for client ${client.name}`);
          }
          
          return {
            clientId: client.user_id,
            clientName: client.name,
            exercise: selectedExercise.name,
            equipment: getEquipmentFromExercise(selectedExercise.name)
          };
        });
        
        
        // Process client-requested exercises and muscle targets deterministically
        const clientRequestAssignments: Record<string, Array<{
          clientId: string;
          clientName: string;
          exercise: string;
          equipment: string[];
          roundAssigned: string;
          reason: 'client_request' | 'muscle_target';
        }>> = {};
        
        // Track which exercises have been used per client
        const usedExercisesPerClient = new Map<string, Set<string>>();
        
        // Initialize with Round 1 and 2 exercises
        clientsWithPreferences.forEach(client => {
          const used = new Set<string>();
          const r1 = round1Assignments.find(a => a.clientId === client.user_id);
          const r2 = round2Assignments.find(a => a.clientId === client.user_id);
          if (r1) used.add(r1.exercise.toLowerCase());
          if (r2) used.add(r2.exercise.toLowerCase());
          usedExercisesPerClient.set(client.user_id, used);
        });
        
        // Check Round 3 and 4 for client requests
        const round3Block = blueprint.blocks.find(b => b.blockId === 'Round3');
        const round4Block = blueprint.blocks.find(b => b.blockId === 'FinalRound');
        
        clientsWithPreferences.forEach(client => {
          if (!client.exercise_requests?.include || client.exercise_requests.include.length === 0) return;
          
          const usedExercises = usedExercisesPerClient.get(client.user_id) || new Set();
          const requestedExercises = client.exercise_requests.include;
          
          requestedExercises.forEach(requestedName => {
            // Skip if already used
            if (usedExercises.has(requestedName.toLowerCase())) return;
            
            // Try to find in Round 3 first
            const r3Exercises = round3Block?.individualCandidates[client.user_id]?.exercises || [];
            const r3Match = r3Exercises.find(ex => 
              ex.name.toLowerCase() === requestedName.toLowerCase() && 
              ex.scoreBreakdown?.includeExerciseBoost > 0
            );
            
            if (r3Match) {
              if (!clientRequestAssignments.Round3) clientRequestAssignments.Round3 = [];
              clientRequestAssignments.Round3.push({
                clientId: client.user_id,
                clientName: client.name,
                exercise: r3Match.name,
                equipment: getEquipmentFromExercise(r3Match.name),
                roundAssigned: 'Round3',
                reason: 'client_request'
              });
              usedExercises.add(r3Match.name.toLowerCase());
              return;
            }
            
            // Try Round 4 if not found in Round 3
            const r4Exercises = round4Block?.individualCandidates[client.user_id]?.exercises || [];
            const r4Match = r4Exercises.find(ex => 
              ex.name.toLowerCase() === requestedName.toLowerCase() && 
              ex.scoreBreakdown?.includeExerciseBoost > 0
            );
            
            if (r4Match) {
              if (!clientRequestAssignments.FinalRound) clientRequestAssignments.FinalRound = [];
              clientRequestAssignments.FinalRound.push({
                clientId: client.user_id,
                clientName: client.name,
                exercise: r4Match.name,
                equipment: getEquipmentFromExercise(r4Match.name),
                roundAssigned: 'FinalRound',
                reason: 'client_request'
              });
              usedExercises.add(r4Match.name.toLowerCase());
            }
          });
        });
        
        // Process muscle targets deterministically (BMF template only)
        if (session.templateType === 'full_body_bmf') {
          clientsWithPreferences.forEach(client => {
          if (!client.muscle_target || client.muscle_target.length === 0) return;
          
          const usedExercises = usedExercisesPerClient.get(client.user_id) || new Set();
          const muscleTargets = client.muscle_target;
          
          // Check if any muscle targets are already covered
          const uncoveredTargets = muscleTargets.filter(target => {
            // Check R1-R4 exercises for this muscle target
            const r1Exercise = round1Assignments.find(a => a.clientId === client.user_id)?.exercise;
            const r2Exercise = round2Assignments.find(a => a.clientId === client.user_id)?.exercise;
            
            // Simple check - in production, would check actual exercise muscle groups
            return true; // For now, assume target not covered
          });
          
          // Try to assign uncovered muscle targets
          uncoveredTargets.forEach(muscleTarget => {
            // Look for highest scoring exercise targeting this muscle in R3/R4
            const r3Exercises = round3Block?.individualCandidates[client.user_id]?.exercises || [];
            const r4Exercises = round4Block?.individualCandidates[client.user_id]?.exercises || [];
            
            // Find exercise with muscle target boost
            const r3Match = r3Exercises.find(ex => 
              !usedExercises.has(ex.name.toLowerCase()) &&
              ex.scoreBreakdown?.muscleTargetBonus > 0
            );
            
            if (r3Match) {
              if (!clientRequestAssignments.Round3) clientRequestAssignments.Round3 = [];
              // Check if client already has assignment in R3
              const existingR3 = clientRequestAssignments.Round3.filter(a => a.clientId === client.user_id).length;
              if (existingR3 === 0) { // Only assign if slot available
                clientRequestAssignments.Round3.push({
                  clientId: client.user_id,
                  clientName: client.name,
                  exercise: r3Match.name,
                  equipment: getEquipmentFromExercise(r3Match.name),
                  roundAssigned: 'Round3',
                  reason: 'muscle_target'
                });
                usedExercises.add(r3Match.name.toLowerCase());
                return;
              }
            }
            
            // Try R4 if R3 is full or no match
            const r4Match = r4Exercises.find(ex => 
              !usedExercises.has(ex.name.toLowerCase()) &&
              ex.scoreBreakdown?.muscleTargetBonus > 0
            );
            
            if (r4Match) {
              if (!clientRequestAssignments.FinalRound) clientRequestAssignments.FinalRound = [];
              const existingR4 = clientRequestAssignments.FinalRound.filter(a => a.clientId === client.user_id).length;
              if (existingR4 === 0) {
                clientRequestAssignments.FinalRound.push({
                  clientId: client.user_id,
                  clientName: client.name,
                  exercise: r4Match.name,
                  equipment: getEquipmentFromExercise(r4Match.name),
                  roundAssigned: 'FinalRound',
                  reason: 'muscle_target'
                });
                usedExercises.add(r4Match.name.toLowerCase());
              }
            }
          });
        });
        }
        
        // Build the dynamic prompt using new prompt builder
        const promptBuilder = new WorkoutPromptBuilder({
          workoutType: 'group',
          groupConfig: {
            clients: clientsWithPreferences,
            blueprint: blueprint.blocks,
            deterministicAssignments: {
              Round1: round1Assignments,
              Round2: round2Assignments,
              ...clientRequestAssignments
            },
            equipment: {
              barbells: 2,
              benches: 2,
              cable_machine: 1,
              row_machine: 1,
              ab_wheel: 1,
              bands: 3,
              bosu_ball: 1,
              kettlebells: 2,
              landmine: 1,
              swiss_ball: 1,
              deadlift_stations: 2,
              medicine_balls: 2,
              dumbbells: "unlimited"
            },
            templateType: 'full_body_bmf'
          }
        });
        
        const systemPrompt = promptBuilder.build();
        
        // Create LLM instance and make the call
        let llmOutput = "Click 'Generate' to see the actual LLM response";
        
        // Initialize workout storage for each client (declare here for proper scope)
        const clientWorkouts = new Map<string, string>(); // clientId -> workoutId
        
        try {
          const llm = createLLM();
          const userMessage = "Generate the group workout assignments for rounds 3 and 4.";
          
          console.log('🤖 Calling LLM for group workout generation...');
          const startTime = Date.now();
          
          const response = await llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(userMessage)
          ]);
          
          const llmTime = Date.now() - startTime;
          console.log(`✅ LLM response received in ${llmTime}ms`);
          
          llmOutput = response.content.toString();
          
          // Parse the JSON from the LLM response
          const jsonMatch = llmOutput.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch?.[1]) {
            const parsedResponse = JSON.parse(jsonMatch[1]) as {
              round3: {
                exercises: Array<{
                  type: 'shared' | 'individual';
                  name?: string;
                  client?: string;
                  exercise?: string;
                  clients?: string[];
                  equipment: string[];
                }>;
                reasoning: string;
              };
              round4: {
                exercises: Array<{
                  type: 'shared' | 'individual';
                  name?: string;
                  client?: string;
                  exercise?: string;
                  clients?: string[];
                  equipment: string[];
                }>;
                reasoning: string;
              };
              finalSlots: Record<string, { used: number; total: number }>;
            };
            console.log('📊 Parsed LLM response:', parsedResponse);
            
            // Save complete workout to database (all rounds together)
            console.log('💾 Saving complete group workout to database...');
            
            await ctx.db.transaction(async (tx) => {
              // First, store the blueprint at the session level
              try {
                // Create a minimal blueprint summary instead of storing the entire blueprint
                // This avoids serialization issues and reduces storage
                const blueprintSummary = {
                  blockCount: blueprint.blocks.length,
                  blockIds: blueprint.blocks.map(b => b.blockId),
                  validationWarnings: blueprint.validationWarnings || [],
                  generatedAt: new Date().toISOString(),
                  llmModel: 'gpt-4o'
                };
                
                await tx
                  .update(TrainingSession)
                  .set({
                    templateConfig: blueprintSummary
                  })
                  .where(eq(TrainingSession.id, input.sessionId));
              } catch (error) {
                console.error('Error storing blueprint summary:', error);
                // Continue without storing blueprint rather than failing entire transaction
              }
              // Prepare all workout records
              const workoutValues = clientsWithPreferences.map(client => ({
                trainingSessionId: input.sessionId,
                userId: client.user_id,
                businessId: user.businessId,
                createdByTrainerId: user.id,
                notes: `${session.templateType || 'BMF'} - ${new Date().toLocaleDateString()}`,
                workoutType: session.templateType || 'full_body_bmf',
                totalPlannedSets: 99,
                llmOutput: JSON.parse(JSON.stringify({
                  systemPrompt,
                  userMessage: "Generate the group workout assignments for rounds 3 and 4.",
                  rawResponse: llmOutput,
                  parsedResponse,
                  llmModel: 'gpt-4o',
                  timestamp: new Date().toISOString()
                })),
                // Blueprint now stored at session level, not in individual workouts
                context: 'group',
              }));
              
              // Bulk insert all workouts at once
              const createdWorkouts = await tx
                .insert(Workout)
                .values(workoutValues)
                .returning();
              
              // Map client IDs to workout IDs
              createdWorkouts.forEach((workout, index) => {
                const client = clientsWithPreferences[index];
                if (client) {
                  clientWorkouts.set(client.user_id, workout.id);
                }
              });
              
              // Now prepare all exercises for all clients
              const allExercises = [];
              
              for (const client of clientsWithPreferences) {
                const workoutId = clientWorkouts.get(client.user_id);
                if (!workoutId) continue;
                
                // Now create all exercises for this client
                const clientExercises = [];
                
                // Round 1
                const r1Assignment = round1Assignments.find(a => a.clientId === client.user_id);
                if (r1Assignment) {
                  const r1Exercise = exercisePool.find(ex => ex.name === r1Assignment.exercise);
                  if (r1Exercise) {
                    clientExercises.push({
                      workoutId: workoutId,
                      exerciseId: r1Exercise.id,
                      orderIndex: 1,
                      setsCompleted: 99,
                      groupName: 'Round 1',
                    });
                  }
                }
                
                // Round 2
                const r2Assignment = round2Assignments.find(a => a.clientId === client.user_id);
                if (r2Assignment) {
                  const r2Exercise = exercisePool.find(ex => ex.name === r2Assignment.exercise);
                  if (r2Exercise) {
                    clientExercises.push({
                      workoutId: workoutId,
                      exerciseId: r2Exercise.id,
                      orderIndex: 2,
                      setsCompleted: 99,
                      groupName: 'Round 2',
                    });
                  }
                }
                
                // Round 3 - merge pre-assigned and LLM-assigned
                const clientR3Exercises = new Set<string>();
                
                // First add pre-assigned R3 exercises
                if (clientRequestAssignments.Round3) {
                  const preAssigned = clientRequestAssignments.Round3.filter(a => a.clientId === client.user_id);
                  for (const assignment of preAssigned) {
                    const exercise = exercisePool.find(ex => ex.name === assignment.exercise);
                    if (exercise) {
                      clientExercises.push({
                        workoutId: workoutId,
                        exerciseId: exercise.id,
                        orderIndex: 3,
                        setsCompleted: 99,
                        groupName: 'Round 3',
                        notes: `Pre-assigned: ${assignment.reason}`,
                      });
                      clientR3Exercises.add(exercise.name.toLowerCase());
                    }
                  }
                }
                
                // Then add LLM-assigned R3 exercises (skip if already pre-assigned)
                for (const exercise of parsedResponse.round3.exercises) {
                  if (exercise.type === 'individual' && exercise.client === client.name) {
                    // Skip if already pre-assigned
                    if (!clientR3Exercises.has((exercise.exercise || '').toLowerCase())) {
                      const dbExercise = exercisePool.find(ex => 
                        ex.name.toLowerCase() === (exercise.exercise || '').toLowerCase()
                      );
                      
                      if (dbExercise) {
                        clientExercises.push({
                          workoutId: workoutId,
                          exerciseId: dbExercise.id,
                          orderIndex: 3,
                          setsCompleted: 99,
                          groupName: 'Round 3',
                        });
                      }
                    }
                  } else if (exercise.type === 'shared' && exercise.clients?.includes(client.name)) {
                    // Skip if already pre-assigned
                    if (!clientR3Exercises.has((exercise.name || '').toLowerCase())) {
                      const dbExercise = exercisePool.find(ex => 
                        ex.name.toLowerCase() === (exercise.name || '').toLowerCase()
                      );
                      
                      if (dbExercise) {
                        clientExercises.push({
                          workoutId: workoutId,
                          exerciseId: dbExercise.id,
                          orderIndex: 3,
                          setsCompleted: 99,
                          groupName: 'Round 3',
                        });
                      }
                    }
                  }
                }
                
                // Round 4 - merge pre-assigned and LLM-assigned
                const clientR4Exercises = new Set<string>();
                
                // First add pre-assigned R4 exercises
                if (clientRequestAssignments.FinalRound) {
                  const preAssigned = clientRequestAssignments.FinalRound.filter(a => a.clientId === client.user_id);
                  for (const assignment of preAssigned) {
                    const exercise = exercisePool.find(ex => ex.name === assignment.exercise);
                    if (exercise) {
                      clientExercises.push({
                        workoutId: workoutId,
                        exerciseId: exercise.id,
                        orderIndex: 4,
                        setsCompleted: 99,
                        groupName: 'Round 4',
                        notes: `Pre-assigned: ${assignment.reason}`,
                      });
                      clientR4Exercises.add(exercise.name.toLowerCase());
                    }
                  }
                }
                
                // Then add LLM-assigned R4 exercises (skip if already pre-assigned)
                for (const exercise of parsedResponse.round4.exercises) {
                  if (exercise.type === 'individual' && exercise.client === client.name) {
                    // Skip if already pre-assigned
                    if (!clientR4Exercises.has((exercise.exercise || '').toLowerCase())) {
                      const dbExercise = exercisePool.find(ex => 
                        ex.name.toLowerCase() === (exercise.exercise || '').toLowerCase()
                      );
                      
                      if (dbExercise) {
                        clientExercises.push({
                          workoutId: workoutId,
                          exerciseId: dbExercise.id,
                          orderIndex: 4,
                          setsCompleted: 99,
                          groupName: 'Round 4',
                        });
                      }
                    }
                  } else if (exercise.type === 'shared' && exercise.clients?.includes(client.name)) {
                    // Skip if already pre-assigned
                    if (!clientR4Exercises.has((exercise.name || '').toLowerCase())) {
                      const dbExercise = exercisePool.find(ex => 
                        ex.name.toLowerCase() === (exercise.name || '').toLowerCase()
                      );
                      
                      if (dbExercise) {
                        clientExercises.push({
                          workoutId: workoutId,
                          exerciseId: dbExercise.id,
                          orderIndex: 4,
                          setsCompleted: 99,
                          groupName: 'Round 4',
                        });
                      }
                    }
                  }
                }
                
                // Add to all exercises array instead of inserting
                allExercises.push(...clientExercises);
              }
              
              // Bulk insert all exercises for all clients at once
              if (allExercises.length > 0) {
                await tx.insert(WorkoutExercise).values(allExercises);
              }
            });
            
            console.log('✅ Complete group workout saved successfully');
          }
          
        } catch (error) {
          console.error('❌ Error calling LLM:', error);
          llmOutput = `Error calling LLM: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
        
        return {
          success: true,
          debug: {
            systemPrompt,
            userMessage: "Generate the group workout assignments for rounds 3 and 4.",
            llmOutput
          },
          sessionId: input.sessionId,
          workoutIds: Array.from(clientWorkouts.entries()).map(([clientId, workoutId]) => ({
            clientId,
            workoutId
          })),
          // Blueprint now stored at session level, not returned in response
        };
      } catch (error) {
        console.error('❌ Error in generateGroupWorkout:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate group workout',
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
            date: TrainingSession.date,
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
              gte(TrainingSession.date, today)
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
            // Generate preference link with network IP for mobile access
            const baseUrl = process.env.NEXTAUTH_URL || 'http://192.168.68.133:3000';
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
                sessionId: session.id,
                isSessionStart: true,
              },
              status: 'sent',
            });

            // Send via Twilio if phone number exists
            if (client.userPhone) {
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
              notes: input.preferences.otherNotes,
              updatedAt: new Date()
            })
            .where(eq(WorkoutPreferences.id, existingPref.id));
        } else {
          // Create new preferences
          await db.insert(WorkoutPreferences).values({
            userId: input.userId,
            trainingSessionId: input.sessionId,
            muscleTargets: input.preferences.muscleFocus || [],
            muscleLessens: input.preferences.muscleAvoidance || [],
            notes: input.preferences.otherNotes,
          });
        }

        // Invalidate blueprint cache
        const { WorkoutBlueprintService } = await import("../services/workout-blueprint-service");
        await WorkoutBlueprintService.invalidateCache(input.sessionId);
        
        // Broadcast update via SSE
        try {
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
          const broadcastUrl = new URL('/api/internal/broadcast-preference', baseUrl);
          
          await fetch(broadcastUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: input.sessionId,
              userId: input.userId,
              preferences: input.preferences
            })
          });
        } catch (error) {
          console.error('Failed to broadcast preference update:', error);
          // Don't fail the mutation if broadcast fails
        }

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
          eq(UserTrainingSession.status, 'checked_in')
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
          eq(UserTrainingSession.status, 'checked_in')
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
            const recommendations = [];
            
            // Get exercise details from database
            const exerciseDetails = await ctx.db
              .select()
              .from(exercises)
              .where(inArray(exercises.name, preferences.includeExercises));
            
            // First exercise is Round1
            const round1Exercise = exerciseDetails.find(e => e.name === preferences.includeExercises[0]);
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
            const round2Exercise = exerciseDetails.find(e => e.name === preferences.includeExercises[1]);
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
            
            // For recommendations, we'll need to generate a blueprint
            // This is handled below in the else block
            return {
              exercises: selections,
              recommendations: recommendations
            };
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
          const selections = [];
          const recommendations = [];
          const round1Block = blueprint.blocks.find(b => b.blockId === 'Round1');
          const round2Block = blueprint.blocks.find(b => b.blockId === 'Round2');
          
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
            
            exerciseList.forEach(exercise => {
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
            
            exerciseList.forEach(exercise => {
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
        const updatedIncludes = [...currentIncludes];
        
        // Round1 = index 0, Round2 = index 1
        const roundIndex = input.round === 'Round1' ? 0 : 1;
        updatedIncludes[roundIndex] = input.newExerciseName;
        
        await ctx.db
          .update(WorkoutPreferences)
          .set({ 
            includeExercises: updatedIncludes,
            updatedAt: new Date()
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
            notes: input.preferences.otherNotes,
            updatedAt: new Date()
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
          notes: input.preferences.otherNotes,
        });
      }

      // Invalidate blueprint cache
      const { WorkoutBlueprintService } = await import("../services/workout-blueprint-service");
      await WorkoutBlueprintService.invalidateCache(input.sessionId);
      
      // Broadcast update via SSE
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const broadcastUrl = new URL('/api/internal/broadcast-preference', baseUrl);
        
        await fetch(broadcastUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: input.sessionId,
            userId: input.userId,
            preferences: input.preferences
          })
        });
      } catch (error) {
        console.error('Failed to broadcast preference update:', error);
        // Don't fail the mutation if broadcast fails
      }

      return { success: true };
    }),
} satisfies TRPCRouterRecord;