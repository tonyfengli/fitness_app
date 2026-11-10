/**
 * The one way to change team tasks (packages/db/src/schema/team.ts). Every write records an
 * event, and the rules about who may do what live here, so workflows, routes and agents all
 * get the same behavior. Design: ai-crew/docs/BUSINESS-ACCOUNTABILITY.md.
 *
 * Rules (V1):
 * - Owners may complete, decline, block/unblock and progress their own tasks.
 * - Reassignment and cancelling need the creator (or the workflow's owner for workflow tasks).
 * - Hard-deadline tasks never move their due date.
 * - createTasks is all-or-nothing and never duplicates a (source, sourceRef).
 */

import { and, desc, eq, inArray, isNull } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamNudge, TeamNudgeTask, TeamTask, TeamTaskEvent, TeamWorkflow, user } from "@acme/db/schema";

import { getGymBusinessId } from "../business";

export type Actor = { kind: "person"; userId: string } | { kind: "workflow" | "agent" | "cron" };
export type Channel = "slack" | "imessage" | "sms" | "dashboard" | "system";
export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "declined" | "cancelled";

export interface NewTask {
  title: string;
  details?: string;
  context?: Record<string, unknown>;
  ownerId?: string | null; // null = unassigned (backlog); nobody is nudged until the meeting assigns it
  creatorId?: string;
  workflowKey?: string;
  dueAt?: Date | null;
  hardDeadline?: boolean;
  source: string;
  sourceRef: string;
}

export type Task = typeof TeamTask.$inferSelect;

export class TeamRuleError extends Error {}

const actorColumns = (actor: Actor) => ({ actor: actor.kind, actorId: actor.kind === "person" ? actor.userId : null });

/** Trainers only own tasks (user.role = 'trainer') */
async function assertTrainer(userId: string) {
  const [u] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1);
  if (u?.role !== "trainer") throw new TeamRuleError(`User ${userId} is not a trainer`);
}

/**
 * Create several tasks at once, all or nothing. Tasks whose (source, sourceRef) already exist
 * are skipped, not duplicated. Returns the tasks that were created.
 */
export async function createTasks(input: NewTask[], actor: Actor, channel: Channel = "system"): Promise<Task[]> {
  if (!input.length) return [];
  const businessId = await getGymBusinessId();
  for (const t of input) {
    if (!t.creatorId && !t.workflowKey) throw new TeamRuleError(`Task "${t.title}" needs a creator or a workflow`);
    if (t.ownerId) await assertTrainer(t.ownerId);
  }
  if (input.some((t) => t.workflowKey)) {
    const keys = [...new Set(input.map((t) => t.workflowKey).filter((k): k is string => !!k))];
    const rows = await db.select({ key: TeamWorkflow.key, active: TeamWorkflow.active }).from(TeamWorkflow).where(inArray(TeamWorkflow.key, keys));
    for (const k of keys) {
      const w = rows.find((r) => r.key === k);
      if (!w) throw new TeamRuleError(`Unknown workflow ${k}`);
      if (!w.active) throw new TeamRuleError(`Workflow ${k} is paused`);
    }
  }
  return db.transaction(async (tx) => {
    const created = await tx
      .insert(TeamTask)
      .values(
        input.map((t) => ({
          businessId,
          title: t.title,
          details: t.details ?? null,
          context: t.context ?? null,
          ownerId: t.ownerId ?? null,
          creatorId: t.creatorId ?? null,
          workflowKey: t.workflowKey ?? null,
          dueAt: t.dueAt ?? null,
          hardDeadline: t.hardDeadline ?? false,
          nextCheckAt: new Date(), // eligible for the next nudge run
          source: t.source,
          sourceRef: t.sourceRef,
        })),
      )
      .onConflictDoNothing({ target: [TeamTask.businessId, TeamTask.source, TeamTask.sourceRef] })
      .returning();
    if (created.length) {
      await tx.insert(TeamTaskEvent).values(
        created.map((c) => ({ businessId, taskId: c.id, type: "created" as const, ...actorColumns(actor), channel, toValue: c.ownerId ?? "unassigned", note: c.title })),
      );
    }
    return created;
  });
}

