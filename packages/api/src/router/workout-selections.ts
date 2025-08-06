import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { eq, and, or, asc } from "@acme/db";
import { db } from "@acme/db/client";
import { 
  workoutExerciseSelections,
  workoutExerciseSwaps,
  exercises
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

      // Get selections for this specific client
      return ctx.db.query.workoutExerciseSelections.findMany({
        where: and(
          eq(workoutExerciseSelections.sessionId, input.sessionId),
          eq(workoutExerciseSelections.clientId, input.clientId)
        ),
        orderBy: [
          asc(workoutExerciseSelections.exerciseName)
        ]
      });
    }),

  // Get current selections for a session
  getSelections: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      clientId: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      const where = input.clientId
        ? and(
            eq(workoutExerciseSelections.sessionId, input.sessionId),
            eq(workoutExerciseSelections.clientId, input.clientId)
          )
        : eq(workoutExerciseSelections.sessionId, input.sessionId);

      return ctx.db.query.workoutExerciseSelections.findMany({
        where,
        orderBy: [
          asc(workoutExerciseSelections.clientId),
          asc(workoutExerciseSelections.exerciseName)
        ]
      });
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

        // 2. Delete old selection
        await tx.delete(workoutExerciseSelections).where(
          and(
            eq(workoutExerciseSelections.sessionId, input.sessionId),
            eq(workoutExerciseSelections.clientId, input.clientId),
            eq(workoutExerciseSelections.exerciseId, input.originalExerciseId)
          )
        );

        // 3. Insert new selection
        await tx.insert(workoutExerciseSelections).values({
          sessionId: input.sessionId,
          clientId: input.clientId,
          exerciseId: input.newExercise.id,
          exerciseName: input.newExercise.name,
          isShared: false, // Swapped exercises are individual
          sharedWithClients: null,
          selectionSource: 'manual_swap'
        });

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

        // 2. Update the selection (delete old, insert new to maintain constraints)
        await tx.delete(workoutExerciseSelections).where(
          and(
            eq(workoutExerciseSelections.sessionId, input.sessionId),
            eq(workoutExerciseSelections.clientId, input.clientId),
            eq(workoutExerciseSelections.exerciseId, input.originalExerciseId)
          )
        );

        // 3. Insert new selection
        await tx.insert(workoutExerciseSelections).values({
          sessionId: input.sessionId,
          clientId: input.clientId,
          exerciseId: input.newExerciseId,
          exerciseName: newExercise.name,
          isShared: false, // Swapped exercises are individual
          sharedWithClients: null,
          selectionSource: 'manual_swap'
        });

        // 4. Update visualization data in templateConfig
        const { TrainingSession } = await import("@acme/db/schema");
        const session = await tx.query.TrainingSession.findFirst({
          where: eq(TrainingSession.id, input.sessionId)
        });

        if (session && session.templateConfig) {
          const templateConfig = session.templateConfig as any;
          const visualizationData = templateConfig?.visualizationData;
          
          if (visualizationData?.llmResult?.exerciseSelection?.clientSelections?.[input.clientId]) {
            const clientSelection = visualizationData.llmResult.exerciseSelection.clientSelections[input.clientId];
            
            // Find and update the exercise in the selected array
            if (clientSelection.selected && Array.isArray(clientSelection.selected)) {
              const exerciseIndex = clientSelection.selected.findIndex(
                (ex: any) => ex.exerciseId === input.originalExerciseId
              );
              
              if (exerciseIndex !== -1) {
                clientSelection.selected[exerciseIndex] = {
                  exerciseId: input.newExerciseId,
                  exerciseName: newExercise.name,
                  reasoning: 'Manually selected by client',
                  isShared: false
                };
              }
            }
            
            // Update the savedAt to current time as ISO string
            if (visualizationData.savedAt) {
              visualizationData.savedAt = new Date().toISOString();
            }
            
            // Update the templateConfig with the modified visualization data
            await tx.update(TrainingSession)
              .set({ templateConfig })
              .where(eq(TrainingSession.id, input.sessionId));
          }
        }

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
      // Get current selections
      const selections = await ctx.db.query.workoutExerciseSelections.findMany({
        where: eq(workoutExerciseSelections.sessionId, input.sessionId)
      });

      if (selections.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No exercise selections found for this session'
        });
      }

      // Group by client
      const selectionsByClient = selections.reduce((acc, sel) => {
        if (!acc[sel.clientId]) acc[sel.clientId] = [];
        acc[sel.clientId].push(sel);
        return acc;
      }, {} as Record<string, typeof selections>);

      // Trigger Phase 2 LLM for sequencing and sets/reps
      const workoutService = new WorkoutGenerationService(ctx);
      const result = await workoutService.generatePhase2Sequencing(
        input.sessionId,
        selectionsByClient
      );

      return result;
    })
} satisfies TRPCRouterRecord;