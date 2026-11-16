/**
 * Hourly: store the intel runs that have finished, and mark as failed any run still unfinished
 * after 6 hours.
 * GET /api/cron/intel-poll            store
 * GET /api/cron/intel-poll?dry=1      report only
 *
 * Polling, not a webhook: one place to look, and a run that never finishes is visible. Storing
 * a run twice adds nothing. Runs even when collection is switched off, so a run already paid
 * for is not lost. Auth as /api/cron/intel-start. Docs: ai-crew/docs/INTEL-COLLECTION.md.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { pollRuns } from "~/lib/intel/collect";

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
    const r = await pollRuns({ apply: !dry });
    if (r.checked) console.log(`[cron/intel-poll] ${dry ? "dry run" : "applied"}: ${r.runs.map((x) => `${x.actor}: ${x.outcome}`).join("; ")}`);
    return NextResponse.json({ ranAt: new Date().toISOString(), ...r });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/intel-poll] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
