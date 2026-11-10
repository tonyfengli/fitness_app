/**
 * Area `celebration`: member recognition cards (birthdays now, milestones next), rendered by
 * the celebrations cron and reviewed by founders on the Retention tab.
 * Written by: /api/cron/celebrations (create, render) and /api/agent/celebrations (posted,
 * skipped). Design: ai-crew/docs/BUSINESS-ACCOUNTABILITY.md. Naming: packages/db/NAMING.md.
 */

import { index, pgEnum, pgTable, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { user } from "../auth-schema";
import { Business } from "../schema";

export const celebrationTypeEnum = pgEnum("celebration_type", ["birthday", "milestone"]);

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
    themeKey: t.varchar({ length: 60 }).notNull(),
    status: celebrationStatusEnum().notNull().default("ready"),
    imageUrl: t.text(), // the rendered card in Blob storage
    renderedAt: t.timestamp({ withTimezone: true }),
    postedAt: t.timestamp({ withTimezone: true }),
    postedBy: t.text().references(() => user.id, { onDelete: "set null" }), // the founder who tapped Posted
    skippedAt: t.timestamp({ withTimezone: true }),
    skippedBy: t.text().references(() => user.id, { onDelete: "set null" }),
    skippedReason: t.text(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => sql`now()`),
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
