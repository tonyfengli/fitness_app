/**
 * The nudge rules: whether to message a founder about their own tasks today, and about what.
 * Fixed rules decide; an agent only writes the words afterwards (Tony, Nov 13 2026: "bet 2").
 * Every run is logged, quiet days included (team_nudge_decision, "bet 1").
 *
 * In order:
 *   1. Weekends and quiet hours: nothing.
 *   2. A weekly budget (WEEKLY_BUDGET messages, Monday to Sunday local). Spent: nothing.
 *   3. Triage, once a week from Tuesday on, when the person has open tasks with no date:
 *      one question, "which of these are actually due this week?". Their answer puts dates on
 *      the ones that matter; the rest stay a backlog and are never pushed.
 *   4. One live task: open, theirs, dated. "coming" = due today or within COMING_DAYS;
 *      "overdue" = the date passed. Each at most once per task per due date, so the same
 *      reminder is never repeated; a moved date makes it new. Skipped: hard deadlines (the
 *      day-of reminder covers them), tasks with their own reminder time, blocked tasks, and
 *      anything they touched in the last day.
 *   5. Otherwise nothing.
 * Evidence and reasoning: ai-crew/docs/BUSINESS-ACCOUNTABILITY.md → "Nudges".
 */

import { and, desc, eq, gte, inArray, isNotNull } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamNudge, TeamNudgeDecision, TeamNudgeTask, TeamProfile, TeamTask, TeamTaskEvent, user } from "@acme/db/schema";

import { getGymBusinessId } from "../business";
import { recordActivity } from "./activity";
import { getProfile, profileBrief } from "./profile";
import type { Channel } from "./tasks";

export const WEEKLY_BUDGET = 3;
export const COMING_DAYS = 2; // "coming" = due today, tomorrow or the day after
const TRIAGE_FROM_WEEKDAY = 2; // Tuesday: after Monday's meeting has added the week's tasks
const RECENT_TOUCH_HOURS = 24;
const OUTCOME_DAYS = 3;

type Decision = typeof TeamNudgeDecision.$inferSelect;
type Considered = Decision["considered"];

function local(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { date, hour: Number(get("hour")) % 24, weekday };
}
const localDay = (d: Date, timezone: string) => local(d, timezone).date;
const addDays = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);
const inQuietHours = (hour: number, start: number, end: number) => (start > end ? hour >= start || hour < end : hour >= start && hour < end);

export interface NudgePlan {
  decisionId: string;
  decision: "send" | "hold";
  kind: "triage" | "task" | null;
  rule: string;
  detail: string;
  alreadySent: boolean;
  budget: { used: number; limit: number };
  /** For kind = task */
  task?: { id: string; title: string; details: string | null; dueOn: string; angle: string; daysToDue: number };
  /** For kind = triage: the undated tasks, soonest created first */
  undated?: { id: string; title: string }[];
  /** How this person wants to be reached, for the agent that writes the words */
  profile?: string;
}

/**
 * Run the rules for one person now. One decision per local day: a second call returns the first.
 * `dry` shows what the rules would choose and writes nothing (for checking a rule change).
 */
