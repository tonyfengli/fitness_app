/**
 * Founder profiles for the Chief of Staff and the Team tab.
 * GET  /api/agent/team/profile                     every active profile with notes
 * GET  /api/agent/team/profile?slackUserId=U…      one, as the Chief reads it (+ `text` brief)
 * GET  /api/agent/team/profile?recent=7            what the Chief added in the last N days
 * POST /api/agent/team/profile  { userId | slackUserId, action, … }
 *   set     { role?, owns?, answerStyle?, focus?, bestTimes?, pushLevel?, askStyle?, avoid?,
 *             dailyMessageLimit? (null = no limit) }       founders: any field, anyone's.
 *             An agent (write key): the working-style fields only, and only for the person it
 *             is acting for (actorSlackUserId = the profile's own Slack id), at their request.
 *   note    { kind, text, traceId? }                     the Chief (write key) or a founder
 *   retire  { noteId }                                   founders only
 * Reads: founders or the read-only key. Writes: see each action.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { resolveWriter, userBySlackId } from "~/lib/team/auth";
import { recordActivity } from "~/lib/team/activity";
import { addNote, getProfile, listProfiles, profileBrief, recentAgentNotes, retireNote, setDailyLimit, setProfileFields, STYLE_FIELDS } from "~/lib/team/profile";
import type { NoteKind, ProfilePatch } from "~/lib/team/profile";

export const dynamic = "force-dynamic";

const KINDS: NoteKind[] = ["preference", "responsibility", "focus", "pattern", "fact"];

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  const q = request.nextUrl.searchParams;
  try {
    const slackUserId = q.get("slackUserId");
    const recent = q.get("recent");
    if (recent) {
      const notes = await recentAgentNotes(Number(recent) || 7);
      return NextResponse.json({ status: "ok", notes: notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString(), retiredAt: n.retiredAt?.toISOString() ?? null })) });
    }
    if (slackUserId) {
      const u = await userBySlackId(slackUserId);
      const p = u ? await getProfile(u.id) : null;
      if (!p) return NextResponse.json({ status: "unknown", message: `No founder profile for Slack user ${slackUserId}` }, { status: 404 });
      return NextResponse.json({ status: "ok", profile: p, text: profileBrief(p) });
    }
    const profiles = await listProfiles();
    return NextResponse.json({ status: "ok", profiles });
  } catch (err) {
    console.error("[API /agent/team/profile] Error:", err);
    return NextResponse.json({ error: "Failed to load profiles", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

interface Body {
  userId?: string;
  slackUserId?: string;
  action?: string;
  role?: string | null;
  owns?: string | null;
  answerStyle?: string | null;
  focus?: string | null;
  bestTimes?: string | null;
  pushLevel?: string | null;
  askStyle?: string | null;
  avoid?: string | null;
  dailyMessageLimit?: number | null;
  kind?: string;
  text?: string;
  traceId?: string;
  noteId?: string;
  actorSlackUserId?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  // The Chief writes notes *about* body.slackUserId; it acts as itself, so no actor mapping is needed.
  const writer = await resolveWriter(request, body.actorSlackUserId ?? body.slackUserId);
  if (writer instanceof NextResponse) return writer;
  const target = body.userId ? { id: body.userId } : body.slackUserId ? await userBySlackId(body.slackUserId) : null;
  if (!target) return NextResponse.json({ error: "userId or a known slackUserId is required" }, { status: 400 });
  try {
    switch (body.action) {
      case "set": {
        const patch: ProfilePatch = {};
        if (writer.via === "agent") {
          // A person's own working style, through their own agent. Nobody else's, nothing else.
          if (writer.userId !== target.id) return NextResponse.json({ status: "refused", reason: "An agent may change only the working style of the person it is acting for" }, { status: 403 });
          for (const key of STYLE_FIELDS) if (body[key] !== undefined) patch[key] = body[key];
          if (!Object.keys(patch).length) return NextResponse.json({ status: "refused", reason: `Nothing to change. An agent may set: ${STYLE_FIELDS.join(", ")}` }, { status: 403 });
        } else {
          for (const key of ["role", "owns", ...STYLE_FIELDS] as const) if (body[key] !== undefined) patch[key] = body[key];
        }
        try {
          await setProfileFields(target.id, patch);
        } catch (err) {
          return NextResponse.json({ error: err instanceof Error ? err.message : "Bad value" }, { status: 400 });
        }
        if (writer.via === "founder" && body.dailyMessageLimit !== undefined) await setDailyLimit(target.id, body.dailyMessageLimit);
        if (writer.via === "agent") await recordActivity({ userId: target.id, kind: "profile_updated", subjectType: "profile", subjectId: target.id, summary: `Working style updated: ${Object.keys(patch).join(", ")}` });
        break;
      }
      case "note": {
        const kind = KINDS.includes(body.kind as NoteKind) ? (body.kind as NoteKind) : "pattern";
        if (!body.text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });
        const id = await addNote(target.id, { kind, text: body.text }, writer.via === "agent" ? { kind: "agent" } : { kind: "person", userId: writer.userId }, writer.via === "agent" ? "slack" : "dashboard", body.traceId);
        return NextResponse.json({ status: "ok", noteId: id });
      }
      case "retire":
        if (writer.via !== "founder") return NextResponse.json({ status: "refused", reason: "Only a founder retires notes" }, { status: 403 });
        if (!body.noteId) return NextResponse.json({ error: "noteId is required" }, { status: 400 });
        await retireNote(body.noteId, writer.userId);
        break;
      default:
        return NextResponse.json({ error: `Unknown action ${body.action ?? "(none)"}` }, { status: 400 });
    }
    const p = await getProfile(target.id);
    return NextResponse.json({ status: "ok", profile: p });
  } catch (err) {
    console.error("[API /agent/team/profile] Error:", err);
    return NextResponse.json({ error: "Failed to update profile", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