export async function getTask(id: string): Promise<Task | null> {
  const [t] = await db.select().from(TeamTask).where(eq(TeamTask.id, id)).limit(1);
  return t ?? null;
}

export async function findTask(source: string, sourceRef: string): Promise<Task | null> {
  const businessId = await getGymBusinessId();
  const [t] = await db
    .select()
    .from(TeamTask)
    .where(and(eq(TeamTask.businessId, businessId), eq(TeamTask.source, source), eq(TeamTask.sourceRef, sourceRef)))
    .limit(1);
  return t ?? null;
}

/** The person a task escalates to: its creator, else its workflow's owner */
export async function escalationTarget(task: Task): Promise<string | null> {
  if (task.creatorId) return task.creatorId;
  if (!task.workflowKey) return null;
  const [w] = await db.select({ ownerId: TeamWorkflow.ownerId }).from(TeamWorkflow).where(eq(TeamWorkflow.key, task.workflowKey)).limit(1);
  return w?.ownerId ?? null;
}

async function mayManage(task: Task, actor: Actor): Promise<boolean> {
  if (actor.kind !== "person") return true; // workflows, agents and crons act within their own rules
  if (task.creatorId === actor.userId) return true;
  return (await escalationTarget(task)) === actor.userId;
}

const isOwner = (task: Task, actor: Actor) => actor.kind !== "person" || (!!task.ownerId && task.ownerId === actor.userId);

const OPEN: TaskStatus[] = ["open", "in_progress", "blocked"];

async function transition(
  task: Task,
  to: TaskStatus,
  actor: Actor,
  channel: Channel,
  eventType: typeof TeamTaskEvent.$inferInsert.type,
  extra: Partial<typeof TeamTask.$inferInsert> = {},
  note?: string,
): Promise<Task> {
  const businessId = task.businessId;
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(TeamTask)
      .set({ status: to, ...extra })
      .where(eq(TeamTask.id, task.id))
      .returning();
    await tx.insert(TeamTaskEvent).values({ businessId, taskId: task.id, type: eventType, ...actorColumns(actor), channel, fromValue: task.status, toValue: to, note: note ?? null });
    return orThrow(updated);
  });
}

function orThrow<T>(row: T | undefined): T {
  if (!row) throw new Error("Task vanished during update");
  return row;
}

export async function complete(task: Task, actor: Actor, channel: Channel = "system", note?: string): Promise<Task> {
  if (task.status === "done") return task;
  if (!OPEN.includes(task.status)) throw new TeamRuleError(`Task is ${task.status}`);
  if (!isOwner(task, actor) && !(await mayManage(task, actor))) throw new TeamRuleError("Only the owner can complete this task");
  return transition(task, "done", actor, channel, "completed", { completedAt: new Date(), nextCheckAt: null }, note);
}

export async function decline(task: Task, actor: Actor, channel: Channel, reason: string): Promise<Task> {
  if (!OPEN.includes(task.status)) throw new TeamRuleError(`Task is ${task.status}`);
  if (!isOwner(task, actor)) throw new TeamRuleError("Only the owner can decline this task");
  return transition(task, "declined", actor, channel, "declined", { nextCheckAt: null }, reason);
}

export async function cancel(task: Task, actor: Actor, channel: Channel, reason?: string): Promise<Task> {
  if (task.status === "cancelled") return task;
  if (!(await mayManage(task, actor))) throw new TeamRuleError("Only the creator (or the workflow's owner) can cancel this task");
  return transition(task, "cancelled", actor, channel, "status_changed", { nextCheckAt: null }, reason);
}

export async function start(task: Task, actor: Actor, channel: Channel): Promise<Task> {
  if (task.status !== "open") throw new TeamRuleError(`Task is ${task.status}`);
  if (!isOwner(task, actor)) throw new TeamRuleError("Only the owner can start this task");
  return transition(task, "in_progress", actor, channel, "status_changed");
}

