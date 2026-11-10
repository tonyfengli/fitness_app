/**
 * The whole story of one task in order: created, every nudge (with the words sent and the
 * Slack message id), every reply (their words), every decision (who, from → to, and the
 * Langfuse trace when a model made it), and the celebration card behind it if there is one.
 * This is what "look at task X" means; the route and scripts/tmp/trace-task.ts call it.
 */

import { and, asc, eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { Celebration, TeamNudge, TeamNudgeTask, TeamTask, TeamTaskEvent, TeamWorkflow, user } from "@acme/db/schema";

import { getGymBusinessId } from "../business";

export interface TimelineLine {
  at: string;
  kind: "event" | "nudge";
  type: string; // event type, or the nudge kind
  by: string; // "Tony Li", "workflow", "cron", "agent"
  channel: string;
  summary: string;
  detail?: string | null; // the message text, the reply, a note
  from?: string | null;
  to?: string | null;
  traceId?: string | null;
  externalId?: string | null; // Slack ts
  bundledWith?: number; // other tasks in the same nudge
}

export interface TaskTrace {
  task: {
    id: string;
    title: string;
    status: string;
    owner: string;
    creator: string | null;
    workflow: string | null;
    workflowOwner: string | null;
    dueAt: string | null;
    hardDeadline: boolean;
    blockedOn: string | null;
    blockedReason: string | null;
    source: string;
    sourceRef: string;
    createdAt: string;
    completedAt: string | null;
  };
  celebration: { id: string; memberId: string; type: string; occasionDate: string; status: string; imageUrl: string | null; postedAt: string | null; skippedAt: string | null } | null;
  timeline: TimelineLine[];
  stats: { nudges: number; replies: number; daysOpen: number; firstNudgeToReplyHours: number | null };
  langfuseTraceIds: string[];
}

const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;

/** Resolve "<uuid>" or "<source>:<sourceRef>" to a task id */
export async function resolveTaskId(ref: string): Promise<string | null> {
  if (/^[0-9a-f-]{36}$/i.test(ref)) return ref;
  const idx = ref.indexOf(":");
  if (idx < 0) return null;
  const businessId = await getGymBusinessId();
  const [t] = await db
    .select({ id: TeamTask.id })
    .from(TeamTask)
    .where(and(eq(TeamTask.businessId, businessId), eq(TeamTask.source, ref.slice(0, idx)), eq(TeamTask.sourceRef, ref.slice(idx + 1))))
    .limit(1);
  return t?.id ?? null;
}

export async function traceTask(taskId: string): Promise<TaskTrace | null> {
  const [t] = await db.select().from(TeamTask).where(eq(TeamTask.id, taskId)).limit(1);
  if (!t) return null;

  const [events, nudgeLinks, workflow] = await Promise.all([
    db.select().from(TeamTaskEvent).where(eq(TeamTaskEvent.taskId, t.id)).orderBy(asc(TeamTaskEvent.createdAt)),
    db
      .select({ nudge: TeamNudge })
      .from(TeamNudgeTask)
      .innerJoin(TeamNudge, eq(TeamNudge.id, TeamNudgeTask.nudgeId))
      .where(eq(TeamNudgeTask.taskId, t.id)),
    t.workflowKey ? db.select().from(TeamWorkflow).where(eq(TeamWorkflow.key, t.workflowKey)).limit(1).then((r) => r[0] ?? null) : Promise.resolve(null),
  ]);
  const nudges = nudgeLinks.map((n) => n.nudge);

  // Names for every person involved
  const ids = new Set<string>([t.ownerId]);
  for (const id of [t.creatorId, t.blockedOnId, workflow?.ownerId]) if (id) ids.add(id);
  for (const e of events) if (e.actorId) ids.add(e.actorId);
  for (const n of nudges) ids.add(n.recipientId);
  const people = ids.size ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, [...ids])) : [];
  const name = (id: string | null | undefined) => (id ? (people.find((p) => p.id === id)?.name ?? id) : null);

  // How many tasks each nudge bundled
  const bundle = nudges.length
    ? await db.select({ nudgeId: TeamNudgeTask.nudgeId }).from(TeamNudgeTask).where(inArray(TeamNudgeTask.nudgeId, nudges.map((n) => n.id)))
    : [];
  const bundleSize = (nudgeId: string) => bundle.filter((b) => b.nudgeId === nudgeId).length;

  const celebrationId = typeof t.context?.celebrationId === "string" ? t.context.celebrationId : null;
  const [c] = celebrationId ? await db.select().from(Celebration).where(eq(Celebration.id, celebrationId)).limit(1) : [];

  const lines: TimelineLine[] = [];
  for (const e of events) {
    const by = e.actor === "person" ? (name(e.actorId) ?? "someone") : e.actor;
    const summary = (() => {
      switch (e.type) {
        case "created":
          return `created for ${name(e.toValue) ?? "?"}`;
        case "nudged":
          return `nudged ${name(e.toValue) ?? "?"}`;
        case "replied":
          return `${by} replied`;
        case "status_changed":
          return `${e.fromValue} → ${e.toValue}`;
        case "deadline_changed":
          return `due ${e.fromValue?.slice(0, 10) ?? "none"} → ${e.toValue?.slice(0, 10) ?? "none"}`;
        case "reassigned":
          return `${name(e.fromValue) ?? "?"} → ${name(e.toValue) ?? "?"}`;
        case "blocked":
          return `blocked${e.toValue ? ` on ${name(e.toValue)}` : ""}`;
        case "escalated":
          return `escalated to ${name(e.toValue) ?? "?"}`;
        default:
          return e.type;
      }
    })();
    lines.push({ at: e.createdAt.toISOString(), kind: "event", type: e.type, by, channel: e.channel, summary, detail: e.note, from: e.fromValue, to: e.toValue, traceId: e.traceId });
  }
  for (const n of nudges) {
    lines.push({
      at: n.sentAt.toISOString(),
      kind: "nudge",
      type: n.kind,
      by: "cron",
      channel: n.channel,
      summary: `${n.kind} sent to ${name(n.recipientId)}${n.outcome ? ` · outcome: ${n.outcome}` : ""}${n.respondedAt ? ` (${Math.round((n.respondedAt.getTime() - n.sentAt.getTime()) / 36e5)}h later)` : ""}`,
      detail: n.body,
      externalId: n.externalId,
      bundledWith: bundleSize(n.id) - 1,
    });
  }
  lines.sort((a, b) => a.at.localeCompare(b.at));

  const firstNudge = nudges.map((n) => n.sentAt.getTime()).sort()[0];
  const firstReply = events.find((e) => e.type === "replied")?.createdAt.getTime();
  const end = t.completedAt ?? (t.status === "cancelled" || t.status === "declined" ? t.updatedAt : new Date());
  return {
    task: {
      id: t.id,
      title: t.title,
      status: t.status,
      owner: name(t.ownerId) ?? t.ownerId,
      creator: name(t.creatorId),
      workflow: t.workflowKey,
      workflowOwner: name(workflow?.ownerId),
      dueAt: iso(t.dueAt),
      hardDeadline: t.hardDeadline,
      blockedOn: name(t.blockedOnId),
      blockedReason: t.blockedReason,
      source: t.source,
      sourceRef: t.sourceRef,
      createdAt: t.createdAt.toISOString(),
      completedAt: iso(t.completedAt),
    },
    celebration: c ? { id: c.id, memberId: c.memberId, type: c.type, occasionDate: c.occasionDate, status: c.status, imageUrl: c.imageUrl, postedAt: iso(c.postedAt), skippedAt: iso(c.skippedAt) } : null,
    timeline: lines,
    stats: {
      nudges: nudges.length,
      replies: events.filter((e) => e.type === "replied").length,
      daysOpen: Math.round(((end.getTime() - t.createdAt.getTime()) / 864e5) * 10) / 10,
      firstNudgeToReplyHours: firstNudge && firstReply ? Math.round(((firstReply - firstNudge) / 36e5) * 10) / 10 : null,
    },
    langfuseTraceIds: [...new Set(events.map((e) => e.traceId).filter((x): x is string => !!x))],
  };
}

