/**
 * Area `celebration`: member recognition cards (birthdays now, milestones next), rendered by
 * the celebrations cron and reviewed by founders on the Retention tab.
 * Written by: /api/cron/celebrations (create, render) and /api/agent/celebrations (posted,
 * skipped, rebuild). Design: ai-crew/docs/BUSINESS-ACCOUNTABILITY.md. Naming: packages/db/NAMING.md.
 */

import { index, pgEnum, pgTable, unique } from "drizzle-orm/pg-core";

import { user } from "../auth-schema";
import { Business } from "../schema";

export const celebrationTypeEnum = pgEnum("celebration_type", ["birthday", "milestone"]);

/** suggested: found, waiting for a founder's yes/no · approved: use it · rejected: never use it (don't ask again) */
export const celebrationPhotoStatusEnum = pgEnum("celebration_photo_status", ["suggested", "approved", "rejected"]);

/** ready: card rendered, waiting for a founder · posted: a founder posted it · skipped: a founder passed */
export const celebrationStatusEnum = pgEnum("celebration_status", ["ready", "posted", "skipped"]);

/** One card per member per occasion. The cron never creates a duplicate (unique below). */
export const Celebration = pgTable(
  "celebration",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    memberId: t.varchar({ length: 50 }).notNull(), // GymMaster member number
    memberName: t.varchar({ length: 255 }).notNull(), // "First Last" at render time
    type: celebrationTypeEnum().notNull(),
    occasionDate: t.date().notNull(), // the birthday this year, or the day the milestone was hit
    detail: t.varchar({ length: 100 }), // milestone: the class count ("50")
    themeKey: t.varchar({ length: 60 }).notNull(), // the design (lib/celebrations/themes.ts), given in rotation
    // What a founder changed on this one card (through the Chief of Staff); null/default = the design's own
    headline: t.text(),
    subline: t.text(), // "" = no second line
    usePhoto: t.boolean().notNull().default(true), // false = the no-photo layout even when a photo exists
    backgroundUrl: t.text(), // art made for this card alone (Blob); null = the design's shared background
    photoSource: t.varchar({ length: 20 }), // where the photo on the rendered card came from ("gymmaster" | "groupme"); null = none on it
    // Set when a founder had the finished card redrawn by the image model (their words); the stored image is
    // then the model's, not a code render. A rebuild from parts clears it.
    aiEditPrompt: t.text(),
    status: celebrationStatusEnum().notNull().default("ready"),
    imageUrl: t.text(), // the rendered card in Blob storage
    renderedAt: t.timestamp({ withTimezone: true }),
    postedAt: t.timestamp({ withTimezone: true }),
    postedBy: t.text().references(() => user.id, { onDelete: "set null" }), // the founder who tapped Posted
    skippedAt: t.timestamp({ withTimezone: true }),
    skippedBy: t.text().references(() => user.id, { onDelete: "set null" }),
    skippedReason: t.text(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    // A Date, not sql`now()`: Drizzle maps timestamp values with toISOString and fails on SQL
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  }),
  (table) => ({
    oneCardPerOccasion: unique("celebration_member_occasion").on(table.businessId, table.memberId, table.type, table.occasionDate),
    byStatus: index("idx_celebration_status_date").on(table.businessId, table.status, table.occasionDate),
  }),
);

/** The AI background for a theme, generated once and reused for every card of that theme. */
export const CelebrationBackground = pgTable(
  "celebration_background",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    themeKey: t.varchar({ length: 60 }).notNull(),
    imageUrl: t.text().notNull(), // Blob storage
    model: t.varchar({ length: 60 }).notNull(),
    prompt: t.text().notNull(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => ({
    oneBackgroundPerTheme: unique("celebration_background_theme").on(table.businessId, table.themeKey),
  }),
);

/**
 * A member's photo from outside GymMaster (the members' GroupMe group), for members whose
 * GymMaster record has none. One row per member: which GroupMe person and picture was found,
 * a founder's one-time yes or no (never asked twice), and the cleaned-up portrait made from it.
 * The approval is for that picture: a new GroupMe picture is a new suggestion.
 * Written by: /api/cron/celebrations (suggestions) and /api/agent/celebrations (photo decisions).
 * Design: ai-crew/docs/BUSINESS-ACCOUNTABILITY.md.
 */
export const CelebrationPhotoMatch = pgTable(
  "celebration_photo_match",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    memberId: t.varchar({ length: 50 }).notNull(), // GymMaster member number
    source: t.varchar({ length: 20 }).notNull().default("groupme"),
    sourceUserId: t.varchar({ length: 50 }).notNull(), // GroupMe user id
    nickname: t.varchar({ length: 255 }).notNull(), // their name in the group when found
    sourceImageUrl: t.text().notNull(), // the picture that was offered (and approved or rejected)
    exactName: t.boolean().notNull().default(false), // nickname equals the member's full name
    status: celebrationPhotoStatusEnum().notNull().default("suggested"),
    note: t.text(), // the founder's words on approval ("she's the one on the left")
    portraitUrl: t.text(), // the cleaned-up portrait in Blob (image model, once, on approval); what cards use
    decidedBy: t.text().references(() => user.id, { onDelete: "set null" }),
    decidedAt: t.timestamp({ withTimezone: true }),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  }),
  (table) => ({
    onePerMember: unique("celebration_photo_match_member").on(table.businessId, table.memberId),
  }),
);