/** "Waiting on <person>": nudges go to that person until unblocked */
export async function block(task: Task, actor: Actor, channel: Channel, blockedOnId: string | null, reason: string): Promise<Task> {
  if (!OPEN.includes(task.status)) throw new TeamRuleError(`Task is ${task.status}`);
  if (!isOwner(task, actor)) throw new TeamRuleError("Only the owner can block this task");
  if (blockedOnId) await assertTrainer(blockedOnId);
  return transition(task, "blocked", actor, channel, "blocked", { blockedOnId, blockedReason: reason, nextCheckAt: new Date() }, reason);
}

export async function unblock(task: Task, actor: Actor, channel: Channel, note?: string): Promise<Task> {
  if (task.status !== "blocked") return task;
  return transition(task, "open", actor, channel, "unblocked", { blockedOnId: null, blockedReason: null, nextCheckAt: new Date() }, note);
}

export async function reassign(task: Task, actor: Actor, channel: Channel, newOwnerId: string, note?: string): Promise<Task> {
  if (!OPEN.includes(task.status)) throw new TeamRuleError(`Task is ${task.status}`);
  // Anyone may take a task out of the unassigned backlog; reassigning an owned task needs the creator
  if (task.ownerId && !(await mayManage(task, actor))) throw new TeamRuleError("Only the creator (or the workflow's owner) can reassign this task");
  await assertTrainer(newOwnerId);
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(TeamTask).set({ ownerId: newOwnerId, nextCheckAt: new Date() }).where(eq(TeamTask.id, task.id)).returning();
    await tx.insert(TeamTaskEvent).values({ businessId: task.businessId, taskId: task.id, type: "reassigned", ...actorColumns(actor), channel, fromValue: task.ownerId ?? "unassigned", toValue: newOwnerId, note: note ?? null });
    return orThrow(updated);
  });
}

/** Back to the unassigned backlog. Any founder may do this (Tony's call, Nov 10); the event records who. */
export async function unassign(task: Task, actor: Actor, channel: Channel, note?: string): Promise<Task> {
  if (!OPEN.includes(task.status)) throw new TeamRuleError(`Task is ${task.status}`);
  if (!task.ownerId) return task;
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(TeamTask).set({ ownerId: null, blockedOnId: null, nextCheckAt: null }).where(eq(TeamTask.id, task.id)).returning();
    await tx.insert(TeamTaskEvent).values({ businessId: task.businessId, taskId: task.id, type: "reassigned", ...actorColumns(actor), channel, fromValue: task.ownerId, toValue: "unassigned", note: note ?? null });
    return orThrow(updated);
  });
}

/** Up to SMALL_SHIFT_DAYS the owner may move a soft due date; more needs the creator. Hard deadlines never move. */
export const SMALL_SHIFT_DAYS = 2;

export async function changeDeadline(task: Task, actor: Actor, channel: Channel, dueAt: Date, note?: string): Promise<Task> {
  if (!OPEN.includes(task.status)) throw new TeamRuleError(`Task is ${task.status}`);
  if (task.hardDeadline) throw new TeamRuleError("This deadline can't move");
  const shiftDays = task.dueAt ? Math.abs(dueAt.getTime() - task.dueAt.getTime()) / 864e5 : Infinity;
  const ownerMay = isOwner(task, actor) && shiftDays <= SMALL_SHIFT_DAYS;
  if (!ownerMay && !(await mayManage(task, actor))) throw new TeamRuleError(`Moving a due date more than ${SMALL_SHIFT_DAYS} days needs the creator`);
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(TeamTask).set({ dueAt, nextCheckAt: new Date() }).where(eq(TeamTask.id, task.id)).returning();
    await tx.insert(TeamTaskEvent).values({ businessId: task.businessId, taskId: task.id, type: "deadline_changed", ...actorColumns(actor), channel, fromValue: task.dueAt?.toISOString() ?? null, toValue: dueAt.toISOString(), note: note ?? null });
    return orThrow(updated);
  });
}

