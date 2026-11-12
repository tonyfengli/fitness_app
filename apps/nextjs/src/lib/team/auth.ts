/**
 * Who may write to team tasks (and celebration cards) through the API:
 *  - a signed-in founder (the dashboard), acting as themselves;
 *  - the gym Chief of Staff on the Mini, with TEAM_AGENT_API_KEY in X-TEAM-AGENT-KEY, acting
 *    on behalf of the Slack user who wrote to it (actorSlackUserId → team_profile → user).
 * The read-only OpenClaw key (X-OPENCLAW-API-KEY) grants nothing here. The library's rules
 * (lib/team/tasks.ts) still apply to whoever the actor resolves to.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamProfile, user } from "@acme/db/schema";
import { auth } from "~/auth/server";
import { isFounder } from "~/lib/founders";

import { getGymBusinessId } from "../business";

export interface Writer {
  via: "founder" | "agent";
  userId: string;
  name: string;
}

export async function userBySlackId(slackUserId: string): Promise<{ id: string; name: string } | null> {
  const businessId = await getGymBusinessId();
  const [row] = await db
    .select({ id: user.id, name: user.name })
    .from(TeamProfile)
    .innerJoin(user, eq(user.id, TeamProfile.userId))
    .where(and(eq(TeamProfile.businessId, businessId), eq(TeamProfile.slackUserId, slackUserId), eq(TeamProfile.active, true)))
    .limit(1);
  return row ?? null;
}

function hasAgentWriteKey(request: NextRequest): boolean {
  const expected = process.env.TEAM_AGENT_API_KEY;
  const given = request.headers.get("X-TEAM-AGENT-KEY");
  const path = request.nextUrl.pathname;
  // Tasks, and the cards behind birthday tasks (send a card, rebuild one)
  return !!expected && !!given && given === expected && (path.startsWith("/api/agent/tasks") || path === "/api/agent/celebrations");
}

/** The person this write acts as, or an error response */
export async function resolveWriter(request: NextRequest, actorSlackUserId?: string): Promise<Writer | NextResponse> {
  if (hasAgentWriteKey(request)) {
    if (!actorSlackUserId) return NextResponse.json({ error: "actorSlackUserId is required for agent writes" }, { status: 400 });
    const u = await userBySlackId(actorSlackUserId);
    if (!u) return NextResponse.json({ error: `No active team profile for Slack user ${actorSlackUserId}` }, { status: 403 });
    return { via: "agent", userId: u.id, name: u.name };
  }
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const email = session?.user.email ?? null;
    if (session?.user && isFounder(email)) return { via: "founder", userId: session.user.id, name: session.user.name };
    if (email) return NextResponse.json({ error: "Founders only." }, { status: 403 });
  } catch {
    // no session
  }
  return NextResponse.json({ error: "Unauthorized. Sign in as a founder, or use X-TEAM-AGENT-KEY." }, { status: 401 });
}
