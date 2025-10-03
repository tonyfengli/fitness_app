/**
 * Lighting control router
 */

import { z } from "zod/v4";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { getLightingService } from "../services/lighting/lighting-service";
import type { WorkoutTemplate } from "../services/lighting/types";
import { CIRCUIT_EVENTS, STRENGTH_EVENTS } from "../services/lighting/types";

export const lightingRouter = createTRPCRouter({
  /**
   * Get lighting system status
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const lightingService = getLightingService();
    return await lightingService.getStatus();
  }),

  /**
   * Get available lights
   */
  getLights: protectedProcedure.query(async ({ ctx }) => {
    const lightingService = getLightingService();
    const lights = await lightingService.getLights();
    
    // Convert to array format for easier consumption
    return Object.entries(lights).map(([id, light]) => ({
      id,
      name: light.name,
      on: light.state.on,
      brightness: light.state.bri,
      reachable: light.state.reachable,
    }));
  }),

  /**
   * Apply a preset to the light group
   */
  applyPreset: protectedProcedure
    .input(
      z.object({
        preset: z.enum(['WORK', 'REST', 'COOLDOWN', 'DEFAULT', 'ROUND_START', 'ROUND_REST']),
        template: z.enum(['circuit', 'strength']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lightingService = getLightingService();
      await lightingService.applyPreset(input.preset, input.template as WorkoutTemplate);
      
      return { success: true };
    }),

  /**
   * Apply custom light state
   */
  setState: protectedProcedure
    .input(
      z.object({
        state: z.object({
          on: z.boolean().optional(),
          bri: z.number().min(1).max(254).optional(),
          hue: z.number().min(0).max(65535).optional(),
          sat: z.number().min(0).max(254).optional(),
          transitiontime: z.number().min(0).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lightingService = getLightingService();
      await lightingService.applyState(input.state);
      
      return { success: true };
    }),

  /**
   * Report timer event from client (MVP fallback)
   */
  reportTimerEvent: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        event: z.enum([
          ...Object.values(CIRCUIT_EVENTS),
          ...Object.values(STRENGTH_EVENTS),
        ] as const),
        metadata: z.object({
          round: z.number().optional(),
          totalRounds: z.number().optional(),
          exerciseName: z.string().optional(),
          clientCount: z.number().optional(),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lightingService = getLightingService();
      
      await lightingService.handleTimerEvent({
        sessionId: input.sessionId,
        event: input.event,
        timestamp: new Date(),
        metadata: input.metadata,
      });
      
      return { success: true };
    }),

  /**
   * Initialize lighting service (called on app startup)
   */
  initialize: protectedProcedure.mutation(async ({ ctx }) => {
    const lightingService = getLightingService();
    await lightingService.initialize();
    
    return { success: true };
  }),

  /**
   * Start an animation effect
   */
  startAnimation: protectedProcedure
    .input(
      z.object({
        animation: z.enum(['drift', 'breathe', 'countdown', 'none']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lightingService = getLightingService();
      
      // Stop any existing animation first
      await lightingService.stopAnimation();
      
      // Start the requested animation
      if (input.animation !== 'none') {
        await lightingService.startAnimation(input.animation);
      }
      
      return { success: true };
    }),

  /**
   * Stop any running animation
   */
  stopAnimation: protectedProcedure.mutation(async ({ ctx }) => {
    const lightingService = getLightingService();
    await lightingService.stopAnimation();
    
    return { success: true };
  }),

  /**
   * Get current animation status
   */
  getAnimationStatus: protectedProcedure.query(async ({ ctx }) => {
    const lightingService = getLightingService();
    return lightingService.getAnimationStatus();
  }),
});