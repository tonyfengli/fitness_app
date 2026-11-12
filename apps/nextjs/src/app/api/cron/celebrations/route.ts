/**
 * Daily: find current members with a birthday in the next 14 days (DAYS_AHEAD), create their
 * celebration rows (never twice) and render the cards that have none. Founders then post by hand from
 * the Retention tab's Celebrations view.
 * GET /api/cron/celebrations                 apply
 * GET /api/cron/celebrations?dry=1           report only (who's upcoming; nothing written)
 * GET /api/cron/celebrations?members=a,b     founders only: run for these member numbers
 *                                            instead of the current-member list (testing)
 *
 * Vercel's scheduler calls it with "Authorization: Bearer <CRON_SECRET>" (vercel.json);
 * a signed-in founder can call it too. Logic in ~/lib/celebrations/service.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { runCelebrations } from "~/lib/celebrations/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // a theme background can take ~15 s to generate; each card a few seconds

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const fromScheduler = !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!fromScheduler) {
    const authError = await validateFounderAccess(request);
    if (authError) return authError;
  }

  const dry = request.nextUrl.searchParams.get("dry") === "1";
  const members = request.nextUrl.searchParams.get("members");
  const testMemberIds = !fromScheduler && members ? members.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  try {
    const run = await runCelebrations({ apply: !dry, testMemberIds });
    console.log(`[cron/celebrations] ${dry ? "dry run" : "applied"}: ${run.upcoming.length} upcoming, ${run.created.length} created, ${run.rendered.length} rendered, ${run.failed.length} failed`);
    return NextResponse.json({ ranAt: new Date().toISOString(), applied: !dry, testMemberIds: testMemberIds ?? null, ...run });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/celebrations] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
