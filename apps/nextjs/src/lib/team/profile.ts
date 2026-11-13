/**
 * Founder profiles: what the Chief of Staff knows about working with each founder, in the
 * business context only. Four summary fields on team_profile plus dated, sourced notes
 * (team_profile_note). The Chief reads a profile at the start of a turn from a known sender
 * and adds a note when it learns something durable; Tony (any founder) edits and retires.
 * Decision Nov 10, 2026: the Chief writes freely; everything is logged; a weekly list of what
 * it added shows on the Team tab. Design: ai-crew/docs/BUSINESS-ACCOUNTABILITY.md.
 */

import { and, desc, eq, gte, isNull } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamProfile, TeamProfileNote, user } from "@acme/db/schema";

import { getGymBusinessId } from "../business";
import type { Actor, Channel } from "./tasks";

export type NoteKind = "preference" | "responsibility" | "focus" | "pattern" | "fact";

export const PUSH_LEVELS = ["light", "steady", "persistent"] as const;
export type PushLevel = (typeof PUSH_LEVELS)[number];

/** The fields a person may change about themselves through their own agent */
export const STYLE_FIELDS = ["answerStyle", "focus", "bestTimes", "pushLevel", "askStyle", "avoid"] as const;
export type StyleField = (typeof STYLE_FIELDS)[number];

export interface Profile {
  userId: string;
  name: string;
  slackUserId: string | null;
  role: string | null;
  owns: string | null;
  answerStyle: string | null;
  focus: string | null;
  bestTimes: string | null;
  pushLevel: PushLevel | null;
  askStyle: string | null;
  avoid: string | null;
  dailyMessageLimit: number | null;
  notes: { id: string; kind: NoteKind; text: string; source: "person" | "agent" | "workflow" | "cron"; author: string | null; traceId: string | null; createdAt: string }[];
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const businessId = await getGymBusinessId();
  const [row] = await db
    .select({ userId: user.id, name: user.name, slackUserId: TeamProfile.slackUserId, role: TeamProfile.role, owns: TeamProfile.owns, answerStyle: TeamProfile.answerStyle, focus: TeamProfile.focus, bestTimes: TeamProfile.bestTimes, pushLevel: TeamProfile.pushLevel, askStyle: TeamProfile.askStyle, avoid: TeamProfile.avoid, dailyMessageLimit: TeamProfile.dailyMessageLimit })
    .from(TeamProfile)
    .innerJoin(user, eq(user.id, TeamProfile.userId))
    .where(and(eq(TeamProfile.businessId, businessId), eq(TeamProfile.userId, userId)))
    .limit(1);
  if (!row) return null;
  const notes = await db
    .select({ id: TeamProfileNote.id, kind: TeamProfileNote.kind, text: TeamProfileNote.text, source: TeamProfileNote.source, authorName: user.name, traceId: TeamProfileNote.traceId, createdAt: TeamProfileNote.createdAt })
    .from(TeamProfileNote)
    .leftJoin(user, eq(user.id, TeamProfileNote.authorId))
    .where(and(eq(TeamProfileNote.userId, userId), isNull(TeamProfileNote.retiredAt)))
    .orderBy(desc(TeamProfileNote.createdAt));
  const pushLevel = PUSH_LEVELS.find((l) => l === row.pushLevel) ?? null;
  return { ...row, pushLevel, notes: notes.map((n) => ({ id: n.id, kind: n.kind, text: n.text, source: n.source, author: n.authorName ?? null, traceId: n.traceId, createdAt: n.createdAt.toISOString() })) };
}

