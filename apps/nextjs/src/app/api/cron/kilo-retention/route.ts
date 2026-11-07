/**
 * Nightly: keep the Kilo "Member Retention" board in step with the at-risk list.
 * GET /api/cron/kilo-retention            apply
 * GET /api/cron/kilo-retention?dry=1      report only
 *
 * Vercel's scheduler calls it with "Authorization: Bearer <CRON_SECRET>" (vercel.json);
 * a signed-in founder can call it too, to refresh the board now. Rules and test mode
 * (KILO_RETENTION_TEST_MEMBERS) in ~/lib/kilo-retention.
 *
 * With KILO_MEMBER_SYNC_ENABLED=true it first brings Kilo's contacts in line with
 * fitness_app's current members (~/lib/kilo-members), so new members get a contact the
 * night after their first payment and can carry cards. Off until Kilo's lead workflows
 * filter out the "current members" tag.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { syncKiloMembers } from "~/lib/kilo-members";
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
    const membersEnabled = process.env.KILO_MEMBER_SYNC_ENABLED === "true";
    const members = membersEnabled ? await syncKiloMembers({ apply: !dry }) : null;
    if (members) console.log(`[cron/kilo-retention] members ${dry ? "dry run" : "applied"}: ${members.actions.length} actions, ${members.inSync} in sync, ${members.noPhone.length} without a phone`);
    const r = await syncRetentionBoard({ apply: !dry });
    const summary = {
      ranAt: new Date().toISOString(),
      applied: !dry,
      members: members
        ? { current: members.members.length, actions: members.actions.map(({ memberId, name, kind }) => ({ memberId, name, kind })), inSync: members.inSync, noPhone: members.noPhone, taggedByHand: members.taggedByHand }
        : "off (KILO_MEMBER_SYNC_ENABLED)",
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
