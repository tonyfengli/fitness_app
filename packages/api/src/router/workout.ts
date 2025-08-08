import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { desc, eq, and, sql, inArray } from "@acme/db";
import { 
  Workout,
  WorkoutExercise,
  TrainingSession,
  UserTrainingSession,
  exercises,
  BusinessExercise,
  CreateWorkoutSchema,
  CreateWorkoutExerciseSchema,
  user
} from "@acme/db/schema";

import { protectedProcedure, publicProcedure } from "../trpc";
import type { SessionUser } from "../types/auth";
import { type LLMWorkoutOutput } from "@acme/ai";
import { WorkoutService } from "../services/workout-service";
import { LLMWorkoutService } from "../services/llm-workout-service";
import { ExerciseService } from "../services/exercise-service";
import { requireBusinessContext, verifyClientInBusiness, requireTrainerRole } from "../utils/validation";
import { getWorkoutsWithExercisesOptimized, withPerformanceMonitoring } from "../utils/query-helpers";
import { getSessionUser, getSessionUserWithBusiness, getTrainerUser } from "../utils/session";

export const workoutRouter = {
  // Create a workout for a training session
  create: protectedProcedure
    .input(z.object({
      trainingSessionId: z.string().uuid(), // Required for this endpoint
      userId: z.string().optional(),
      completedAt: z.date(),
      notes: z.string().optional(),
      exercises: z.array(z.object({
        exerciseId: z.string().uuid(),
        orderIndex: z.number().int().min(1),
        setsCompleted: z.number().int().min(1),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = getSessionUserWithBusiness(ctx);
      const businessId = currentUser.businessId;
      const workoutService = new WorkoutService(ctx.db);
      
      // Verify the training session
      const session = await workoutService.verifyTrainingSession(
        input.trainingSessionId,
        businessId
      );
      
      // Verify user is registered for this session (unless they're the trainer)
      const targetUserId = input.userId || currentUser.id;
      if (currentUser.id !== session.trainerId) {
        await workoutService.verifyUserRegistration(
          targetUserId,
          input.trainingSessionId,
          session.trainerId
        );
      }
      
      // Verify permission to log workouts
      workoutService.verifyWorkoutPermission(targetUserId, currentUser);
      
      // Create workout using service
      const workout = await workoutService.createWorkoutForSession({
        trainingSessionId: input.trainingSessionId,
        userId: targetUserId,
        businessId,
        createdByTrainerId: currentUser.id,
        completedAt: input.completedAt,
        notes: input.notes,
        exercises: input.exercises,
      });
      
      return workout;
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
      const currentUser = getSessionUser(ctx);
      
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
      
      // Additional check for trainers - ensure they can only modify workouts for their business
      if (currentUser.role === 'trainer' && workoutData.trainingSession.businessId !== currentUser.businessId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only modify workouts within your business',
        });
      }
      
      // Use transaction for inserting multiple exercises
      const results = await ctx.db.transaction(async (tx) => {
        // Validate all exercises exist and belong to the business
        const exerciseIds = input.exercises.map(ex => ex.exerciseId);
        const validExercises = await tx
          .select({ id: exercises.id })
          .from(exercises)
          .innerJoin(BusinessExercise, eq(exercises.id, BusinessExercise.exerciseId))
          .where(and(
            eq(BusinessExercise.businessId, currentUser.businessId),
            inArray(exercises.id, exerciseIds)
          ));
        
        if (validExercises.length !== exerciseIds.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'One or more exercises are invalid or not available for your business',
          });
        }
        
        // Insert all exercises
        return await tx
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
      });
        
      return results;
    }),

  // Get user's workout history
  myWorkouts: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const currentUser = getSessionUser(ctx);
      
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
      const currentUser = getSessionUser(ctx);
      
      // Get workout (with optional session info)
      const workoutResult = await ctx.db
        .select({
          workout: Workout,
          trainingSession: TrainingSession,
        })
        .from(Workout)
        .leftJoin(TrainingSession, eq(Workout.trainingSessionId, TrainingSession.id))
        .where(eq(Workout.id, input.id))
        .limit(1);
      
      const workout = workoutResult[0];
      
      if (!workout) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workout not found',
        });
      }
      
      // Check business scope - use workout's businessId directly
      if (workout.workout.businessId !== currentUser.businessId) {
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
      
      // Get exercises for this workout with groupName
      const workoutExercises = await ctx.db
        .select({
          id: WorkoutExercise.id,
          orderIndex: WorkoutExercise.orderIndex,
          setsCompleted: WorkoutExercise.setsCompleted,
          groupName: WorkoutExercise.groupName,
          createdAt: WorkoutExercise.createdAt,
          exercise: {
            id: exercises.id,
            name: exercises.name,
            primaryMuscle: exercises.primaryMuscle,
            secondaryMuscles: exercises.secondaryMuscles,
            movementPattern: exercises.movementPattern,
            modality: exercises.modality,
            equipment: exercises.equipment,
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
      const currentUser = getTrainerUser(ctx);
      
      // Verify client belongs to same business
      const client = await verifyClientInBusiness(
        ctx.db,
        input.clientId,
        currentUser.businessId
      );
      
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
      const currentUser = getSessionUser(ctx);
      
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

  // Get session workouts with exercises included (optimized version)
  sessionWorkoutsWithExercises: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const currentUser = getSessionUser(ctx);
      
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
      
      // First get all workouts for the session
      const workouts = await ctx.db
        .select({
          workout: Workout,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        })
        .from(Workout)
        .innerJoin(user, eq(Workout.userId, user.id))
        .where(and(...conditions))
        .orderBy(desc(Workout.createdAt));
      
      // Get all workout IDs
      const workoutIds = workouts.map(w => w.workout.id);
      
      if (workoutIds.length === 0) {
        return [];
      }
      
      // Fetch all exercises for all workouts in one query
      const allExercises = await ctx.db
        .select({
          workoutId: WorkoutExercise.workoutId,
          id: WorkoutExercise.id,
          orderIndex: WorkoutExercise.orderIndex,
          setsCompleted: WorkoutExercise.setsCompleted,
          groupName: WorkoutExercise.groupName,
          exercise: {
            id: exercises.id,
            name: exercises.name,
            primaryMuscle: exercises.primaryMuscle,
            equipment: exercises.equipment,
          },
        })
        .from(WorkoutExercise)
        .innerJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .where(inArray(WorkoutExercise.workoutId, workoutIds))
        .orderBy(WorkoutExercise.workoutId, WorkoutExercise.orderIndex);
      
      // Group exercises by workout ID
      const exercisesByWorkout = allExercises.reduce((acc, exercise) => {
        if (!acc[exercise.workoutId]) {
          acc[exercise.workoutId] = [];
        }
        acc[exercise.workoutId]!.push({
          workoutId: exercise.workoutId,
          id: exercise.id,
          orderIndex: exercise.orderIndex,
          setsCompleted: exercise.setsCompleted,
          groupName: exercise.groupName,
          exercise: exercise.exercise,
        });
        return acc;
      }, {} as Record<string, typeof allExercises>);
      
      // Combine workouts with their exercises
      return workouts.map(w => ({
        ...w,
        exercises: exercisesByWorkout[w.workout.id] || [],
        exerciseCount: exercisesByWorkout[w.workout.id]?.length || 0,
      }));
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
      const currentUser = getSessionUserWithBusiness(ctx);
      const businessId = currentUser.businessId;
      
      // Use WorkoutService for session validation
      const workoutService = new WorkoutService(ctx.db);
      await workoutService.verifyTrainingSession(
        input.trainingSessionId,
        businessId
      );
      
      // Use validation utility for client verification
      const client = await verifyClientInBusiness(
        ctx.db,
        input.userId,
        businessId
      );
      
      // Use LLMWorkoutService to save the workout
      const llmWorkoutService = new LLMWorkoutService(ctx.db);
      const result = await llmWorkoutService.saveWorkout({
        trainingSessionId: input.trainingSessionId,
        userId: input.userId,
        businessId,
        createdByTrainerId: currentUser.id,
        llmOutput: input.llmOutput as LLMWorkoutOutput,
        workoutType: input.workoutType,
        workoutName: input.workoutName,
        workoutDescription: input.workoutDescription,
      }, client.name);
      
      return result;
    }),

  // Get client's latest workouts with exercises for trainer dashboard
  getClientWorkoutsWithExercises: protectedProcedure
    .input(z.object({
      clientId: z.string(),
      limit: z.number().min(1).max(10).default(3),
    }))
    .query(async ({ ctx, input }) => {
      const currentUser = getSessionUser(ctx);
      
      // Only trainers can view other users' workouts
      requireTrainerRole(currentUser);
      
      // Verify client belongs to same business
      const client = await verifyClientInBusiness(
        ctx.db,
        input.clientId,
        currentUser.businessId
      );
      
      // Use optimized query with performance monitoring
      const workoutsWithExercises = await withPerformanceMonitoring(
        'getClientWorkoutsWithExercises',
        () => getWorkoutsWithExercisesOptimized(ctx.db, {
          userId: input.clientId,
          businessId: currentUser.businessId,
          limit: input.limit,
        })
      );
      
      return workoutsWithExercises;
    }),

  // Generate individual workout (no training session required)
  generateIndividual: protectedProcedure
    .input(z.object({
      userId: z.string(), // Client user ID
      templateType: z.enum(["standard", "circuit", "full_body"]),
      exercises: z.record(z.any()), // LLM output object with blocks
      workoutName: z.string().optional(),
      workoutDescription: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = getSessionUserWithBusiness(ctx);
      
      // Verify client belongs to same business
      const client = await verifyClientInBusiness(
        ctx.db,
        input.userId,
        currentUser.businessId
      );
      
      // Use LLMWorkoutService to save the workout
      const llmWorkoutService = new LLMWorkoutService(ctx.db);
      
      // Use the new individual workout method
      const result = await llmWorkoutService.saveIndividualWorkout({
        userId: input.userId,
        businessId: currentUser.businessId,
        createdByTrainerId: currentUser.id,
        llmOutput: input.exercises as LLMWorkoutOutput,
        workoutType: input.templateType,
        workoutName: input.workoutName,
        workoutDescription: input.workoutDescription || `Individual workout for ${client.name || client.email}`,
        templateType: input.templateType,
        context: "individual",
      }, client.name);
      
      return result;
    }),

  // Delete a specific exercise from a workout
  deleteExercise: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      workoutExerciseId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = getSessionUser(ctx);
      
      // Verify workout exists and user has access
      const workoutService = new WorkoutService(ctx.db);
      await workoutService.verifyWorkoutAccess(
        input.workoutId,
        currentUser.businessId
      );
      
      // Use transaction to delete and reorder
      await ctx.db.transaction(async (tx) => {
        // First, get the exercise to delete to know its group and orderIndex
        const exerciseToDelete = await tx.query.WorkoutExercise.findFirst({
          where: and(
            eq(WorkoutExercise.id, input.workoutExerciseId),
            eq(WorkoutExercise.workoutId, input.workoutId)
          ),
        });
        
        if (!exerciseToDelete) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Exercise not found in workout',
          });
        }
        
        // Delete the exercise
        await tx.delete(WorkoutExercise)
          .where(eq(WorkoutExercise.id, input.workoutExerciseId));
        
        // Only update exercises in the same group that come after the deleted one
        // This is more efficient as it only updates what's necessary
        if (exerciseToDelete.groupName !== null) {
          await tx.update(WorkoutExercise)
            .set({ orderIndex: sql`${WorkoutExercise.orderIndex} - 1` })
            .where(and(
              eq(WorkoutExercise.workoutId, input.workoutId),
              eq(WorkoutExercise.groupName, exerciseToDelete.groupName),
              sql`${WorkoutExercise.orderIndex} > ${exerciseToDelete.orderIndex}`
            ));
        } else {
          // Handle case where groupName is null
          await tx.update(WorkoutExercise)
            .set({ orderIndex: sql`${WorkoutExercise.orderIndex} - 1` })
            .where(and(
              eq(WorkoutExercise.workoutId, input.workoutId),
              sql`${WorkoutExercise.groupName} IS NULL`,
              sql`${WorkoutExercise.orderIndex} > ${exerciseToDelete.orderIndex}`
            ));
        }
      });
      
      return { success: true };
    }),

  // Update exercise order within the same block
  updateExerciseOrder: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      workoutExerciseId: z.string().uuid(),
      direction: z.enum(['up', 'down'])
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = getSessionUser(ctx);
      
      // Verify workout exists and user has access
      const workoutService = new WorkoutService(ctx.db);
      await workoutService.verifyWorkoutAccess(
        input.workoutId,
        currentUser.businessId
      );
      
      // Get all exercises for this workout
      const workoutExercises = await ctx.db.query.WorkoutExercise.findMany({
        where: eq(WorkoutExercise.workoutId, input.workoutId),
        orderBy: [WorkoutExercise.orderIndex],
      });
      
      // Find the exercise to move
      const exerciseIndex = workoutExercises.findIndex(ex => ex.id === input.workoutExerciseId);
      if (exerciseIndex === -1) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Exercise not found in workout',
        });
      }
      
      const exercise = workoutExercises[exerciseIndex];
      if (!exercise) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Exercise not found in workout',
        });
      }
      
      // Find exercises in the same group
      const groupExercises = workoutExercises
        .filter(ex => ex.groupName === exercise.groupName)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      
      const currentGroupIndex = groupExercises.findIndex(ex => ex.id === input.workoutExerciseId);
      const targetGroupIndex = input.direction === 'up' ? currentGroupIndex - 1 : currentGroupIndex + 1;
      
      // Check if move is valid
      if (targetGroupIndex < 0 || targetGroupIndex >= groupExercises.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot move exercise ${input.direction} - already at boundary`,
        });
      }
      
      // Swap the exercises
      const targetExercise = groupExercises[targetGroupIndex];
      if (!targetExercise) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Target exercise not found',
        });
      }
      
      await ctx.db.transaction(async (tx) => {
        // Swap orderIndex values
        await tx.update(WorkoutExercise)
          .set({ orderIndex: targetExercise.orderIndex })
          .where(eq(WorkoutExercise.id, exercise.id));
          
        await tx.update(WorkoutExercise)
          .set({ orderIndex: exercise.orderIndex })
          .where(eq(WorkoutExercise.id, targetExercise.id));
      });
      
      return { success: true };
    }),

  // Delete all exercises in a block/group
  deleteBlock: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      groupName: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = getSessionUser(ctx);
      
      // Verify workout exists and user has access
      const workoutService = new WorkoutService(ctx.db);
      await workoutService.verifyWorkoutAccess(
        input.workoutId,
        currentUser.businessId
      );
      
      // Check if this is the only block
      const allExercises = await ctx.db.query.WorkoutExercise.findMany({
        where: eq(WorkoutExercise.workoutId, input.workoutId),
      });
      
      const uniqueGroups = new Set(allExercises.map(ex => ex.groupName));
      if (uniqueGroups.size <= 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete the only remaining block',
        });
      }
      
      // Delete all exercises in the block
      await ctx.db.delete(WorkoutExercise)
        .where(
          and(
            eq(WorkoutExercise.workoutId, input.workoutId),
            eq(WorkoutExercise.groupName, input.groupName)
          )
        );
      
      return { success: true };
    }),

  // Delete entire workout
  deleteWorkout: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = getSessionUser(ctx);
      
      // Verify workout exists and user has access
      const workoutService = new WorkoutService(ctx.db);
      const workout = await workoutService.verifyWorkoutAccess(
        input.workoutId,
        currentUser.businessId
      );
      
      // Check if this is an assessment workout (which shouldn't be deleted)
      if (workout.context === 'assessment') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Assessment workouts cannot be deleted',
        });
      }
      
      // Delete workout (cascade will handle WorkoutExercise deletion)
      await ctx.db.delete(Workout)
        .where(eq(Workout.id, input.workoutId));
      
      return { success: true };
    }),

  // Replace an exercise with another one
  replaceExercise: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      workoutExerciseId: z.string().uuid(),
      newExerciseId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = getSessionUser(ctx);
      
      // Use WorkoutService for validation
      const workoutService = new WorkoutService(ctx.db);
      await workoutService.verifyWorkoutAccess(
        input.workoutId, 
        currentUser.businessId
      );
      
      // Verify the workout exercise exists
      const workoutExercise = await ctx.db.query.WorkoutExercise.findFirst({
        where: and(
          eq(WorkoutExercise.id, input.workoutExerciseId),
          eq(WorkoutExercise.workoutId, input.workoutId)
        ),
      });
      
      if (!workoutExercise) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Exercise not found in workout',
        });
      }
      
      // Verify new exercise exists and is available to the business
      const newExercise = await ctx.db
        .select({
          exercise: exercises,
        })
        .from(exercises)
        .innerJoin(BusinessExercise, eq(exercises.id, BusinessExercise.exerciseId))
        .where(and(
          eq(exercises.id, input.newExerciseId),
          eq(BusinessExercise.businessId, currentUser.businessId)
        ))
        .limit(1);
      
      if (!newExercise[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'New exercise not found or not available for your business',
        });
      }
      
      // Update the exercise
      await ctx.db.update(WorkoutExercise)
        .set({ exerciseId: input.newExerciseId })
        .where(eq(WorkoutExercise.id, input.workoutExerciseId));
      
      return { success: true };
    }),

  // Update exercise sets
  updateExerciseSets: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      workoutExerciseId: z.string().uuid(),
      sets: z.number().int().min(1).max(10)
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = getSessionUser(ctx);
      
      // Use WorkoutService for validation
      const workoutService = new WorkoutService(ctx.db);
      await workoutService.verifyWorkoutAccess(
        input.workoutId, 
        currentUser.businessId
      );
      
      // Verify the workout exercise exists
      const workoutExercise = await ctx.db.query.WorkoutExercise.findFirst({
        where: and(
          eq(WorkoutExercise.id, input.workoutExerciseId),
          eq(WorkoutExercise.workoutId, input.workoutId)
        ),
      });
      
      if (!workoutExercise) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Exercise not found in workout',
        });
      }
      
      // Update the sets
      await ctx.db.update(WorkoutExercise)
        .set({ setsCompleted: input.sets })
        .where(eq(WorkoutExercise.id, input.workoutExerciseId));
      
      return { success: true };
    }),

  // Add a new exercise to an existing workout
  addExercise: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      exerciseId: z.string().uuid(),
      groupName: z.string(),
      position: z.enum(['beginning', 'end']).default('end'),
      sets: z.number().int().min(1).default(3)
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = getSessionUser(ctx);
      
      // Use WorkoutService for validation
      const workoutService = new WorkoutService(ctx.db);
      await workoutService.verifyWorkoutAccess(
        input.workoutId,
        currentUser.businessId
      );
      
      // Verify exercise exists and is available to the business
      const exercise = await ctx.db
        .select({
          exercise: exercises,
        })
        .from(exercises)
        .innerJoin(BusinessExercise, eq(exercises.id, BusinessExercise.exerciseId))
        .where(and(
          eq(exercises.id, input.exerciseId),
          eq(BusinessExercise.businessId, currentUser.businessId)
        ))
        .limit(1);
      
      if (!exercise[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Exercise not found or not available for your business',
        });
      }
      
      // Get existing exercises to determine orderIndex
      const existingExercises = await ctx.db.query.WorkoutExercise.findMany({
        where: eq(WorkoutExercise.workoutId, input.workoutId),
        orderBy: [WorkoutExercise.orderIndex],
      });
      
      // Find exercises in the target group
      const groupExercises = existingExercises.filter(ex => ex.groupName === input.groupName);
      
      let newOrderIndex: number;
      
      if (input.position === 'beginning' && groupExercises.length > 0) {
        // Insert at beginning of group
        newOrderIndex = groupExercises[0]!.orderIndex;
        
        // Shift all exercises in workout with orderIndex >= newOrderIndex
        await ctx.db.transaction(async (tx) => {
          // Increment orderIndex for all exercises at or after the insertion point
          await tx.update(WorkoutExercise)
            .set({ orderIndex: sql`${WorkoutExercise.orderIndex} + 1` })
            .where(and(
              eq(WorkoutExercise.workoutId, input.workoutId),
              sql`${WorkoutExercise.orderIndex} >= ${newOrderIndex}`
            ));
          
          // Insert the new exercise
          await tx.insert(WorkoutExercise)
            .values({
              workoutId: input.workoutId,
              exerciseId: input.exerciseId,
              orderIndex: newOrderIndex,
              setsCompleted: input.sets,
              groupName: input.groupName,
            });
        });
      } else {
        // Insert at end of group or as first exercise in new/empty group
        if (groupExercises.length > 0) {
          newOrderIndex = groupExercises[groupExercises.length - 1]!.orderIndex + 1;
        } else if (existingExercises.length > 0) {
          newOrderIndex = existingExercises[existingExercises.length - 1]!.orderIndex + 1;
        } else {
          newOrderIndex = 1;
        }
        
        // Insert the new exercise
        await ctx.db.insert(WorkoutExercise)
          .values({
            workoutId: input.workoutId,
            exerciseId: input.exerciseId,
            orderIndex: newOrderIndex,
            setsCompleted: input.sets,
            groupName: input.groupName,
          });
      }
      
      return { success: true };
    }),

  // Duplicate an existing workout
  duplicateWorkout: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      targetUserId: z.string().optional(), // If not provided, duplicate for same user
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = getSessionUser(ctx);
      
      // Get the workout to duplicate
      const originalWorkout = await ctx.db.query.Workout.findFirst({
        where: and(
          eq(Workout.id, input.workoutId),
          eq(Workout.businessId, currentUser.businessId)
        ),
      });
      
      if (!originalWorkout) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workout not found',
        });
      }
      
      // Determine target user
      const targetUserId = input.targetUserId || originalWorkout.userId;
      
      // If targeting different user, verify they're in the same business
      if (targetUserId !== originalWorkout.userId) {
        const targetUser = await ctx.db.query.user.findFirst({
          where: eq(user.id, targetUserId),
        });
        
        if (!targetUser || targetUser.businessId !== currentUser.businessId) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Target user not found in your business',
          });
        }
      }
      
      // Get all exercises from the original workout
      const originalExercises = await ctx.db.query.WorkoutExercise.findMany({
        where: eq(WorkoutExercise.workoutId, input.workoutId),
        orderBy: [WorkoutExercise.orderIndex],
      });
      
      // Create the duplicate workout
      const result = await ctx.db.transaction(async (tx) => {
        const [newWorkout] = await tx
          .insert(Workout)
          .values({
            trainingSessionId: originalWorkout.trainingSessionId,
            userId: targetUserId,
            businessId: currentUser.businessId,
            createdByTrainerId: currentUser.id,
            completedAt: null, // New workout starts uncompleted
            notes: input.notes || `Duplicated from workout on ${new Date().toLocaleDateString()}`,
            workoutType: originalWorkout.workoutType,
            totalPlannedSets: originalWorkout.totalPlannedSets,
            llmOutput: originalWorkout.llmOutput,
            templateConfig: originalWorkout.templateConfig,
            context: originalWorkout.context,
          })
          .returning();
          
        if (!newWorkout) {
          throw new Error('Failed to create duplicate workout');
        }
        
        // Duplicate all exercises
        if (originalExercises.length > 0) {
          await tx.insert(WorkoutExercise)
            .values(
              originalExercises.map(ex => ({
                workoutId: newWorkout.id,
                exerciseId: ex.exerciseId,
                orderIndex: ex.orderIndex,
                setsCompleted: ex.setsCompleted,
                groupName: ex.groupName,
              }))
            );
        }
        
        return newWorkout;
      });
      
      return { 
        success: true,
        workoutId: result.id
      };
    }),

  // Public endpoint for clients to view their workout
  getClientWorkoutPublic: publicProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      userId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Find the workout for this user and session
      const workout = await ctx.db.query.Workout.findFirst({
        where: and(
          eq(Workout.trainingSessionId, input.sessionId),
          eq(Workout.userId, input.userId)
        ),
      });

      if (!workout) {
        // Return empty result if no workout found
        return {
          workout: null,
          exercises: [],
        };
      }

      // Get exercises for this workout
      const workoutExercises = await ctx.db
        .select({
          id: WorkoutExercise.id,
          orderIndex: WorkoutExercise.orderIndex,
          setsCompleted: WorkoutExercise.setsCompleted,
          groupName: WorkoutExercise.groupName,
          exercise: {
            id: exercises.id,
            name: exercises.name,
            primaryMuscle: exercises.primaryMuscle,
            equipment: exercises.equipment,
          },
        })
        .from(WorkoutExercise)
        .innerJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .where(eq(WorkoutExercise.workoutId, workout.id))
        .orderBy(WorkoutExercise.orderIndex);

      return {
        workout,
        exercises: workoutExercises,
      };
    }),
} satisfies TRPCRouterRecord;