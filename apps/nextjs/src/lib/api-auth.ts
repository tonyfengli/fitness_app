/**
 * API Authentication
 * Supports two auth methods:
 * 1. API Key (X-OPENCLAW-API-KEY header) - for the OpenClaw Slack bot. Read-only:
 *    accepted only for GET requests to /api/agent/*.
 * 2. Session auth - for webapp dashboard users
 *
 * Either method grants access. Both failing = 401.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "~/auth/server";
import { headers } from "next/headers";
import { isFounder } from "~/lib/founders";

/** The OpenClaw key, presented on a read of an /api/agent/* route. Anywhere else it grants nothing. */
function hasAgentKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("X-OPENCLAW-API-KEY");
  const expectedKey = process.env.OPENCLAW_API_KEY;
  return (
    !!apiKey &&
    !!expectedKey &&
    apiKey === expectedKey &&
    request.method === "GET" &&
    request.nextUrl.pathname.startsWith("/api/agent/")
  );
}

/**
 * Validate API access via either API key or session
 * Returns null if authorized, NextResponse error if not
 */
export async function validateApiAccess(request: NextRequest): Promise<NextResponse | null> {
  // Method 1: Check API key (OpenClaw)
  const expectedKey = process.env.OPENCLAW_API_KEY;

  if (hasAgentKey(request)) {
    return null; // Valid API key - proceed
  }

  // Method 2: Check session (webapp user)
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) {
      return null; // Valid session - proceed
    }
  } catch {
    // Session check failed, continue to rejection
  }

  // Dev mode: skip auth if OPENCLAW_API_KEY not configured
  if (!expectedKey) {
    console.warn("[API Auth] OPENCLAW_API_KEY not configured - skipping validation (dev mode)");
    return null;
  }

  // Neither auth method succeeded
  return NextResponse.json(
    { error: "Unauthorized. Sign in, or use X-OPENCLAW-API-KEY (GET /api/agent/* only)." },
    { status: 401 }
  );
}

/**
 * Founder-only data (KPI, P&L, reconciliation, Retention): a logged-in founder, or
 * the OpenClaw API key on a GET /api/agent/* request. No dev-mode bypass, so this
 * data is never open when OPENCLAW_API_KEY isn't configured.
 */
export async function validateFounderAccess(request: NextRequest): Promise<NextResponse | null> {
  if (hasAgentKey(request)) return null;

  let email: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    email = session?.user?.email ?? null;
  } catch {
    // Session check failed: treated as signed out
  }

  if (isFounder(email)) return null;
  return NextResponse.json(
    { error: email ? "Founders only." : "Unauthorized. Sign in as a founder, or use X-OPENCLAW-API-KEY (GET /api/agent/* only)." },
    { status: email ? 403 : 401 }
  );
}
