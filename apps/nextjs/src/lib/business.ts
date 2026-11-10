/**
 * The gym's business id, for rows that carry one (packages/db/NAMING.md rule 5).
 * fitness_app serves one gym; its id is the business the founders' logins belong to.
 * GYM_BUSINESS_ID overrides the lookup (tests, a second gym).
 */

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { user } from "@acme/db/schema";

import { isFounder } from "./founders";

let cached: string | null = null;

export async function getGymBusinessId(): Promise<string> {
  if (process.env.GYM_BUSINESS_ID) return process.env.GYM_BUSINESS_ID;
  if (cached) return cached;
  const trainers = await db.select({ email: user.email, businessId: user.businessId }).from(user).where(eq(user.role, "trainer"));
  const ids = [...new Set(trainers.filter((t) => isFounder(t.email)).map((t) => t.businessId))];
  const [id] = ids;
  if (!id || ids.length !== 1) throw new Error(`Expected the founders to share one business, found ${ids.length}`);
  cached = id;
  return cached;
}
