import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, sql, inArray } from "@acme/db";
import { TrainingSession, Workout, WorkoutExercise } from "@acme/db/schema";
import { DEFAULT_CIRCUIT_CONFIG, createDefaultRoundTemplates, migrateToRoundTemplates } from "@acme/db";
import {
  CircuitConfigInputSchema,
  UpdateCircuitConfigSchema,
  CircuitConfigSchema,
} from "@acme/validators";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { getSessionUserWithBusiness } from "../utils/session";

// Helper to ensure round templates exist in config
function ensureRoundTemplates(config: any) {
  // If roundTemplates already exist, normalize them
  if (config.config?.roundTemplates?.length > 0) {
    return {
      ...config,
      config: {
        ...config.config,
        roundTemplates: config.config.roundTemplates.map((rt: any) => {
          if (rt.template.type === 'circuit_round') {
            return {
              ...rt,
              template: {
                ...rt.template,
                // Ensure all values are explicitly set (including 0)
                workDuration: rt.template.workDuration !== undefined 
                  ? rt.template.workDuration 
                  : (config.config.workDuration !== undefined ? config.config.workDuration : 45),
                restDuration: rt.template.restDuration !== undefined 
                  ? rt.template.restDuration 
                  : (config.config.restDuration !== undefined ? config.config.restDuration : 0),
                repeatTimes: rt.template.repeatTimes ?? 1,
                restBetweenSets: rt.template.restBetweenSets ?? 60,
              }
            };
          } else if (rt.template.type === 'stations_round') {
            console.log('[BUG TRACE - ensureRoundTemplates] Processing stations_round:', {
              roundNumber: rt.roundNumber,
              hasStationCircuits: !!rt.template.stationCircuits,
              stationCircuitsKeys: rt.template.stationCircuits ? Object.keys(rt.template.stationCircuits) : [],
              stationCircuitsData: rt.template.stationCircuits,
              workDuration: rt.template.workDuration,
              restDuration: rt.template.restDuration
            });
            
            const processedTemplate = {
              ...rt,
              template: {
                ...rt.template,
                workDuration: rt.template.workDuration !== undefined 
                  ? rt.template.workDuration 
                  : (config.config.workDuration !== undefined ? config.config.workDuration : 60),
                restDuration: rt.template.restDuration !== undefined 
                  ? rt.template.restDuration 
                  : (config.config.restDuration !== undefined ? config.config.restDuration : 15),
                repeatTimes: rt.template.repeatTimes ?? 1,
              }
            };
            
            console.log('[BUG TRACE - ensureRoundTemplates] Processed stations_round result:', {
              roundNumber: processedTemplate.roundNumber,
              hasStationCircuits: !!processedTemplate.template.stationCircuits,
              stationCircuitsData: processedTemplate.template.stationCircuits
            });
            
            return processedTemplate;
          } else if (rt.template.type === 'amrap_round') {
            return {
              ...rt,
              template: {
                ...rt.template,
                totalDuration: rt.template.totalDuration ?? 300, // Default 5 minutes
              }
            };
          }
          return rt;
        }),
      },
    };
  }
  
  // Otherwise create round templates from legacy fields
  const rounds = config.config?.rounds ?? 3;
  const exercisesPerRound = config.config?.exercisesPerRound ?? 6;
  // Use explicit checks for 0 values
  const workDuration = config.config?.workDuration !== undefined ? config.config.workDuration : 45;
  const restDuration = config.config?.restDuration !== undefined ? config.config.restDuration : 0;
  
  return {
    ...config,
    config: {
      ...config.config,
      roundTemplates: createDefaultRoundTemplates(
        rounds,
        exercisesPerRound,
        workDuration,
        restDuration
      ),
    },
  };
}

