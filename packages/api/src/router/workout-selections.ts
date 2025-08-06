import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { eq, and, or, asc, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { 
  workoutExerciseSwaps,
  exercises,
  WorkoutExercise
} from "@acme/db/schema";
import { protectedProcedure, publicProcedure } from "../trpc";
import type { SessionUser } from "../types/auth";
import { WorkoutBlueprintService } from "../services/workout-blueprint-service";
import { WorkoutGenerationService } from "../services/workout-generation-service";

export const workoutSelectionsRouter = {
  // Get current selections for a session (public version)
  getSelectionsPublic: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      clientId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      // First verify that the client is checked into the session
      const { UserTrainingSession, Workout } = await import("@acme/db/schema");
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.clientId),
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

      // Get the draft workout for this client
      const workout = await ctx.db
        .select()
        .from(Workout)
        .where(and(
          eq(Workout.trainingSessionId, input.sessionId),
          eq(Workout.userId, input.clientId),
          eq(Workout.status, 'draft')
        ))
        .limit(1);

      if (!workout || workout.length === 0) {
        return [];
      }

      // Get workout exercises with exercise details
      const workoutExercises = await ctx.db
        .select({
          we: WorkoutExercise,
          exercise: exercises
        })
        .from(WorkoutExercise)
        .innerJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .where(eq(WorkoutExercise.workoutId, workout[0].id))
        .orderBy(asc(WorkoutExercise.orderIndex));

      // Transform to match the expected format
      return workoutExercises.map(row => ({
        id: row.we.id,
        sessionId: input.sessionId,
        clientId: input.clientId,
        exerciseId: row.we.exerciseId,
        exerciseName: row.exercise.name,
        isShared: row.we.isShared || false,
        sharedWithClients: row.we.sharedWithClients,
        selectionSource: row.we.selectionSource
      }));
    }),

  // Get current selections for a session
  getSelections: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      clientId: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      const { Workout } = await import("@acme/db/schema");
      
      // Build where clause for workouts
      const workoutWhere = input.clientId
        ? and(
            eq(Workout.trainingSessionId, input.sessionId),
            eq(Workout.userId, input.clientId),
            eq(Workout.status, 'draft')
          )
        : and(
            eq(Workout.trainingSessionId, input.sessionId),
            eq(Workout.status, 'draft')
          );

      // Get workouts first
      const workouts = await ctx.db
        .select()
        .from(Workout)
        .where(workoutWhere);

      if (workouts.length === 0) {
        return [];
      }

      // Get workout exercises with exercise details
      const workoutIds = workouts.map(w => w.id);
      const workoutExercises = await ctx.db
        .select({
          we: WorkoutExercise,
          exercise: exercises,
          workoutId: WorkoutExercise.workoutId,
          userId: Workout.userId
        })
        .from(WorkoutExercise)
        .innerJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .innerJoin(Workout, eq(WorkoutExercise.workoutId, Workout.id))
        .where(sql`${WorkoutExercise.workoutId} IN (${sql.join(workoutIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(asc(WorkoutExercise.orderIndex));

      // Transform to match expected format
      return workoutExercises.map(row => ({
        id: row.we.id,
        sessionId: input.sessionId,
        clientId: row.userId,
        exerciseId: row.we.exerciseId,
        exerciseName: row.exercise.name,
        isShared: row.we.isShared || false,
        sharedWithClients: row.we.sharedWithClients,
        selectionSource: row.we.selectionSource
      }));
    }),

  // Swap an exercise
  swapExercise: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      clientId: z.string(),
      originalExerciseId: z.string(),
      newExercise: z.object({
        id: z.string(),
        name: z.string()
      }),
      reason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;

      return await ctx.db.transaction(async (tx) => {
        // 1. Log the swap
        await tx.insert(workoutExerciseSwaps).values({
          sessionId: input.sessionId,
          clientId: input.clientId,
          originalExerciseId: input.originalExerciseId,
          newExerciseId: input.newExercise.id,
          swapReason: input.reason,
          swappedBy: user.id
        });

        // 2. Find the workout for this user
        const { Workout } = await import("@acme/db/schema");
        const workout = await tx
          .select()
          .from(Workout)
          .where(and(
            eq(Workout.trainingSessionId, input.sessionId),
            eq(Workout.userId, input.clientId),
            eq(Workout.status, 'draft')
          ))
          .limit(1);

        if (!workout || workout.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Draft workout not found',
          });
        }

        // 3. Update the workout exercise
        await tx.update(WorkoutExercise)
          .set({
            exerciseId: input.newExercise.id,
            isShared: false, // Swapped exercises are individual
            sharedWithClients: null,
            selectionSource: 'manual_swap'
          })
          .where(
            and(
              eq(WorkoutExercise.workoutId, workout[0].id),
              eq(WorkoutExercise.exerciseId, input.originalExerciseId)
            )
          );

        return { success: true };
      });
    }),

  // Public version of swap exercise for clients
  swapExercisePublic: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      clientId: z.string(),
      originalExerciseId: z.string(),
      newExerciseId: z.string(),
      reason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // First verify that the client is checked into the session
      const { UserTrainingSession } = await import("@acme/db/schema");
      const userSession = await ctx.db.query.UserTrainingSession.findFirst({
        where: and(
          eq(UserTrainingSession.userId, input.clientId),
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

      // Get the new exercise name for the selection
      const newExercise = await ctx.db.query.exercises.findFirst({
        where: eq(exercises.id, input.newExerciseId)
      });

      if (!newExercise) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'New exercise not found',
        });
      }

      // Now perform the swap transaction
      return await ctx.db.transaction(async (tx) => {
        // 1. Log the swap - we record who made the swap as the client themselves
        await tx.insert(workoutExerciseSwaps).values({
          sessionId: input.sessionId,
          clientId: input.clientId,
          originalExerciseId: input.originalExerciseId,
          newExerciseId: input.newExerciseId,
          swapReason: input.reason || 'Client manual selection',
          swappedBy: input.clientId // Client swapped their own exercise
        });

        // 2. Find the workout exercise to update
        const { Workout } = await import("@acme/db/schema");
        const workout = await tx
          .select()
          .from(Workout)
          .where(and(
            eq(Workout.trainingSessionId, input.sessionId),
            eq(Workout.userId, input.clientId),
            eq(Workout.status, 'draft')
          ))
          .limit(1);

        if (!workout || workout.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Draft workout not found',
          });
        }

        // 3. Update the workout exercise
        await tx.update(WorkoutExercise)
          .set({
            exerciseId: input.newExerciseId,
            isShared: false, // Swapped exercises are individual
            sharedWithClients: null,
            selectionSource: 'manual_swap'
          })
          .where(
            and(
              eq(WorkoutExercise.workoutId, workout[0].id),
              eq(WorkoutExercise.exerciseId, input.originalExerciseId)
            )
          );

        // 4. Skip templateConfig update for now to avoid serialization issues
        // The workout_exercise_selections table is the source of truth
        // The visualization data can be regenerated if needed

        return { success: true };
      });
    }),

  // Get available alternatives for swapping
  getSwapAlternatives: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      clientId: z.string(),
      currentExerciseId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user;
      
      // Get the blueprint data to find alternatives
      const blueprintData = await WorkoutBlueprintService.prepareClientsForBlueprint(
        input.sessionId,
        user.businessId,
        user.id
      );

      // Check if it's a standard blueprint
      const blueprint = blueprintData.blueprint as any;
      if (!blueprint.clientExercisePools) {
        return []; // Not a standard blueprint
      }

      // Find client's exercise pool
      const clientPool = blueprint.clientExercisePools[input.clientId];
      if (!clientPool) return [];

      // Return top 10 alternatives, excluding current
      return clientPool.exercises
        .filter((ex: any) => ex.id !== input.currentExerciseId)
        .slice(0, 10)
        .map((ex: any) => ({
          id: ex.id,
          name: ex.name,
          score: ex.score,
          muscleGroups: ex.muscleGroups || [],
          equipment: ex.equipment || []
        }));
    }),

  // Get swap history for a session
  getSwapHistory: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.workoutExerciseSwaps.findMany({
        where: eq(workoutExerciseSwaps.sessionId, input.sessionId),
        orderBy: asc(workoutExerciseSwaps.swappedAt)
      });
    }),

  // Finalize selections and trigger Phase 2
  finalizeSelections: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { Workout } = await import("@acme/db/schema");
      
      // Get draft workouts for this session
      const draftWorkouts = await ctx.db
        .select()
        .from(Workout)
        .where(and(
          eq(Workout.trainingSessionId, input.sessionId),
          eq(Workout.status, 'draft')
        ));

      if (draftWorkouts.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No draft workouts found for this session'
        });
      }

      // Get workout exercises for all draft workouts
      const workoutIds = draftWorkouts.map(w => w.id);
      const workoutExercises = await ctx.db
        .select({
          we: WorkoutExercise,
          exercise: exercises,
          workoutId: WorkoutExercise.workoutId,
          userId: Workout.userId
        })
        .from(WorkoutExercise)
        .innerJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .innerJoin(Workout, eq(WorkoutExercise.workoutId, Workout.id))
        .where(sql`${WorkoutExercise.workoutId} IN (${sql.join(workoutIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(asc(WorkoutExercise.orderIndex));

      // Transform to match expected format for Phase 2
      const selectionsByClient = workoutExercises.reduce((acc, row) => {
        if (!acc[row.userId]) acc[row.userId] = [];
        
        acc[row.userId].push({
          id: row.we.id,
          sessionId: input.sessionId,
          clientId: row.userId,
          exerciseId: row.we.exerciseId,
          exerciseName: row.exercise.name,
          isShared: row.we.isShared || false,
          sharedWithClients: row.we.sharedWithClients,
          selectionSource: row.we.selectionSource
        });
        
        return acc;
      }, {} as Record<string, any[]>);

      // Trigger Phase 2 LLM for sequencing and sets/reps
      const workoutService = new WorkoutGenerationService(ctx);
      const result = await workoutService.generatePhase2Sequencing(
        input.sessionId,
        selectionsByClient
      );

      return result;
    })
} satisfies TRPCRouterRecord;