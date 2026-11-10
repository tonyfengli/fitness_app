/**
 * Idempotent setup for the team layer: workflows and who can be messaged. Run from
 * scripts/tmp/team-setup.ts (or a future admin page); nothing here is called on a request.
 */

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamProfile, TeamWorkflow, user } from "@acme/db/schema";

import { getGymBusinessId } from "../business";

export async function trainerIdByEmail(email: string): Promise<string> {
  const [u] = await db.select({ id: user.id, role: user.role }).from(user).where(eq(user.email, email.trim().toLowerCase())).limit(1);
  if (!u) throw new Error(`No user with email ${email}`);
  if (u.role !== "trainer") throw new Error(`${email} is not a trainer`);
  return u.id;
}

export async function ensureWorkflow(key: string, name: string, ownerId: string): Promise<void> {
  const businessId = await getGymBusinessId();
  await db
    .insert(TeamWorkflow)
    .values({ key, businessId, name, ownerId })
    .onConflictDoUpdate({ target: TeamWorkflow.key, set: { name, ownerId } });
}

export async function ensureProfile(userId: string, patch: { slackUserId?: string | null; aliases?: string[]; active?: boolean }): Promise<void> {
  const businessId = await getGymBusinessId();
  await db
    .insert(TeamProfile)
    .values({ userId, businessId, ...patch })
    .onConflictDoUpdate({ target: TeamProfile.userId, set: patch });
}
