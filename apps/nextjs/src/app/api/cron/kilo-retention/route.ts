/**
 * Nightly: keep the Kilo "Member Retention" board in step with the at-risk list.
 * GET /api/cron/kilo-retention            apply
 * GET /api/cron/kilo-retention?dry=1      report only
 *
 * Vercel's scheduler calls it with "Authorization: Bearer <CRON_SECRET>" (vercel.json);
 * a signed-in founder can call it too, to refresh the board now. Rules and test mode
 * (KILO_RETENTION_TEST_MEMBERS) in ~/lib/kilo-retention.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { syncRetentionBoard } from "~/lib/kilo-retention";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // reads a conversation per open card

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const fromScheduler = !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!fromScheduler) {
    const authError = await validateFounderAccess(request);
    if (authError) return authError;
  }

  const dry = request.nextUrl.searchParams.get("dry") === "1";
  try {
    const r = await syncRetentionBoard({ apply: !dry });
    const summary = {
      ranAt: new Date().toISOString(),
      applied: !dry,
      testMembers: r.testMembers ? [...r.testMembers] : null,
      actions: r.actions.map(({ memberId, name, kind, detail }) => ({ memberId, name, kind, detail })),
      unchanged: r.unchanged.length,
      skipped: r.skipped,
      warnings: r.warnings,
    };
    console.log(`[cron/kilo-retention] ${dry ? "dry run" : "applied"}: ${r.actions.length} actions, ${r.unchanged.length} unchanged, ${r.skipped.length} skipped`);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/kilo-retention] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
