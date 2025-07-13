import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";

import { desc, eq, and, sql } from "@acme/db";
import { 
  Workout,
  WorkoutExercise,
  TrainingSession,
  UserTrainingSession,
  exercises,
  CreateWorkoutSchema,
  CreateWorkoutExerciseSchema,
  user
} from "@acme/db/schema";

import { protectedProcedure } from "../trpc";
import type { SessionUser } from "../types/auth";
import { 
  transformLLMOutputToDB, 
  validateExerciseLookup,
  type LLMWorkoutOutput 
} from "@acme/ai/workout-generation/transformers/workoutTransformer";

export const workoutRouter = {
  // Create a workout for a training session
  create: protectedProcedure
    .input(CreateWorkoutSchema.extend({
      exercises: z.array(z.object({
        exerciseId: z.string().uuid(),
        orderIndex: z.number().int().min(1),
        setsCompleted: z.number().int().min(1),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user as SessionUser;
      
      // Verify the training session exists and belongs to user's business
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.trainingSessionId),
          eq(TrainingSession.businessId, currentUser.businessId)
        ),
      });
      
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Training session not found',
        });
      }
      
      // Verify user is registered for this session (unless they're the trainer)
      if (currentUser.id !== session.trainerId) {
        const registration = await ctx.db.query.UserTrainingSession.findFirst({
          where: and(
            eq(UserTrainingSession.userId, input.userId || currentUser.id),
            eq(UserTrainingSession.trainingSessionId, input.trainingSessionId)
          ),
        });
        
        if (!registration) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'User must be registered for the session to log a workout',
          });
        }
      }
      
      // Trainers can log workouts for any user in their business
      // Users can only log their own workouts
      const targetUserId = input.userId || currentUser.id;
      if (targetUserId !== currentUser.id && currentUser.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only log your own workouts',
        });
      }
      
      // Use transaction to create workout and exercises atomically
      const result = await ctx.db.transaction(async (tx) => {
        // Create workout
        const [workout] = await tx
          .insert(Workout)
          .values({
            trainingSessionId: input.trainingSessionId,
            userId: targetUserId,
            completedAt: input.completedAt,
            notes: input.notes,
          })
          .returning();
          
        // Create workout exercises if provided
        if (input.exercises && input.exercises.length > 0) {
          await tx
            .insert(WorkoutExercise)
            .values(
              input.exercises.map(ex => ({
                workoutId: workout.id,
                exerciseId: ex.exerciseId,
                orderIndex: ex.orderIndex,
                setsCompleted: ex.setsCompleted,
              }))
            );
        }
        
        return workout;
      });
      
      return result;
    }),

  // Add exercises to an existing workout
  addExercises: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      exercises: z.array(z.object({
        exerciseId: z.string().uuid(),
        orderIndex: z.number().int().min(1),
        setsCompleted: z.number().int().min(1),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user as SessionUser;
      
      // Verify workout exists and user has access
      const workout = await ctx.db
        .select({
          workout: Workout,
          trainingSession: TrainingSession,
        })
        .from(Workout)
        .innerJoin(TrainingSession, eq(Workout.trainingSessionId, TrainingSession.id))
        .where(eq(Workout.id, input.workoutId))
        .limit(1);
      
      const workoutData = workout[0];
      
      if (!workoutData) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workout not found',
        });
      }
      
      // Check business scope
      if (workoutData.trainingSession.businessId !== currentUser.businessId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }
      
      // Only workout owner or trainer can add exercises
      if (workoutData.workout.userId !== currentUser.id && currentUser.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only modify your own workouts',
        });
      }
      
      const results = await ctx.db
        .insert(WorkoutExercise)
        .values(
          input.exercises.map(ex => ({
            workoutId: input.workoutId,
            exerciseId: ex.exerciseId,
            orderIndex: ex.orderIndex,
            setsCompleted: ex.setsCompleted,
          }))
        )
        .returning();
        
      return results;
    }),

  // Get user's workout history
  myWorkouts: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user as SessionUser;
      
      const workouts = await ctx.db
        .select({
          workout: Workout,
          trainingSession: {
            id: TrainingSession.id,
            name: TrainingSession.name,
            scheduledAt: TrainingSession.scheduledAt,
            trainerId: TrainingSession.trainerId,
          },
          exerciseCount: sql<number>`count(${WorkoutExercise.id})::int`,
        })
        .from(Workout)
        .innerJoin(TrainingSession, eq(Workout.trainingSessionId, TrainingSession.id))
        .leftJoin(WorkoutExercise, eq(WorkoutExercise.workoutId, Workout.id))
        .where(and(
          eq(Workout.userId, currentUser.id),
          eq(TrainingSession.businessId, currentUser.businessId)
        ))
        .groupBy(Workout.id, TrainingSession.id, TrainingSession.name, TrainingSession.scheduledAt, TrainingSession.trainerId)
        .orderBy(desc(Workout.completedAt))
        .limit(input.limit)
        .offset(input.offset);
        
      return workouts;
    }),

  // Get a specific workout with exercises
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user as SessionUser;
      
      // Get workout with session info
      const workoutResult = await ctx.db
        .select({
          workout: Workout,
          trainingSession: TrainingSession,
        })
        .from(Workout)
        .innerJoin(TrainingSession, eq(Workout.trainingSessionId, TrainingSession.id))
        .where(eq(Workout.id, input.id))
        .limit(1);
      
      const workout = workoutResult[0];
      
      if (!workout) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workout not found',
        });
      }
      
      // Check business scope
      if (workout.trainingSession.businessId !== currentUser.businessId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }
      
      // Check access: user can see their own workouts, trainers can see all
      if (workout.workout.userId !== currentUser.id && currentUser.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only view your own workouts',
        });
      }
      
      // Get exercises for this workout
      const workoutExercises = await ctx.db
        .select({
          id: WorkoutExercise.id,
          orderIndex: WorkoutExercise.orderIndex,
          setsCompleted: WorkoutExercise.setsCompleted,
          exercise: {
            id: exercises.id,
            name: exercises.name,
            primaryMuscle: exercises.primaryMuscle,
            movementPattern: exercises.movementPattern,
          },
        })
        .from(WorkoutExercise)
        .innerJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .where(eq(WorkoutExercise.workoutId, input.id))
        .orderBy(WorkoutExercise.orderIndex);
        
      return {
        ...workout.workout,
        trainingSession: workout.trainingSession,
        exercises: workoutExercises,
      };
    }),

  // Trainer views client's workouts
  clientWorkouts: protectedProcedure
    .input(z.object({
      clientId: z.string(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user as SessionUser;
      
      // Only trainers can view other users' workouts
      if (currentUser.role !== 'trainer') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only trainers can view client workouts',
        });
      }
      
      // Verify client belongs to same business
      const client = await ctx.db.query.user.findFirst({
        where: eq(user.id, input.clientId),
      });
      
      if (!client || client.businessId !== currentUser.businessId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found in your business',
        });
      }
      
      const workouts = await ctx.db
        .select({
          workout: Workout,
          trainingSession: {
            id: TrainingSession.id,
            name: TrainingSession.name,
            scheduledAt: TrainingSession.scheduledAt,
          },
          exerciseCount: sql<number>`count(${WorkoutExercise.id})::int`,
        })
        .from(Workout)
        .innerJoin(TrainingSession, eq(Workout.trainingSessionId, TrainingSession.id))
        .leftJoin(WorkoutExercise, eq(WorkoutExercise.workoutId, Workout.id))
        .where(and(
          eq(Workout.userId, input.clientId),
          eq(TrainingSession.businessId, currentUser.businessId)
        ))
        .groupBy(Workout.id, TrainingSession.id, TrainingSession.name, TrainingSession.scheduledAt)
        .orderBy(desc(Workout.completedAt))
        .limit(input.limit)
        .offset(input.offset);
        
      return workouts;
    }),

  // Get all workouts for a training session
  sessionWorkouts: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user as SessionUser;
      
      // Verify session belongs to user's business
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.sessionId),
          eq(TrainingSession.businessId, currentUser.businessId)
        ),
      });
      
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Training session not found',
        });
      }
      
      // Trainers can see all workouts, users can only see their own
      const conditions = [eq(Workout.trainingSessionId, input.sessionId)];
      if (currentUser.role !== 'trainer') {
        conditions.push(eq(Workout.userId, currentUser.id));
      }
      
      const workouts = await ctx.db
        .select({
          workout: Workout,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
          exerciseCount: sql<number>`count(${WorkoutExercise.id})::int`,
        })
        .from(Workout)
        .innerJoin(user, eq(Workout.userId, user.id))
        .leftJoin(WorkoutExercise, eq(WorkoutExercise.workoutId, Workout.id))
        .where(and(...conditions))
        .groupBy(Workout.id, user.id, user.name, user.email)
        .orderBy(desc(Workout.completedAt));
        
      return workouts;
    }),

  // Save LLM-generated workout
  saveWorkout: protectedProcedure
    .input(z.object({
      trainingSessionId: z.string().uuid(),
      userId: z.string(), // Client user ID
      llmOutput: z.any(), // Raw LLM response
      workoutType: z.string().optional(), // Optional, will be extracted from transformer
      workoutName: z.string().optional(),
      workoutDescription: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user as SessionUser;
      
      // Verify the training session exists and belongs to user's business
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(
          eq(TrainingSession.id, input.trainingSessionId),
          eq(TrainingSession.businessId, currentUser.businessId)
        ),
      });
      
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Training session not found',
        });
      }
      
      // Verify client belongs to same business
      const client = await ctx.db.query.user.findFirst({
        where: eq(user.id, input.userId),
      });
      
      if (!client || client.businessId !== currentUser.businessId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found in your business',
        });
      }
      
      // Get all exercises for lookup
      const allExercises = await ctx.db.query.exercises.findMany();
      const exerciseLookup = new Map(allExercises.map(ex => [ex.id, ex]));
      
      // Validate exercises in LLM output
      const validation = validateExerciseLookup(input.llmOutput as LLMWorkoutOutput, exerciseLookup);
      if (!validation.valid) {
        console.warn('Some exercises not found:', validation.warnings);
      }
      
      // Transform LLM output to database format
      const transformed = await transformLLMOutputToDB(
        input.llmOutput as LLMWorkoutOutput,
        exerciseLookup,
        input.workoutType || 'standard',
        input.workoutName,
        input.workoutDescription || `Generated by AI for ${client.name}`
      );
      
      // Use transaction to create workout and exercises atomically
      const result = await ctx.db.transaction(async (tx) => {
        // Create workout with transformed data
        const [workout] = await tx
          .insert(Workout)
          .values({
            trainingSessionId: input.trainingSessionId,
            userId: input.userId,
            completedAt: new Date(), // LLM-generated workouts are marked as completed
            notes: transformed.workout.description,
            workoutType: transformed.workout.workoutType,
            totalPlannedSets: transformed.workout.totalPlannedSets,
            llmOutput: transformed.workout.llmOutput,
            templateConfig: transformed.workout.templateConfig,
          })
          .returning();
          
        // Create workout exercises with groupName
        if (transformed.exercises.length > 0) {
          const exerciseData = transformed.exercises
            .filter(ex => ex.exerciseId !== 'unknown') // Skip unknown exercises
            .map(ex => ({
              workoutId: workout.id,
              exerciseId: ex.exerciseId,
              orderIndex: ex.orderIndex,
              setsCompleted: ex.sets,
              groupName: ex.groupName,
              // Store additional info in notes for now
              notes: [
                ex.reps && `Reps: ${ex.reps}`,
                ex.restPeriod && `Rest: ${ex.restPeriod}`,
                ex.notes
              ].filter(Boolean).join(' | ') || undefined,
            }));
          
          if (exerciseData.length > 0) {
            await tx.insert(WorkoutExercise).values(exerciseData);
          }
        }
        
        return workout;
      });
      
      return result;
    }),
} satisfies TRPCRouterRecord;