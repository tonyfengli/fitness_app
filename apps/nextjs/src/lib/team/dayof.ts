/**
 * The one message a founder gets about a task between meetings (BUSINESS-ACCOUNTABILITY.md →
 * MVP). When it goes out is the task's `nudgeAt`, or, when unset, the rule: a hard deadline
 * → 8am local on the due day; anything else → never. The Mini checks every 5 minutes; the
 * Chief of Staff writes the words; this module decides eligibility, enforces the limits (one
 * regular message per person per local day via team_nudge's unique index, quiet hours), sends,
 * and records. The COS cannot send without going through here.
 */

import { and, eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamNudge, TeamNudgeTask, TeamProfile, TeamTask, TeamTaskEvent, user } from "@acme/db/schema";

import { getGymBusinessId } from "../business";
import { sendSlackDm } from "./notify";
import type { Task } from "./tasks";

const OPEN = ["open", "in_progress", "blocked"] as const;
export const DEFAULT_NUDGE_HOUR = 8; // local, on the due day, for hard deadlines

export interface DayOfItem {
  task: Task;
  nudgeTime: Date; // when the message is meant to go out
  nudgeSetBy: "rule" | "person" | "agent" | "workflow" | "cron";
  recipient: { userId: string; name: string; slackUserId: string | null; timezone: string; quietStart: number; quietEnd: number };
  localDate: string;
  localHour: number;
  alreadyNudgedToday: boolean;
}

function local(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

/** `hour`:00 local on the same local day as `d` */
function atLocalHour(d: Date, timezone: string, hour: number): Date {
  const { date } = local(d, timezone);
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const localNoonHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(noonUtc)) % 24;
  return new Date(noonUtc.getTime() + (hour - localNoonHour) * 36e5);
}

const inQuietHours = (hour: number, start: number, end: number) => (start > end ? hour >= start || hour < end : hour >= start && hour < end);

/** The time a task's message is meant to go out, and who decided it; null = never */
export function nudgeTimeFor(t: Task, timezone: string): { at: Date; setBy: DayOfItem["nudgeSetBy"] } | null {
  if (t.nudgeAt) return { at: t.nudgeAt, setBy: t.nudgeSetBy ?? "person" };
  if (t.hardDeadline && t.dueAt) return { at: atLocalHour(t.dueAt, timezone, DEFAULT_NUDGE_HOUR), setBy: "rule" };
  return null;
}

/**
 * Tasks whose message should go out now: open, nudge time reached, not yet messaged since that
 * time was set, the responsible person reachable and outside quiet hours.
 */
