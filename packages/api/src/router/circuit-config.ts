import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "@acme/db";
import { TrainingSession } from "@acme/db/schema";
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
                workDuration: rt.template.workDuration ?? config.config.workDuration ?? 45,
                restDuration: rt.template.restDuration ?? config.config.restDuration ?? 15,
              }
            };
          } else if (rt.template.type === 'stations_round') {
            return {
              ...rt,
              template: {
                ...rt.template,
                workDuration: rt.template.workDuration ?? config.config.workDuration ?? 45,
                restDuration: rt.template.restDuration ?? config.config.restDuration ?? 15,
                repeatTimes: rt.template.repeatTimes ?? 1,
              }
            };
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
  const rounds = config.config?.rounds || 3;
  const exercisesPerRound = config.config?.exercisesPerRound || 6;
  const workDuration = config.config?.workDuration || 45;
  const restDuration = config.config?.restDuration || 15;
  
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
        return ensureRoundTemplates(session.templateConfig);
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
      
      // Get the session to verify it exists and is a circuit session
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
      
      console.log('[CircuitConfig API] Updated config before validation:', JSON.stringify(updatedConfig, null, 2));

      // Ensure round templates exist
      const configWithRoundTemplates = ensureRoundTemplates(updatedConfig);
      
      console.log('[CircuitConfig API] Config after ensureRoundTemplates:', JSON.stringify(configWithRoundTemplates, null, 2));

      // Validate the complete config
      let validatedConfig;
      try {
        validatedConfig = CircuitConfigSchema.parse(configWithRoundTemplates);
        console.log('[CircuitConfig API] Validated config:', JSON.stringify(validatedConfig, null, 2));
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
});