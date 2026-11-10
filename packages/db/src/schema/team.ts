/**
 * Area `team`: staff accountability. A task is a commitment by a trainer (user.role =
 * 'trainer'); everything that happens to it is an append-only event; every message sent
 * about tasks is a nudge, bundled per person per day.
 * Written by: fitness_app's team library (apps/nextjs/src/lib/team) only, which enforces who
 * may change what; agents and workflows go through it. Design and decisions:
 * ai-crew/docs/BUSINESS-ACCOUNTABILITY.md. Naming: packages/db/NAMING.md.
 */

import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, unique, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "../auth-schema";
import { Business } from "../schema";

/** open → in_progress / blocked → done; declined = the owner rejected it (creator told); cancelled = no longer needed */
export const teamTaskStatusEnum = pgEnum("team_task_status", ["open", "in_progress", "blocked", "done", "declined", "cancelled"]);

export const teamTaskEventTypeEnum = pgEnum("team_task_event_type", [
  "created",
  "status_changed",
  "deadline_changed",
  "reassigned",
  "blocked",
  "unblocked",
  "note",
  "nudged",
  "replied", // the owner (or blocked-on person) answered a nudge; note = their words
  "escalated",
  "completed",
  "declined",
]);

/** Who did it: a person (actorId set), or one of these */
export const teamActorEnum = pgEnum("team_actor", ["person", "workflow", "agent", "cron"]);

export const teamChannelEnum = pgEnum("team_channel", ["slack", "imessage", "sms", "dashboard", "system"]);

export const teamNudgeKindEnum = pgEnum("team_nudge_kind", ["reminder", "escalation"]);

export const teamNudgeOutcomeEnum = pgEnum("team_nudge_outcome", ["replied", "task_done", "ignored"]);

/**
 * Messaging settings for a trainer. Reachable = user.role 'trainer' + an active row here;
 * only the founders get one in V1. Phone comes from user.phone.
 */
export const TeamProfile = pgTable("team_profile", (t) => ({
  userId: t
    .text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  businessId: t
    .uuid()
    .notNull()
    .references(() => Business.id, { onDelete: "cascade" }),
  slackUserId: t.varchar({ length: 20 }), // e.g. U0ARQLTA57D; null = no Slack delivery
  aliases: t.text().array().notNull().default(sql`'{}'::text[]`), // names a transcript may use ("Richie")
  timezone: t.varchar({ length: 60 }).notNull().default("America/Los_Angeles"),
  quietStart: t.smallint().notNull().default(21), // no messages from this hour (local)...
  quietEnd: t.smallint().notNull().default(8), // ...until this hour
  active: t.boolean().notNull().default(true),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
}));

