/**
 * "One touch, day of" (BUSINESS-ACCOUNTABILITY.md → MVP): the only message the team gets
 * between meetings. A task with a hard deadline before the next meeting gets one Slack DM to
 * its owner on the morning of the deadline. The Chief of Staff writes the words; this module
 * decides eligibility, enforces the limits (one per person per local day via team_nudge's
 * unique index, quiet hours), sends, and records. The COS cannot send without going through
 * here, so its instructions can't exceed the cap.
 */

import { and, eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamNudge, TeamNudgeTask, TeamProfile, TeamTask, TeamTaskEvent, user } from "@acme/db/schema";

import { getGymBusinessId } from "../business";
import { isUrgent } from "./meeting";
import { sendSlackDm } from "./notify";
import type { Task } from "./tasks";

const OPEN = ["open", "in_progress", "blocked"] as const;

export interface DayOfItem {
  task: Task;
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

const inQuietHours = (hour: number, start: number, end: number) => (start > end ? hour >= start || hour < end : hour >= start && hour < end);

/**
 * Tasks that should get their day-of message now: open, hard deadline before the next meeting,
 * due today in the responsible person's local day (or earlier and still open), person reachable
 * and outside quiet hours, no regular nudge to them yet today.
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

  const due: DayOfItem[] = [];
  const skipped: { taskId: string; title: string; reason: string }[] = [];
  for (const t of tasks) {
    if (!isUrgent(t, now) || !t.dueAt) continue;
    const responsibleId = t.status === "blocked" ? (t.blockedOnId ?? t.ownerId) : t.ownerId;
    const p = byId.get(responsibleId);
    if (!p?.active) {
      skipped.push({ taskId: t.id, title: t.title, reason: "no active profile" });
      continue;
    }
    const { date, hour } = local(now, p.timezone);
    const dueLocal = local(t.dueAt, p.timezone).date;
    if (dueLocal > date) continue; // not today yet
    if (!p.slackUserId) {
      skipped.push({ taskId: t.id, title: t.title, reason: "no Slack id" });
      continue;
    }
    if (inQuietHours(hour, p.quietStart, p.quietEnd)) {
      skipped.push({ taskId: t.id, title: t.title, reason: `quiet hours (${hour}:00 local)` });
      continue;
    }
    const [already] = await db
      .select({ id: TeamNudge.id })
      .from(TeamNudge)
      .innerJoin(TeamNudgeTask, eq(TeamNudgeTask.nudgeId, TeamNudge.id))
      .where(and(eq(TeamNudgeTask.taskId, t.id), eq(TeamNudge.recipientId, p.userId), eq(TeamNudge.localDate, date)))
      .limit(1);
    due.push({ task: t, recipient: { userId: p.userId, name: p.name, slackUserId: p.slackUserId, timezone: p.timezone, quietStart: p.quietStart, quietEnd: p.quietEnd }, localDate: date, localHour: hour, alreadyNudgedToday: !!already });
  }
  return { due, skipped };
}

export class NudgeRefused extends Error {}

/**
 * Send one day-of message to one person covering the given tasks. Refuses (and sends nothing)
 * when the tasks aren't eligible for that person today, or the person already got today's
 * message. The cap is the unique index: the row is claimed before the send.
 */
export async function sendDayOf(input: { slackUserId: string; taskIds: string[]; text: string; traceId?: string }, now = new Date()): Promise<{ nudgeId: string; externalId: string | null; tasks: number }> {
  if (!input.text.trim()) throw new NudgeRefused("Empty message");
  if (!input.taskIds.length) throw new NudgeRefused("No tasks");
  const { due } = await dayOfItems(now);
  const mine = due.filter((d) => d.recipient.slackUserId === input.slackUserId && input.taskIds.includes(d.task.id));
  if (!mine.length) throw new NudgeRefused("None of these tasks is due for this person today");
  const notEligible = input.taskIds.filter((id) => !mine.some((d) => d.task.id === id));
  if (notEligible.length) throw new NudgeRefused(`Not eligible today: ${notEligible.join(", ")}`);
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
