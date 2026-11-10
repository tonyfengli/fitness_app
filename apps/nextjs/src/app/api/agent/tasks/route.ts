/**
 * Team tasks for the dashboard and the gym Chief of Staff.
 * GET /api/agent/tasks                 open tasks (owner, due, status, source), soonest first
 * GET /api/agent/tasks?status=all      every status, newest first
 * GET /api/agent/tasks?owner=<userId>  one person's
 * GET /api/agent/tasks?urgent=1        hard-deadline tasks due before the next Monday 7pm Pacific
 *                                      (the "one touch, day of" set; see BUSINESS-ACCOUNTABILITY.md)
 * Founders, or the OpenClaw key (read-only).
 * POST /api/agent/tasks                create tasks at the meeting (founder) or for a Slack user
 *                                      (COS with the write key). Body: { tasks: [{ title, details?,
 *                                      ownerUserId | ownerSlackUserId, dueAt?, hardDeadline? }] }.
 *                                      All or nothing; the creator is whoever is signed in.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamTask, user } from "@acme/db/schema";
import { validateFounderAccess } from "~/lib/api-auth";
import { getGymBusinessId } from "~/lib/business";
import { resolveWriter, userBySlackId } from "~/lib/team/auth";
import { isUrgent, nextMeeting } from "~/lib/team/meeting";
import { createTasks, TeamRuleError } from "~/lib/team/tasks";

export const dynamic = "force-dynamic";

const OPEN = ["open", "in_progress", "blocked"] as const;

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  const q = request.nextUrl.searchParams;
  try {
    const businessId = await getGymBusinessId();
    const all = q.get("status") === "all";
    const owner = q.get("owner");
    const urgent = q.get("urgent") === "1";
    const conds = [eq(TeamTask.businessId, businessId)];
    if (!all) conds.push(inArray(TeamTask.status, [...OPEN]));
    if (owner) conds.push(eq(TeamTask.ownerId, owner));
    const rows = await db
      .select({ task: TeamTask, ownerName: user.name })
      .from(TeamTask)
      .innerJoin(user, eq(user.id, TeamTask.ownerId))
      .where(and(...conds))
      .orderBy(all ? desc(TeamTask.createdAt) : asc(TeamTask.dueAt));
    const cutoff = nextMeeting();
    const tasks = rows
      .filter((r) => !urgent || isUrgent(r.task))
      .map(({ task: t, ownerName }) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        ownerId: t.ownerId,
        owner: ownerName,
        dueAt: t.dueAt?.toISOString() ?? null,
        hardDeadline: t.hardDeadline,
        blockedOnId: t.blockedOnId,
        blockedReason: t.blockedReason,
        source: t.source,
        sourceRef: t.sourceRef,
        workflowKey: t.workflowKey,
        context: t.context,
        createdAt: t.createdAt.toISOString(),
        completedAt: t.completedAt?.toISOString() ?? null,
      }));
    return NextResponse.json({ status: "ok", tasks, _meta: { generatedAt: new Date().toISOString(), nextMeeting: cutoff.toISOString(), urgent } });
  } catch (err) {
    console.error("[API /agent/tasks] Error:", err);
    return NextResponse.json({ error: "Failed to load tasks", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

interface NewTaskBody {
  title?: string;
  details?: string;
  ownerUserId?: string;
  ownerSlackUserId?: string;
  dueAt?: string | null;
  hardDeadline?: boolean;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { tasks?: NewTaskBody[]; actorSlackUserId?: string; source?: string };
  const writer = await resolveWriter(request, body.actorSlackUserId);
  if (writer instanceof NextResponse) return writer;
  if (!Array.isArray(body.tasks) || !body.tasks.length) return NextResponse.json({ error: "tasks[] is required" }, { status: 400 });
  try {
    const stamp = Date.now().toString(36);
    const input = [];
    for (const [i, t] of body.tasks.entries()) {
      const title = t.title?.trim();
      if (!title) return NextResponse.json({ error: `tasks[${i}]: title is required` }, { status: 400 });
      const ownerId = t.ownerUserId ?? (t.ownerSlackUserId ? (await userBySlackId(t.ownerSlackUserId))?.id : undefined);
      if (!ownerId) return NextResponse.json({ error: `tasks[${i}]: ownerUserId or a known ownerSlackUserId is required` }, { status: 400 });
      const dueAt = t.dueAt ? new Date(t.dueAt) : null;
      if (dueAt && isNaN(dueAt.getTime())) return NextResponse.json({ error: `tasks[${i}]: bad dueAt` }, { status: 400 });
      input.push({
        title,
        details: t.details?.trim() ? t.details.trim() : undefined,
        ownerId,
        creatorId: writer.userId,
        dueAt,
        hardDeadline: !!t.hardDeadline,
        source: body.source ?? "meeting",
        sourceRef: `${stamp}:${i}:${Math.random().toString(36).slice(2, 8)}`,
      });
    }
    const created = await createTasks(input, { kind: "person", userId: writer.userId }, writer.via === "agent" ? "slack" : "dashboard");
    return NextResponse.json({ status: "ok", created: created.map((c) => ({ id: c.id, title: c.title, ownerId: c.ownerId, dueAt: c.dueAt?.toISOString() ?? null })) });
  } catch (err) {
    if (err instanceof TeamRuleError) return NextResponse.json({ status: "refused", reason: err.message }, { status: 403 });
    console.error("[API /agent/tasks] Error:", err);
    return NextResponse.json({ error: "Failed to create tasks", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