export async function decide(userId: string, now = new Date(), dry = false): Promise<NudgePlan> {
  const businessId = await getGymBusinessId();
  const [p] = await db.select().from(TeamProfile).where(and(eq(TeamProfile.businessId, businessId), eq(TeamProfile.userId, userId))).limit(1);
  if (!p?.active) throw new Error("No active team profile");
  const { date, hour, weekday } = local(now, p.timezone);

  const tasks = await db
    .select()
    .from(TeamTask)
    .where(and(eq(TeamTask.businessId, businessId), eq(TeamTask.ownerId, userId), inArray(TeamTask.status, ["open", "in_progress", "blocked"])));
  const mondayOfWeek = addDays(date, -((weekday + 6) % 7));
  const weekRows = await db
    .select()
    .from(TeamNudgeDecision)
    .where(and(eq(TeamNudgeDecision.userId, userId), gte(TeamNudgeDecision.localDate, mondayOfWeek)));
  const today = weekRows.find((r) => r.localDate === date);
  if (today && !dry) return plan(today, tasks, userId);

  const sentThisWeek = weekRows.filter((r) => r.nudgeId);
  const budgetUsed = sentThisWeek.length;
  const considered: Considered = [];
  const base = { businessId, userId, localDate: date, budgetUsed, budgetLimit: WEEKLY_BUDGET };
  const save = (values: typeof TeamNudgeDecision.$inferInsert) => (dry ? Promise.resolve({ taskId: null, angle: null, dueOn: null, kind: null, ...values, id: "dry-run", nudgeId: null, createdAt: now, considered } as Decision) : store(values));
  const hold = (rule: string, detail: string) => save({ ...base, decision: "hold", kind: null, rule, detail, considered });

  if (weekday === 0 || weekday === 6) return plan(await hold("weekend", "Weekend: no messages about work tasks."), tasks, userId);
  if (inQuietHours(hour, p.quietStart, p.quietEnd)) return plan(await hold("quiet_hours", `Quiet hours (${hour}:00 local).`), tasks, userId);
  if (budgetUsed >= WEEKLY_BUDGET) return plan(await hold("budget_spent", `All ${WEEKLY_BUDGET} messages for this week are used.`), tasks, userId);

  // 3. Triage
  const undated = tasks.filter((t) => !t.dueAt && t.status !== "blocked");
  const triagedThisWeek = weekRows.some((r) => r.kind === "triage" && r.nudgeId);
  if (weekday >= TRIAGE_FROM_WEEKDAY && !triagedThisWeek && undated.length) {
    for (const t of undated) considered.push({ taskId: t.id, title: t.title, due: null, verdict: "undated: part of the triage question" });
    return plan(await save({ ...base, decision: "send", kind: "triage", rule: "triage_due", detail: `${undated.length} open task(s) have no date and no triage question has gone out this week.`, considered }), tasks, userId);
  }

  // 4. One live task
  const past = await db
    .select({ taskId: TeamNudgeDecision.taskId, angle: TeamNudgeDecision.angle, dueOn: TeamNudgeDecision.dueOn })
    .from(TeamNudgeDecision)
    .where(and(eq(TeamNudgeDecision.userId, userId), isNotNull(TeamNudgeDecision.nudgeId), isNotNull(TeamNudgeDecision.taskId)));
  const touched = tasks.length
    ? await db
        .select({ taskId: TeamTaskEvent.taskId })
        .from(TeamTaskEvent)
        .where(and(inArray(TeamTaskEvent.taskId, tasks.map((t) => t.id)), gte(TeamTaskEvent.createdAt, new Date(now.getTime() - RECENT_TOUCH_HOURS * 36e5))))
    : [];
  const touchedIds = new Set(touched.map((e) => e.taskId));

  const candidates: { t: (typeof tasks)[number]; dueOn: string; angle: "coming" | "overdue"; daysToDue: number }[] = [];
  for (const t of [...tasks].sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity))) {
    const dueOn = t.dueAt ? localDay(t.dueAt, p.timezone) : null;
    const note = (verdict: string) => considered.push({ taskId: t.id, title: t.title, due: dueOn, verdict });
    if (!dueOn) {
      note("no date: backlog, never pushed");
      continue;
    }
    const daysToDue = Math.round((new Date(`${dueOn}T12:00:00Z`).getTime() - new Date(`${date}T12:00:00Z`).getTime()) / 864e5);
    if (t.status === "blocked") note("blocked: waiting on someone else");
    else if (t.hardDeadline) note("hard deadline: the day-of reminder covers it");
    else if (t.nudgeAt) note("has its own reminder time");
    else if (daysToDue > COMING_DAYS) note(`due in ${daysToDue} days: not yet`);
    else if (touchedIds.has(t.id)) note("touched in the last day: leave it");
    else {
      const angle = daysToDue < 0 ? "overdue" : "coming";
      if (past.some((d) => d.taskId === t.id && d.angle === angle && d.dueOn === dueOn)) note(`already messaged (${angle}) for this date: never repeated`);
      else {
        note(`live: ${angle}`);
        candidates.push({ t, dueOn, angle, daysToDue });
      }
    }
  }
  const pick = candidates[0];
  if (!pick) return plan(await hold("nothing_live", "No task is both due soon and new to mention."), tasks, userId);
  const rule = pick.angle === "overdue" ? "overdue" : "coming_due";
  const detail = pick.angle === "overdue" ? `"${pick.t.title}" was due ${pick.dueOn} and is still open.` : `"${pick.t.title}" is due ${pick.daysToDue === 0 ? "today" : pick.daysToDue === 1 ? "tomorrow" : `in ${pick.daysToDue} days`} (${pick.dueOn}).`;
  return plan(await save({ ...base, decision: "send", kind: "task", rule, detail, taskId: pick.t.id, angle: pick.angle, dueOn: pick.dueOn, considered }), tasks, userId);
}

