/**
 * Re-render every card that is still waiting to be posted (status ready), e.g. after the
 * card layout changed. Without --apply it only lists them. With --apply it overwrites each
 * card's image in Blob and updates its row; tasks and statuses are untouched.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/tmp/rerender-ready-cards.ts [--apply]
 */
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { Celebration } from "@acme/db/schema";

import { getGymBusinessId } from "../../src/lib/business";
import { renderCard } from "../../src/lib/celebrations/service";

const apply = process.argv.includes("--apply");
const businessId = await getGymBusinessId();
const ready = await db
  .select({ id: Celebration.id, memberId: Celebration.memberId, occasionDate: Celebration.occasionDate })
  .from(Celebration)
  .where(and(eq(Celebration.businessId, businessId), eq(Celebration.status, "ready")))
  .orderBy(Celebration.occasionDate);
for (const c of ready) {
  if (!apply) {
    console.log(`#${c.memberId} ${c.occasionDate} (would re-render)`);
    continue;
  }
  const card = await renderCard(c.id);
  console.log(`#${c.memberId} ${c.occasionDate}: photo ${card.photo}, design ${card.themeKey} → ${card.imageUrl}`);
}
console.log(apply ? `re-rendered ${ready.length}` : `${ready.length} ready; pass --apply to re-render`);
process.exit(0);