/** Undo a Done / Drop / Decline at the meeting: back to open. Owner, creator or workflow owner. */
export async function reopen(task: Task, actor: Actor, channel: Channel): Promise<Task> {
  if (OPEN.includes(task.status)) return task;
  if (!isOwner(task, actor) && !(await mayManage(task, actor))) throw new TeamRuleError("Only the owner or the creator can reopen this task");
  return transition(task, "open", actor, channel, "status_changed", { completedAt: null, nextCheckAt: new Date() }, "Reopened");
}

/** "Still on" at the Monday review: the item was looked at and carries over unchanged. Counted as a carry-over. */
export const REVIEW_NOTE = "Reviewed at the meeting: still on";

export async function review(task: Task, actor: Actor, channel: Channel): Promise<Task> {
  if (!OPEN.includes(task.status)) throw new TeamRuleError(`Task is ${task.status}`);
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(TeamTask).set({ nextCheckAt: new Date() }).where(eq(TeamTask.id, task.id)).returning();
    await tx.insert(TeamTaskEvent).values({ businessId: task.businessId, taskId: task.id, type: "note", ...actorColumns(actor), channel, note: REVIEW_NOTE });
    return orThrow(updated);
  });
}

/** Fix the wording (a Granola draft got it wrong). Creator, workflow owner or the owner. */
export async function edit(task: Task, actor: Actor, channel: Channel, patch: { title?: string; details?: string | null }): Promise<Task> {
  if (!OPEN.includes(task.status)) throw new TeamRuleError(`Task is ${task.status}`);
  if (!isOwner(task, actor) && !(await mayManage(task, actor))) throw new TeamRuleError("Only the owner or the creator can edit this task");
  const title = patch.title?.trim();
  if (patch.title !== undefined && !title) throw new TeamRuleError("Title can't be empty");
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(TeamTask)
      .set({ ...(title ? { title } : {}), ...(patch.details !== undefined ? { details: patch.details } : {}) })
      .where(eq(TeamTask.id, task.id))
      .returning();
    await tx.insert(TeamTaskEvent).values({ businessId: task.businessId, taskId: task.id, type: "note", ...actorColumns(actor), channel, fromValue: task.title, toValue: title ?? task.title, note: "Edited" });
    return orThrow(updated);
  });
}

export async function addNote(task: Task, actor: Actor, channel: Channel, note: string, traceId?: string): Promise<void> {
  await db.insert(TeamTaskEvent).values({ businessId: task.businessId, taskId: task.id, type: "note", ...actorColumns(actor), channel, note, traceId: traceId ?? null });
}

/**
 * A person answered a nudge about this task. Records their words as an event and marks the
 * latest nudge that covered the task as replied. The agent then acts (complete, block, …) as
 * a separate call, so the timeline shows the reply and the decision as two lines.
 */
export async function recordReply(task: Task, from: { userId: string }, channel: Channel, text: string, traceId?: string): Promise<void> {
  await db.insert(TeamTaskEvent).values({ businessId: task.businessId, taskId: task.id, type: "replied", actor: "person", actorId: from.userId, channel, note: text, traceId: traceId ?? null });
  const [latest] = await db
    .select({ id: TeamNudge.id })
    .from(TeamNudge)
    .innerJoin(TeamNudgeTask, eq(TeamNudgeTask.nudgeId, TeamNudge.id))
    .where(and(eq(TeamNudgeTask.taskId, task.id), eq(TeamNudge.recipientId, from.userId)))
    .orderBy(desc(TeamNudge.sentAt))
    .limit(1);
  if (latest) await db.update(TeamNudge).set({ outcome: "replied", respondedAt: new Date() }).where(and(eq(TeamNudge.id, latest.id), isNull(TeamNudge.respondedAt)));
}

/** Open tasks that someone is responsible for right now: their own, plus ones blocked on them */
export async function openTasksFor(userId: string): Promise<Task[]> {
  const businessId = await getGymBusinessId();
  const rows = await db
    .select()
    .from(TeamTask)
    .where(and(eq(TeamTask.businessId, businessId), inArray(TeamTask.status, OPEN)));
  return rows.filter((t) => !!t.ownerId && (t.status === "blocked" ? (t.blockedOnId ?? t.ownerId) === userId : t.ownerId === userId));
}
