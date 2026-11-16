/**
 * Daily: start the intel collection that is due (the weekly Instagram pull), and return at once.
 * GET /api/cron/intel-start            start what is due
 * GET /api/cron/intel-start?dry=1      report only: nothing written, nothing spent
 * GET /api/cron/intel-start?force=1    start a pull now, whatever the day (a founder's "collect now")
 *
 * The scraper works for minutes, so this never waits for it: /api/cron/intel-poll stores the
 * results. Off unless INTEL_COLLECTION_ENABLED=true. Vercel's scheduler calls it with
 * "Authorization: Bearer <CRON_SECRET>" (vercel.json); a signed-in founder can call it too.
 * Rules, caps and schedule: ~/lib/intel. Docs: ai-crew/docs/INTEL-COLLECTION.md.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { launchDue } from "~/lib/intel/collect";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const fromScheduler = !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!fromScheduler) {
    const authError = await validateFounderAccess(request);
    if (authError) return authError;
  }

  const dry = request.nextUrl.searchParams.get("dry") === "1";
  const force = request.nextUrl.searchParams.get("force") === "1";
  try {
    const r = await launchDue({ apply: !dry, force });
    console.log(`[cron/intel-start] ${dry ? "dry run" : "applied"}: ${r.reason}; ${r.accounts} accounts, est $${r.estimateUsd}, month $${r.monthSpendUsd}/$${r.monthCapUsd}`);
    return NextResponse.json({ ranAt: new Date().toISOString(), ...r });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/intel-start] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
