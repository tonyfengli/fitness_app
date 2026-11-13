/**
 * Nudges about a founder's own tasks: fixed rules decide, an agent writes the words, every run
 * is logged (lib/team/nudge.ts).
 * GET  /api/agent/nudges?slackUserId=U…&days=35   the decision log with what happened after each
 *                                                 message. Founders or the read-only key.
 * POST /api/agent/nudges  { actorSlackUserId, action, … }   the person's own agent (write key) or a founder
 *   decide                     run today's rules for that person; returns send (with the task or
 *                              the undated list, and how they like to be asked) or hold. One
 *                              decision per day: calling again returns the same one.
 *                              { dry: true } shows the choice and records nothing.
 *   sent   { decisionId, text, channel? }   the message went out: record it
 *   reply                      they answered the latest message
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { resolveWriter, userBySlackId } from "~/lib/team/auth";
import { decide, markReplied, markSent, NudgeDecisionError, nudgeLog } from "~/lib/team/nudge";
import type { Channel } from "~/lib/team/tasks";

export const dynamic = "force-dynamic";

const CHANNELS: Channel[] = ["slack", "imessage", "sms"];

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  const q = request.nextUrl.searchParams;
  try {
    const slackUserId = q.get("slackUserId");
    const u = slackUserId ? await userBySlackId(slackUserId) : null;
    if (!u) return NextResponse.json({ error: "A known slackUserId is required" }, { status: 400 });
    const days = Math.min(120, Math.max(1, Number(q.get("days")) || 35));
    const log = await nudgeLog(u.id, days);
    const sent = log.filter((r) => r.outcome);
    const count = (v: string) => sent.filter((r) => r.outcome?.verdict === v).length;
    return NextResponse.json({
      status: "ok",
      person: u.name,
      days,
      summary: { runs: log.length, sent: sent.length, held: log.length - sent.length, acted: count("acted"), answeredOnly: count("answered, nothing changed"), ignored: count("ignored"), waiting: count("waiting") },
      log,
    });
  } catch (err) {
    console.error("[API /agent/nudges] Error:", err);
    return NextResponse.json({ error: "Failed to load the nudge log", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { actorSlackUserId?: string; action?: string; decisionId?: string; text?: string; channel?: string; dry?: boolean };
  const writer = await resolveWriter(request, body.actorSlackUserId);
  if (writer instanceof NextResponse) return writer;
  try {
    switch (body.action) {
      case "decide":
        return NextResponse.json({ status: "ok", plan: await decide(writer.userId, new Date(), body.dry === true) });
      case "sent": {
        if (!body.decisionId || !body.text?.trim()) return NextResponse.json({ error: "decisionId and text are required" }, { status: 400 });
        const channel = CHANNELS.find((c) => c === body.channel) ?? "imessage";
        return NextResponse.json({ status: "ok", ...(await markSent(body.decisionId, writer.userId, body.text, channel)) });
      }
      case "reply":
        return NextResponse.json({ status: "ok", marked: await markReplied(writer.userId) });
      default:
        return NextResponse.json({ error: `Unknown action ${body.action ?? "(none)"}` }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof NudgeDecisionError) return NextResponse.json({ status: "refused", reason: err.message }, { status: 403 });
    console.error("[API /agent/nudges] Error:", err);
    return NextResponse.json({ error: "Nudge failed", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
