/**
 * Unified lighting control router
 */

import { z } from "zod/v4";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getLightingService } from "../services/lighting/get-service";
import type { WorkoutTemplate } from "../services/lighting/types";
import { CIRCUIT_EVENTS, STRENGTH_EVENTS } from "../services/lighting/types";

export const lightingRouter = createTRPCRouter({
  /**
   * Initialize the lighting system
   */
  initialize: protectedProcedure.mutation(async ({ ctx }) => {
    const lightingService = getLightingService();
    // The service initializes itself on creation, so just return status
    return await lightingService.getStatus();
  }),

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
   * Get available scenes (if supported by provider)
   */
  getScenes: protectedProcedure.query(async ({ ctx }) => {
    const lightingService = getLightingService();
    const scenes = await lightingService.getScenes();
    
    // Return in consistent format
    return scenes.map(scene => ({
      id: scene.id,
      name: scene.name,
      lastUpdated: scene.lastUpdated,
      lights: scene.lights,
      owner: scene.owner,
      type: scene.type,
      lightstates: scene.lightstates,
      group: scene.group,
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
      await lightingService.setState(input.state);
      
      return { success: true };
    }),

  /**
   * Set group state (unified endpoint for all providers)
   */
  setGroupState: protectedProcedure
    .input(
      z.object({
        groupId: z.string().default("0"),
        state: z.object({
          on: z.boolean().optional(),
          bri: z.number().min(1).max(254).optional(),
          hue: z.number().min(0).max(65535).optional(),
          sat: z.number().min(0).max(254).optional(),
          transitiontime: z.number().min(0).optional(),
        })
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lightingService = getLightingService();
      // setState already uses the configured groupId, but we could extend this
      await lightingService.setState(input.state);
      
      return { success: true };
    }),

  /**
   * Activate a scene (if supported by provider)
   */
  activateScene: protectedProcedure
    .input(
      z.object({
        sceneId: z.string(),
        groupId: z.string().default("0"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log('[Lighting Router] activateScene called:', input);
      const lightingService = getLightingService();
      const status = await lightingService.getStatus();
      console.log('[Lighting Router] Service status:', status);
      
      await lightingService.activateScene(input.sceneId, input.groupId);
      
      return { success: true };
    }),

  /**
   * Report timer event (explicit event reporting for testing/manual control)
   */
  reportTimerEvent: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        event: z.enum([
          // Circuit events
          'circuit:round:start',
          'circuit:interval:work:start',
          'circuit:interval:rest:start',
          'circuit:round:end',
          'circuit:workout:complete',
          // Strength events
          'strength:round:start',
          'strength:round:rest:start',
          'strength:round:end',
          'strength:workout:complete',
        ]),
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
      
      // Map events to presets
      const eventToPreset: Record<string, { preset: string, template: WorkoutTemplate }> = {
        'circuit:round:start': { preset: 'ROUND_START', template: 'circuit' },
        'circuit:interval:work:start': { preset: 'WORK', template: 'circuit' },
        'circuit:interval:rest:start': { preset: 'REST', template: 'circuit' },
        'circuit:round:end': { preset: 'REST', template: 'circuit' },
        'circuit:workout:complete': { preset: 'COOLDOWN', template: 'circuit' },
        'strength:round:start': { preset: 'ROUND_START', template: 'strength' },
        'strength:round:rest:start': { preset: 'ROUND_REST', template: 'strength' },
        'strength:round:end': { preset: 'ROUND_REST', template: 'strength' },
        'strength:workout:complete': { preset: 'COOLDOWN', template: 'strength' },
      };
      
      const presetConfig = eventToPreset[input.event];
      if (presetConfig) {
        await lightingService.applyPreset(
          presetConfig.preset as any,
          presetConfig.template
        );
      }
      
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