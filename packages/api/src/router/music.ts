import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { eq } from "@acme/db";
import { musicTracks, CreateMusicTrackSchema, UpdateMusicTrackSchema, MusicSegmentSchema } from "@acme/db/schema";
import type { MusicSegment } from "@acme/db/schema";

import { protectedProcedure } from "../trpc";

// Energy type for filtering (excludes "outro" since you don't filter by it)
const EnergyFilterSchema = z.enum(["low", "medium", "high"]);
type EnergyFilter = z.infer<typeof EnergyFilterSchema>;

/**
 * Helper to check if a track has a segment with the given energy
 */
function hasEnergySegment(segments: MusicSegment[] | null | undefined, energy: EnergyFilter): boolean {
  if (!segments || segments.length === 0) return false;
  return segments.some(s => s.energy === energy);
}

/**
 * Helper to get a random segment with the given energy from a track
 */
function getRandomSegmentByEnergy(segments: MusicSegment[], energy: EnergyFilter): MusicSegment | null {
  const matching = segments.filter(s => s.energy === energy);
  if (matching.length === 0) return null;
  return matching[Math.floor(Math.random() * matching.length)] ?? null;
}

export const musicRouter = {
  // Get all music tracks
  list: protectedProcedure
    .input(z.object({
      energy: EnergyFilterSchema.optional(), // filter tracks that have segments with this energy
    }).optional())
    .query(async ({ ctx, input }) => {
      const tracks = await ctx.db
        .select()
        .from(musicTracks)
        .orderBy(musicTracks.name);

      // If energy filter provided, filter tracks that have at least one segment with that energy
      if (input?.energy) {
        return tracks.filter(t => hasEnergySegment(t.segments, input.energy!));
      }

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

  // Get a random track with a segment matching the energy level
  // Returns the track AND the selected segment to seek to
  getRandom: protectedProcedure
    .input(z.object({
      energy: EnergyFilterSchema,
      excludeIds: z.array(z.string().uuid()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const allTracks = await ctx.db
        .select()
        .from(musicTracks);

      // Filter tracks that have at least one segment with the requested energy
      let availableTracks = allTracks.filter(t => hasEnergySegment(t.segments, input.energy));

      // Exclude specified track IDs
      if (input.excludeIds && input.excludeIds.length > 0) {
        const excludeSet = new Set(input.excludeIds);
        const filtered = availableTracks.filter(t => !excludeSet.has(t.id));
        // If all tracks are excluded, allow repeats
        if (filtered.length > 0) {
          availableTracks = filtered;
        }
      }

      if (availableTracks.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No tracks with ${input.energy} energy segments available`,
        });
      }

      // Pick a random track
      const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)]!;

      // Pick a random segment with the requested energy from that track
      const segment = getRandomSegmentByEnergy(randomTrack.segments ?? [], input.energy);

      return {
        track: randomTrack,
        segment, // The segment to seek to
      };
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