export async function dayOfItems(now = new Date()): Promise<{ due: DayOfItem[]; skipped: { taskId: string; title: string; reason: string }[] }> {
  const businessId = await getGymBusinessId();
  const tasks = await db.select().from(TeamTask).where(and(eq(TeamTask.businessId, businessId), inArray(TeamTask.status, [...OPEN])));
  const people = await db
    .select({ userId: user.id, name: user.name, slackUserId: TeamProfile.slackUserId, timezone: TeamProfile.timezone, quietStart: TeamProfile.quietStart, quietEnd: TeamProfile.quietEnd, active: TeamProfile.active })
    .from(TeamProfile)
    .innerJoin(user, eq(user.id, TeamProfile.userId))
    .where(eq(TeamProfile.businessId, businessId));
  const byId = new Map(people.map((p) => [p.userId, p]));
  const nudgedEvents = tasks.length
    ? await db
        .select({ taskId: TeamTaskEvent.taskId, createdAt: TeamTaskEvent.createdAt })
        .from(TeamTaskEvent)
        .where(and(inArray(TeamTaskEvent.taskId, tasks.map((t) => t.id)), eq(TeamTaskEvent.type, "nudged")))
    : [];
  const lastNudged = new Map<string, number>();
  for (const e of nudgedEvents) lastNudged.set(e.taskId, Math.max(lastNudged.get(e.taskId) ?? 0, e.createdAt.getTime()));

  const due: DayOfItem[] = [];
  const skipped: { taskId: string; title: string; reason: string }[] = [];
  for (const t of tasks) {
    const responsibleId = t.status === "blocked" ? (t.blockedOnId ?? t.ownerId) : t.ownerId;
    if (!responsibleId) continue; // unassigned: never messaged
    const p = byId.get(responsibleId);
    const timezone = p?.timezone ?? "America/Los_Angeles";
    const when = nudgeTimeFor(t, timezone);
    if (!when || when.at > now) continue; // no message, or not yet
    if ((lastNudged.get(t.id) ?? 0) >= when.at.getTime()) continue; // already sent for this time
    if (!p?.active) {
      skipped.push({ taskId: t.id, title: t.title, reason: "no active profile" });
      continue;
    }
    if (!p.slackUserId) {
      skipped.push({ taskId: t.id, title: t.title, reason: "no Slack id" });
      continue;
    }
    const { date, hour } = local(now, p.timezone);
    if (inQuietHours(hour, p.quietStart, p.quietEnd)) {
      skipped.push({ taskId: t.id, title: t.title, reason: `quiet hours (${hour}:00 local); goes out after ${p.quietEnd}:00` });
      continue;
    }
    const [already] = await db
      .select({ id: TeamNudge.id })
      .from(TeamNudge)
      .where(and(eq(TeamNudge.recipientId, p.userId), eq(TeamNudge.localDate, date), eq(TeamNudge.kind, "reminder")))
      .limit(1);
    due.push({
      task: t,
      nudgeTime: when.at,
      nudgeSetBy: when.setBy,
      recipient: { userId: p.userId, name: p.name, slackUserId: p.slackUserId, timezone: p.timezone, quietStart: p.quietStart, quietEnd: p.quietEnd },
      localDate: date,
      localHour: hour,
      alreadyNudgedToday: !!already,
    });
  }
  return { due, skipped };
}

export class NudgeRefused extends Error {}

/**
 * Send one message to one person covering the given tasks. Refuses (and sends nothing) when
 * the tasks aren't due a message for that person now, or the person already got today's
 * message. The cap is the unique index: the row is claimed before the send.
 */
export async function sendDayOf(input: { slackUserId: string; taskIds: string[]; text: string; traceId?: string }, now = new Date()): Promise<{ nudgeId: string; externalId: string | null; tasks: number }> {
  if (!input.text.trim()) throw new NudgeRefused("Empty message");
  if (!input.taskIds.length) throw new NudgeRefused("No tasks");
  const { due } = await dayOfItems(now);
  const mine = due.filter((d) => d.recipient.slackUserId === input.slackUserId && input.taskIds.includes(d.task.id));
  if (!mine.length) throw new NudgeRefused("None of these tasks is due a message for this person now");
  const notEligible = input.taskIds.filter((id) => !mine.some((d) => d.task.id === id));
  if (notEligible.length) throw new NudgeRefused(`Not due now: ${notEligible.join(", ")}`);
  const first = mine[0];
  if (!first) throw new NudgeRefused("Nothing to send");
  const r = first.recipient;
  const localDate = first.localDate;
  const businessId = first.task.businessId;

  const [claimed] = await db
    .insert(TeamNudge)
    .values({ businessId, recipientId: r.userId, channel: "slack", kind: "reminder", localDate, body: input.text })
    .onConflictDoNothing()
    .returning({ id: TeamNudge.id });
  if (!claimed) throw new NudgeRefused(`${r.name} already got today's message`);
  try {
    const delivery = await sendSlackDm(input.slackUserId, input.text);
    await db.update(TeamNudge).set({ externalId: delivery.externalId }).where(eq(TeamNudge.id, claimed.id));
    await db.insert(TeamNudgeTask).values(mine.map((d) => ({ nudgeId: claimed.id, taskId: d.task.id, businessId })));
    await db.insert(TeamTaskEvent).values(
      mine.map((d) => ({ businessId, taskId: d.task.id, type: "nudged" as const, actor: "agent" as const, channel: "slack" as const, toValue: r.userId, note: input.text, traceId: input.traceId ?? null })),
    );
    return { nudgeId: claimed.id, externalId: delivery.externalId, tasks: mine.length };
  } catch (err) {
    await db.delete(TeamNudge).where(eq(TeamNudge.id, claimed.id)); // free the slot; nothing was sent
    throw err;
  }
}