/** An automatic source of tasks (celebrations, weekly_meeting, …) and the trainer who answers for it */
export const TeamWorkflow = pgTable("team_workflow", (t) => ({
  key: t.varchar({ length: 40 }).primaryKey(), // "celebrations"
  businessId: t
    .uuid()
    .notNull()
    .references(() => Business.id, { onDelete: "cascade" }),
  name: t.varchar({ length: 100 }).notNull(),
  ownerId: t
    .text()
    .notNull()
    .references(() => user.id), // gets this workflow's escalations
  active: t.boolean().notNull().default(true), // off = creates no new tasks
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

/** The commitment. Real tasks only; drafts (e.g. meeting items before Send) live with their workflow. */
export const TeamTask = pgTable(
  "team_task",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    title: t.varchar({ length: 200 }).notNull(),
    details: t.text(),
    context: t.jsonb().$type<Record<string, unknown>>(), // source-specific: celebrationId + imageUrl; meeting quote + link
    ownerId: t
      .text()
      .notNull()
      .references(() => user.id),
    creatorId: t.text().references(() => user.id), // a person who created it (meeting items: Tony)
    workflowKey: t.varchar({ length: 40 }).references(() => TeamWorkflow.key), // the workflow that created it
    status: teamTaskStatusEnum().notNull().default("open"),
    dueAt: t.timestamp({ withTimezone: true }),
    hardDeadline: t.boolean().notNull().default(false), // the date can't move (a birthday)
    blockedOnId: t.text().references(() => user.id), // "waiting on Richie": nudges go there
    blockedReason: t.text(),
    nextCheckAt: t.timestamp({ withTimezone: true }), // when to consider a nudge next
    source: t.varchar({ length: 40 }).notNull(), // "celebrations", "meeting", "manual"
    sourceRef: t.varchar({ length: 120 }).notNull(), // "birthday:<memberId>:<date>"; unique with source
    completedAt: t.timestamp({ withTimezone: true }),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  }),
  (table) => ({
    noDuplicateFromSource: unique("team_task_source").on(table.businessId, table.source, table.sourceRef),
    byOwnerStatus: index("idx_team_task_owner_status").on(table.businessId, table.ownerId, table.status),
    byNextCheck: index("idx_team_task_next_check").on(table.status, table.nextCheckAt),
  }),
);

/** Append-only history of a task; never updated or deleted */
export const TeamTaskEvent = pgTable(
  "team_task_event",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    taskId: t
      .uuid()
      .notNull()
      .references(() => TeamTask.id, { onDelete: "cascade" }),
    type: teamTaskEventTypeEnum().notNull(),
    actor: teamActorEnum().notNull(),
    actorId: t.text().references(() => user.id), // when actor = person
    channel: teamChannelEnum().notNull().default("system"),
    fromValue: t.text(),
    toValue: t.text(),
    note: t.text(),
    traceId: t.varchar({ length: 120 }), // Langfuse trace / OpenClaw session that produced this, when a model was involved
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => ({
    byTask: index("idx_team_task_event_task").on(table.taskId, table.createdAt),
  }),
);

/**
 * One message sent to one person about their tasks. The strict cap: at most one regular nudge
 * per recipient per local day (partial unique index below). A hard-deadline escalation may
 * bypass the cap once per task (bypassTaskId, unique).
 */
export const TeamNudge = pgTable(
  "team_nudge",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    recipientId: t
      .text()
      .notNull()
      .references(() => user.id),
    channel: teamChannelEnum().notNull(),
    kind: teamNudgeKindEnum().notNull().default("reminder"),
    localDate: t.date().notNull(), // the recipient's local day
    bypassTaskId: t.uuid().references(() => TeamTask.id), // set only on a hard-deadline escalation
    body: t.text().notNull(),
    externalId: t.varchar({ length: 80 }), // Slack message ts, to match a reply
    sentAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    outcome: teamNudgeOutcomeEnum(), // what the agent learns from; null until known
    respondedAt: t.timestamp({ withTimezone: true }),
  }),
  (table) => ({
    oneRegularPerDay: uniqueIndex("team_nudge_recipient_day")
      .on(table.recipientId, table.localDate)
      .where(sql`${table.bypassTaskId} is null`),
    oneBypassPerTask: uniqueIndex("team_nudge_bypass_task").on(table.bypassTaskId).where(sql`${table.bypassTaskId} is not null`),
    byRecipient: index("idx_team_nudge_recipient").on(table.recipientId, table.sentAt),
  }),
);

/** Which tasks a nudge covered (a bundle) */
export const TeamNudgeTask = pgTable(
  "team_nudge_task",
  (t) => ({
    nudgeId: t
      .uuid()
      .notNull()
      .references(() => TeamNudge.id, { onDelete: "cascade" }),
    taskId: t
      .uuid()
      .notNull()
      .references(() => TeamTask.id, { onDelete: "cascade" }),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
  }),
  (table) => ({
    pair: unique("team_nudge_task_pair").on(table.nudgeId, table.taskId),
    byTask: index("idx_team_nudge_task_task").on(table.taskId),
  }),
);