async function store(values: typeof TeamNudgeDecision.$inferInsert): Promise<Decision> {
  const [row] = await db.insert(TeamNudgeDecision).values(values).onConflictDoNothing().returning();
  if (row) return row;
  // Two runs raced on the same day: the first one stands
  const [existing] = await db.select().from(TeamNudgeDecision).where(and(eq(TeamNudgeDecision.userId, values.userId), eq(TeamNudgeDecision.localDate, values.localDate))).limit(1);
  if (!existing) throw new Error("Could not record the decision");
  return existing;
}

async function plan(d: Decision, tasks: (typeof TeamTask.$inferSelect)[], userId: string): Promise<NudgePlan> {
  const out: NudgePlan = {
    decisionId: d.id,
    decision: d.decision === "send" ? "send" : "hold",
    kind: d.kind === "triage" || d.kind === "task" ? d.kind : null,
    rule: d.rule,
    detail: d.detail,
    alreadySent: !!d.nudgeId,
    budget: { used: d.budgetUsed, limit: d.budgetLimit },
  };
  if (out.decision !== "send" || out.alreadySent) return out;
  const profile = await getProfile(userId);
  if (profile) out.profile = profileBrief({ ...profile, notes: [] });
  if (out.kind === "task") {
    const t = tasks.find((x) => x.id === d.taskId);
    // The task was finished, dated differently or handed off since the decision: nothing to say
    if (!t || !d.dueOn) return { ...out, decision: "hold", rule: "task_gone", detail: "The chosen task is no longer open for this person." };
    const daysToDue = Math.round((new Date(`${d.dueOn}T12:00:00Z`).getTime() - new Date(`${d.localDate}T12:00:00Z`).getTime()) / 864e5);
    out.task = { id: t.id, title: t.title, details: t.details, dueOn: d.dueOn, angle: d.angle ?? "coming", daysToDue };
  } else {
    out.undated = tasks.filter((t) => !t.dueAt && t.status !== "blocked").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map((t) => ({ id: t.id, title: t.title }));
    if (!out.undated.length) return { ...out, decision: "hold", rule: "task_gone", detail: "Every open task has a date now." };
  }
  return out;
}

export class NudgeDecisionError extends Error {}

/** The message for a decision went out: record it (team_nudge, the task's history, the activity record) */
export async function markSent(decisionId: string, userId: string, text: string, channel: Channel): Promise<{ nudgeId: string }> {
  const body = text.trim();
  if (!body) throw new NudgeDecisionError("Empty message");
  const [d] = await db.select().from(TeamNudgeDecision).where(and(eq(TeamNudgeDecision.id, decisionId), eq(TeamNudgeDecision.userId, userId))).limit(1);
  if (!d) throw new NudgeDecisionError("No such decision for this person");
  if (d.decision !== "send") throw new NudgeDecisionError("That decision was to stay quiet");
  if (d.nudgeId) return { nudgeId: d.nudgeId };
  const [nudge] = await db.insert(TeamNudge).values({ businessId: d.businessId, recipientId: userId, channel, kind: "reminder", localDate: d.localDate, body }).returning({ id: TeamNudge.id });
  if (!nudge) throw new NudgeDecisionError("Could not record the message");
  await db.update(TeamNudgeDecision).set({ nudgeId: nudge.id }).where(eq(TeamNudgeDecision.id, d.id));
  if (d.taskId) {
    await db.insert(TeamNudgeTask).values({ nudgeId: nudge.id, taskId: d.taskId, businessId: d.businessId }).onConflictDoNothing();
    await db.insert(TeamTaskEvent).values({ businessId: d.businessId, taskId: d.taskId, type: "nudged", actor: "agent", channel, toValue: userId, note: body });
    const [t] = await db.select({ title: TeamTask.title }).from(TeamTask).where(eq(TeamTask.id, d.taskId)).limit(1);
    await recordActivity({ userId, kind: "reminder_sent", subjectType: "task", subjectId: d.taskId, summary: `Nudged about the task "${t?.title ?? "?"}" (${d.angle})` });
  }
  return { nudgeId: nudge.id };
}

