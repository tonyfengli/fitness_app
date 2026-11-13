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
  // What the Chief of Staff knows about working with this person (business only). Seeded by
  // Tony, grown by the Chief through team_profile_note; these four are the short summary.
  role: t.varchar({ length: 120 }), // "Co-founder, runs in-gym coaching"
  owns: t.text(), // areas and recurring responsibilities
  answerStyle: t.text(), // how they like answers: numbers first, short, detailed, …
  focus: t.text(), // what they're chasing right now
  // Working style: how to reach this person about their tasks. Settings, not private data
  // (Tony, Nov 12 2026). Seeded by a short interview (ai-crew/shared/working-style-interview.md),
  // changed only by the person themselves: on the Team tab or through their own agent.
  bestTimes: t.text(), // when a message gets a real answer: "after 2pm, never before the morning class"
  pushLevel: t.varchar({ length: 20 }), // light | steady | persistent; null = not asked yet
  askStyle: t.text(), // what gets a response: "casual, one thing at a time"
  avoid: t.text(), // what gets ignored: "lists, morning briefs"
  timezone: t.varchar({ length: 60 }).notNull().default("America/Los_Angeles"),
  quietStart: t.smallint().notNull().default(21), // no messages from this hour (local)...
  quietEnd: t.smallint().notNull().default(8), // ...until this hour
  dailyMessageLimit: t.smallint(), // max task messages per local day for this person; null = no limit (the default)
  active: t.boolean().notNull().default(true),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
}));

/**
 * What the Chief of Staff learns about a founder over time, one line per note, append-only.
 * Written by the Chief (source agent, with its trace) or a founder (source person). A wrong
 * note is retired, not deleted, so the record of what the Chief believed stays readable.
 */
export const teamProfileNoteKindEnum = pgEnum("team_profile_note_kind", ["preference", "responsibility", "focus", "pattern", "fact"]);

export const TeamProfileNote = pgTable(
  "team_profile_note",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    userId: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }), // whom the note is about
    kind: teamProfileNoteKindEnum().notNull().default("pattern"),
    text: t.varchar({ length: 500 }).notNull(),
    source: teamActorEnum().notNull(), // person or agent
    authorId: t.text().references(() => user.id), // when source = person
    traceId: t.varchar({ length: 120 }), // the conversation the Chief learned it from
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    retiredAt: t.timestamp({ withTimezone: true }),
    retiredBy: t.text().references(() => user.id),
  }),
  (table) => ({
    byPerson: index("idx_team_profile_note_person").on(table.userId, table.createdAt),
  }),
);

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
    ownerId: t.text().references(() => user.id), // null = unassigned backlog: no nudges, assigned at the meeting
    creatorId: t.text().references(() => user.id), // a person who created it (meeting items: Tony)
    workflowKey: t.varchar({ length: 40 }).references(() => TeamWorkflow.key), // the workflow that created it
    status: teamTaskStatusEnum().notNull().default("open"),
    dueAt: t.timestamp({ withTimezone: true }),
    hardDeadline: t.boolean().notNull().default(false), // the date can't move (a birthday)
    // When the one message about this task goes out. Null = the rule (hard deadline → 8am local
    // on the due day; otherwise never). Set by a person, later by the agent; nudgeSetBy says who.
    nudgeAt: t.timestamp({ withTimezone: true }),
    nudgeSetBy: teamActorEnum(),
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
 * One message sent to one person about their tasks. No daily cap (Tony, Nov 10): a message goes
 * out only when a task's nudge time arrives, once per time (lib/team/dayof.ts). bypassTaskId is
 * unused since escalations were dropped; kept so old rows stay valid.
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

/**
 * The shared activity record: one row each time the Chief of Staff sends something to a person
 * or changes something for them (a card sent or changed, a reminder sent, a task created or
 * updated). Not the questions it answers. Conversations with the Chief are separate and
 * forget each other; this is what they all read to know what was recently done for someone
 * ("make it more fun" → the card sent to them ten minutes ago).
 * Append-only. Written by lib/team/activity.ts (recordActivity) from the card, task and
 * reminder code paths; read by GET /api/agent/team/activity. Design: ai-crew/docs/BUSINESS-ACCOUNTABILITY.md.
 */
export const TeamActivityEvent = pgTable(
  "team_activity_event",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    slackUserId: t.varchar({ length: 20 }).notNull(), // who it was sent to or done for
    userId: t.text().references(() => user.id, { onDelete: "set null" }), // the same person as a login, when they have one
    kind: t.varchar({ length: 40 }).notNull(), // card_sent, card_changed, card_photo_shown, card_photo_decided, reminder_sent, task_created, task_updated
    subjectType: t.varchar({ length: 20 }).notNull(), // "card" | "task"
    subjectId: t.varchar({ length: 64 }).notNull(), // celebration id or task id
    summary: t.text().notNull(), // one line the Chief can read back: "Sent Alex Kim's birthday card (Nov 16)"
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => ({
    byPerson: index("idx_team_activity_event_person").on(table.businessId, table.slackUserId, table.createdAt),
  }),
);

/**
 * The nudge decision log: one row each time the nudge rules ran for a person on a day, whether
 * they chose to send or to stay quiet. Holds what was considered, the rule that decided, and
 * (once delivered) the message it led to. The quiet days are logged on purpose: without them
 * nobody can tell later whether silence was right or the rules were hiding something.
 * What happened next (answered, task moved, done by the date) is derived at read time from
 * team_nudge and team_task_event, never stored here.
 * Written by lib/team/nudge.ts (decide, then markSent); read by GET /api/agent/nudges for the
 * monthly review. Design: ai-crew/docs/BUSINESS-ACCOUNTABILITY.md → "Nudges".
 */
export const TeamNudgeDecision = pgTable(
  "team_nudge_decision",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    userId: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }), // whose plate was looked at
    localDate: t.date().notNull(), // their local day; one decision per person per day
    decision: t.varchar({ length: 10 }).notNull(), // send | hold
    kind: t.varchar({ length: 20 }), // triage | task; null on hold
    rule: t.varchar({ length: 40 }).notNull(), // why: triage_due, coming_due, overdue, budget_spent, nothing_live, weekend, quiet_hours
    detail: t.text().notNull(), // the same, as a sentence a person can read
    taskId: t.uuid().references(() => TeamTask.id, { onDelete: "set null" }), // the one task, for kind = task
    angle: t.varchar({ length: 20 }), // coming | overdue: a task gets each at most once per due date
    dueOn: t.date(), // the task's due day when chosen, so a moved date allows a new message
    considered: t.jsonb().$type<{ taskId: string; title: string; due: string | null; verdict: string }[]>().notNull().default(sql`'[]'::jsonb`),
    budgetUsed: t.smallint().notNull(), // messages already sent this week before this decision
    budgetLimit: t.smallint().notNull(),
    nudgeId: t.uuid().references(() => TeamNudge.id, { onDelete: "set null" }), // set once the message went out
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => ({
    onePerDay: unique("team_nudge_decision_person_day").on(table.userId, table.localDate),
    byPerson: index("idx_team_nudge_decision_person").on(table.userId, table.createdAt),
  }),
);
