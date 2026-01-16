import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { z } from "zod";

/**
 * Music tracks table for local MP3 workout music
 * Tracks are downloaded from cloud storage and cached locally on the TV app
 * Filename convention: {filename}.mp3 matches the 'filename' column
 */
export const musicTracks = pgTable("music_tracks", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  filename: t.text().notNull().unique(), // e.g., "track_001" -> local storage as track_001.mp3
  name: t.text().notNull(),
  artist: t.text().notNull(),
  durationMs: t.integer("duration_ms").notNull(),
  energy: t.text().notNull().$type<"high" | "low">(), // high = exercise, low = rest
  genre: t.text(), // optional genre classification
  downloadUrl: t.text("download_url"), // URL to download the MP3 from cloud storage
  startTimestamp: t.integer("start_timestamp"), // seconds - where to start for "jump to" feature
  skipOutro: t.integer("skip_outro"), // seconds to skip at end
  createdAt: t.timestamp("created_at").defaultNow().notNull(),
  updatedAt: t
    .timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => sql`now()`),
}), (table) => ({
  energyIdx: index("idx_music_tracks_energy").on(table.energy),
}));

// Zod schema for validation
export const CreateMusicTrackSchema = z.object({
  filename: z.string().min(1),
  name: z.string().min(1),
  artist: z.string().min(1),
  durationMs: z.number().positive(),
  energy: z.enum(["high", "low"]),
  genre: z.string().optional(),
  downloadUrl: z.string().url().optional(),
  startTimestamp: z.number().nonnegative().optional(),
  skipOutro: z.number().nonnegative().optional(),
});

export const UpdateMusicTrackSchema = CreateMusicTrackSchema.partial().omit({ filename: true });

export type MusicTrack = typeof musicTracks.$inferSelect;
export type NewMusicTrack = typeof musicTracks.$inferInsert;