/** They answered the latest message (within OUTCOME_DAYS): mark it, once */
export async function markReplied(userId: string, now = new Date()): Promise<boolean> {
  const [latest] = await db
    .select({ id: TeamNudge.id, respondedAt: TeamNudge.respondedAt })
    .from(TeamNudge)
    .innerJoin(TeamNudgeDecision, eq(TeamNudgeDecision.nudgeId, TeamNudge.id))
    .where(and(eq(TeamNudge.recipientId, userId), gte(TeamNudge.sentAt, new Date(now.getTime() - OUTCOME_DAYS * 864e5))))
    .orderBy(desc(TeamNudge.sentAt))
    .limit(1);
  if (!latest || latest.respondedAt) return false;
  await db.update(TeamNudge).set({ outcome: "replied", respondedAt: now }).where(eq(TeamNudge.id, latest.id));
  return true;
}

export interface NudgeLogRow {
  date: string;
  decision: string;
  kind: string | null;
  rule: string;
  detail: string;
  budget: string;
  task: string | null;
  considered: Considered;
  message: string | null;
  sentAt: string | null;
  /** Derived, for sent rows: what happened in the OUTCOME_DAYS after */
  outcome: { replied: boolean; repliedAfterHours: number | null; taskChanges: string[]; datesSet: number; doneByDue: boolean | null; verdict: string } | null;
}

/** The log for the monthly review, newest first, with what happened after each message */
export async function nudgeLog(userId: string, days = 35, now = new Date()): Promise<NudgeLogRow[]> {
  const rows = await db
    .select({ d: TeamNudgeDecision, n: TeamNudge, taskTitle: TeamTask.title, taskStatus: TeamTask.status, taskCompletedAt: TeamTask.completedAt, taskDueAt: TeamTask.dueAt })
    .from(TeamNudgeDecision)
    .leftJoin(TeamNudge, eq(TeamNudge.id, TeamNudgeDecision.nudgeId))
    .leftJoin(TeamTask, eq(TeamTask.id, TeamNudgeDecision.taskId))
    .where(and(eq(TeamNudgeDecision.userId, userId), gte(TeamNudgeDecision.createdAt, new Date(now.getTime() - days * 864e5))))
    .orderBy(desc(TeamNudgeDecision.createdAt));
  const out: NudgeLogRow[] = [];
  for (const { d, n, taskTitle, taskStatus, taskCompletedAt, taskDueAt } of rows) {
    let outcome: NudgeLogRow["outcome"] = null;
    if (n) {
      const until = new Date(n.sentAt.getTime() + OUTCOME_DAYS * 864e5);
      // A task message looks at its task; a triage message at every task they own
      const scope = d.taskId ? eq(TeamTaskEvent.taskId, d.taskId) : inArray(TeamTaskEvent.taskId, db.select({ id: TeamTask.id }).from(TeamTask).where(eq(TeamTask.ownerId, userId)));
      const events = await db
        .select({ type: TeamTaskEvent.type, createdAt: TeamTaskEvent.createdAt, fromValue: TeamTaskEvent.fromValue })
        .from(TeamTaskEvent)
        .where(and(scope, gte(TeamTaskEvent.createdAt, n.sentAt)));
      const after = events.filter((e) => e.createdAt <= until && e.type !== "nudged");
      const taskChanges = [...new Set(after.map((e) => e.type))];
      const datesSet = after.filter((e) => e.type === "deadline_changed").length;
      const doneByDue = d.taskId ? (taskStatus === "done" && taskCompletedAt && taskDueAt ? taskCompletedAt.getTime() <= taskDueAt.getTime() + 864e5 : taskDueAt && taskDueAt.getTime() + 864e5 < now.getTime() ? false : null) : null;
      const replied = !!n.respondedAt;
      const open = until > now;
      const verdict = taskChanges.length ? "acted" : replied ? "answered, nothing changed" : open ? "waiting" : "ignored";
      outcome = { replied, repliedAfterHours: n.respondedAt ? Math.round(((n.respondedAt.getTime() - n.sentAt.getTime()) / 36e5) * 10) / 10 : null, taskChanges, datesSet, doneByDue, verdict };
    }
    out.push({
      date: d.localDate,
      decision: d.decision === "send" && !n ? "chosen, not delivered" : d.decision,
      kind: d.kind,
      rule: d.rule,
      detail: d.detail,
      budget: `${d.budgetUsed}/${d.budgetLimit}`,
      task: taskTitle ?? null,
      considered: d.considered,
      message: n?.body ?? null,
      sentAt: n?.sentAt.toISOString() ?? null,
      outcome,
    });
  }
  return out;
}

export async function userName(userId: string): Promise<string> {
  const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1);
  return u?.name ?? "?";
}
