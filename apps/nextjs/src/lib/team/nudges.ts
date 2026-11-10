/**
 * The daily nudge run: for each reachable person, the open tasks they're responsible for
 * that are due soon, overdue or waiting on them, bundled into one message. Fixed limits
 * (deterministic, never overridden by a model):
 *   - at most one regular nudge per person per local day (the partial unique index)
 *   - nothing in quiet hours (profile quietStart–quietEnd, local time)
 *   - a hard-deadline task due today/tomorrow that got no reply escalates to the task's
 *     creator or workflow owner, bypassing the cap once per task
 * What goes in the bundle is a rule today; the agent takes over timing later, inside the same limits.
 */

import { and, eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamNudge, TeamNudgeTask, TeamProfile, TeamTaskEvent, user } from "@acme/db/schema";

import { getGymBusinessId } from "../business";
import { notify } from "./notify";
import type { Recipient } from "./notify";
import { escalationTarget, openTasksFor } from "./tasks";
import type { Task } from "./tasks";

export const DUE_SOON_DAYS = 3;
const SITE = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}` : "https://app.g1fitnessoc.com";

export interface NudgeRun {
  now: string;
  people: number;
  sent: { userId: string; name: string; channel: string; tasks: number; kind: "reminder" | "escalation" }[];
  skipped: { userId: string; name: string; reason: string }[];
  failed: { userId: string; name: string; error: string }[];
}

interface Person extends Recipient {
  timezone: string;
  quietStart: number;
  quietEnd: number;
}

/** Local hour and YYYY-MM-DD for a timezone */
function local(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

const inQuietHours = (hour: number, start: number, end: number) => (start > end ? hour >= start || hour < end : hour >= start && hour < end);

const daysUntil = (due: Date | null, now: Date) => (due ? Math.ceil((due.getTime() - now.getTime()) / 864e5) : null);

function dueLabel(t: Task, now: Date) {
  const d = daysUntil(t.dueAt, now);
  if (d === null) return "no due date";
  if (d < 0) return `overdue by ${-d} day${d === -1 ? "" : "s"}`;
  if (d === 0) return "due today";
  if (d === 1) return "due tomorrow";
  return `due in ${d} days`;
}

/**
 * Which of a person's open tasks belong in today's message: anything they haven't been told
 * about yet (first notice), anything due within DUE_SOON_DAYS or overdue, and anything blocked.
 */
export function tasksToMention(tasks: Task[], now: Date, alreadyNudged: Set<string>): Task[] {
  return tasks
    .filter((t) => {
      if (!alreadyNudged.has(t.id)) return true;
      const d = daysUntil(t.dueAt, now);
      return t.status === "blocked" || d === null || d <= DUE_SOON_DAYS;
    })
    .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));
}

/** Ids of the given tasks that have been in a nudge before */
async function nudgedBefore(tasks: Task[]): Promise<Set<string>> {
  if (!tasks.length) return new Set();
  const rows = await db
    .select({ taskId: TeamTaskEvent.taskId })
    .from(TeamTaskEvent)
    .where(and(inArray(TeamTaskEvent.taskId, tasks.map((t) => t.id)), eq(TeamTaskEvent.type, "nudged")));
  return new Set(rows.map((r) => r.taskId));
}

function link(t: Task): string {
  const ctx = t.context ?? {};
  if (t.source === "celebrations") return `${SITE}/kpi?tab=retention&view=milestones`;
  return typeof ctx.url === "string" ? ctx.url : "";
}

export function reminderText(name: string, tasks: Task[], now: Date): string {
  const first = name.split(" ")[0] ?? name;
  const lines = [`🤖 Elev8 Ops — morning, ${first}. ${tasks.length === 1 ? "One thing on your plate" : `${tasks.length} things on your plate`}:`];
  // (new assignments appear here once, then again when they're due within a few days)
  for (const t of tasks) {
    const url = link(t);
    const blocked = t.status === "blocked" ? ` — waiting: ${t.blockedReason ?? "blocked"}` : "";
    lines.push(`• ${t.title} (${dueLabel(t, now)})${blocked}${url ? ` ${url}` : ""}`);
  }
  lines.push("", "Reply here when something's done or stuck; the dashboard also works.");
  return lines.join("\n");
}

function escalationText(name: string, owner: string, t: Task, now: Date): string {
  const url = link(t);
  return `🤖 Elev8 Ops — heads up, ${name.split(" ")[0]}: "${t.title}" (${owner}) is ${dueLabel(t, now)} with a deadline that can't move, and hasn't been marked done.${url ? ` ${url}` : ""}`;
}

async function people(): Promise<Person[]> {
  const businessId = await getGymBusinessId();
  const rows = await db
    .select({ userId: user.id, name: user.name, role: user.role, slackUserId: TeamProfile.slackUserId, timezone: TeamProfile.timezone, quietStart: TeamProfile.quietStart, quietEnd: TeamProfile.quietEnd })
    .from(TeamProfile)
    .innerJoin(user, eq(user.id, TeamProfile.userId))
    .where(and(eq(TeamProfile.businessId, businessId), eq(TeamProfile.active, true)));
  return rows.filter((r) => r.role === "trainer");
}

/** Insert the nudge row first: the unique index is the cap. Returns null when today's slot is taken. */
async function claimNudge(p: Person, localDate: string, kind: "reminder" | "escalation", body: string, bypassTaskId: string | null, businessId: string) {
  const [row] = await db
    .insert(TeamNudge)
    .values({ businessId, recipientId: p.userId, channel: "slack", kind, localDate, bypassTaskId, body })
    .onConflictDoNothing()
    .returning({ id: TeamNudge.id });
  return row ?? null;
}

export async function runNudges(opts: { apply: boolean; now?: Date }): Promise<NudgeRun> {
  const now = opts.now ?? new Date();
  const run: NudgeRun = { now: now.toISOString(), people: 0, sent: [], skipped: [], failed: [] };
  const businessId = await getGymBusinessId();
  const everyone = await people();
  run.people = everyone.length;
  const byId = new Map(everyone.map((p) => [p.userId, p]));

  for (const p of everyone) {
    const { date, hour } = local(now, p.timezone);
    if (!p.slackUserId) {
      run.skipped.push({ userId: p.userId, name: p.name, reason: "no channel" });
      continue;
    }
    if (inQuietHours(hour, p.quietStart, p.quietEnd)) {
      run.skipped.push({ userId: p.userId, name: p.name, reason: `quiet hours (${hour}:00 local)` });
      continue;
    }
    const open = await openTasksFor(p.userId);
    const tasks = tasksToMention(open, now, await nudgedBefore(open));
    if (!tasks.length) {
      run.skipped.push({ userId: p.userId, name: p.name, reason: "nothing due" });
      continue;
    }
    const text = reminderText(p.name, tasks, now);
    if (!opts.apply) {
      run.sent.push({ userId: p.userId, name: p.name, channel: "slack (dry)", tasks: tasks.length, kind: "reminder" });
      continue;
    }
    const claimed = await claimNudge(p, date, "reminder", text, null, businessId);
    if (!claimed) {
      run.skipped.push({ userId: p.userId, name: p.name, reason: "already nudged today" });
      continue;
    }
    try {
      const delivery = await notify(p, text);
      await db.update(TeamNudge).set({ externalId: delivery.externalId }).where(eq(TeamNudge.id, claimed.id));
      await db.insert(TeamNudgeTask).values(tasks.map((t) => ({ nudgeId: claimed.id, taskId: t.id, businessId })));
      await db.insert(TeamTaskEvent).values(tasks.map((t) => ({ businessId, taskId: t.id, type: "nudged" as const, actor: "cron" as const, channel: "slack" as const, toValue: p.userId })));
      run.sent.push({ userId: p.userId, name: p.name, channel: "slack", tasks: tasks.length, kind: "reminder" });
    } catch (err) {
      await db.delete(TeamNudge).where(eq(TeamNudge.id, claimed.id)); // the slot is free again
      run.failed.push({ userId: p.userId, name: p.name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Hard-deadline escalations: due today or tomorrow, nudged at least once, still open → the creator/owner, once per task
  const openHard = await hardDeadlineTasks(everyone.map((p) => p.userId), now);
  for (const t of openHard) {
    const targetId = await escalationTarget(t);
    const target = targetId ? byId.get(targetId) : null;
    const owner = byId.get(t.ownerId);
    if (!target?.slackUserId || target.userId === t.ownerId) continue; // nobody else to tell
    const { date, hour } = local(now, target.timezone);
    if (inQuietHours(hour, target.quietStart, target.quietEnd)) continue;
    const text = escalationText(target.name, owner?.name ?? t.ownerId, t, now);
    if (!opts.apply) {
      run.sent.push({ userId: target.userId, name: target.name, channel: "slack (dry)", tasks: 1, kind: "escalation" });
      continue;
    }
    const claimed = await claimNudge(target, date, "escalation", text, t.id, businessId);
    if (!claimed) continue; // this task already escalated once
    try {
      const delivery = await notify(target, text);
      await db.update(TeamNudge).set({ externalId: delivery.externalId }).where(eq(TeamNudge.id, claimed.id));
      await db.insert(TeamNudgeTask).values({ nudgeId: claimed.id, taskId: t.id, businessId });
      await db.insert(TeamTaskEvent).values({ businessId, taskId: t.id, type: "escalated", actor: "cron", channel: "slack", toValue: target.userId });
      run.sent.push({ userId: target.userId, name: target.name, channel: "slack", tasks: 1, kind: "escalation" });
    } catch (err) {
      await db.delete(TeamNudge).where(eq(TeamNudge.id, claimed.id));
      run.failed.push({ userId: target.userId, name: target.name, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return run;
}

/** Open hard-deadline tasks due within a day that have been nudged before */
async function hardDeadlineTasks(ownerIds: string[], now: Date): Promise<Task[]> {
  if (!ownerIds.length) return [];
  const all = (await Promise.all(ownerIds.map((id) => openTasksFor(id)))).flat();
  const seen = new Set<string>();
  const candidates = all.filter((t) => {
    if (seen.has(t.id) || !t.hardDeadline) return false;
    seen.add(t.id);
    const d = daysUntil(t.dueAt, now);
    return d !== null && d <= 1;
  });
  if (!candidates.length) return [];
  const nudged = await db
    .select({ taskId: TeamTaskEvent.taskId })
    .from(TeamTaskEvent)
    .where(and(inArray(TeamTaskEvent.taskId, candidates.map((t) => t.id)), eq(TeamTaskEvent.type, "nudged")));
  const nudgedIds = new Set(nudged.map((n) => n.taskId));
  return candidates.filter((t) => nudgedIds.has(t.id));
}