export const circuitConfigRouter = createTRPCRouter({
  /**
   * Get circuit configuration for a session
   */
  getBySession: publicProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db
        .select()
        .from(TrainingSession)
        .where(eq(TrainingSession.id, input.sessionId))
        .limit(1)
        .then((res) => res[0]);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Return circuit config if it exists, otherwise return default
      if (
        session.templateType === "circuit" &&
        session.templateConfig &&
        typeof session.templateConfig === "object" &&
        "type" in session.templateConfig &&
        session.templateConfig.type === "circuit"
      ) {
        console.log('[BUG TRACE - getBySession] Processing circuit config:', {
          sessionId: input.sessionId,
          templateType: session.templateType,
          hasTemplateConfig: !!session.templateConfig,
          templateConfigType: (session.templateConfig as any)?.type
        });
        
        const result = ensureRoundTemplates(session.templateConfig);
        
        // Filter out orphaned round templates (rounds with no exercises in database)
        if (result.config?.roundTemplates?.length > 0) {
          // Get all unique round names that have exercises in the database
          const roundsWithExercises = await ctx.db
            .selectDistinct({ groupName: WorkoutExercise.groupName })
            .from(WorkoutExercise)
            .innerJoin(Workout, eq(Workout.id, WorkoutExercise.workoutId))
            .where(eq(Workout.trainingSessionId, input.sessionId));
          
          const existingRoundNames = new Set(
            roundsWithExercises
              .map(r => r.groupName)
              .filter(name => name?.startsWith('Round '))
          );
          
          console.log('[BUG TRACE - getBySession] Found rounds with exercises:', Array.from(existingRoundNames));
          
          // Filter roundTemplates to only include rounds that have exercises
          const filteredRoundTemplates = result.config.roundTemplates.filter((rt: any) => {
            const roundName = `Round ${rt.roundNumber}`;
            const hasExercises = existingRoundNames.has(roundName);
            if (!hasExercises) {
              console.log('[BUG TRACE - getBySession] Filtering out orphaned round:', roundName);
            }
            return hasExercises;
          });
          
          // Renumber the remaining rounds sequentially
          const renumberedRoundTemplates = filteredRoundTemplates.map((rt: any, index: number) => ({
            ...rt,
            roundNumber: index + 1
          }));
          
          // Update exercise groupNames to match the new round numbers
          if (filteredRoundTemplates.length !== (session.templateConfig as any).config?.roundTemplates?.length) {
            console.log('[BUG TRACE - getBySession] Updating exercise groupNames after renumbering...');
            
            // Build mapping of old round names to new round names
            const roundNameMapping: Record<string, string> = {};
            filteredRoundTemplates.forEach((rt: any, index: number) => {
              const oldRoundName = `Round ${rt.roundNumber}`;
              const newRoundName = `Round ${index + 1}`;
              if (oldRoundName !== newRoundName) {
                roundNameMapping[oldRoundName] = newRoundName;
              }
            });
            
            console.log('[BUG TRACE - getBySession] Round name mapping:', roundNameMapping);
            
            // Update all exercises with the new round names
            for (const [oldName, newName] of Object.entries(roundNameMapping)) {
              await ctx.db
                .update(WorkoutExercise)
                .set({ groupName: newName })
                .where(
                  and(
                    eq(WorkoutExercise.groupName, oldName),
                    inArray(
                      WorkoutExercise.workoutId,
                      ctx.db
                        .select({ id: Workout.id })
                        .from(Workout)
                        .where(eq(Workout.trainingSessionId, input.sessionId))
                    )
                  )
                );
              
              console.log(`[BUG TRACE - getBySession] Updated exercises from "${oldName}" to "${newName}"`);
            }
          }
          
          result.config.roundTemplates = renumberedRoundTemplates;
          result.config.rounds = renumberedRoundTemplates.length;
          
          console.log('[BUG TRACE - getBySession] After filtering orphaned rounds:', {
            originalCount: (session.templateConfig as any).config?.roundTemplates?.length || 0,
            filteredCount: renumberedRoundTemplates.length,
            filteredRounds: renumberedRoundTemplates.map((rt: any) => rt.roundNumber),
            roundTemplateDetails: renumberedRoundTemplates.map((rt: any) => ({
              roundNumber: rt.roundNumber,
              type: rt.template?.type,
              workDuration: rt.template?.workDuration,
              restDuration: rt.template?.restDuration,
              repeatTimes: rt.template?.repeatTimes
            }))
          });
        }
        
        console.log('[BUG TRACE - getBySession] After ensureRoundTemplates and filtering:', {
          sessionId: input.sessionId,
          hasRoundTemplates: !!result.config?.roundTemplates,
          roundTemplatesCount: result.config?.roundTemplates?.length || 0,
          roundTemplatesWithStationCircuits: result.config?.roundTemplates?.filter((rt: any) => 
            rt.template.type === 'stations_round' && rt.template.stationCircuits
          ).map((rt: any) => ({
            roundNumber: rt.roundNumber,
            stationCircuitsKeys: Object.keys(rt.template.stationCircuits)
          })) || []
        });
        
        return result;
      }

      // Return default config for circuit sessions without config
      if (session.templateType === "circuit") {
        return DEFAULT_CIRCUIT_CONFIG;
      }

      return null;
    }),

  /**
   * Update circuit configuration for a session
   */
  update: protectedProcedure
    .input(CircuitConfigInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getSessionUserWithBusiness(ctx);

      // Get the session
      const session = await ctx.db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.id, input.sessionId),
            eq(TrainingSession.businessId, user.businessId),
          ),
        )
        .limit(1)
        .then((res) => res[0]);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      if (session.templateType !== "circuit") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not a circuit training session",
        });
      }

      // Only trainers can update circuit config
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can update circuit configuration",
        });
      }
      
      // Get existing config or use default
      const existingConfig =
        session.templateConfig &&
        typeof session.templateConfig === "object" &&
        "type" in session.templateConfig &&
        session.templateConfig.type === "circuit"
          ? (session.templateConfig as typeof DEFAULT_CIRCUIT_CONFIG)
          : DEFAULT_CIRCUIT_CONFIG;

      // Merge with updates - use ISO string for date
      const updatedConfig = {
        type: "circuit" as const,
        config: {
          ...existingConfig.config,
          ...input.config,
          // Ensure legacy fields are preserved when updating roundTemplates
          ...(input.config.roundTemplates ? {
            workDuration: existingConfig.config.workDuration || 45,
            restDuration: existingConfig.config.restDuration || 15,
            exercisesPerRound: existingConfig.config.exercisesPerRound || 6,
          } : {}),
        },
        lastUpdated: new Date().toISOString(),
        updatedBy: user.id,
      };

      // Ensure round templates exist
      const configWithRoundTemplates = ensureRoundTemplates(updatedConfig);

      // Validate the complete config
      const validatedConfig = CircuitConfigSchema.parse(configWithRoundTemplates);

      // Update the session
      await ctx.db
        .update(TrainingSession)
        .set({
          templateConfig: validatedConfig,
          updatedAt: new Date(), // Set manually to bypass $onUpdateFn
        })
        .where(eq(TrainingSession.id, input.sessionId));

      return validatedConfig;
    }),

  /**
   * Reset circuit configuration to defaults
   */
  reset: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getSessionUserWithBusiness(ctx);

      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can reset circuit configuration",
        });
      }

      const session = await ctx.db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.id, input.sessionId),
            eq(TrainingSession.businessId, user.businessId),
          ),
        )
        .limit(1)
        .then((res) => res[0]);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      if (session.templateType !== "circuit") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not a circuit training session",
        });
      }

      const resetConfig = {
        ...DEFAULT_CIRCUIT_CONFIG,
        lastUpdated: new Date(),
        updatedBy: user.id,
      };

      const [updated] = await ctx.db
        .update(TrainingSession)
        .set({
          templateConfig: resetConfig,
        })
        .where(eq(TrainingSession.id, input.sessionId))
        .returning();

      return updated?.templateConfig || resetConfig;
    }),

  /**
   * Public endpoint for getting circuit config (no auth required)
   * Used by client preferences pages
   */
  getPublic: publicProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db
        .select({
          id: TrainingSession.id,
          templateType: TrainingSession.templateType,
          templateConfig: TrainingSession.templateConfig,
        })
        .from(TrainingSession)
        .where(eq(TrainingSession.id, input.sessionId))
        .limit(1)
        .then((res) => res[0]);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      if (session.templateType !== "circuit") {
        return null;
      }

      // Return config or default
      if (
        session.templateConfig &&
        typeof session.templateConfig === "object" &&
        "type" in session.templateConfig &&
        session.templateConfig.type === "circuit"
      ) {
        return ensureRoundTemplates(session.templateConfig);
      }

      return DEFAULT_CIRCUIT_CONFIG;
    }),

  /**
   * Public endpoint for updating circuit config (no auth required)
   * Used by client preferences pages on mobile
   */
  updatePublic: publicProcedure
    .input(CircuitConfigInputSchema)
    .mutation(async ({ ctx, input }) => {
      console.log('[CircuitConfig API] updatePublic called with input:', JSON.stringify(input, null, 2));
      console.log('[BUG TRACE] Circuit config update - sourceWorkoutId:', input.config.sourceWorkoutId);
      
      // Get the session to verify it exists and is a circuit session
      const session = await ctx.db
        .select()
        .from(TrainingSession)
        .where(eq(TrainingSession.id, input.sessionId))
        .limit(1)
        .then((res) => res[0]);
      
      console.log('[BUG TRACE] Session before update:', {
        sessionId: session?.id,
        hasTemplateConfig: !!session?.templateConfig,
        currentSourceWorkoutId: (session?.templateConfig as any)?.config?.sourceWorkoutId,
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      if (session.templateType !== "circuit") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not a circuit type",
        });
      }

      // Get existing config or use default
      const existingConfig =
        session.templateConfig &&
        typeof session.templateConfig === "object" &&
        "type" in session.templateConfig &&
        session.templateConfig.type === "circuit"
          ? (session.templateConfig as typeof DEFAULT_CIRCUIT_CONFIG)
          : DEFAULT_CIRCUIT_CONFIG;

      // Merge with updates - use ISO string for date
      const updatedConfig = {
        type: "circuit" as const,
        config: {
          ...existingConfig.config,
          ...input.config,
          // Ensure legacy fields are preserved when updating roundTemplates
          ...(input.config.roundTemplates ? {
            workDuration: existingConfig.config.workDuration || 45,
            restDuration: existingConfig.config.restDuration || 15,
            exercisesPerRound: existingConfig.config.exercisesPerRound || 6,
          } : {}),
        },
        lastUpdated: new Date().toISOString(),
        updatedBy: "anonymous", // Since it's public
      };
      
      // Validate station circuit configurations if they exist
      if (input.config.roundTemplates) {
        console.log('[BUG TRACE - updatePublic] Processing roundTemplates for validation:', {
          roundTemplatesCount: input.config.roundTemplates.length,
          roundTemplates: input.config.roundTemplates.map(rt => ({
            roundNumber: rt.roundNumber,
            type: rt.template.type,
            hasStationCircuits: rt.template.type === 'stations_round' ? !!(rt.template as any).stationCircuits : false,
            stationCircuitsKeys: rt.template.type === 'stations_round' && (rt.template as any).stationCircuits ? Object.keys((rt.template as any).stationCircuits) : []
          }))
        });
        
        for (const roundTemplate of input.config.roundTemplates) {
          if (roundTemplate.template.type === 'stations_round' && 
              roundTemplate.template.stationCircuits) {
            console.log('[BUG TRACE - updatePublic] Validating stations_round with stationCircuits:', {
              roundNumber: roundTemplate.roundNumber,
              stationWorkDuration: roundTemplate.template.workDuration,
              stationCircuits: roundTemplate.template.stationCircuits,
              stationCircuitsKeys: Object.keys(roundTemplate.template.stationCircuits)
            });
            
            const stationWorkDuration = roundTemplate.template.workDuration;
            
            // Validate each station circuit configuration
            for (const [stationIndex, circuitConfig] of Object.entries(roundTemplate.template.stationCircuits)) {
              console.log('[BUG TRACE - updatePublic] Validating station circuit:', {
                stationIndex,
                circuitConfig,
                stationWorkDuration
              });
              
              const { workDuration, restDuration, sets } = circuitConfig;
              const totalConfiguredTime = (workDuration * sets) + (restDuration * (sets - 1));
              
              if (totalConfiguredTime !== stationWorkDuration) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Station ${parseInt(stationIndex) + 1} circuit timing (${totalConfiguredTime}s) must equal station duration (${stationWorkDuration}s)`,
                });
              }
            }
          }
        }
      }
      

      // Ensure round templates exist
      const configWithRoundTemplates = ensureRoundTemplates(updatedConfig);
      
      console.log('[CircuitConfig API] Config after ensureRoundTemplates:', JSON.stringify(configWithRoundTemplates, null, 2));

      // Validate the complete config
      let validatedConfig;
      try {
        validatedConfig = CircuitConfigSchema.parse(configWithRoundTemplates);
      } catch (error) {
        console.error('[CircuitConfig API] Validation error:', error);
        throw error;
      }

      // Update the session
      await ctx.db
        .update(TrainingSession)
        .set({
          templateConfig: validatedConfig,
          updatedAt: new Date(),
        })
        .where(eq(TrainingSession.id, input.sessionId));

      return validatedConfig;
    }),

  /**
   * Reorder rounds in circuit configuration
   */
  reorderRounds: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      currentRoundNumber: z.number().min(1),
      direction: z.enum(["up", "down"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getSessionUserWithBusiness(ctx);

      // Only trainers can reorder rounds
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can reorder rounds",
        });
      }

      // Get the session
      const session = await ctx.db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.id, input.sessionId),
            eq(TrainingSession.businessId, user.businessId),
          ),
        )
        .limit(1)
        .then((res) => res[0]);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      if (session.templateType !== "circuit") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not a circuit training session",
        });
      }

      // Get current config
      const currentConfig = session.templateConfig as typeof DEFAULT_CIRCUIT_CONFIG;
      if (!currentConfig?.config?.roundTemplates) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No round templates found",
        });
      }

      const roundTemplates = [...currentConfig.config.roundTemplates];
      const currentIndex = input.currentRoundNumber - 1;
      const targetIndex = input.direction === "up" ? currentIndex - 1 : currentIndex + 1;

      // Validate bounds
      if (targetIndex < 0 || targetIndex >= roundTemplates.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot move round in that direction",
        });
      }

      // Swap rounds in the array
      const temp = roundTemplates[currentIndex]!;
      roundTemplates[currentIndex] = roundTemplates[targetIndex]!;
      roundTemplates[targetIndex] = temp;

      // Update round numbers
      roundTemplates.forEach((template, index) => {
        template.roundNumber = index + 1;
      });

      // Update the config
      const updatedConfig = {
        ...currentConfig,
        config: {
          ...currentConfig.config,
          roundTemplates,
        },
        lastUpdated: new Date().toISOString(),
        updatedBy: user.id,
      };

      // Validate the updated config
      const validatedConfig = CircuitConfigSchema.parse(updatedConfig);

      // Start transaction to update both config and exercise round names
      await ctx.db.transaction(async (tx) => {
        // Update the session config
        await tx
          .update(TrainingSession)
          .set({
            templateConfig: validatedConfig,
            updatedAt: new Date(),
          })
          .where(eq(TrainingSession.id, input.sessionId));

        // Update exercise groupNames in WorkoutExercise table
        // We need to rename the rounds to reflect new order
        const currentRoundName = `Round ${input.currentRoundNumber}`;
        const targetRoundName = `Round ${input.direction === "up" ? input.currentRoundNumber - 1 : input.currentRoundNumber + 1}`;
        const tempRoundName = `Round_TEMP_${Date.now()}`;

        // Get all workouts for this session
        const workouts = await tx
          .select({ id: Workout.id })
          .from(Workout)
          .where(eq(Workout.trainingSessionId, input.sessionId));

        if (workouts.length > 0) {
          // Update WorkoutExercise groupNames for each workout
          for (const workout of workouts) {
            // Step 1: Rename current round to temp
            await tx
              .update(WorkoutExercise)
              .set({ groupName: tempRoundName })
              .where(and(
                eq(WorkoutExercise.workoutId, workout.id),
                eq(WorkoutExercise.groupName, currentRoundName)
              ));

            // Step 2: Rename target round to current
            await tx
              .update(WorkoutExercise)
              .set({ groupName: currentRoundName })
              .where(and(
                eq(WorkoutExercise.workoutId, workout.id),
                eq(WorkoutExercise.groupName, targetRoundName)
              ));

            // Step 3: Rename temp to target
            await tx
              .update(WorkoutExercise)
              .set({ groupName: targetRoundName })
              .where(and(
                eq(WorkoutExercise.workoutId, workout.id),
                eq(WorkoutExercise.groupName, tempRoundName)
              ));
          }
        }
      });

      return validatedConfig;
    }),

  /**
   * Delete a round from circuit configuration
   */
  deleteRound: publicProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      roundNumber: z.number().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the session
      const session = await ctx.db
        .select()
        .from(TrainingSession)
        .where(eq(TrainingSession.id, input.sessionId))
        .limit(1)
        .then((res) => res[0]);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      if (session.templateType !== "circuit") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not a circuit type",
        });
      }

      // Get current config
      const currentConfig = session.templateConfig as typeof DEFAULT_CIRCUIT_CONFIG;
      if (!currentConfig?.config?.roundTemplates) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No round templates found",
        });
      }

      // Allow deletion of any round, including the last one
      // Users can now have empty round configurations and build from scratch

      // Start transaction to update both config and exercises
      const result = await ctx.db.transaction(async (tx) => {
        // 1. Remove the round from roundTemplates
        const updatedRoundTemplates = currentConfig.config.roundTemplates
          .filter(rt => rt.roundNumber !== input.roundNumber)
          .map((rt, index) => ({
            ...rt,
            roundNumber: index + 1, // Renumber sequentially
          }));

        // 2. Update circuit config
        const updatedConfig = {
          ...currentConfig,
          config: {
            ...currentConfig.config,
            rounds: updatedRoundTemplates.length,
            roundTemplates: updatedRoundTemplates,
          },
          lastUpdated: new Date().toISOString(),
          updatedBy: "anonymous", // Public endpoint
        };

        // Validate the updated config
        const validatedConfig = CircuitConfigSchema.parse(updatedConfig);

        // 3. Update session config
        await tx
          .update(TrainingSession)
          .set({
            templateConfig: validatedConfig,
            updatedAt: new Date(),
          })
          .where(eq(TrainingSession.id, input.sessionId));

        // 4. Handle WorkoutExercise cleanup
        const deletedRoundName = `Round ${input.roundNumber}`;
        const workouts = await tx
          .select({ id: Workout.id })
          .from(Workout)
          .where(eq(Workout.trainingSessionId, input.sessionId));

        let totalDeletedExercises = 0;

        if (workouts.length > 0) {
          for (const workout of workouts) {
            // Delete exercises in the deleted round
            const deleted = await tx
              .delete(WorkoutExercise)
              .where(and(
                eq(WorkoutExercise.workoutId, workout.id),
                eq(WorkoutExercise.groupName, deletedRoundName)
              ))
              .returning();
            
            totalDeletedExercises += deleted.length;

            // Rename subsequent rounds
            for (let i = input.roundNumber + 1; i <= currentConfig.config.rounds; i++) {
              await tx
                .update(WorkoutExercise)
                .set({ groupName: `Round ${i - 1}` })
                .where(and(
                  eq(WorkoutExercise.workoutId, workout.id),
                  eq(WorkoutExercise.groupName, `Round ${i}`)
                ));
            }
          }
        }


        return {
          config: validatedConfig,
          deletedExerciseCount: totalDeletedExercises,
          affectedWorkouts: workouts.length,
        };
      });

      return result.config;
    }),

  /**
   * Add a new round to circuit configuration
   */
  addRound: publicProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      roundConfig: z.object({
        type: z.enum(['circuit_round', 'stations_round', 'amrap_round']),
        exercisesPerRound: z.number().optional(),
        workDuration: z.number().optional(),
        restDuration: z.number().optional(),
        repeatTimes: z.number().optional(),
        restBetweenSets: z.number().optional(),
        totalDuration: z.number().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the session
      const session = await ctx.db
        .select()
        .from(TrainingSession)
        .where(eq(TrainingSession.id, input.sessionId))
        .limit(1)
        .then((res) => res[0]);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      if (session.templateType !== "circuit") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not a circuit type",
        });
      }

      // Get current config
      const currentConfig = session.templateConfig as typeof DEFAULT_CIRCUIT_CONFIG;
      if (!currentConfig?.config?.roundTemplates) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No round templates found",
        });
      }

      // Start transaction to update both config and exercises
      const result = await ctx.db.transaction(async (tx) => {
        // 1. Create the new round template
        const newRoundNumber = currentConfig.config.roundTemplates.length + 1;
        
        console.log("[addRound DEBUG] Current round templates before adding:", currentConfig.config.roundTemplates.map((rt: any) => ({
          roundNumber: rt.roundNumber,
          type: rt.template?.type
        })));
        console.log("[addRound DEBUG] Current rounds count:", currentConfig.config.rounds);
        console.log("[addRound DEBUG] New round number will be:", newRoundNumber);
        
        // Build the round template based on type
        let template: any = { type: input.roundConfig.type };
        
        console.log("[addRound] Creating round with type:", input.roundConfig.type);
        console.log("[addRound] Input roundConfig:", input.roundConfig);
        
        if (input.roundConfig.type === 'circuit_round') {
          template = {
            ...template,
            exercisesPerRound: input.roundConfig.exercisesPerRound || 6,
            workDuration: input.roundConfig.workDuration || 45,
            restDuration: input.roundConfig.restDuration || 15,
            repeatTimes: input.roundConfig.repeatTimes || 1,
            restBetweenSets: input.roundConfig.restBetweenSets || 60,
          };
        } else if (input.roundConfig.type === 'stations_round') {
          template = {
            ...template,
            exercisesPerRound: input.roundConfig.exercisesPerRound || 4,
            workDuration: input.roundConfig.workDuration || 60,
            restDuration: input.roundConfig.restDuration || 15,
            repeatTimes: input.roundConfig.repeatTimes || 1,
            restBetweenSets: input.roundConfig.restBetweenSets || 60,
          };
        } else if (input.roundConfig.type === 'amrap_round') {
          template = {
            ...template,
            exercisesPerRound: input.roundConfig.exercisesPerRound || 5,
            totalDuration: input.roundConfig.totalDuration || 300,
          };
        }

        const newRoundTemplate = {
          roundNumber: newRoundNumber,
          template,
        };

        console.log("[addRound] Built template:", template);
        console.log("[addRound] New round template:", newRoundTemplate);
        console.log("[addRound DEBUG] Template timing values:", {
          workDuration: template.workDuration,
          restDuration: template.restDuration,
          repeatTimes: template.repeatTimes,
          restBetweenSets: template.restBetweenSets
        });

        // 2. Update circuit config
        const updatedConfig = {
          ...currentConfig,
          config: {
            ...currentConfig.config,
            rounds: currentConfig.config.rounds + 1,
            roundTemplates: [...currentConfig.config.roundTemplates, newRoundTemplate],
          },
          lastUpdated: new Date().toISOString(),
          updatedBy: "anonymous", // Public endpoint
        };
        
        console.log("[addRound DEBUG] Updated config roundTemplates count:", updatedConfig.config.roundTemplates.length);
        console.log("[addRound DEBUG] Updated config rounds:", updatedConfig.config.rounds);

        // Validate the updated config
        const validatedConfig = CircuitConfigSchema.parse(updatedConfig);

        // 3. Update session config
        await tx
          .update(TrainingSession)
          .set({
            templateConfig: validatedConfig,
            updatedAt: new Date(),
          })
          .where(eq(TrainingSession.id, input.sessionId));

        // 4. Create placeholder exercises for all workouts
        const newRoundName = `Round ${newRoundNumber}`;
        console.log("[addRound DEBUG] Creating exercises with round name:", newRoundName);
        const workouts = await tx
          .select({ id: Workout.id, userId: Workout.userId })
          .from(Workout)
          .where(eq(Workout.trainingSessionId, input.sessionId));

        let totalCreatedExercises = 0;
        const exercisesPerRound = template.exercisesPerRound || 5;

        if (workouts.length > 0) {
          console.log(`[addRound] Creating ${input.roundConfig.type} with ${exercisesPerRound} exercises/stations`);
          
          for (const workout of workouts) {
            // Get the max order index for this workout
            const maxOrderResult = await tx
              .select({ maxOrder: sql<number>`MAX(${WorkoutExercise.orderIndex})` })
              .from(WorkoutExercise)
              .where(eq(WorkoutExercise.workoutId, workout.id));
            
            const startOrderIndex = (maxOrderResult[0]?.maxOrder || 0) + 1;

            // Create placeholder exercises
            const exercisesToCreate = [];
            for (let i = 0; i < exercisesPerRound; i++) {
              exercisesToCreate.push({
                workoutId: workout.id,
                exerciseId: null, // Custom exercise
                orderIndex: startOrderIndex + i,
                groupName: newRoundName,
                isShared: false,
                selectionSource: 'trainer' as const,
                setsCompleted: 0, // Default to 0 sets
                // For stations rounds, each exercise is a station with stationIndex 0
                // For other rounds, stationIndex is null
                stationIndex: input.roundConfig.type === 'stations_round' ? 0 : null,
                custom_exercise: {
                  customName: `Exercise ${i + 1}`,
                  customDescription: '',
                  userId: workout.userId,
                },
              });
            }

            await tx.insert(WorkoutExercise).values(exercisesToCreate);
            totalCreatedExercises += exercisesToCreate.length;
            
            console.log(`[addRound] Created exercises for workout ${workout.id}:`, {
              roundType: input.roundConfig.type,
              exerciseCount: exercisesToCreate.length,
              orderIndexRange: `${startOrderIndex}-${startOrderIndex + exercisesPerRound - 1}`,
              stationIndexPattern: input.roundConfig.type === 'stations_round' ? 
                'All stationIndex: 0' : 'All stationIndex: null'
            });
          }
        }


        console.log("[addRound DEBUG] Final result before returning:", {
          configRoundsCount: validatedConfig.config.rounds,
          configRoundTemplatesCount: validatedConfig.config.roundTemplates.length,
          lastRoundTemplate: validatedConfig.config.roundTemplates[validatedConfig.config.roundTemplates.length - 1],
          totalCreatedExercises,
          affectedWorkouts: workouts.length
        });

        return {
          config: validatedConfig,
          createdExerciseCount: totalCreatedExercises,
          affectedWorkouts: workouts.length,
        };
      });

      console.log("[addRound DEBUG] Transaction completed, returning config");
      return result.config;
    }),
});