/** A readable version for Slack, the terminal, or me */
export function formatTrace(tr: TaskTrace): string {
  const t = tr.task;
  const lines = [
    `Task ${t.id.slice(0, 8)}… "${t.title}"`,
    `  owner ${t.owner}${t.workflow ? ` (workflow ${t.workflow}, owner ${t.workflowOwner})` : ""}${t.creator ? ` · created by ${t.creator}` : ""} · ${t.hardDeadline ? "hard deadline" : "due"} ${t.dueAt?.slice(0, 10) ?? "none"} · status ${t.status}`,
  ];
  if (t.blockedOn) lines.push(`  blocked on ${t.blockedOn}: ${t.blockedReason ?? ""}`);
  if (tr.celebration) lines.push(`  card: ${tr.celebration.type} ${tr.celebration.occasionDate} for #${tr.celebration.memberId}, ${tr.celebration.status}${tr.celebration.imageUrl ? "" : " (no image)"}`);
  lines.push("");
  for (const l of tr.timeline) {
    const when = new Date(l.at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const extra = [l.bundledWith ? `bundled with ${l.bundledWith} other${l.bundledWith === 1 ? "" : "s"}` : "", l.externalId ? `ts ${l.externalId}` : "", l.traceId ? `trace ${l.traceId}` : ""].filter(Boolean).join(", ");
    lines.push(`${when.padEnd(20)} ${l.summary}${extra ? ` [${extra}]` : ""}`);
    if (l.detail) lines.push(`${"".padEnd(20)} → ${l.detail.replace(/\s+/g, " ").slice(0, 220)}`);
  }
  lines.push("", `nudges ${tr.stats.nudges} · replies ${tr.stats.replies} · open ${tr.stats.daysOpen} days${tr.stats.firstNudgeToReplyHours !== null ? ` · first reply ${tr.stats.firstNudgeToReplyHours}h after first nudge` : ""}`);
  return lines.join("\n");
}
