/**
 * Is the intel collection healthy?
 * GET /api/agent/intel/health  ->  { ok, enabled, problems[], monthSpendUsd, monthCapUsd, latest[] }
 *
 * Always HTTP 200 when it could check; `ok: false` with the reasons in `problems` when a pull
 * failed, is overdue, stored nothing, came back short, or spend passed the cap. The Mac Mini's
 * nightly check (ai-crew scripts/nightly-check.sh) calls this and posts problems to the health
 * Slack channel. Founders or the agent read key. Rules: ~/lib/intel/health.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { intelHealth } from "~/lib/intel/health";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  try {
    return NextResponse.json(await intelHealth());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent/intel/health] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
