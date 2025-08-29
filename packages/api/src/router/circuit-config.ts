import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "@acme/db";
import { TrainingSession } from "@acme/db/schema";
import { DEFAULT_CIRCUIT_CONFIG } from "@acme/db";
import {
  CircuitConfigInputSchema,
  UpdateCircuitConfigSchema,
  CircuitConfigSchema,
} from "@acme/validators";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { getSessionUserWithBusiness } from "../utils/session";

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
        return session.templateConfig;
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
      console.log("[circuitConfig.update] === Starting update ===");
      console.log("[circuitConfig.update] Input:", JSON.stringify(input, null, 2));
      console.log("[circuitConfig.update] Input types:", {
        sessionId: typeof input.sessionId,
        config: typeof input.config,
        configKeys: input.config ? Object.keys(input.config) : [],
      });
      
      const user = await getSessionUserWithBusiness(ctx);
      console.log("[circuitConfig.update] User:", { id: user.id, role: user.role, businessId: user.businessId });

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
        console.log("[circuitConfig.update] Session not found");
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      console.log("[circuitConfig.update] Session found:", {
        id: session.id,
        templateType: session.templateType,
        hasTemplateConfig: !!session.templateConfig,
        templateConfigType: typeof session.templateConfig,
      });

      if (session.templateType !== "circuit") {
        console.log("[circuitConfig.update] Wrong template type:", session.templateType);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not a circuit training session",
        });
      }

      // Only trainers can update circuit config
      if (user.role !== "trainer") {
        console.log("[circuitConfig.update] User is not trainer:", user.role);
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can update circuit configuration",
        });
      }

      console.log("[circuitConfig.update] Existing templateConfig:", JSON.stringify(session.templateConfig, null, 2));
      
      // Get existing config or use default
      const existingConfig =
        session.templateConfig &&
        typeof session.templateConfig === "object" &&
        "type" in session.templateConfig &&
        session.templateConfig.type === "circuit"
          ? session.templateConfig
          : DEFAULT_CIRCUIT_CONFIG;

      console.log("[circuitConfig.update] Existing config after processing:", JSON.stringify(existingConfig, null, 2));

      // Merge with updates - use ISO string for date
      const updatedConfig = {
        type: "circuit" as const,
        config: {
          ...existingConfig.config,
          ...input.config,
        },
        lastUpdated: new Date().toISOString(),
        updatedBy: user.id,
      };

      console.log("[circuitConfig.update] Updated config before validation:", {
        ...updatedConfig,
        lastUpdatedType: typeof updatedConfig.lastUpdated,
      });

      let validatedConfig;
      try {
        // Validate the complete config
        validatedConfig = CircuitConfigSchema.parse(updatedConfig);
        console.log("[circuitConfig.update] Config validated successfully");
        console.log("[circuitConfig.update] Validated config:", JSON.stringify(validatedConfig, null, 2));
      } catch (error) {
        console.error("[circuitConfig.update] Validation error:", error);
        console.error("[circuitConfig.update] Validation error details:", {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown',
          stack: error instanceof Error ? error.stack : 'No stack',
        });
        throw error;
      }

      try {
        // Update the session
        console.log("[circuitConfig.update] Attempting database update...");
        console.log("[circuitConfig.update] Setting templateConfig to:", JSON.stringify(validatedConfig, null, 2));
        console.log("[circuitConfig.update] Type check - is validatedConfig a plain object?", validatedConfig.constructor === Object);
        
        // Ensure it's a plain object
        const plainConfig = JSON.parse(JSON.stringify(validatedConfig));
        console.log("[circuitConfig.update] Plain config:", JSON.stringify(plainConfig, null, 2));
        
        // Check all fields in the update
        console.log("[circuitConfig.update] === Checking update fields ===");
        console.log("[circuitConfig.update] Fields being set:", Object.keys({ templateConfig: plainConfig }));
        console.log("[circuitConfig.update] templateConfig type:", typeof plainConfig);
        console.log("[circuitConfig.update] templateConfig constructor:", plainConfig?.constructor?.name);
        
        // Check if session has other fields
        console.log("[circuitConfig.update] Original session updatedAt:", session.updatedAt);
        console.log("[circuitConfig.update] Original session updatedAt type:", typeof session.updatedAt);
        console.log("[circuitConfig.update] Original session updatedAt constructor:", session.updatedAt?.constructor?.name);
        
        // Log the exact SQL being generated
        console.log("[circuitConfig.update] About to execute update with:");
        console.log("[circuitConfig.update] - sessionId:", input.sessionId);
        console.log("[circuitConfig.update] - templateConfig keys:", Object.keys(plainConfig));
        
        // Check for any Date objects in the config
        const checkForDates = (obj: any, path: string = ''): void => {
          for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            if (value instanceof Date) {
              console.log(`[circuitConfig.update] FOUND Date object at ${currentPath}:`, value);
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
              checkForDates(value, currentPath);
            }
            console.log(`[circuitConfig.update] Field ${currentPath}: type=${typeof value}, value=${JSON.stringify(value)}`);
          }
        };
        
        console.log("[circuitConfig.update] Checking plainConfig for Date objects:");
        checkForDates(plainConfig);
        
        await ctx.db
          .update(TrainingSession)
          .set({
            templateConfig: plainConfig,
            updatedAt: new Date(), // Set manually to bypass $onUpdateFn
          })
          .where(eq(TrainingSession.id, input.sessionId));

        console.log("[circuitConfig.update] Database update successful");
        
        // Return the config we just saved
        console.log("[circuitConfig.update] Returning config:", JSON.stringify(plainConfig, null, 2));
        return plainConfig;
      } catch (error) {
        console.error("[circuitConfig.update] Database update error:", error);
        console.error("[circuitConfig.update] Error details:", {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown',
          stack: error instanceof Error ? error.stack : 'No stack',
        });
        throw error;
      }
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

      return updated.templateConfig;
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
        return session.templateConfig;
      }

      return DEFAULT_CIRCUIT_CONFIG;
    }),
});