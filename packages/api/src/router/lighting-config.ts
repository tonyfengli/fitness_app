/**
 * Lighting configuration router for workout sessions
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "@acme/db";
import { TrainingSession } from "@acme/db/schema";
import type { CircuitConfig, LightingConfig } from "@acme/db";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getSessionUserWithBusiness } from "../utils/session";

// Input schemas
const LightingSceneSchema = z.object({
  sceneId: z.string(),
  sceneName: z.string(),
});

// Schema that allows null for removal
const LightingSceneNullableSchema = z.union([
  LightingSceneSchema,
  z.null(),
]);

const GlobalLightingDefaultsSchema = z.object({
  work: LightingSceneNullableSchema.optional(),
  rest: LightingSceneNullableSchema.optional(),
  preview: LightingSceneNullableSchema.optional(),
  warning: LightingSceneNullableSchema.optional(),
  roundBreak: LightingSceneNullableSchema.optional(),
});

const LightingConfigUpdateSchema = z.object({
  sessionId: z.string().uuid(),
  lighting: z.object({
    enabled: z.boolean(),
    globalDefaults: GlobalLightingDefaultsSchema,
    roundOverrides: z.record(
      z.string(),
      z.record(z.string(), LightingSceneNullableSchema)
    ).optional(),
    targetGroup: z.string().optional(),
  }),
});

// New schema for batch round configuration
const BatchRoundConfigSchema = z.object({
  sessionId: z.string().uuid(),
  roundId: z.number(),
  masterConfig: z.object({
    preview: LightingSceneNullableSchema.optional(),
    work: LightingSceneNullableSchema.optional(),
    rest: LightingSceneNullableSchema.optional(),
  }),
});

// New schema for global defaults configuration
const GlobalDefaultsConfigSchema = z.object({
  sessionId: z.string().uuid(),
  globalConfig: z.object({
    preview: LightingSceneNullableSchema.optional(),
    work: LightingSceneNullableSchema.optional(),
    rest: LightingSceneNullableSchema.optional(),
  }),
});

// Helper function to transform null to undefined for scene configs
function transformNullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

// Helper function to transform lighting config nulls to undefined
function transformLightingConfig(config: z.infer<typeof LightingConfigUpdateSchema>['lighting']): LightingConfig {
  const roundOverrides = config.roundOverrides
    ? Object.fromEntries(
        Object.entries(config.roundOverrides)
          .map(([roundId, phases]) => [
            roundId,
            Object.fromEntries(
              Object.entries(phases)
                .filter((entry): entry is [string, { sceneId: string; sceneName: string }] =>
                  entry[1] !== null && entry[1] !== undefined
                )
            )
          ])
          .filter(([, phases]) => Object.keys(phases as object).length > 0)
      )
    : undefined;

  return {
    enabled: config.enabled,
    globalDefaults: {
      work: transformNullToUndefined(config.globalDefaults.work),
      rest: transformNullToUndefined(config.globalDefaults.rest),
      preview: transformNullToUndefined(config.globalDefaults.preview),
      warning: transformNullToUndefined(config.globalDefaults.warning),
      roundBreak: transformNullToUndefined(config.globalDefaults.roundBreak),
    },
    roundOverrides,
    targetGroup: config.targetGroup,
  };
}

export const lightingConfigRouter = createTRPCRouter({
  /**
   * Get lighting configuration for a session
   */
  get: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await getSessionUserWithBusiness(ctx);

      const session = await ctx.db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.id, input.sessionId),
            eq(TrainingSession.businessId, user.businessId)
          )
        )
        .limit(1)
        .then((res) => res[0]);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Extract lighting config from templateConfig
      if (
        session.templateConfig &&
        typeof session.templateConfig === "object" &&
        "type" in session.templateConfig &&
        session.templateConfig.type === "circuit"
      ) {
        const circuitConfig = session.templateConfig as CircuitConfig;
        return circuitConfig.config.lighting || null;
      }

      return null;
    }),

  /**
   * Update lighting configuration for a session
   */
  update: protectedProcedure
    .input(LightingConfigUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getSessionUserWithBusiness(ctx);

      // Only trainers can update lighting config
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can update lighting configuration",
        });
      }

      // Get the session
      const session = await ctx.db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.id, input.sessionId),
            eq(TrainingSession.businessId, user.businessId)
          )
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
          message: "Lighting configuration is only available for circuit training sessions",
        });
      }

      // Get existing config
      const existingConfig = session.templateConfig as CircuitConfig | null;
      
      if (!existingConfig || existingConfig.type !== "circuit") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid session configuration",
        });
      }

      // Update the config with lighting (transform nulls to undefined)
      const updatedConfig: CircuitConfig = {
        ...existingConfig,
        config: {
          ...existingConfig.config,
          lighting: transformLightingConfig(input.lighting),
        },
        lastUpdated: new Date().toISOString(),
        updatedBy: user.id,
      };

      // Update the session
      await ctx.db
        .update(TrainingSession)
        .set({
          templateConfig: updatedConfig,
          updatedAt: new Date(),
        })
        .where(eq(TrainingSession.id, input.sessionId));

      return transformLightingConfig(input.lighting);
    }),

  /**
   * Clear lighting configuration for a session
   */
  clear: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getSessionUserWithBusiness(ctx);

      // Only trainers can clear lighting config
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can clear lighting configuration",
        });
      }

      // Get the session
      const session = await ctx.db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.id, input.sessionId),
            eq(TrainingSession.businessId, user.businessId)
          )
        )
        .limit(1)
        .then((res) => res[0]);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Get existing config
      const existingConfig = session.templateConfig as CircuitConfig | null;
      
      if (!existingConfig || existingConfig.type !== "circuit") {
        return { success: true };
      }

      // Remove lighting from config
      const { lighting, ...configWithoutLighting } = existingConfig.config;
      
      const updatedConfig: CircuitConfig = {
        ...existingConfig,
        config: configWithoutLighting,
        lastUpdated: new Date().toISOString(),
        updatedBy: user.id,
      };

      // Update the session
      await ctx.db
        .update(TrainingSession)
        .set({
          templateConfig: updatedConfig,
          updatedAt: new Date(),
        })
        .where(eq(TrainingSession.id, input.sessionId));

      return { success: true };
    }),

  /**
   * Update round configuration with batch master settings
   */
  updateRoundConfig: protectedProcedure
    .input(BatchRoundConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getSessionUserWithBusiness(ctx);

      // Only trainers can update lighting config
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can update lighting configuration",
        });
      }

      // Get the session
      const session = await ctx.db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.id, input.sessionId),
            eq(TrainingSession.businessId, user.businessId)
          )
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
          message: "Lighting configuration is only available for circuit training sessions",
        });
      }

      // Get existing config
      const existingConfig = session.templateConfig as CircuitConfig | null;
      
      if (!existingConfig || existingConfig.type !== "circuit") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid session configuration",
        });
      }

      // Get current lighting config or create default
      const currentLighting: LightingConfig = existingConfig.config.lighting || {
        enabled: true,
        globalDefaults: {},
        roundOverrides: {},
        targetGroup: "0",
      };

      const roundKey = `round-${input.roundId}`;
      const updatedOverrides = { ...currentLighting.roundOverrides };

      // Ensure round override object exists
      if (!updatedOverrides[roundKey]) {
        updatedOverrides[roundKey] = {};
      }

      // Helper function to clear detailed overrides for a specific phase type
      // Intent-based clearing: only clear if master phase is being explicitly set
      const clearDetailedOverrides = (phaseType: string) => {
        const roundConfig = updatedOverrides[roundKey];
        if (!roundConfig) return;
        
        const phasePrefix = `${phaseType}-`;
        
        Object.keys(roundConfig).forEach(key => {
          if (key.startsWith(phasePrefix)) {
            delete roundConfig[key];
          }
        });
      };

      // Process each master configuration and clear corresponding detailed overrides
      
      Object.entries(input.masterConfig).forEach(([phaseType, sceneConfig]) => {
        if (sceneConfig !== undefined) {
          if (sceneConfig === null) {
            // Remove the configuration
            delete updatedOverrides[roundKey]![phaseType];
          } else {
            // Clear detailed overrides for this phase type (intent-based)
            // Only clear if master phase is being explicitly set
            clearDetailedOverrides(phaseType);
            
            // Set the master configuration (no timestamp needed)
            updatedOverrides[roundKey]![phaseType] = transformNullToUndefined(sceneConfig)!
          }
        }
      });
      

      // Clean up empty round entries
      if (updatedOverrides[roundKey] && Object.keys(updatedOverrides[roundKey]).length === 0) {
        delete updatedOverrides[roundKey];
      }

      // Update the config with new lighting configuration
      const updatedConfig: CircuitConfig = {
        ...existingConfig,
        config: {
          ...existingConfig.config,
          lighting: {
            ...currentLighting,
            roundOverrides: updatedOverrides,
          },
        },
        lastUpdated: new Date().toISOString(),
        updatedBy: user.id,
      };

      // Update the session
      await ctx.db
        .update(TrainingSession)
        .set({
          templateConfig: updatedConfig,
          updatedAt: new Date(),
        })
        .where(eq(TrainingSession.id, input.sessionId));

      return {
        success: true,
        updatedRoundConfig: updatedOverrides[roundKey],
      };
    }),

  /**
   * Update global defaults configuration with intent-based logic
   */
  updateGlobalDefaults: protectedProcedure
    .input(GlobalDefaultsConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getSessionUserWithBusiness(ctx);

      // Only trainers can update lighting config
      if (user.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can update lighting configuration",
        });
      }

      // Get the session
      const session = await ctx.db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.id, input.sessionId),
            eq(TrainingSession.businessId, user.businessId)
          )
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
          message: "Lighting configuration is only available for circuit training sessions",
        });
      }

      // Get existing config
      const existingConfig = session.templateConfig as CircuitConfig | null;
      
      if (!existingConfig || existingConfig.type !== "circuit") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid session configuration",
        });
      }

      // Get current lighting config or create default
      const currentLighting: LightingConfig = existingConfig.config.lighting || {
        enabled: true,
        globalDefaults: {},
        roundOverrides: {},
        targetGroup: "0",
      };

      const updatedGlobalDefaults = { ...currentLighting.globalDefaults };
      const updatedRoundOverrides = { ...currentLighting.roundOverrides };

      // Helper function to clear all round and detailed overrides for a phase type
      const clearAllOverridesForPhase = (phaseType: string) => {
        Object.keys(updatedRoundOverrides).forEach(roundKey => {
          const roundConfig = updatedRoundOverrides[roundKey];
          if (!roundConfig) return;
          
          // Clear round master (e.g., "work")
          if (roundConfig[phaseType]) {
            delete roundConfig[phaseType];
          }
          
          // Clear detailed overrides (e.g., "work-station-0", "work-exercise-1")
          const phasePrefix = `${phaseType}-`;
          Object.keys(roundConfig).forEach(key => {
            if (key.startsWith(phasePrefix)) {
              delete roundConfig[key];
            }
          });
          
          // Clean up empty round entries
          if (Object.keys(roundConfig).length === 0) {
            delete updatedRoundOverrides[roundKey];
          }
        });
      };

      // Process each global configuration (intent-based)
      Object.entries(input.globalConfig).forEach(([phaseType, sceneConfig]) => {
        if (sceneConfig !== undefined) {
          if (sceneConfig === null) {
            // Remove the global default
            delete updatedGlobalDefaults[phaseType as keyof typeof updatedGlobalDefaults];
          } else {
            // Clear all conflicting round masters and detailed overrides
            clearAllOverridesForPhase(phaseType);
            
            // Set the global default (transform null to undefined)
            updatedGlobalDefaults[phaseType as keyof typeof updatedGlobalDefaults] = transformNullToUndefined(sceneConfig);
          }
        }
      });

      // Update the config with new lighting configuration
      const updatedConfig: CircuitConfig = {
        ...existingConfig,
        config: {
          ...existingConfig.config,
          lighting: {
            ...currentLighting,
            globalDefaults: updatedGlobalDefaults,
            roundOverrides: updatedRoundOverrides,
          },
        },
        lastUpdated: new Date().toISOString(),
        updatedBy: user.id,
      };

      // Update the session
      await ctx.db
        .update(TrainingSession)
        .set({
          templateConfig: updatedConfig,
          updatedAt: new Date(),
        })
        .where(eq(TrainingSession.id, input.sessionId));

      return {
        success: true,
        updatedGlobalDefaults,
      };
    }),
});