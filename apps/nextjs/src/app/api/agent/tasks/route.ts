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
 *                                      ownerUserId? | ownerSlackUserId?, dueAt?, hardDeadline? }] }.
 *                                      No owner = the unassigned backlog (assigned at the meeting).
 *                                      All or nothing; the creator is whoever is signed in.
 *                                      Meeting drafts (Granola, via the COS): { draft: true, source: "granola",
 *                                      meetingRef, meetingTitle, tasks: [{ title, ownerName?, dueAt?, quote? }] }.
 *                                      Drafts stay unassigned; the owner named is kept as a suggestion
 *                                      (context.suggestedOwnerId) for a one-tap Accept on the Team tab.
 *                                      Same meetingRef again = no duplicates.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamProfile, TeamTask, user } from "@acme/db/schema";
import { validateFounderAccess } from "~/lib/api-auth";
import { getGymBusinessId } from "~/lib/business";
import { resolveWriter, userBySlackId } from "~/lib/team/auth";
import { isUrgent, nextMeeting } from "~/lib/team/meeting";
import { createTasks, TeamRuleError } from "~/lib/team/tasks";

export const dynamic = "force-dynamic";

const OPEN = ["open", "in_progress", "blocked"] as const;

/** A founder by first name, full name or alias ("Richie"); undefined when none or several match */
async function ownerByName(raw: string): Promise<string | undefined> {
  const q = raw.trim().toLowerCase();
  if (!q) return undefined;
  const businessId = await getGymBusinessId();
  const rows = await db
    .select({ id: user.id, name: user.name, aliases: TeamProfile.aliases })
    .from(TeamProfile)
    .innerJoin(user, eq(user.id, TeamProfile.userId))
    .where(and(eq(TeamProfile.businessId, businessId), eq(TeamProfile.active, true)));
  const hits = rows.filter((r) => r.name.toLowerCase() === q || r.name.split(" ")[0]?.toLowerCase() === q || r.aliases.some((a) => a.toLowerCase() === q));
  return hits.length === 1 ? hits[0]?.id : undefined;
}

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
      .leftJoin(user, eq(user.id, TeamTask.ownerId))
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
        owner: ownerName ?? "unassigned",
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
  ownerName?: string; // "David", "Richie": matched against founders' names and aliases; unclear = unassigned
  dueAt?: string | null;
  hardDeadline?: boolean;
  nudgeAt?: string | null;
  quote?: string; // the meeting line it came from (drafts)
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { tasks?: NewTaskBody[]; actorSlackUserId?: string; source?: string; draft?: boolean; meetingRef?: string; meetingTitle?: string };
  const writer = await resolveWriter(request, body.actorSlackUserId);
  if (writer instanceof NextResponse) return writer;
  if (!Array.isArray(body.tasks) || !body.tasks.length) return NextResponse.json({ error: "tasks[] is required" }, { status: 400 });
  try {
    const stamp = Date.now().toString(36);
    const input = [];
    for (const [i, t] of body.tasks.entries()) {
      const title = t.title?.trim();
      if (!title) return NextResponse.json({ error: `tasks[${i}]: title is required` }, { status: 400 });
      const byName = !t.ownerUserId && !t.ownerSlackUserId && t.ownerName ? await ownerByName(t.ownerName) : undefined;
      const resolvedOwner = t.ownerUserId ?? (t.ownerSlackUserId ? (await userBySlackId(t.ownerSlackUserId))?.id : byName);
      const ownerId = body.draft ? undefined : resolvedOwner; // drafts wait for Tony's Accept
      if (t.ownerSlackUserId && !ownerId) return NextResponse.json({ error: `tasks[${i}]: unknown ownerSlackUserId` }, { status: 400 });
      const dueAt = t.dueAt ? new Date(t.dueAt) : null;
      if (dueAt && isNaN(dueAt.getTime())) return NextResponse.json({ error: `tasks[${i}]: bad dueAt` }, { status: 400 });
      const nudgeAt = t.nudgeAt ? new Date(t.nudgeAt) : null;
      if (nudgeAt && isNaN(nudgeAt.getTime())) return NextResponse.json({ error: `tasks[${i}]: bad nudgeAt` }, { status: 400 });
      input.push({
        title,
        details: t.details?.trim() ? t.details.trim() : undefined,
        ownerId: ownerId ?? null,
        creatorId: writer.userId,
        dueAt,
        hardDeadline: !!t.hardDeadline,
        nudgeAt: body.draft ? null : nudgeAt,
        source: body.source ?? (writer.via === "agent" ? "slack" : "meeting"),
        sourceRef: body.meetingRef ? `${body.meetingRef}:${i}` : `${stamp}:${i}:${Math.random().toString(36).slice(2, 8)}`,
        context: body.draft
          ? { draft: true, suggestedOwnerId: resolvedOwner ?? null, suggestedOwnerName: t.ownerName ?? null, meeting: body.meetingTitle ?? null, quote: t.quote ?? null }
          : undefined,
      });
    }
    const created = await createTasks(input, { kind: "person", userId: writer.userId }, writer.via === "agent" ? "slack" : "dashboard");
    const names = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, created.map((c) => c.ownerId).filter((x): x is string => !!x).concat(["-"])));
    return NextResponse.json({
      status: "ok",
      duplicatesSkipped: input.length - created.length,
      created: created.map((c) => ({ id: c.id, title: c.title, ownerId: c.ownerId, owner: names.find((n) => n.id === c.ownerId)?.name ?? "unassigned", suggestedOwner: (c.context as { suggestedOwnerName?: string } | null)?.suggestedOwnerName ?? null, dueAt: c.dueAt?.toISOString() ?? null, hardDeadline: c.hardDeadline, nudgeAt: c.nudgeAt?.toISOString() ?? null })),
    });
  } catch (err) {
    if (err instanceof TeamRuleError) return NextResponse.json({ status: "refused", reason: err.message }, { status: 403 });
    console.error("[API /agent/tasks] Error:", err);
    return NextResponse.json({ error: "Failed to create tasks", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
