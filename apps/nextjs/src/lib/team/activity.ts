/**
 * The shared activity record (team_activity_event): what the Chief of Staff recently sent to a
 * person or changed for them. Every conversation with the Chief starts without the others'
 * history, so this is where "her card" / "that task" gets resolved: the card or task it most
 * recently touched for the person asking.
 *
 * Record sends and changes only, never questions answered. recordActivity never throws: a
 * missing line must not fail the send or change it describes.
 */

import { and, desc, eq, gte } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamActivityEvent, TeamProfile } from "@acme/db/schema";

import { getGymBusinessId } from "../business";

export type ActivityKind = "card_sent" | "card_changed" | "card_photo_shown" | "card_photo_decided" | "reminder_sent" | "task_created" | "task_updated";

export interface ActivityInput {
  /** Who it was sent to or done for: a Slack user id, or a login when the Slack id isn't at hand */
  slackUserId?: string | null;
  userId?: string | null;
  kind: ActivityKind;
  subjectType: "card" | "task";
  subjectId: string;
  /** One readable line, past tense: "Sent Alex Kim's birthday card (2026-11-16)" */
  summary: string;
}

export async function recordActivity(input: ActivityInput | ActivityInput[]): Promise<void> {
  try {
    const items = Array.isArray(input) ? input : [input];
    if (!items.length) return;
    const businessId = await getGymBusinessId();
    const profiles = await db.select({ userId: TeamProfile.userId, slackUserId: TeamProfile.slackUserId }).from(TeamProfile).where(eq(TeamProfile.businessId, businessId));
    const rows = items.flatMap((i) => {
      const slackUserId = i.slackUserId ?? profiles.find((p) => p.userId === i.userId)?.slackUserId ?? null;
      if (!slackUserId) return []; // nobody to remember it for (a founder with no Slack yet)
      const userId = i.userId ?? profiles.find((p) => p.slackUserId === slackUserId)?.userId ?? null;
      return [{ businessId, slackUserId, userId, kind: i.kind, subjectType: i.subjectType, subjectId: i.subjectId, summary: i.summary.slice(0, 500) }];
    });
    if (rows.length) await db.insert(TeamActivityEvent).values(rows);
  } catch (err) {
    console.warn("[team/activity] not recorded:", err instanceof Error ? err.message : err);
  }
}

export interface Activity {
  at: string;
  minutesAgo: number;
  slackUserId: string;
  kind: string;
  subjectType: string;
  subjectId: string;
  summary: string;
}

/** Newest first. One person's activity, or everyone's when slackUserId is omitted. */
export async function recentActivity(opts: { slackUserId?: string; minutes: number; limit?: number }, now = new Date()): Promise<Activity[]> {
  const businessId = await getGymBusinessId();
  const since = new Date(now.getTime() - opts.minutes * 60_000);
  const conds = [eq(TeamActivityEvent.businessId, businessId), gte(TeamActivityEvent.createdAt, since)];
  if (opts.slackUserId) conds.push(eq(TeamActivityEvent.slackUserId, opts.slackUserId));
  const rows = await db.select().from(TeamActivityEvent).where(and(...conds)).orderBy(desc(TeamActivityEvent.createdAt)).limit(opts.limit ?? 50);
  return rows.map((r) => ({
    at: r.createdAt.toISOString(),
    minutesAgo: Math.max(0, Math.round((now.getTime() - r.createdAt.getTime()) / 60_000)),
    slackUserId: r.slackUserId,
    kind: r.kind,
    subjectType: r.subjectType,
    subjectId: r.subjectId,
    summary: r.summary,
  }));
}
