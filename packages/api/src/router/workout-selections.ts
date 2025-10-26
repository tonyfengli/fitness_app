import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { and, asc, eq, or, sql, isNull } from "@acme/db";
import { db } from "@acme/db/client";
import {
  exercises,
  WorkoutExercise,
  workoutExerciseSwaps,
} from "@acme/db/schema";

import type { SessionUser } from "../types/auth";
import { WorkoutBlueprintService } from "../services/workout-blueprint-service";
import { WorkoutGenerationService } from "../services/workout-generation-service";
import { protectedProcedure, publicProcedure } from "../trpc";

export const workoutSelectionsRouter = {
  // Get current selections for a session (public version)
  getSelectionsPublic: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        clientId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // For circuit sessions, we allow access without check-in
      // Just verify the session exists
      const { TrainingSession, Workout } = await import("@acme/db/schema");
      
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });
      
      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }

      // Get the draft or ready workout for this client
      const workout = await ctx.db
        .select()
        .from(Workout)
        .where(
          and(
            eq(Workout.trainingSessionId, input.sessionId),
            eq(Workout.userId, input.clientId),
            or(eq(Workout.status, "draft"), eq(Workout.status, "ready")),
          ),
        )
        .limit(1);

      if (!workout || workout.length === 0) {
        return [];
      }

      const firstWorkout = workout[0];
      if (!firstWorkout) {
        return [];
      }

      // Get workout exercises with exercise details
      const workoutExercises = await ctx.db
        .select({
          we: WorkoutExercise,
          exercise: exercises,
        })
        .from(WorkoutExercise)
        .leftJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .where(eq(WorkoutExercise.workoutId, firstWorkout.id))
        .orderBy(asc(WorkoutExercise.orderIndex));

      // Transform to match the expected format
      return workoutExercises.map((row) => ({
        id: row.we.id,
        sessionId: input.sessionId,
        clientId: input.clientId,
        exerciseId: row.we.exerciseId,
        exerciseName: (row.we.custom_exercise as any)?.customName || row.exercise?.name || 'Unknown Exercise',
        equipment: row.exercise?.equipment || [],
        isShared: row.we.isShared || false,
        sharedWithClients: row.we.sharedWithClients,
        selectionSource: row.we.selectionSource,
        groupName: row.we.groupName,
        orderIndex: row.we.orderIndex,
        custom_exercise: row.we.custom_exercise,
        repsPlanned: row.we.repsPlanned,
      }));
    }),

  // Get current selections for a session
  getSelections: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        clientId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { Workout, TrainingSession } = await import("@acme/db/schema");

      
      // First, get the session to determine template type
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });
      
      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }
      
      const templateType = session.templateType || "standard";

      // Build where clause for workouts
      // When checking for existing workouts, look for draft OR ready status
      // This ensures we find workouts that may have progressed past draft
      const workoutWhere = input.clientId
        ? and(
            eq(Workout.trainingSessionId, input.sessionId),
            eq(Workout.userId, input.clientId),
            or(
              eq(Workout.status, "draft"),
              eq(Workout.status, "ready"),
              eq(Workout.status, "completed"),
            ),
          )
        : and(
            eq(Workout.trainingSessionId, input.sessionId),
            or(
              eq(Workout.status, "draft"),
              eq(Workout.status, "ready"),
              eq(Workout.status, "completed"),
            ),
          );

      // Get workouts first
      const workouts = await ctx.db.select().from(Workout).where(workoutWhere);


      if (workouts.length === 0) {
        return [];
      }

      // For circuit workouts (no specific clientId), just use the first workout
      // since exercises are shared across all clients
      // For standard workouts without clientId, get all workouts
      const workoutIds = input.clientId 
        ? workouts.map((w) => w.id)  // Individual mode: get all workouts for that client
        : templateType === "circuit"
          ? [workouts[0]!.id]         // Circuit mode: just one workout to avoid duplicates
          : workouts.map((w) => w.id); // Standard mode: get all workouts

      // Get workout exercises with exercise details
      const workoutExercises = await ctx.db
        .select({
          we: WorkoutExercise,
          exercise: exercises,
        })
        .from(WorkoutExercise)
        .leftJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .where(
          sql`${WorkoutExercise.workoutId} IN (${sql.join(
            workoutIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )
        .orderBy(asc(WorkoutExercise.orderIndex));


      // Transform to match expected format
      // For circuit workouts without clientId, we'll use the first workout's userId
      // For standard workouts, we need to map each exercise to its actual client
      
      // Build a map of workoutId to userId for standard workouts
      const workoutToUserMap = new Map(
        workouts.map(w => [w.id, w.userId])
      );
      
      const results = workoutExercises.map((row) => {
        // For standard workouts, use the actual userId from the workout
        // For circuit workouts without clientId, use the first workout's userId
        const clientId = input.clientId || 
          (templateType === "standard" 
            ? workoutToUserMap.get(row.we.workoutId) || workouts[0]!.userId
            : workouts[0]!.userId);
            
        return {
          id: row.we.id,
          sessionId: input.sessionId,
          clientId: clientId,
          exerciseId: row.we.exerciseId,
          exerciseName: (row.we.custom_exercise as any)?.customName || row.exercise?.name || 'Unknown Exercise',
          equipment: row.exercise?.equipment || [],
          isShared: row.we.isShared || false,
          sharedWithClients: row.we.sharedWithClients,
          selectionSource: row.we.selectionSource,
          groupName: row.we.groupName,
          orderIndex: row.we.orderIndex,
          stationIndex: row.we.stationIndex,
          custom_exercise: row.we.custom_exercise,
          repsPlanned: row.we.repsPlanned,
        };
      });
      
      // Log the distribution of exercises per client
      const exercisesByClient = results.reduce((acc, ex) => {
        acc[ex.clientId] = (acc[ex.clientId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      
      return results;
    }),

  // Swap an exercise
  swapExercise: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        clientId: z.string(),
        originalExerciseId: z.string(),
        newExercise: z.object({
          id: z.string(),
          name: z.string(),
        }),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;

      return await ctx.db.transaction(async (tx) => {
        // 1. Log the swap
        await tx.insert(workoutExerciseSwaps).values({
          trainingSessionId: input.sessionId,
          clientId: input.clientId,
          originalExerciseId: input.originalExerciseId,
          newExerciseId: input.newExercise.id,
          swapReason: input.reason,
          swappedBy: user.id,
        });

        // 2. Find the workout for this user
        const { Workout } = await import("@acme/db/schema");
        const workout = await tx
          .select()
          .from(Workout)
          .where(
            and(
              eq(Workout.trainingSessionId, input.sessionId),
              eq(Workout.userId, input.clientId),
              or(
                eq(Workout.status, "draft"),
                eq(Workout.status, "ready"),
                eq(Workout.status, "completed"),
              ),
            ),
          )
          .limit(1);

        if (!workout || workout.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Draft workout not found",
          });
        }

        const firstWorkout = workout[0];
        if (!firstWorkout) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Draft workout not found",
          });
        }

        // 3. Update the workout exercise
        await tx
          .update(WorkoutExercise)
          .set({
            exerciseId: input.newExercise.id,
            isShared: false, // Swapped exercises are individual
            sharedWithClients: null,
            selectionSource: "manual_swap",
          })
          .where(
            and(
              eq(WorkoutExercise.workoutId, firstWorkout.id),
              eq(WorkoutExercise.exerciseId, input.originalExerciseId),
            ),
          );

        return { success: true };
      });
    }),

  // Public version of swap exercise for clients
  swapExercisePublic: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        clientId: z.string(),
        originalExerciseId: z.string(),
        newExerciseId: z.string(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[swapExercisePublic] Starting swap with input:", input);

      // For circuit sessions, we allow modifications without check-in
      // Just verify the session exists
      const { TrainingSession } = await import("@acme/db/schema");
      
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });
      
      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }

      // Get the new exercise name for the selection (if not custom)
      let newExerciseName: string | undefined;
      if (input.newExerciseId) {
        const newExercise = await ctx.db.query.exercises.findFirst({
          where: eq(exercises.id, input.newExerciseId),
        });

        if (!newExercise) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "New exercise not found",
          });
        }
        newExerciseName = newExercise.name;
      }

      // Now perform the swap transaction
      return await ctx.db.transaction(async (tx) => {
        // 1. Log the swap - we record who made the swap as the client themselves
        const swapData = {
          trainingSessionId: input.sessionId,
          clientId: input.clientId,
          originalExerciseId: input.originalExerciseId,
          newExerciseId: input.newExerciseId,
          swapReason: input.reason || "Client manual selection",
          swappedBy: input.clientId, // Client swapped their own exercise
        };

        console.log("[swapExercisePublic] Inserting swap data:", swapData);

        const insertResult = await tx
          .insert(workoutExerciseSwaps)
          .values(swapData)
          .returning();

        console.log(
          "[swapExercisePublic] Swap inserted successfully:",
          insertResult,
        );

        // 2. Find the workout exercise to update
        const { Workout } = await import("@acme/db/schema");
        const workout = await tx
          .select()
          .from(Workout)
          .where(
            and(
              eq(Workout.trainingSessionId, input.sessionId),
              eq(Workout.userId, input.clientId),
              or(
                eq(Workout.status, "draft"),
                eq(Workout.status, "ready"),
                eq(Workout.status, "completed"),
              ),
            ),
          )
          .limit(1);

        if (!workout || workout.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Draft workout not found",
          });
        }

        const firstWorkout = workout[0];
        if (!firstWorkout) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Draft workout not found",
          });
        }

        // 3. Update the workout exercise
        await tx
          .update(WorkoutExercise)
          .set({
            exerciseId: input.newExerciseId,
            isShared: false, // Swapped exercises are individual
            sharedWithClients: null,
            selectionSource: "manual_swap",
          })
          .where(
            and(
              eq(WorkoutExercise.workoutId, firstWorkout.id),
              eq(WorkoutExercise.exerciseId, input.originalExerciseId),
            ),
          );

        // 4. Skip templateConfig update for now to avoid serialization issues
        // The workout_exercise_selections table is the source of truth
        // The visualization data can be regenerated if needed

        return { success: true };
      });
    }),

  // Swap an exercise in a circuit workout (updates for all participants)
  swapCircuitExercise: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        roundName: z.string(), // e.g., "Round 1"
        exerciseIndex: z.number(), // orderIndex of the exercise
        originalExerciseId: z.string().nullable(), // null for custom exercises being replaced
        newExerciseId: z.string().nullable(), // null for custom exercises
        customName: z.string().optional(), // custom exercise name
        reason: z.string().optional(),
        swappedBy: z.string(), // clientId of who initiated the swap
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[swapCircuitExercise] Starting circuit swap with input:", input);

      // Get the new exercise details if not custom
      let newExerciseName = input.customName;
      if (input.newExerciseId) {
        const newExercise = await ctx.db.query.exercises.findFirst({
          where: eq(exercises.id, input.newExerciseId),
        });

        if (!newExercise) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "New exercise not found",
          });
        }
        newExerciseName = newExercise.name;
      }

      return await ctx.db.transaction(async (tx) => {
        // 1. Find all workout exercises that match this round and position
        const { Workout } = await import("@acme/db/schema");
        
        // Get all workouts for this session
        const workouts = await tx
          .select()
          .from(Workout)
          .where(
            and(
              eq(Workout.trainingSessionId, input.sessionId),
              or(
                eq(Workout.status, "draft"),
                eq(Workout.status, "ready"),
              ),
            ),
          );

        if (workouts.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No workouts found for this session",
          });
        }

        const workoutIds = workouts.map((w) => w.id);

        // 2. Update all matching workout exercises across all clients
        const updateData: any = {
          selectionSource: "manual_swap",
          // Keep isShared as true for circuit exercises
          isShared: true,
        };
        
        if (input.newExerciseId) {
          // Regular exercise swap
          updateData.exerciseId = input.newExerciseId;
          updateData.custom_exercise = null; // Clear any custom data
        } else {
          // Custom exercise - set exerciseId to NULL, store custom data
          updateData.exerciseId = null;
          updateData.custom_exercise = {
            customName: input.customName,
            originalExerciseId: input.originalExerciseId,
          };
        }
        
        // Build WHERE clause - for circuit workouts, match by position (round + index)
        // Don't match by exerciseId since it might have been changed already
        const whereConditions = [
          sql`${WorkoutExercise.workoutId} IN (${sql.join(
            workoutIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
          eq(WorkoutExercise.groupName, input.roundName),
          eq(WorkoutExercise.orderIndex, input.exerciseIndex),
        ];
        
        // Debug: Let's check what exercises actually exist
        const existingExercises = await tx
          .select({
            id: WorkoutExercise.id,
            exerciseId: WorkoutExercise.exerciseId,
            groupName: WorkoutExercise.groupName,
            orderIndex: WorkoutExercise.orderIndex,
            workoutId: WorkoutExercise.workoutId,
          })
          .from(WorkoutExercise)
          .where(
            sql`${WorkoutExercise.workoutId} IN (${sql.join(
              workoutIds.map((id) => sql`${id}`),
              sql`, `,
            )})`
          );
        
        console.log("[swapCircuitExercise] Existing exercises in these workouts:");
        existingExercises.forEach(ex => {
          console.log(`  - ID: ${ex.id}, exerciseId: ${ex.exerciseId}, round: ${ex.groupName}, index: ${ex.orderIndex}`);
        });
        
        console.log("[swapCircuitExercise] Attempting update with conditions:");
        console.log("  - Round name:", input.roundName);
        console.log("  - Exercise index:", input.exerciseIndex);
        console.log("  - Original exercise ID:", input.originalExerciseId);
        console.log("  - New exercise ID:", input.newExerciseId);
        console.log("  - Update data:", updateData);
        console.log("  - Number of workouts:", workoutIds.length);
        
        const updateResult = await tx
          .update(WorkoutExercise)
          .set(updateData)
          .where(and(...whereConditions))
          .returning();

        console.log("[swapCircuitExercise] Update result:", updateResult);
        console.log("[swapCircuitExercise] Number of rows updated:", updateResult.length);

        // 3. Log the swap for each affected client (only if both IDs are valid)
        // Skip logging for custom exercises since the swap table requires valid exercise IDs
        if (input.originalExerciseId && input.newExerciseId) {
          for (const workout of workouts) {
            await tx.insert(workoutExerciseSwaps).values({
              trainingSessionId: input.sessionId,
              clientId: workout.userId,
              originalExerciseId: input.originalExerciseId,
              newExerciseId: input.newExerciseId,
              swapReason: input.reason || `Circuit swap by participant`,
              swappedBy: input.swappedBy,
            });
          }
          console.log("[swapCircuitExercise] Logged swaps for all participants:", workouts.length);
        } else {
          console.log("[swapCircuitExercise] Skipped swap logging for custom exercise");
        }

        return { 
          success: true, 
          affectedClients: workouts.length,
          newExerciseName: newExerciseName || 'Custom Exercise' 
        };
      });
    }),

  // Reorder exercises in a circuit workout (up/down movement)
  reorderCircuitExercise: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        roundName: z.string(), // e.g., "Round 1"
        currentIndex: z.number(), // Current orderIndex
        direction: z.enum(["up", "down"]), // Direction to move
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[reorderCircuitExercise] Starting reorder with input:", input);

      const { currentIndex, direction } = input;
      // Calculate the target index
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      
      console.log("[reorderCircuitExercise] Swapping indices:", {
        currentIndex,
        targetIndex,
        direction
      });

      return await ctx.db.transaction(async (tx) => {
        // 1. Get all workouts for this session
        const { Workout } = await import("@acme/db/schema");
        
        const workouts = await tx
          .select()
          .from(Workout)
          .where(
            and(
              eq(Workout.trainingSessionId, input.sessionId),
              or(
                eq(Workout.status, "draft"),
                eq(Workout.status, "ready"),
              ),
            ),
          );

        if (workouts.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No workouts found for this session",
          });
        }

        const workoutIds = workouts.map((w) => w.id);

        // 2. First set the current exercise to a temporary index to avoid conflicts
        const tempIndex = 999;
        await tx
          .update(WorkoutExercise)
          .set({
            orderIndex: tempIndex,
          })
          .where(
            and(
              sql`${WorkoutExercise.workoutId} IN (${sql.join(
                workoutIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
              eq(WorkoutExercise.groupName, input.roundName),
              eq(WorkoutExercise.orderIndex, currentIndex),
            ),
          );

        // 3. Move the target exercise to the current position
        await tx
          .update(WorkoutExercise)
          .set({
            orderIndex: currentIndex,
          })
          .where(
            and(
              sql`${WorkoutExercise.workoutId} IN (${sql.join(
                workoutIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
              eq(WorkoutExercise.groupName, input.roundName),
              eq(WorkoutExercise.orderIndex, targetIndex),
            ),
          );

        // 4. Move the original exercise to the target position
        await tx
          .update(WorkoutExercise)
          .set({
            orderIndex: targetIndex,
          })
          .where(
            and(
              sql`${WorkoutExercise.workoutId} IN (${sql.join(
                workoutIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
              eq(WorkoutExercise.groupName, input.roundName),
              eq(WorkoutExercise.orderIndex, tempIndex),
            ),
          );

        console.log("[reorderCircuitExercise] Reordered exercises successfully");

        return { 
          success: true, 
          affectedClients: workouts.length,
        };
      });
    }),

  // Get available alternatives for swapping
  getSwapAlternatives: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        clientId: z.string(),
        currentExerciseId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user;

      // Get the blueprint data to find alternatives
      const blueprintData =
        await WorkoutBlueprintService.prepareClientsForBlueprint(
          input.sessionId,
          user.businessId,
          user.id,
        );

      // Check if it's a standard blueprint
      const blueprint = (blueprintData as any).blueprint as any;
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
          equipment: ex.equipment || [],
        }));
    }),

  // Get swap history for a session
  getSwapHistory: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(workoutExerciseSwaps)
        .where(eq(workoutExerciseSwaps.trainingSessionId, input.sessionId))
        .orderBy(asc(workoutExerciseSwaps.swappedAt));
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
        .where(
          and(
            eq(Workout.trainingSessionId, input.sessionId),
            eq(Workout.status, "draft"),
          ),
        );

      if (draftWorkouts.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No draft workouts found for this session",
        });
      }

      // Get workout exercises for all draft workouts
      const workoutIds = draftWorkouts.map((w) => w.id);
      const workoutExercises = await ctx.db
        .select({
          we: WorkoutExercise,
          exercise: exercises,
          workoutId: WorkoutExercise.workoutId,
          userId: Workout.userId,
        })
        .from(WorkoutExercise)
        .leftJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .innerJoin(Workout, eq(WorkoutExercise.workoutId, Workout.id))
        .where(
          sql`${WorkoutExercise.workoutId} IN (${sql.join(
            workoutIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )
        .orderBy(asc(WorkoutExercise.orderIndex));

      // Transform to match expected format for Phase 2
      const selectionsByClient = workoutExercises.reduce(
        (acc, row) => {
          if (!acc[row.userId]) acc[row.userId] = [];

          acc[row.userId]!.push({
            id: row.we.id,
            sessionId: input.sessionId,
            clientId: row.userId,
            exerciseId: row.we.exerciseId,
            exerciseName: row.exercise?.name || 'Unknown Exercise',
            isShared: row.we.isShared || false,
            sharedWithClients: row.we.sharedWithClients,
            selectionSource: row.we.selectionSource,
          });

          return acc;
        },
        {} as Record<string, any[]>,
      );

      // Trigger Phase 2 LLM for sequencing and sets/reps
      const workoutService = new WorkoutGenerationService(ctx);
      const result = await workoutService.generatePhase2Sequencing(
        input.sessionId,
        selectionsByClient,
      );

      return result;
    }),

  // Update reps planned for an exercise
  updateRepsPlanned: protectedProcedure
    .input(
      z.object({
        exerciseId: z.string(), // workout_exercise.id
        repsPlanned: z.number().int().min(0).max(99).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[updateRepsPlanned] Input:", input);

      // Update the workout exercise
      const result = await ctx.db
        .update(WorkoutExercise)
        .set({ repsPlanned: input.repsPlanned })
        .where(eq(WorkoutExercise.id, input.exerciseId))
        .returning();

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Exercise not found",
        });
      }

      console.log("[updateRepsPlanned] Updated:", result[0]);
      return result[0];
    }),

  // Public version of update reps planned (for circuit workouts)
  updateRepsPlannedPublic: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        clientId: z.string(),
        exerciseId: z.string(), // workout_exercise.id
        repsPlanned: z.number().int().min(0).max(99).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[updateRepsPlannedPublic] Input:", input);

      // For circuit sessions, we allow modifications without check-in
      // Just verify the session exists
      const { TrainingSession } = await import("@acme/db/schema");
      
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });
      
      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }

      // Verify the exercise belongs to a workout in this session for this client
      const { Workout } = await import("@acme/db/schema");
      const workoutExercise = await ctx.db
        .select({
          we: WorkoutExercise,
          workout: Workout,
        })
        .from(WorkoutExercise)
        .innerJoin(Workout, eq(WorkoutExercise.workoutId, Workout.id))
        .where(
          and(
            eq(WorkoutExercise.id, input.exerciseId),
            eq(Workout.trainingSessionId, input.sessionId),
            eq(Workout.userId, input.clientId),
          ),
        )
        .limit(1);

      if (!workoutExercise || workoutExercise.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Exercise not found or not accessible",
        });
      }

      // Update the workout exercise
      const result = await ctx.db
        .update(WorkoutExercise)
        .set({ repsPlanned: input.repsPlanned })
        .where(eq(WorkoutExercise.id, input.exerciseId))
        .returning();

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Exercise not found",
        });
      }

      console.log("[updateRepsPlannedPublic] Updated:", result[0]);
      return result[0];
    }),

  // Add exercise to an existing station (circuit stations rounds only)
  addExerciseToStation: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        roundName: z.string(),
        targetStationIndex: z.number().min(0),
        newExerciseId: z.string().uuid().nullable(), // null for custom exercises
        customName: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;

      console.log("[addExerciseToStation] Starting with input:", input);

      // Import required schemas
      const { TrainingSession, Workout } = await import("@acme/db/schema");

      // Verify the session exists and belongs to the user's business
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

      // Use transaction for consistency
      return await ctx.db.transaction(async (tx) => {
        // Get all workouts for this session
        const workouts = await tx
          .select()
          .from(Workout)
          .where(
            and(
              eq(Workout.trainingSessionId, input.sessionId),
              or(
                eq(Workout.status, "draft"),
                eq(Workout.status, "ready"),
              ),
            ),
          );

        if (workouts.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No workouts found for this session",
          });
        }

        console.log("[addExerciseToStation] Found workouts:", {
          count: workouts.length,
          workouts: workouts.map(w => ({ 
            id: w.id, 
            status: w.status, 
            userId: w.userId 
          })),
        });

        const workoutIds = workouts.map((w) => w.id);
        
        console.log("[addExerciseToStation] Looking for exercises with:", {
          workoutIds: workoutIds,
          roundName: input.roundName,
          targetStationIndex: input.targetStationIndex,
        });

        // Debug: First, let's see ALL exercises for this round
        const allRoundExercises = await tx
          .select()
          .from(WorkoutExercise)
          .where(
            and(
              sql`${WorkoutExercise.workoutId} IN (${sql.join(
                workoutIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
              eq(WorkoutExercise.groupName, input.roundName)
            ),
          );
          
        console.log("[addExerciseToStation] All exercises in round:", {
          count: allRoundExercises.length,
          exercises: allRoundExercises.map(ex => ({
            id: ex.id,
            workoutId: ex.workoutId,
            groupName: ex.groupName,
            orderIndex: ex.orderIndex,
            stationIndex: ex.stationIndex,
            exerciseId: ex.exerciseId,
            isShared: ex.isShared,
            custom_exercise: ex.custom_exercise,
          })),
        });

        // Find exercises at the target station
        // For stations rounds, we need to find the exercise that represents this station
        // The frontend sends 0-based station index, but exercises might have gaps in orderIndex
        
        // First, get all exercises in the round sorted by orderIndex
        const allRoundExercisesOrdered = allRoundExercises
          .filter(ex => ex.stationIndex === null || ex.stationIndex === 0) // Consider both null and 0 as main station exercises
          .sort((a, b) => a.orderIndex - b.orderIndex);
        
        // Find the exercise at the target station position
        const targetStationExercise = allRoundExercisesOrdered[input.targetStationIndex];
        
        if (!targetStationExercise) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Target station not found",
          });
        }
        
        // Now find all exercises with the same orderIndex (including those with stationIndex)
        const targetStationExercises = await tx
          .select()
          .from(WorkoutExercise)
          .where(
            and(
              sql`${WorkoutExercise.workoutId} IN (${sql.join(
                workoutIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
              eq(WorkoutExercise.groupName, input.roundName),
              eq(WorkoutExercise.orderIndex, targetStationExercise.orderIndex)
            ),
          )
          .orderBy(asc(WorkoutExercise.stationIndex));
          
        console.log("[addExerciseToStation] Target station exercises found:", {
          count: targetStationExercises.length,
          exercises: targetStationExercises.map(ex => ({
            id: ex.id,
            orderIndex: ex.orderIndex,
            stationIndex: ex.stationIndex,
          })),
        });

        if (targetStationExercises.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No exercises found at the specified station",
          });
        }

        // For stations rounds, exercises in the same station should have the same orderIndex
        // but different stationIndex values
        const stationOrderIndex = targetStationExercises[0]?.orderIndex || 0;
        
        // Get the next available stationIndex for this station
        const maxStationIndex = Math.max(
          ...targetStationExercises.map((ex) => ex.stationIndex || 0),
          0
        );
        const nextStationIndex = maxStationIndex + 1;

        // Get exercise details if not custom
        let exerciseName = input.customName || "Custom Exercise";
        if (input.newExerciseId) {
          const exercise = await tx.query.exercises.findFirst({
            where: eq(exercises.id, input.newExerciseId),
          });

          if (!exercise) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Exercise not found",
            });
          }
          exerciseName = exercise.name;
        }

        // Get template info from the first exercise at this station
        const templateExercise = targetStationExercises[0];
        const template = templateExercise?.template || null;

        // Insert the new exercise for all workouts
        const insertPromises = workoutIds.map((workoutId) =>
          tx.insert(WorkoutExercise).values({
            workoutId: workoutId,
            exerciseId: input.newExerciseId,
            orderIndex: stationOrderIndex, // Use same orderIndex as the station
            setsCompleted: 0,
            groupName: input.roundName,
            stationIndex: nextStationIndex, // Use incremented stationIndex for uniqueness
            isShared: true, // Circuit exercises are shared
            selectionSource: "manual_swap",
            template: template,
            custom_exercise: input.newExerciseId
              ? null
              : {
                  customName: input.customName,
                },
          }),
        );

        await Promise.all(insertPromises);

        console.log(
          `[addExerciseToStation] Added exercise "${exerciseName}" to station ${input.targetStationIndex} for ${workoutIds.length} workouts`,
        );

        return {
          success: true,
          affectedWorkouts: workoutIds.length,
          newExerciseName: exerciseName,
          stationIndex: input.targetStationIndex,
        };
      });
    }),

  // Public version of add exercise to station (for circuit workouts)
  addExerciseToStationPublic: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        clientId: z.string(),
        roundName: z.string(),
        targetStationIndex: z.number().min(0),
        newExerciseId: z.string().uuid().nullable(), // null for custom exercises
        customName: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[addExerciseToStationPublic] Starting with input:", input);

      // For circuit sessions, we allow modifications without check-in
      // Just verify the session exists
      const { TrainingSession } = await import("@acme/db/schema");
      
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });
      
      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }

      // Use transaction for consistency
      return await ctx.db.transaction(async (tx) => {
        // Get all workouts for this session
        const { Workout } = await import("@acme/db/schema");
        const workouts = await tx
          .select()
          .from(Workout)
          .where(
            and(
              eq(Workout.trainingSessionId, input.sessionId),
              or(
                eq(Workout.status, "draft"),
                eq(Workout.status, "ready"),
              ),
            ),
          );

        if (workouts.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No workouts found for this session",
          });
        }

        console.log("[addExerciseToStationPublic] Found workouts:", {
          count: workouts.length,
          workouts: workouts.map(w => ({ 
            id: w.id, 
            status: w.status, 
            userId: w.userId 
          })),
        });

        const workoutIds = workouts.map((w) => w.id);
        
        console.log("[addExerciseToStationPublic] Looking for exercises with:", {
          workoutIds: workoutIds,
          roundName: input.roundName,
          targetStationIndex: input.targetStationIndex,
        });

        // Debug: First, let's see ALL exercises for this round
        const allRoundExercises = await tx
          .select()
          .from(WorkoutExercise)
          .where(
            and(
              sql`${WorkoutExercise.workoutId} IN (${sql.join(
                workoutIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
              eq(WorkoutExercise.groupName, input.roundName)
            ),
          );
          
        console.log("[addExerciseToStationPublic] All exercises in round:", {
          count: allRoundExercises.length,
          exercises: allRoundExercises.map(ex => ({
            id: ex.id,
            workoutId: ex.workoutId,
            groupName: ex.groupName,
            orderIndex: ex.orderIndex,
            stationIndex: ex.stationIndex,
            exerciseId: ex.exerciseId,
            isShared: ex.isShared,
            custom_exercise: ex.custom_exercise,
          })),
          // Group by station for clarity
          groupedByOrderIndex: (() => {
            const grouped: Record<number, any[]> = {};
            allRoundExercises.forEach(ex => {
              if (!grouped[ex.orderIndex]) {
                grouped[ex.orderIndex] = [];
              }
              grouped[ex.orderIndex].push({
                id: ex.id,
                stationIndex: ex.stationIndex,
                exerciseId: ex.exerciseId,
                custom_exercise: ex.custom_exercise
              });
            });
            return grouped;
          })()
        });

        console.log("[addExerciseToStationPublic] DETAILED STATION MAPPING DEBUG:");

        // Find exercises at the target station
        // For stations rounds, we need to find the exercise that represents this station
        // The frontend sends 0-based station index, but exercises might have gaps in orderIndex
        
        // First, get all exercises in the round sorted by orderIndex
        console.log("[addExerciseToStationPublic] FILTERING LOGIC - Before filter:", {
          totalExercises: allRoundExercises.length,
          nullStationIndexCount: allRoundExercises.filter(ex => ex.stationIndex === null).length,
          zeroStationIndexCount: allRoundExercises.filter(ex => ex.stationIndex === 0).length,
          otherStationIndexCount: allRoundExercises.filter(ex => ex.stationIndex !== null && ex.stationIndex !== 0).length,
          detailedBreakdown: allRoundExercises.map(ex => ({
            orderIndex: ex.orderIndex,
            stationIndex: ex.stationIndex,
            isCustom: ex.custom_exercise !== null,
            willBeIncluded: (() => {
              const sameOrderIndexCount = allRoundExercises.filter(e => e.orderIndex === ex.orderIndex).length;
              if (sameOrderIndexCount === 1) return true;
              const hasStationIndex0 = allRoundExercises.some(e => e.orderIndex === ex.orderIndex && e.stationIndex === 0);
              return hasStationIndex0 ? ex.stationIndex === 0 : ex.stationIndex === null;
            })()
          }))
        });
        
        // For stations rounds, we need to identify the "main" exercise for each station
        // Legacy data may have stationIndex: null, new data should have stationIndex: 0
        const allRoundExercisesOrdered = allRoundExercises
          .filter(ex => {
            // Get all exercises with the same orderIndex
            const sameOrderIndexExercises = allRoundExercises.filter(e => e.orderIndex === ex.orderIndex);
            
            // If there's only one exercise with this orderIndex, include it
            if (sameOrderIndexExercises.length === 1) {
              return true;
            }
            
            // If there are multiple, prefer stationIndex 0, then null
            const hasStationIndex0 = sameOrderIndexExercises.some(e => e.stationIndex === 0);
            if (hasStationIndex0) {
              return ex.stationIndex === 0;
            } else {
              // For legacy data, use the one with stationIndex null
              return ex.stationIndex === null;
            }
          })
          .sort((a, b) => a.orderIndex - b.orderIndex);
        
        console.log("[addExerciseToStationPublic] Station mapping logic:", {
          input: {
            targetStationIndex: input.targetStationIndex,
            roundName: input.roundName
          },
          allRoundExercisesOrdered: allRoundExercisesOrdered.map(ex => ({
            id: ex.id,
            orderIndex: ex.orderIndex,
            stationIndex: ex.stationIndex,
            exerciseId: ex.exerciseId
          })),
          mapping: {
            frontendStationIndex: input.targetStationIndex,
            stationCount: allRoundExercisesOrdered.length,
            expectedOrderIndex: allRoundExercisesOrdered[input.targetStationIndex]?.orderIndex || 'NOT_FOUND',
            willMapToOrderIndex: allRoundExercisesOrdered[input.targetStationIndex]?.orderIndex
          }
        });
        
        // Find the exercise at the target station position
        const targetStationExercise = allRoundExercisesOrdered[input.targetStationIndex];
        
        if (!targetStationExercise) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Target station not found",
          });
        }
        
        // Now find all exercises with the same orderIndex (including those with stationIndex)
        const targetStationExercises = await tx
          .select()
          .from(WorkoutExercise)
          .where(
            and(
              sql`${WorkoutExercise.workoutId} IN (${sql.join(
                workoutIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
              eq(WorkoutExercise.groupName, input.roundName),
              eq(WorkoutExercise.orderIndex, targetStationExercise.orderIndex)
            ),
          )
          .orderBy(asc(WorkoutExercise.stationIndex));
          
        console.log("[addExerciseToStationPublic] Target station exercises found:", {
          count: targetStationExercises.length,
          exercises: targetStationExercises.map(ex => ({
            id: ex.id,
            orderIndex: ex.orderIndex,
            stationIndex: ex.stationIndex,
          })),
        });

        if (targetStationExercises.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No exercises found at the specified station",
          });
        }

        // For stations rounds, exercises in the same station share the same orderIndex
        // The stationIndex determines their position within the station (0, 1, 2, etc.)
        const stationOrderIndex = targetStationExercises[0]?.orderIndex || 0;
        
        // Get the next available stationIndex for this station
        const maxStationIndex = Math.max(
          ...targetStationExercises.map((ex) => ex.stationIndex ?? -1),
          -1
        );
        const nextStationIndex = maxStationIndex + 1;

        // Get exercise details if not custom
        let exerciseName = input.customName || "Custom Exercise";
        if (input.newExerciseId) {
          const exercise = await tx.query.exercises.findFirst({
            where: eq(exercises.id, input.newExerciseId),
          });

          if (!exercise) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Exercise not found",
            });
          }
          exerciseName = exercise.name;
        }

        // Get template info from the first exercise at this station
        const templateExercise = targetStationExercises[0];
        const template = templateExercise?.template || null;

        // Insert the new exercise for all workouts
        const insertPromises = workoutIds.map((workoutId) =>
          tx.insert(WorkoutExercise).values({
            workoutId: workoutId,
            exerciseId: input.newExerciseId,
            orderIndex: stationOrderIndex, // Use same orderIndex as the station
            setsCompleted: 0,
            groupName: input.roundName,
            stationIndex: nextStationIndex, // Use incremented stationIndex for position in station
            isShared: true, // Circuit exercises are shared
            selectionSource: "manual_swap",
            template: template,
            custom_exercise: input.newExerciseId
              ? null
              : {
                  customName: input.customName,
                },
          }),
        );

        await Promise.all(insertPromises);

        console.log(
          `[addExerciseToStationPublic] Added exercise "${exerciseName}" to station ${input.targetStationIndex} for ${workoutIds.length} workouts`,
        );

        return {
          success: true,
          affectedWorkouts: workoutIds.length,
          newExerciseName: exerciseName,
          stationIndex: input.targetStationIndex,
        };
      });
    }),

  // Swap a specific exercise by ID (for stations with multiple exercises)
  swapSpecificExercise: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        exerciseId: z.string(), // ID of the specific exercise to replace
        newExerciseId: z.string().nullable(), // null for custom exercises
        customName: z.string().optional(), // custom exercise name
        reason: z.string().optional(),
        swappedBy: z.string(), // clientId of who initiated the swap
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[swapSpecificExercise] Starting specific exercise swap with input:", input);

      // Get the new exercise details if not custom
      let newExerciseName = input.customName || "Custom Exercise";
      if (input.newExerciseId) {
        const newExercise = await ctx.db.query.exercises.findFirst({
          where: eq(exercises.id, input.newExerciseId),
        });

        if (!newExercise) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "New exercise not found",
          });
        }
        newExerciseName = newExercise.name;
      }

      return await ctx.db.transaction(async (tx) => {
        // Find the exercise to be replaced
        const targetExercise = await tx.query.WorkoutExercise.findFirst({
          where: eq(WorkoutExercise.id, input.exerciseId),
        });

        if (!targetExercise) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Exercise to replace not found",
          });
        }

        // Update the specific exercise
        const updateData: any = {
          selectionSource: "manual_swap",
        };
        
        if (input.newExerciseId) {
          // Regular exercise swap
          updateData.exerciseId = input.newExerciseId;
          updateData.custom_exercise = null;
        } else {
          // Custom exercise
          updateData.exerciseId = null;
          updateData.custom_exercise = {
            customName: input.customName,
            originalExerciseId: targetExercise.exerciseId,
          };
        }

        const updateResult = await tx
          .update(WorkoutExercise)
          .set(updateData)
          .where(eq(WorkoutExercise.id, input.exerciseId))
          .returning();

        console.log("[swapSpecificExercise] Update result:", updateResult);

        // Log the swap if both IDs are valid
        if (targetExercise.exerciseId && input.newExerciseId) {
          const { Workout } = await import("@acme/db/schema");
          
          const workout = await tx.query.Workout.findFirst({
            where: eq(Workout.id, targetExercise.workoutId),
          });

          if (workout) {
            await tx.insert(workoutExerciseSwaps).values({
              trainingSessionId: input.sessionId,
              clientId: workout.userId,
              originalExerciseId: targetExercise.exerciseId,
              newExerciseId: input.newExerciseId,
              swapReason: input.reason || "Specific exercise swap",
              swappedBy: input.swappedBy,
            });
          }
        }

        return { 
          success: true, 
          newExerciseName: newExerciseName,
        };
      });
    }),

  // Delete a specific exercise from all circuit workouts in a session
  deleteCircuitExercise: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        exerciseId: z.string().uuid(), // WorkoutExercise.id
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[deleteCircuitExercise] Starting deletion with input:", input);

      return await ctx.db.transaction(async (tx) => {
        // 1. Find the specific exercise to delete
        const exerciseToDelete = await tx.query.WorkoutExercise.findFirst({
          where: eq(WorkoutExercise.id, input.exerciseId),
        });

        if (!exerciseToDelete) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Exercise not found",
          });
        }

        console.log("[deleteCircuitExercise] Found exercise to delete:", {
          id: exerciseToDelete.id,
          groupName: exerciseToDelete.groupName,
          orderIndex: exerciseToDelete.orderIndex,
          stationIndex: exerciseToDelete.stationIndex,
          exerciseId: exerciseToDelete.exerciseId,
        });

        // 2. Get all workouts for this session
        const { Workout } = await import("@acme/db/schema");
        
        const workouts = await tx
          .select()
          .from(Workout)
          .where(
            and(
              eq(Workout.trainingSessionId, input.sessionId),
              or(
                eq(Workout.status, "draft"),
                eq(Workout.status, "ready"),
              ),
            ),
          );

        if (workouts.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No workouts found for this session",
          });
        }

        const workoutIds = workouts.map((w) => w.id);

        console.log("[deleteCircuitExercise] Found workouts:", {
          count: workouts.length,
          workoutIds: workoutIds,
        });

        // 3. Delete ALL matching exercises across ALL workouts
        // (same round + orderIndex + stationIndex combination)
        const deleteConditions = [
          sql`${WorkoutExercise.workoutId} IN (${sql.join(
            workoutIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
          eq(WorkoutExercise.orderIndex, exerciseToDelete.orderIndex),
        ];

        // Handle groupName matching (null vs specific value)
        if (exerciseToDelete.groupName !== null) {
          deleteConditions.push(eq(WorkoutExercise.groupName, exerciseToDelete.groupName));
        } else {
          deleteConditions.push(isNull(WorkoutExercise.groupName));
        }

        // Handle stationIndex matching (null vs specific value)
        if (exerciseToDelete.stationIndex !== null) {
          deleteConditions.push(eq(WorkoutExercise.stationIndex, exerciseToDelete.stationIndex));
        } else {
          deleteConditions.push(isNull(WorkoutExercise.stationIndex));
        }

        const deletedExercises = await tx
          .delete(WorkoutExercise)
          .where(and(...deleteConditions))
          .returning();

        console.log("[deleteCircuitExercise] Deleted exercises:", {
          count: deletedExercises.length,
          exerciseIds: deletedExercises.map(ex => ex.id),
        });

        // 4. Close gaps within station (stationIndex reordering)
        // Only if we deleted a secondary exercise (stationIndex !== null)
        if (exerciseToDelete.stationIndex !== null) {
          const reorderConditions = [
            sql`${WorkoutExercise.workoutId} IN (${sql.join(
              workoutIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
            eq(WorkoutExercise.orderIndex, exerciseToDelete.orderIndex),
            sql`${WorkoutExercise.stationIndex} > ${exerciseToDelete.stationIndex}`,
          ];

          // Handle groupName matching (null vs specific value) for reordering
          if (exerciseToDelete.groupName !== null) {
            reorderConditions.push(eq(WorkoutExercise.groupName, exerciseToDelete.groupName));
          } else {
            reorderConditions.push(isNull(WorkoutExercise.groupName));
          }

          await tx
            .update(WorkoutExercise)
            .set({ stationIndex: sql`${WorkoutExercise.stationIndex} - 1` })
            .where(and(...reorderConditions));
        }

        console.log("[deleteCircuitExercise] Deletion completed successfully");

        return { 
          success: true, 
          affectedWorkouts: workoutIds.length,
          deletedExerciseCount: deletedExercises.length,
        };
      });
    }),

  // Add exercise to end of a round (for circuit workouts)
  addExerciseToRound: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        roundName: z.string(),
        newExerciseId: z.string().uuid().nullable(), // null for custom exercises
        customName: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;

      console.log("[addExerciseToRound] Starting with input:", input);

      // Import required schemas
      const { TrainingSession, Workout } = await import("@acme/db/schema");

      // Verify the session exists and belongs to the user's business
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

      // Use transaction for consistency
      return await ctx.db.transaction(async (tx) => {
        // Get all workouts for this session
        const workouts = await tx
          .select()
          .from(Workout)
          .where(
            and(
              eq(Workout.trainingSessionId, input.sessionId),
              or(
                eq(Workout.status, "draft"),
                eq(Workout.status, "ready"),
              ),
            ),
          );

        if (workouts.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No workouts found for this session",
          });
        }

        console.log("[addExerciseToRound] Found workouts:", {
          count: workouts.length,
          workouts: workouts.map(w => ({ 
            id: w.id, 
            status: w.status, 
            userId: w.userId 
          })),
        });

        const workoutIds = workouts.map((w) => w.id);
        
        // Get all exercises in the target round to find the next orderIndex
        const allRoundExercises = await tx
          .select()
          .from(WorkoutExercise)
          .where(
            and(
              sql`${WorkoutExercise.workoutId} IN (${sql.join(
                workoutIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
              eq(WorkoutExercise.groupName, input.roundName)
            ),
          );
          
        console.log("[addExerciseToRound] All exercises in round:", {
          count: allRoundExercises.length,
          exercises: allRoundExercises.map(ex => ({
            id: ex.id,
            workoutId: ex.workoutId,
            groupName: ex.groupName,
            orderIndex: ex.orderIndex,
            stationIndex: ex.stationIndex,
            exerciseId: ex.exerciseId,
          })),
        });

        // Find the highest orderIndex in this round
        const maxOrderIndex = allRoundExercises.length > 0 
          ? Math.max(...allRoundExercises.map((ex) => ex.orderIndex || 0))
          : -1;
        const nextOrderIndex = maxOrderIndex + 1;

        console.log("[addExerciseToRound] Order index calculation:", {
          maxOrderIndex,
          nextOrderIndex,
        });

        // Get exercise details if not custom
        let exerciseName = input.customName || "Custom Exercise";
        if (input.newExerciseId) {
          const exercise = await tx.query.exercises.findFirst({
            where: eq(exercises.id, input.newExerciseId),
          });

          if (!exercise) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Exercise not found",
            });
          }
          exerciseName = exercise.name;
        }

        // Get template info from an existing exercise in this round (if any)
        const templateExercise = allRoundExercises[0];
        const template = templateExercise?.template || null;

        console.log("[addExerciseToRound] Template info:", {
          hasTemplate: !!template,
          templateExerciseId: templateExercise?.id,
        });

        // Insert the new exercise for all workouts
        const insertPromises = workoutIds.map((workoutId) =>
          tx.insert(WorkoutExercise).values({
            workoutId: workoutId,
            exerciseId: input.newExerciseId,
            orderIndex: nextOrderIndex, // Add at end of round
            setsCompleted: 0,
            groupName: input.roundName,
            stationIndex: null, // Always null for regular round exercises
            isShared: true, // Circuit exercises are shared
            selectionSource: "manual_swap",
            template: template,
            custom_exercise: input.newExerciseId
              ? null
              : {
                  customName: input.customName,
                },
          }),
        );

        await Promise.all(insertPromises);

        console.log(
          `[addExerciseToRound] Added exercise "${exerciseName}" to end of round "${input.roundName}" for ${workoutIds.length} workouts`,
        );

        return {
          success: true,
          affectedWorkouts: workoutIds.length,
          newExerciseName: exerciseName,
          roundName: input.roundName,
          orderIndex: nextOrderIndex,
        };
      });
    }),

  // Public version of add exercise to round (for circuit workouts)
  addExerciseToRoundPublic: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        clientId: z.string(),
        roundName: z.string(),
        newExerciseId: z.string().uuid().nullable(), // null for custom exercises
        customName: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[addExerciseToRoundPublic] Starting with input:", input);

      // For circuit sessions, we allow modifications without check-in
      // Just verify the session exists
      const { TrainingSession } = await import("@acme/db/schema");
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }

      // Use transaction for consistency
      return await ctx.db.transaction(async (tx) => {
        // Get all workouts for this session
        const { Workout } = await import("@acme/db/schema");
        const workouts = await tx
          .select()
          .from(Workout)
          .where(
            and(
              eq(Workout.trainingSessionId, input.sessionId),
              or(
                eq(Workout.status, "draft"),
                eq(Workout.status, "ready"),
              ),
            ),
          );

        if (workouts.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No workouts found for this session",
          });
        }

        console.log("[addExerciseToRoundPublic] Found workouts:", {
          count: workouts.length,
          workouts: workouts.map(w => ({ 
            id: w.id, 
            status: w.status, 
            userId: w.userId 
          })),
        });

        const workoutIds = workouts.map((w) => w.id);
        
        // Get all exercises in the target round to find the next orderIndex
        const allRoundExercises = await tx
          .select()
          .from(WorkoutExercise)
          .where(
            and(
              sql`${WorkoutExercise.workoutId} IN (${sql.join(
                workoutIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
              eq(WorkoutExercise.groupName, input.roundName)
            ),
          );
          
        console.log("[addExerciseToRoundPublic] All exercises in round:", {
          count: allRoundExercises.length,
          exercises: allRoundExercises.map(ex => ({
            id: ex.id,
            workoutId: ex.workoutId,
            groupName: ex.groupName,
            orderIndex: ex.orderIndex,
            stationIndex: ex.stationIndex,
            exerciseId: ex.exerciseId,
          })),
        });

        // Find the highest orderIndex in this round
        const maxOrderIndex = allRoundExercises.length > 0 
          ? Math.max(...allRoundExercises.map((ex) => ex.orderIndex || 0))
          : -1;
        const nextOrderIndex = maxOrderIndex + 1;

        console.log("[addExerciseToRoundPublic] Order index calculation:", {
          maxOrderIndex,
          nextOrderIndex,
        });

        // Get exercise details if not custom
        let exerciseName = input.customName || "Custom Exercise";
        if (input.newExerciseId) {
          const exercise = await tx.query.exercises.findFirst({
            where: eq(exercises.id, input.newExerciseId),
          });

          if (!exercise) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Exercise not found",
            });
          }
          exerciseName = exercise.name;
        }

        // Get template info from an existing exercise in this round (if any)
        const templateExercise = allRoundExercises[0];
        const template = templateExercise?.template || null;

        console.log("[addExerciseToRoundPublic] Template info:", {
          hasTemplate: !!template,
          templateExerciseId: templateExercise?.id,
        });

        // Check if this is a stations round by looking at the circuit config
        const { TrainingSession } = await import("@acme/db/schema");
        
        const sessionWithConfig = await tx
          .select()
          .from(TrainingSession)
          .where(eq(TrainingSession.id, input.sessionId))
          .limit(1);
        
        let stationIndex = null;
        
        if (sessionWithConfig?.[0]?.templateConfig && 
            sessionWithConfig[0].templateType === 'circuit' &&
            sessionWithConfig[0].templateConfig.type === 'circuit') {
          const config = sessionWithConfig[0].templateConfig.config as any;
          const roundNumber = parseInt(input.roundName.match(/\d+/)?.[0] || '0');
          const roundTemplate = config.roundTemplates?.find((rt: any) => rt.roundNumber === roundNumber);
          
          if (roundTemplate?.template?.type === 'stations_round') {
            // For stations rounds, assign the station index based on how many unique stations exist
            // Group exercises by orderIndex to count stations
            const stationMap = new Map<number, number>();
            allRoundExercises.forEach(ex => {
              if (!stationMap.has(ex.orderIndex)) {
                stationMap.set(ex.orderIndex, 0);
              }
            });
            
            // The new exercise will be at a new station, so stationIndex should be 0 (first exercise in the new station)
            stationIndex = 0;
            
            console.log("[addExerciseToRoundPublic] NEW STATION - Stations round detected:", {
              roundName: input.roundName,
              roundNumber: roundNumber,
              roundType: roundTemplate.template.type,
              allExercisesInRound: allRoundExercises.length,
              existingStations: stationMap.size,
              existingOrderIndexes: Array.from(stationMap.keys()).sort((a, b) => a - b),
              newOrderIndex: nextOrderIndex,
              newStationIndex: stationIndex, // Should be 0 for first exercise in new station
              exerciseToAdd: input.newExerciseId ? 'Selected exercise' : `Custom: ${input.customName}`,
            });
            
            // Log detailed station structure
            console.log("[addExerciseToRoundPublic] NEW STATION - Current station structure:", {
              stationBreakdown: Array.from(stationMap.keys()).sort((a, b) => a - b).map(orderIdx => {
                const exercisesAtStation = allRoundExercises.filter(ex => ex.orderIndex === orderIdx);
                return {
                  orderIndex: orderIdx,
                  exerciseCount: exercisesAtStation.length,
                  stationIndexes: exercisesAtStation.map(ex => ex.stationIndex).sort((a, b) => (a || 0) - (b || 0)),
                  exercises: exercisesAtStation.map(ex => ({
                    id: ex.id.slice(-8),
                    stationIndex: ex.stationIndex,
                    exerciseId: ex.exerciseId?.slice(-8) || 'custom',
                  }))
                };
              })
            });
          }
        }

        // Insert the new exercise for all workouts
        const insertPromises = workoutIds.map((workoutId) =>
          tx.insert(WorkoutExercise).values({
            workoutId: workoutId,
            exerciseId: input.newExerciseId,
            orderIndex: nextOrderIndex, // Add at end of round
            setsCompleted: 0,
            groupName: input.roundName,
            stationIndex: stationIndex, // Proper station index for stations rounds
            isShared: true, // Circuit exercises are shared
            selectionSource: "manual_swap",
            template: template,
            custom_exercise: input.newExerciseId
              ? null
              : {
                  customName: input.customName,
                },
          }),
        );

        await Promise.all(insertPromises);

        // Log the final result for stations rounds
        if (stationIndex !== null) {
          console.log("[addExerciseToRoundPublic] NEW STATION - Exercise inserted:", {
            exerciseName: exerciseName,
            roundName: input.roundName,
            finalOrderIndex: nextOrderIndex,
            finalStationIndex: stationIndex,
            workoutsAffected: workoutIds.length,
            isCustomExercise: !input.newExerciseId,
          });
        }

        console.log(
          `[addExerciseToRoundPublic] Added exercise "${exerciseName}" to end of round "${input.roundName}" for ${workoutIds.length} workouts`,
        );

        return {
          success: true,
          affectedWorkouts: workoutIds.length,
          newExerciseName: exerciseName,
          roundName: input.roundName,
          orderIndex: nextOrderIndex,
        };
      });
    }),
} satisfies TRPCRouterRecord;
