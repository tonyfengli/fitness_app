/**
 * The Monday review (Team tab): GET /api/agent/tasks/review
 * Everyone who can own tasks, each with their open items (carry-over count, last reply, days
 * open, nudges) and what they closed since the last meeting. Founders only (or the read-only key).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, or } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamProfile, TeamTask, TeamTaskEvent, user } from "@acme/db/schema";
import { validateFounderAccess } from "~/lib/api-auth";
import { getGymBusinessId } from "~/lib/business";
import { nudgeTimeFor } from "~/lib/team/dayof";
import { nextMeeting } from "~/lib/team/meeting";
import { REVIEW_NOTE } from "~/lib/team/tasks";

export const dynamic = "force-dynamic";

const OPEN = ["open", "in_progress", "blocked"] as const;
const WEEK = 7 * 864e5;

export interface ReviewTask {
  id: string;
  title: string;
  details: string | null;
  status: string;
  ownerId: string | null; // null = unassigned backlog
  dueAt: string | null;
  hardDeadline: boolean;
  nudgeAt: string | null; // when the one message goes out (explicit or by rule); null = never
  nudgeSetBy: "rule" | "person" | "agent" | "workflow" | "cron" | null;
  blockedOnId: string | null;
  blockedReason: string | null;
  source: string;
  context: Record<string, unknown> | null;
  createdAt: string;
  completedAt: string | null;
  daysOpen: number;
  carryOvers: number; // meeting reviews + deadline moves
  nudges: number;
  lastReply: { at: string; text: string } | null;
}

export interface ReviewPerson {
  userId: string;
  name: string;
  open: ReviewTask[];
  closedThisWeek: ReviewTask[];
  carryOvers: number;
}

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  try {
    const businessId = await getGymBusinessId();
    const now = new Date();
    const since = new Date(nextMeeting(now).getTime() - WEEK); // the previous meeting
    const [people, tasks] = await Promise.all([
      db
        .select({ userId: user.id, name: user.name, active: TeamProfile.active })
        .from(TeamProfile)
        .innerJoin(user, eq(user.id, TeamProfile.userId))
        .where(eq(TeamProfile.businessId, businessId)),
      db
        .select()
        .from(TeamTask)
        .where(and(eq(TeamTask.businessId, businessId), or(inArray(TeamTask.status, [...OPEN]), gte(TeamTask.updatedAt, since))))
        .orderBy(TeamTask.dueAt),
    ]);
    const events = tasks.length
      ? await db
          .select({ taskId: TeamTaskEvent.taskId, type: TeamTaskEvent.type, note: TeamTaskEvent.note, createdAt: TeamTaskEvent.createdAt })
          .from(TeamTaskEvent)
          .where(inArray(TeamTaskEvent.taskId, tasks.map((t) => t.id)))
          .orderBy(desc(TeamTaskEvent.createdAt))
      : [];
    // Owners of open tasks who have no profile still get a block
    const ownerIds = new Set(tasks.map((t) => t.ownerId).filter((id): id is string => !!id));
    const known = new Set(people.map((p) => p.userId));
    const extra = [...ownerIds].filter((id) => !known.has(id));
    const extraPeople = extra.length ? await db.select({ userId: user.id, name: user.name }).from(user).where(inArray(user.id, extra)) : [];
    const everyone = [...people.filter((p) => p.active).map(({ userId, name }) => ({ userId, name })), ...extraPeople];

    const shape = (t: (typeof tasks)[number]): ReviewTask => {
      const mine = events.filter((e) => e.taskId === t.id);
      const reply = mine.find((e) => e.type === "replied");
      const end = t.completedAt ?? (OPEN.includes(t.status as (typeof OPEN)[number]) ? now : t.updatedAt);
      return {
        id: t.id,
        title: t.title,
        details: t.details,
        status: t.status,
        ownerId: t.ownerId,
        dueAt: t.dueAt?.toISOString() ?? null,
        hardDeadline: t.hardDeadline,
        nudgeAt: nudgeTimeFor(t, "America/Los_Angeles")?.at.toISOString() ?? null,
        nudgeSetBy: nudgeTimeFor(t, "America/Los_Angeles")?.setBy ?? null,
        blockedOnId: t.blockedOnId,
        blockedReason: t.blockedReason,
        source: t.source,
        context: t.context,
        createdAt: t.createdAt.toISOString(),
        completedAt: t.completedAt?.toISOString() ?? null,
        daysOpen: Math.round((end.getTime() - t.createdAt.getTime()) / 864e5),
        // Carried = "Not yet" at a Monday review, nothing else (Tony, Nov 12): date changes never count
        carryOvers: mine.filter((e) => e.type === "note" && e.note === REVIEW_NOTE).length,
        nudges: mine.filter((e) => e.type === "nudged").length,
        lastReply: reply ? { at: reply.createdAt.toISOString(), text: reply.note ?? "" } : null,
      };
    };

    const byPerson: ReviewPerson[] = everyone
      .map((p) => {
        const open = tasks.filter((t) => t.ownerId === p.userId && OPEN.includes(t.status as (typeof OPEN)[number])).map(shape);
        const closed = tasks.filter((t) => t.ownerId === p.userId && !OPEN.includes(t.status as (typeof OPEN)[number])).map(shape);
        return { userId: p.userId, name: p.name, open, closedThisWeek: closed, carryOvers: open.reduce((n, t) => n + t.carryOvers, 0) };
      })
      .sort((a, b) => b.open.length - a.open.length || a.name.localeCompare(b.name));

    const unassigned = tasks.filter((t) => !t.ownerId && OPEN.includes(t.status as (typeof OPEN)[number])).map(shape);
    const closedUnassigned = tasks.filter((t) => !t.ownerId && !OPEN.includes(t.status as (typeof OPEN)[number])).map(shape);

    return NextResponse.json({
      status: "ok",
      unassigned,
      closedUnassigned,
      people: byPerson,
      owners: everyone, // for the owner pickers
      _meta: { generatedAt: now.toISOString(), nextMeeting: nextMeeting(now).toISOString(), since: since.toISOString() },
    });
  } catch (err) {
    console.error("[API /agent/tasks/review] Error:", err);
    return NextResponse.json({ error: "Failed to load the review", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
