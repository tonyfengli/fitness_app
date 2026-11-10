/**
 * The day-of message (BUSINESS-ACCOUNTABILITY.md → MVP, "one touch, day of").
 * GET  /api/agent/tasks/day-of   whose message time has arrived, per person, with the
 *                                facts the Chief of Staff needs to write it. Founders or the
 *                                read-only OpenClaw key.
 * POST /api/agent/tasks/day-of   { slackUserId, taskIds, text, traceId? }: send it. The COS
 *                                (X-TEAM-AGENT-KEY) or a founder. Refused unless the tasks
 *                                are due for that person today and they haven't had today's
 *                                message; the cap is enforced in the database.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { resolveWriter } from "~/lib/team/auth";
import { dayOfItems, NudgeRefused, sendDayOf } from "~/lib/team/dayof";
import { nextMeeting } from "~/lib/team/meeting";
import { traceTask } from "~/lib/team/trace";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  try {
    const { due, skipped } = await dayOfItems();
    // Group by person, with each task's recent history so the message can be specific
    const byPerson = new Map<string, { slackUserId: string; name: string; localHour: number; alreadyNudgedToday: boolean; tasks: unknown[] }>();
    for (const d of due) {
      const key = d.recipient.userId;
      let person = byPerson.get(key);
      if (!person) {
        person = { slackUserId: d.recipient.slackUserId ?? "", name: d.recipient.name, localHour: d.localHour, alreadyNudgedToday: d.alreadyNudgedToday, tasks: [] };
        byPerson.set(key, person);
      }
      const tr = await traceTask(d.task.id);
      person.tasks.push({
        id: d.task.id,
        title: d.task.title,
        details: d.task.details,
        dueAt: d.task.dueAt?.toISOString() ?? null,
        nudgeTime: d.nudgeTime.toISOString(),
        nudgeSetBy: d.nudgeSetBy,
        status: d.task.status,
        blockedReason: d.task.blockedReason,
        context: d.task.context,
        celebration: tr?.celebration ?? null,
        history: tr?.timeline.map((l) => ({ at: l.at, what: l.summary, said: l.detail ?? undefined })) ?? [],
        stats: tr?.stats ?? null,
      });
    }
    return NextResponse.json({ status: "ok", people: [...byPerson.values()], skipped, _meta: { generatedAt: new Date().toISOString(), nextMeeting: nextMeeting().toISOString() } });
  } catch (err) {
    console.error("[API /agent/tasks/day-of] Error:", err);
    return NextResponse.json({ error: "Failed to load day-of items", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { slackUserId?: string; taskIds?: string[]; text?: string; traceId?: string };
  const writer = await resolveWriter(request, body.slackUserId); // the agent acts for the recipient's benefit; any founder may send
  if (writer instanceof NextResponse) return writer;
  if (!body.slackUserId || !Array.isArray(body.taskIds) || !body.text) return NextResponse.json({ error: "slackUserId, taskIds and text are required" }, { status: 400 });
  try {
    const sent = await sendDayOf({ slackUserId: body.slackUserId, taskIds: body.taskIds, text: body.text, traceId: body.traceId });
    return NextResponse.json({ status: "sent", ...sent });
  } catch (err) {
    if (err instanceof NudgeRefused) return NextResponse.json({ status: "refused", reason: err.message }, { status: 409 });
    console.error("[API /agent/tasks/day-of] Error:", err);
    return NextResponse.json({ error: "Failed to send", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
