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

const GlobalLightingDefaultsSchema = z.object({
  work: LightingSceneSchema.optional(),
  rest: LightingSceneSchema.optional(),
  preview: LightingSceneSchema.optional(),
  warning: LightingSceneSchema.optional(),
  roundBreak: LightingSceneSchema.optional(),
});

const LightingConfigUpdateSchema = z.object({
  sessionId: z.string().uuid(),
  lighting: z.object({
    enabled: z.boolean(),
    globalDefaults: GlobalLightingDefaultsSchema,
    roundOverrides: z.record(
      z.string(),
      z.record(z.string(), LightingSceneSchema)
    ).optional(),
    targetGroup: z.string().optional(),
  }),
});

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

      // Update the config with lighting
      const updatedConfig: CircuitConfig = {
        ...existingConfig,
        config: {
          ...existingConfig.config,
          lighting: input.lighting,
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

      return input.lighting;
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
});