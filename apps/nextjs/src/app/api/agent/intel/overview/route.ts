/**
 * The competitor overview behind the dashboard's Competitors tab.
 * GET /api/agent/intel/overview  ->  { asOf, comparedTo, pulls, accounts[], missing[], wins[], flops[] }
 *
 * Public data only (Instagram counts and posts of tracked gyms). Founders or the agent read
 * key. How each number is worked out: ~/lib/intel/overview.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { intelOverview } from "~/lib/intel/overview";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  try {
    return NextResponse.json(await intelOverview());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent/intel/overview] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
