/**
 * Daily team nudges: one bundled Slack DM per person with what's due, plus hard-deadline
 * escalations. Rules and limits in ~/lib/team/nudges.
 * GET /api/cron/team-nudges           send
 * GET /api/cron/team-nudges?dry=1     report who would get what; nothing sent or written
 * Scheduler: "Authorization: Bearer <CRON_SECRET>"; a signed-in founder can call it too.
 * Scheduled for 16:00 UTC (8am PST / 9am PDT), after quiet hours end.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { runNudges } from "~/lib/team/nudges";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const fromScheduler = !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!fromScheduler) {
    const authError = await validateFounderAccess(request);
    if (authError) return authError;
  }
  const dry = request.nextUrl.searchParams.get("dry") === "1";
  try {
    const run = await runNudges({ apply: !dry });
    console.log(`[cron/team-nudges] ${dry ? "dry run" : "sent"}: ${run.sent.length} messages, ${run.skipped.length} skipped, ${run.failed.length} failed`);
    return NextResponse.json({ ranAt: new Date().toISOString(), applied: !dry, ...run });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/team-nudges] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
