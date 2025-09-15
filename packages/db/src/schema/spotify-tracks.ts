import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { z } from "zod";

export const spotifyTracks = pgTable("spotify_tracks", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  spotifyId: t.text("spotify_id").notNull().unique(),
  name: t.text().notNull(),
  artist: t.text().notNull(),
  durationMs: t.integer("duration_ms").notNull(),
  genres: t.text().array().default(sql`'{}'::text[]`),
  usage: t.text().array().default(sql`'{}'::text[]`),
  hypeTimestamp: t.integer("hype_timestamp"),
  skipOutro: t.integer("skip_outro"),
  createdAt: t.timestamp("created_at").defaultNow().notNull(),
  updatedAt: t
    .timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => sql`now()`),
}), (table) => ({
  // Add GIN indexes for array columns
  genresIdx: index("idx_spotify_tracks_genres").using("gin", table.genres),
  usageIdx: index("idx_spotify_tracks_usage").using("gin", table.usage),
}));

// Create Zod schema for validation
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