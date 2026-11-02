/**
 * API Authentication
 * Supports two auth methods:
 * 1. API Key (X-OPENCLAW-API-KEY header) - for OpenClaw agents
 * 2. Session auth - for webapp dashboard users
 *
 * Either method grants access. Both failing = 401.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "~/auth/server";
import { headers } from "next/headers";
import { isFounder } from "~/lib/founders";

/**
 * Validate API access via either API key or session
 * Returns null if authorized, NextResponse error if not
 */
export async function validateApiAccess(request: NextRequest): Promise<NextResponse | null> {
  // Method 1: Check API key (OpenClaw)
  const apiKey = request.headers.get("X-OPENCLAW-API-KEY");
  const expectedKey = process.env.OPENCLAW_API_KEY;

  if (apiKey && expectedKey && apiKey === expectedKey) {
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
    { error: "Unauthorized. Provide X-OPENCLAW-API-KEY header or valid session." },
    { status: 401 }
  );
}

/**
 * Founder-only data (KPI, P&L, reconciliation, Retention): the OpenClaw API key,
 * or a logged-in founder. No dev-mode bypass, so this data is never open when
 * OPENCLAW_API_KEY isn't configured.
 */
export async function validateFounderAccess(request: NextRequest): Promise<NextResponse | null> {
  const apiKey = request.headers.get("X-OPENCLAW-API-KEY");
  const expectedKey = process.env.OPENCLAW_API_KEY;
  if (apiKey && expectedKey && apiKey === expectedKey) return null;

  let email: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    email = session?.user?.email ?? null;
  } catch {
    // Session check failed: treated as signed out
  }

  if (isFounder(email)) return null;
  return NextResponse.json(
    { error: email ? "Founders only." : "Unauthorized. Sign in as a founder or provide X-OPENCLAW-API-KEY." },
    { status: email ? 403 : 401 }
  );
}

/**
 * @deprecated Use validateApiAccess instead (supports both API key and session)
 */
export function validateOpenClawApiKey(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get("X-OPENCLAW-API-KEY");
  const expectedKey = process.env.OPENCLAW_API_KEY;

  if (!expectedKey) {
    console.warn("[API Auth] OPENCLAW_API_KEY not configured - skipping validation");
    return null;
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing API key. Include X-OPENCLAW-API-KEY header." },
      { status: 401 }
    );
  }

  if (apiKey !== expectedKey) {
    return NextResponse.json(
      { error: "Invalid API key" },
      { status: 403 }
    );
  }

  return null;
}