export async function listProfiles(): Promise<Profile[]> {
  const businessId = await getGymBusinessId();
  const rows = await db.select({ userId: TeamProfile.userId }).from(TeamProfile).where(and(eq(TeamProfile.businessId, businessId), eq(TeamProfile.active, true)));
  const out: Profile[] = [];
  for (const r of rows) {
    const p = await getProfile(r.userId);
    if (p) out.push(p);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function setDailyLimit(userId: string, limit: number | null): Promise<void> {
  const v = limit === null || !Number.isFinite(limit) || limit <= 0 ? null : Math.min(20, Math.floor(limit));
  await db.update(TeamProfile).set({ dailyMessageLimit: v }).where(eq(TeamProfile.userId, userId));
}

export type ProfilePatch = Partial<Record<"role" | "owns" | StyleField, string | null>>;

export async function setProfileFields(userId: string, patch: ProfilePatch): Promise<void> {
  const clean: Record<string, string | null> = {};
  for (const key of ["role", "owns", ...STYLE_FIELDS] as const) {
    if (!(key in patch)) continue;
    const trimmed = patch[key]?.trim() ?? "";
    if (key === "pushLevel") {
      const level = trimmed.toLowerCase();
      if (level && !PUSH_LEVELS.some((l) => l === level)) throw new Error(`pushLevel must be one of ${PUSH_LEVELS.join(", ")}`);
      clean[key] = level || null;
    } else clean[key] = trimmed ? trimmed.slice(0, 600) : null;
  }
  if (!Object.keys(clean).length) return;
  await db.update(TeamProfile).set(clean).where(eq(TeamProfile.userId, userId));
}

export async function addNote(userId: string, note: { kind: NoteKind; text: string }, actor: Actor, _channel: Channel, traceId?: string): Promise<string> {
  const businessId = await getGymBusinessId();
  const text = note.text.trim().slice(0, 500);
  if (!text) throw new Error("Empty note");
  const [row] = await db
    .insert(TeamProfileNote)
    .values({ businessId, userId, kind: note.kind, text, source: actor.kind, authorId: actor.kind === "person" ? actor.userId : null, traceId: traceId ?? null })
    .returning({ id: TeamProfileNote.id });
  return row?.id ?? "";
}

export async function retireNote(noteId: string, by: string): Promise<void> {
  await db.update(TeamProfileNote).set({ retiredAt: new Date(), retiredBy: by }).where(and(eq(TeamProfileNote.id, noteId), isNull(TeamProfileNote.retiredAt)));
}

/** What the Chief added recently, for the weekly check on the Team tab */
export async function recentAgentNotes(days = 7) {
  const businessId = await getGymBusinessId();
  const since = new Date(Date.now() - days * 864e5);
  return db
    .select({ id: TeamProfileNote.id, userId: TeamProfileNote.userId, name: user.name, kind: TeamProfileNote.kind, text: TeamProfileNote.text, traceId: TeamProfileNote.traceId, createdAt: TeamProfileNote.createdAt, retiredAt: TeamProfileNote.retiredAt })
    .from(TeamProfileNote)
    .innerJoin(user, eq(user.id, TeamProfileNote.userId))
    .where(and(eq(TeamProfileNote.businessId, businessId), eq(TeamProfileNote.source, "agent"), gte(TeamProfileNote.createdAt, since)))
    .orderBy(desc(TeamProfileNote.createdAt));
}

/** The profile as the Chief should read it at the start of a turn */
export function profileBrief(p: Profile): string {
  const lines = [`${p.name}${p.role ? ` — ${p.role}` : ""}`];
  if (p.owns) lines.push(`Owns: ${p.owns}`);
  if (p.answerStyle) lines.push(`Likes answers: ${p.answerStyle}`);
  if (p.focus) lines.push(`Current focus: ${p.focus}`);
  if (p.bestTimes) lines.push(`Best times to reach: ${p.bestTimes}`);
  if (p.pushLevel) lines.push(`Push level: ${p.pushLevel}`);
  if (p.askStyle) lines.push(`How to ask: ${p.askStyle}`);
  if (p.avoid) lines.push(`Avoid: ${p.avoid}`);
  if (p.notes.length) {
    lines.push("", "Notes (newest first):");
    for (const n of p.notes.slice(0, 25)) lines.push(`- [${n.kind}, ${n.createdAt.slice(0, 10)}, ${n.source === "agent" ? "you" : (n.author ?? "a founder")}] ${n.text}`);
  } else {
    lines.push("", "No notes yet.");
  }
  return lines.join("\n");
}
