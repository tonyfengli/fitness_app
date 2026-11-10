/**
 * Change one task. POST /api/agent/tasks/<id>
 * Body: { action, actorSlackUserId?, text?, dueAt?, blockedOnSlackUserId?, newOwnerSlackUserId?, traceId? }
 *   reply     record what the person said (text); the nudge's outcome becomes "replied"
 *   complete  done                      start     in progress
 *   block     waiting on someone (blockedOnSlackUserId) or something (text)
 *   unblock   back to open               decline   the owner rejects it (text = why)
 *   move      new due date (dueAt ISO); hard deadlines refuse; owners may shift ≤ 2 days
 *   handoff   new owner (newOwnerSlackUserId); creator or workflow owner only
 *   unassign  back to the backlog; owner, creator or workflow owner
 *   cancel    no longer needed; creator or workflow owner only
 *   note      a note on the task (text)
 * Who: a signed-in founder (acts as themselves) or the COS with X-TEAM-AGENT-KEY acting as
 * actorSlackUserId. The library's rules decide what that person may do; a refusal is a 403.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveWriter, userBySlackId } from "~/lib/team/auth";
import { addNote, block, cancel, changeDeadline, complete, decline, edit, getTask, reassign, recordReply, reopen, review, start, TeamRuleError, unassign, unblock } from "~/lib/team/tasks";
import type { Actor, Channel } from "~/lib/team/tasks";
import { traceTask } from "~/lib/team/trace";

export const dynamic = "force-dynamic";

interface Body {
  action?: string;
  actorSlackUserId?: string;
  text?: string;
  dueAt?: string;
  blockedOnSlackUserId?: string;
  newOwnerSlackUserId?: string;
  newOwnerUserId?: string; // the dashboard knows user ids, not Slack ids
  title?: string;
  details?: string | null;
  traceId?: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Body;
  const writer = await resolveWriter(request, body.actorSlackUserId);
  if (writer instanceof NextResponse) return writer;
  const task = await getTask(id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const actor: Actor = { kind: "person", userId: writer.userId };
  const channel: Channel = writer.via === "agent" ? "slack" : "dashboard";
  const text = body.text?.trim();
  try {
    switch (body.action) {
      case "reply":
        if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
        await recordReply(task, { userId: writer.userId }, channel, text, body.traceId);
        break;
      case "complete":
        await complete(task, actor, channel, text);
        break;
      case "start":
        await start(task, actor, channel);
        break;
      case "block": {
        const on = body.blockedOnSlackUserId ? await userBySlackId(body.blockedOnSlackUserId) : null;
        if (body.blockedOnSlackUserId && !on) return NextResponse.json({ error: "Unknown blockedOnSlackUserId" }, { status: 400 });
        await block(task, actor, channel, on?.id ?? null, text ?? "blocked");
        break;
      }
      case "unblock":
        await unblock(task, actor, channel, text);
        break;
      case "decline":
        if (!text) return NextResponse.json({ error: "text (the reason) is required" }, { status: 400 });
        await decline(task, actor, channel, text);
        break;
      case "move": {
        const due = body.dueAt ? new Date(body.dueAt) : null;
        if (!due || isNaN(due.getTime())) return NextResponse.json({ error: "dueAt (ISO) is required" }, { status: 400 });
        await changeDeadline(task, actor, channel, due, text);
        break;
      }
      case "handoff": {
        const to = body.newOwnerSlackUserId ? await userBySlackId(body.newOwnerSlackUserId) : body.newOwnerUserId ? { id: body.newOwnerUserId } : null;
        if (!to) return NextResponse.json({ error: "newOwnerSlackUserId or newOwnerUserId is required" }, { status: 400 });
        await reassign(task, actor, channel, to.id, text);
        break;
      }
      case "review":
        await review(task, actor, channel);
        break;
      case "reopen":
        await reopen(task, actor, channel);
        break;
      case "unassign":
        await unassign(task, actor, channel, text);
        break;
      case "edit":
        await edit(task, actor, channel, { title: body.title, details: body.details });
        break;
      case "cancel":
        await cancel(task, actor, channel, text);
        break;
      case "note":
        if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
        await addNote(task, actor, channel, text, body.traceId);
        break;
      default:
        return NextResponse.json({ error: `Unknown action ${body.action ?? "(none)"}` }, { status: 400 });
    }
    const trace = await traceTask(task.id);
    return NextResponse.json({ status: "ok", action: body.action, by: writer.name, task: trace?.task ?? null });
  } catch (err) {
    if (err instanceof TeamRuleError) return NextResponse.json({ status: "refused", reason: err.message }, { status: 403 });
    console.error("[API /agent/tasks/<id>] Error:", err);
    return NextResponse.json({ error: "Failed to update task", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
