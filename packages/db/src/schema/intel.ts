/**
 * Area `intel`: public content and competitor data, collected for later analysis. Instagram
 * (and later TikTok) posts and profile counts for a list of accounts, plus single posts people
 * drop in as ideas; competitors' Meta ads, Google reviews and
 * website pages; ELEV8's own post insights.
 * Public data only: no member data, and no joins to member tables. Personal data about private
 * individuals (Google reviewer names, links and photos; Instagram commenters) is dropped before
 * a row is stored, from the raw payload too.
 * Written by: the collection library (apps/nextjs/src/lib/intel) only, through the crons
 * /api/cron/intel-start and /api/cron/intel-poll and the scripts in apps/nextjs/scripts.
 * Agents never call the scraper. Design: ai-crew/docs/INTEL-COLLECTION.md.
 * Built in phases: the Instagram tables are here now; ads, reviews, website pages and saved
 * files come with their collection step, ELEV8's own insights after that.
 * Naming: packages/db/NAMING.md.
 */

import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, unique } from "drizzle-orm/pg-core";

import { user } from "../auth-schema";
import { Business } from "../schema";

/** own: ELEV8 Anaheim · franchisor: Elev8 Costa Mesa, never a competitor · inspiration: accounts to learn from · competitor: local gyms */
export const intelAccountKindEnum = pgEnum("intel_account_kind", ["own", "franchisor", "inspiration", "competitor"]);

/** What a run collects. own_insight is ELEV8's own post insights from Meta, not a scrape. */
export const intelSourceEnum = pgEnum("intel_source", ["instagram", "tiktok", "meta_ad", "google_review", "website", "own_insight"]);

/** scheduled: started by the cron · backfill: a one-time history pull (outside the monthly cap) · manual: a founder or a script */
export const intelRunKindEnum = pgEnum("intel_run_kind", ["scheduled", "backfill", "manual"]);

/** launching: row written, scraper not started yet · running: waiting for the scraper · ingested: rows stored · failed: see error */
export const intelRunStatusEnum = pgEnum("intel_run_status", ["launching", "running", "ingested", "failed"]);

/** reel also covers a TikTok video */
export const intelPostTypeEnum = pgEnum("intel_post_type", ["reel", "carousel", "image"]);

export const intelPlatformEnum = pgEnum("intel_platform", ["instagram", "tiktok"]);

/**
 * What a post is meant to do (the franchisor's planning system): attract = pull new people to
 * the page (hooks, memes, "why you need a trainer") · grow = win followers (overlaps attract) ·
 * nurture = serve the people already following (updates, tips, community) · convert = ask for
 * the visit or the sale (offers, "book a trial").
 */
export const intelOutcomeEnum = pgEnum("intel_outcome", ["attract", "grow", "nurture", "convert"]);

/** tracked: came from an account on the list · inbox: a link someone dropped in · search: found by a topic search */
export const intelPostOriginEnum = pgEnum("intel_post_origin", ["tracked", "inbox", "search"]);

/**
 * A tracked entity and where to find it. One row per gym or creator; an empty field means that
 * source is not collected for it. Loaded from Tony's CSV by scripts/intel-import-accounts.ts,
 * which deactivates rows that leave the list and never deletes (history hangs off this table).
 */
export const IntelAccount = pgTable(
  "intel_account",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    key: t.varchar({ length: 80 }).notNull(), // stable id from the CSV ("f45-anaheim"), so a re-import updates
    kind: intelAccountKindEnum().notNull(),
    name: t.varchar({ length: 200 }).notNull(),
    instagramHandle: t.varchar({ length: 60 }), // without the @, lowercase
    tiktokHandle: t.varchar({ length: 60 }), // without the @, lowercase
    facebookPage: t.text(), // page URL or id, for the Meta Ad Library
    googlePlace: t.text(), // Google Maps place id or URL
    websitePages: t.text().array().notNull().default(sql`'{}'::text[]`), // URLs to watch for changes (pricing, offers)
    note: t.text(),
    active: t.boolean().notNull().default(true), // false = collected no longer; its history stays
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  }),
  (table) => ({
    oneKey: unique("intel_account_key").on(table.businessId, table.key),
  }),
);

/**
 * One row per collection run, written before the scraper is launched, so a run that never
 * comes back is still visible. Cost caps and the health check read this table.
 */
export const IntelRun = pgTable(
  "intel_run",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    source: intelSourceEnum().notNull(),
    kind: intelRunKindEnum().notNull(),
    status: intelRunStatusEnum().notNull().default("launching"),
    actor: t.varchar({ length: 120 }), // the Apify actor used ("apify/instagram-scraper"); null for own_insight
    apifyRunId: t.varchar({ length: 40 }),
    apifyDatasetId: t.varchar({ length: 40 }),
    accountIds: t.uuid().array().notNull().default(sql`'{}'::uuid[]`), // the intel_account rows asked for
    accountsRequested: t.integer().notNull().default(0),
    accountsReturned: t.integer(), // accounts with at least one item in the result
    rowsInserted: t.integer(),
    costUsd: t.numeric({ precision: 10, scale: 4 }), // what Apify charged for the run
    error: t.text(),
    startedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    finishedAt: t.timestamp({ withTimezone: true }), // ingested or failed
  }),
  (table) => ({
    bySource: index("idx_intel_run_source_started").on(table.businessId, table.source, table.startedAt),
    byStatus: index("idx_intel_run_status").on(table.status),
  }),
);

