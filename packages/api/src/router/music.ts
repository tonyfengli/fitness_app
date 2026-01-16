import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { eq } from "@acme/db";
import { musicTracks, CreateMusicTrackSchema, UpdateMusicTrackSchema } from "@acme/db/schema";

import { protectedProcedure } from "../trpc";

export const musicRouter = {
  // Get all music tracks
  list: protectedProcedure
    .input(z.object({
      energy: z.enum(["high", "low"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input?.energy) {
        conditions.push(eq(musicTracks.energy, input.energy));
      }

      const tracks = await ctx.db
        .select()
        .from(musicTracks)
        .where(conditions.length > 0 ? conditions[0] : undefined)
        .orderBy(musicTracks.name);

      return tracks;
    }),

  // Get a single track by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [track] = await ctx.db
        .select()
        .from(musicTracks)
        .where(eq(musicTracks.id, input.id))
        .limit(1);

      if (!track) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Track not found",
        });
      }

      return track;
    }),

  // Get a random track by energy level
  getRandom: protectedProcedure
    .input(z.object({
      energy: z.enum(["high", "low"]),
      excludeIds: z.array(z.string().uuid()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const tracks = await ctx.db
        .select()
        .from(musicTracks)
        .where(eq(musicTracks.energy, input.energy));

      // Filter out excluded tracks
      let availableTracks = tracks;
      if (input.excludeIds && input.excludeIds.length > 0) {
        availableTracks = tracks.filter(t => !input.excludeIds!.includes(t.id));
      }

      if (availableTracks.length === 0) {
        // If all tracks are excluded, allow repeats
        availableTracks = tracks;
      }

      if (availableTracks.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No ${input.energy} energy tracks available`,
        });
      }

      // Return a random track
      const randomIndex = Math.floor(Math.random() * availableTracks.length);
      return availableTracks[randomIndex];
    }),

  // Create a new track
  create: protectedProcedure
    .input(CreateMusicTrackSchema)
    .mutation(async ({ ctx, input }) => {
      const [track] = await ctx.db
        .insert(musicTracks)
        .values(input)
        .returning();

      return track;
    }),

  // Update a track
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: UpdateMusicTrackSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const [track] = await ctx.db
        .update(musicTracks)
        .set(input.data)
        .where(eq(musicTracks.id, input.id))
        .returning();

      if (!track) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Track not found",
        });
      }

      return track;
    }),

  // Delete a track
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [track] = await ctx.db
        .delete(musicTracks)
        .where(eq(musicTracks.id, input.id))
        .returning();

      if (!track) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Track not found",
        });
      }

      return { success: true };
    }),

  // Bulk create tracks (for seeding)
  bulkCreate: protectedProcedure
    .input(z.array(CreateMusicTrackSchema))
    .mutation(async ({ ctx, input }) => {
      if (input.length === 0) {
        return { count: 0 };
      }

      const tracks = await ctx.db
        .insert(musicTracks)
        .values(input)
        .returning();

      return { count: tracks.length };
    }),
} satisfies TRPCRouterRecord;
