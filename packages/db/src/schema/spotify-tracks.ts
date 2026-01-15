import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { z } from "zod";

/**
 * Spotify tracks table for workout music
 * Note: This schema is kept for database compatibility but Spotify integration has been removed.
 * The table can be dropped when ready.
 */
export const spotifyTracks = pgTable("spotify_tracks", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  spotifyId: t.text("spotify_id").notNull().unique(),
  name: t.text().notNull(),
  artist: t.text().notNull(),
  durationMs: t.integer("duration_ms").notNull(),
  genres: t.text().array().default(sql`'{}'::text[]`),
  usage: t.text().array().default(sql`'{}'::text[]`), // "rest", "bridge", "hype"
  hypeTimestamp: t.integer("hype_timestamp"), // seconds to hype moment
  skipOutro: t.integer("skip_outro"), // seconds to skip at end
  createdAt: t.timestamp("created_at").defaultNow().notNull(),
  updatedAt: t
    .timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => sql`now()`),
}), (table) => ({
  genresIdx: index("idx_spotify_tracks_genres").using("gin", table.genres),
  usageIdx: index("idx_spotify_tracks_usage").using("gin", table.usage),
}));

// Zod schema for validation
export const CreateSpotifyTrackSchema = z.object({
  spotifyId: z.string().min(1),
  name: z.string().min(1),
  artist: z.string().min(1),
  durationMs: z.number().positive(),
  genres: z.array(z.string()).optional(),
  usage: z.array(z.enum(["rest", "bridge", "hype"])).optional(),
  hypeTimestamp: z.number().nonnegative().optional(),
  skipOutro: z.number().nonnegative().optional(),
});

export type SpotifyTrack = typeof spotifyTracks.$inferSelect;
export type NewSpotifyTrack = typeof spotifyTracks.$inferInsert;
