import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";

import { desc, eq, and, gte, lte, or, sql } from "@acme/db";
import { 
  TrainingSession, 
  UserTrainingSession,
  WorkoutPreferences,
  CreateTrainingSessionSchema,
  CreateUserTrainingSessionSchema,
  user as userTable,
  exercises
} from "@acme/db/schema";
import { 
  generateGroupWorkoutBlueprint,
  type GroupContext,
  type ClientContext,
  type GroupCohesionSettings,
  type ClientGroupSettings,
  type ScoredExercise,
  type Exercise
} from "@acme/ai";

import { protectedProcedure } from "../trpc";
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

export const trainingSessionRouter = {
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
      const goalOptions = ['strength', 'stability', 'endurance'];
      
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
        let randomMuscleTargets = [];
        if (addedClients.length === 0 && muscleOptions.includes('upper_back')) {
          // First client gets specific settings for testing
          randomIntensity = 'moderate'; // Force moderate intensity
          randomMuscleTargets.push('upper_back');
          // Maybe add a second muscle target (50% chance)
          if (Math.random() < 0.5) {
            const otherMuscles = muscleOptions.filter(m => m !== 'upper_back' && m !== 'calves');
            if (otherMuscles.length > 0) {
              randomMuscleTargets.push(otherMuscles[Math.floor(Math.random() * otherMuscles.length)]);
            }
          }
        } else {
          // Other clients get random muscle targets
          const numMuscleTargets = Math.floor(Math.random() * 2) + 1;
          for (let i = 0; i < numMuscleTargets; i++) {
            const muscle = muscleOptions[Math.floor(Math.random() * muscleOptions.length)];
            if (!randomMuscleTargets.includes(muscle)) {
              randomMuscleTargets.push(muscle);
            }
          }
        }
        
        // Sometimes add muscle lessens (30% chance)
        let randomMuscleLessens = [];
        if (addedClients.length === 0 && muscleOptions.includes('calves')) {
          // First client always gets calves as muscle lessen for testing
          randomMuscleLessens = ['calves'];
        } else if (Math.random() < 0.3 && muscleOptions.length > 0) {
          // Other clients: Pick a muscle that's not already in targets
          const availableMusclesForLessen = muscleOptions.filter(m => !randomMuscleTargets.includes(m));
          if (availableMusclesForLessen.length > 0) {
            randomMuscleLessens = [availableMusclesForLessen[Math.floor(Math.random() * availableMusclesForLessen.length)]];
          }
        }
        
        // Sometimes add joint avoidance (20% chance)
        const randomAvoidJoints = Math.random() < 0.2
          ? [jointOptions[Math.floor(Math.random() * jointOptions.length)]]
          : [];
        
        // Sometimes add exercise preferences (40% chance for includes, 30% for avoids)
        const randomIncludeExercises = Math.random() < 0.4 && exerciseNames.length > 0
          ? [exerciseNames[Math.floor(Math.random() * exerciseNames.length)]]
          : [];
          
        let randomAvoidExercises = [];
        if (Math.random() < 0.3 && exerciseNames.length > 1) {
          // Pick an exercise that's not already in includes
          const availableExercisesForAvoid = exerciseNames.filter(e => !randomIncludeExercises.includes(e));
          if (availableExercisesForAvoid.length > 0) {
            randomAvoidExercises = [availableExercisesForAvoid[Math.floor(Math.random() * availableExercisesForAvoid.length)]];
          }
        }
        
        // Insert preferences
        await ctx.db
          .insert(WorkoutPreferences)
          .values({
            userId: client.id,
            trainingSessionId: input.sessionId,
            businessId: user.businessId,
            intensity: randomIntensity as "low" | "moderate" | "high",
            muscleTargets: randomMuscleTargets,
            muscleLessens: randomMuscleLessens.length > 0 ? randomMuscleLessens : null,
            includeExercises: randomIncludeExercises.length > 0 ? randomIncludeExercises : null,
            avoidExercises: randomAvoidExercises.length > 0 ? randomAvoidExercises : null,
            avoidJoints: randomAvoidJoints.length > 0 ? randomAvoidJoints : null,
            sessionGoal: randomGoal,
            intensitySource: 'explicit',
            sessionGoalSource: 'explicit',
            collectionMethod: 'manual',
          });
        
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
      
      // Get preferences for each client separately
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
          return { ...client, preferences };
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
      const { ExerciseFilterService } = await import("../services/exercise-filter-service");
      const { groupWorkoutTestDataLogger } = await import("../utils/groupWorkoutTestDataLogger");
      const filterService = new ExerciseFilterService(ctx.db);
      
      // Create default cohesion settings (50% shared across all blocks)
      const cohesionSettings: GroupCohesionSettings = {
        blockSettings: {
          'A': { sharedRatio: 0.5, enforceShared: false },
          'B': { sharedRatio: 0.5, enforceShared: false },
          'C': { sharedRatio: 0.5, enforceShared: false },
          'D': { sharedRatio: 0.5, enforceShared: false },
        },
        defaultSharedRatio: 0.5,
      };
      
      // Create default client group settings (all clients want 50% shared)
      const clientGroupSettings: ClientGroupSettings = {};
      for (const client of clientsWithPreferences) {
        clientGroupSettings[client.userId] = { cohesionRatio: 0.5 };
      }
      
      // Create initial GroupContext for logging
      const initialGroupContext: GroupContext = {
        clients: [], // Will be populated after processing
        groupCohesionSettings: cohesionSettings,
        clientGroupSettings: clientGroupSettings,
        sessionId: input.sessionId,
        businessId: user.businessId,
        templateType: 'workout',
      };
      
      // Initialize test data logging
      const testData = groupWorkoutTestDataLogger.initGroupSession(input.sessionId, initialGroupContext);
      
      console.log('💪 Running Phase 1 & 2 for each client...');
      
      const phase1_2StartTime = Date.now();
      
      // Process each client through Phase 1 & 2 in parallel
      const clientProcessingResults = await Promise.all(
        clientsWithPreferences.map(async (client) => {
          const prefs = client.preferences;
          const clientStartTime = Date.now();
          
          // Create filter input matching the expected format
          const filterInput = {
            clientId: client.userId,
            clientName: client.userName || client.userEmail,
            strengthCapacity: 'moderate' as const, // Would need to get from profile
            skillCapacity: 'moderate' as const, // Would need to get from profile
            sessionGoal: (prefs?.sessionGoal as 'strength' | 'stability') || 'strength',
            intensity: (prefs?.intensity as 'low' | 'moderate' | 'high') || 'moderate',
            template: 'standard' as const, // Using same template for all
            includeExercises: prefs?.includeExercises || [],
            avoidExercises: prefs?.avoidExercises || [],
            muscleTarget: prefs?.muscleTargets || [],
            muscleLessen: prefs?.muscleLessens || [],
            avoidJoints: prefs?.avoidJoints || [],
            debug: true, // Enable debug for visibility
          };
          
          console.log(`  📋 Processing client ${client.userName || client.userId}...`);
          
          // Run Phase 1 & 2 using the filter service
          const filteredResult = await filterService.filterForWorkoutGeneration(filterInput, {
            userId: user.id,
            businessId: user.businessId
          });
          
          const clientProcessingTime = Date.now() - clientStartTime;
          
          console.log(`  ✅ Client ${client.userName}: ${filteredResult.exercises.length} exercises filtered & scored`);
          
          // Log client processing data
          groupWorkoutTestDataLogger.logClientProcessing(
            input.sessionId,
            client.userId,
            client.userName || client.userEmail,
            prefs,
            {
              totalExercises: filteredResult.totalExercises || 1000, // Approximate
              filteredCount: filteredResult.exercises.length,
              excludedReasons: filteredResult.excludedReasons || {},
              timingMs: clientProcessingTime
            },
            {
              scoredCount: filteredResult.exercises.length,
              scoreDistribution: calculateScoreDistribution(filteredResult.exercises),
              topExercises: filteredResult.exercises.slice(0, 10).map(ex => ({
                id: ex.id,
                name: ex.name,
                score: ex.score,
                scoreBreakdown: ex.scoreBreakdown
              })),
              timingMs: clientProcessingTime // Combined time for this implementation
            }
          );
          
          // Create ClientContext for group processing
          const clientContext: ClientContext = {
            user_id: client.userId,
            name: client.userName || client.userEmail,
            strength_capacity: filterInput.strengthCapacity,
            skill_capacity: filterInput.skillCapacity,
            intensity: filterInput.intensity,
            primary_goal: filterInput.sessionGoal,
            muscle_target: filterInput.muscleTarget,
            muscle_lessen: filterInput.muscleLessen,
            avoid_exercises: filterInput.avoidExercises,
            exercise_requests: filterInput.includeExercises,
            avoid_joints: filterInput.avoidJoints,
          };
          
          return {
            clientContext,
            filteredExercises: filteredResult.exercises, // These are already scored
          };
        })
      );
      
      const phase1_2Time = Date.now() - phase1_2StartTime;
      groupWorkoutTestDataLogger.updateTiming(input.sessionId, 'phase1_2', phase1_2Time);
      
      // Extract client contexts and create pre-scored exercise map
      const clientContexts = clientProcessingResults.map(r => r.clientContext);
      const preScoredExercises = new Map<string, ScoredExercise[]>();
      
      // Build the pre-scored exercises map and collect unique exercises WITHOUT scores
      const allFilteredExercises = new Map<string, any>();
      for (const result of clientProcessingResults) {
        preScoredExercises.set(result.clientContext.user_id, result.filteredExercises);
        for (const exercise of result.filteredExercises) {
          // Only add the exercise if we haven't seen it before
          // This prevents overwriting with different client's scores
          if (!allFilteredExercises.has(exercise.id)) {
            // Strip the score to create a clean exercise for the pool
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { score, scoreBreakdown, ...cleanExercise } = exercise;
            allFilteredExercises.set(exercise.id, cleanExercise as Exercise);
          }
        }
      }
      const exercisePool = Array.from(allFilteredExercises.values());
      
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
      
      // Create GroupContext
      const groupContext: GroupContext = {
        clients: clientContexts,
        groupCohesionSettings: cohesionSettings,
        clientGroupSettings: clientGroupSettings,
        sessionId: input.sessionId,
        businessId: user.businessId,
        templateType: 'workout',
      };
      
      // Run Phase A & B to generate blueprint
      console.log('🚀 Running Phase A & B with GroupContext:', {
        clientCount: groupContext.clients.length,
        templateType: groupContext.templateType,
        cohesionSettings: groupContext.groupCohesionSettings
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
} satisfies TRPCRouterRecord;