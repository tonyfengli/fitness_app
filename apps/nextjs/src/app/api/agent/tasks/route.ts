/**
 * Team tasks for the dashboard and the gym Chief of Staff.
 * GET /api/agent/tasks                 open tasks (owner, due, status, source), soonest first
 * GET /api/agent/tasks?status=all      every status, newest first
 * GET /api/agent/tasks?owner=<userId>  one person's
 * GET /api/agent/tasks?urgent=1        hard-deadline tasks due before the next Monday 7pm Pacific
 *                                      (the "one touch, day of" set; see BUSINESS-ACCOUNTABILITY.md)
 * Founders, or the OpenClaw key (read-only). Writes come later through a scoped key.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamTask, user } from "@acme/db/schema";
import { validateFounderAccess } from "~/lib/api-auth";
import { getGymBusinessId } from "~/lib/business";
import { isUrgent, nextMeeting } from "~/lib/team/meeting";

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
