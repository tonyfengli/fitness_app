import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";

/**
 * Music segment within a track
 * Each segment marks a point in the track with a specific energy level
 */
export const MusicSegmentSchema = z.object({
  timestamp: z.number().nonnegative(), // seconds - where this segment starts
  energy: z.enum(["low", "medium", "high", "outro"]),
  buildupDuration: z.number().nonnegative().optional(), // seconds before timestamp where buildup starts
});

export type MusicSegment = z.infer<typeof MusicSegmentSchema>;

/**
 * Music tracks table for workout music
 * Tracks are downloaded from cloud storage and cached locally on the TV app
 * Filename convention: {filename}.mp3 or {filename}.m4a matches the 'filename' column
 */
export const musicTracks = pgTable("music_tracks", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  filename: t.text().notNull().unique(), // e.g., "track_001" -> local storage as track_001.mp3
  name: t.text().notNull(),
  artist: t.text().notNull(),
  durationMs: t.integer("duration_ms").notNull(),
  genre: t.text(), // optional genre classification
  downloadUrl: t.text("download_url"), // URL to download from cloud storage
  segments: jsonb("segments").$type<MusicSegment[]>().notNull().default([]), // energy segments within the track
  createdAt: t.timestamp("created_at").defaultNow().notNull(),
  updatedAt: t
    .timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => sql`now()`),
}));

// Zod schema for validation
export const CreateMusicTrackSchema = z.object({
  filename: z.string().min(1),
  name: z.string().min(1),
  artist: z.string().min(1),
  durationMs: z.number().positive(),
  genre: z.string().optional(),
  downloadUrl: z.string().url().optional(),
  segments: z.array(MusicSegmentSchema).min(1), // at least one segment required
});

export const UpdateMusicTrackSchema = z.object({
  name: z.string().min(1).optional(),
  artist: z.string().min(1).optional(),
  durationMs: z.number().positive().optional(),
  genre: z.string().optional(),
  downloadUrl: z.string().url().optional(),
  segments: z.array(MusicSegmentSchema).min(1).optional(),
});

export type MusicTrack = typeof musicTracks.$inferSelect;
export type NewMusicTrack = typeof musicTracks.$inferInsert;