/**
 * An account's public counts at one pull: followers and post count on Instagram or TikTok, or
 * Google rating and review count. Insert only; these numbers can't be recovered later.
 */
export const IntelAccountSnapshot = pgTable(
  "intel_account_snapshot",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    accountId: t
      .uuid()
      .notNull()
      .references(() => IntelAccount.id, { onDelete: "cascade" }),
    runId: t
      .uuid()
      .notNull()
      .references(() => IntelRun.id, { onDelete: "cascade" }),
    source: intelSourceEnum().notNull(), // instagram, tiktok or google_review
    capturedAt: t.timestamp({ withTimezone: true }).notNull(),
    followers: t.integer(),
    following: t.integer(),
    postCount: t.integer(),
    googleRating: t.numeric({ precision: 3, scale: 2 }),
    googleReviewCount: t.integer(),
    raw: t.jsonb().$type<Record<string, unknown>>(), // the scraper's profile item, personal data removed
  }),
  (table) => ({
    oncePerRun: unique("intel_account_snapshot_run").on(table.runId, table.accountId, table.source),
    byAccount: index("idx_intel_account_snapshot_account").on(table.accountId, table.source, table.capturedAt),
  }),
);

/**
 * A post on Instagram or TikTok: the parts that don't change (caption, type, date, link),
 * stored once when the post is first seen, with the scraper's full item. Its numbers over time
 * are in intel_post_snapshot. Most posts come from tracked accounts; a post can also be a link
 * someone dropped in the idea inbox, from an account that is not on the list (accountId null).
 * The outcome is set by a person at planning, never guessed by the collector.
 */
export const IntelPost = pgTable(
  "intel_post",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    accountId: t.uuid().references(() => IntelAccount.id, { onDelete: "cascade" }), // null = the author is not a tracked account
    platform: intelPlatformEnum().notNull().default("instagram"),
    origin: intelPostOriginEnum().notNull().default("tracked"),
    externalId: t.varchar({ length: 60 }).notNull(), // the id in the post's link: Instagram shortcode (instagram.com/p/<id>) or TikTok video id
    mediaId: t.varchar({ length: 60 }), // Instagram's numeric media id, when the scraper gives it (Meta insights use it)
    authorHandle: t.varchar({ length: 60 }), // the public account that posted it, without the @
    outcome: intelOutcomeEnum(), // null = not sorted yet
    outcomeBy: t.text().references(() => user.id, { onDelete: "set null" }),
    addedBy: t.text().references(() => user.id, { onDelete: "set null" }), // inbox: the founder who dropped the link
    addedNote: t.text(), // inbox: why it caught their eye, or who sent it
    type: intelPostTypeEnum().notNull(),
    postedAt: t.timestamp({ withTimezone: true }),
    caption: t.text(),
    url: t.text().notNull(), // the post's page; works for as long as the account keeps the post up
    durationSeconds: t.numeric({ precision: 8, scale: 2 }), // reels
    audio: t.text(), // the sound's title and artist, as shown on the reel
    firstRunId: t.uuid().references(() => IntelRun.id, { onDelete: "set null" }),
    firstSeenAt: t.timestamp({ withTimezone: true }).notNull(),
    raw: t.jsonb().$type<Record<string, unknown>>(), // first-seen item, commenters and other private people removed
  }),
  (table) => ({
    onePost: unique("intel_post_external").on(table.businessId, table.platform, table.externalId),
    byAccount: index("idx_intel_post_account_posted").on(table.accountId, table.postedAt),
    byOrigin: index("idx_intel_post_origin").on(table.businessId, table.origin, table.firstSeenAt),
  }),
);

/**
 * A post's numbers at one pull: one row per post per pull, insert only. This is how a post's
 * growth is seen. A backfill row is the post's numbers on the day of the backfill.
 */
export const IntelPostSnapshot = pgTable(
  "intel_post_snapshot",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    postId: t
      .uuid()
      .notNull()
      .references(() => IntelPost.id, { onDelete: "cascade" }),
    runId: t
      .uuid()
      .notNull()
      .references(() => IntelRun.id, { onDelete: "cascade" }),
    capturedAt: t.timestamp({ withTimezone: true }).notNull(),
    likes: t.integer(), // null when the account hides like counts
    comments: t.integer(),
    views: t.integer(), // video plays; null for images and carousels
    pinned: t.boolean().notNull().default(false),
  }),
  (table) => ({
    oncePerRun: unique("intel_post_snapshot_run").on(table.runId, table.postId),
    byPost: index("idx_intel_post_snapshot_post").on(table.postId, table.capturedAt),
  }),
);
