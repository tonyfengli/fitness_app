/**
 * QuickBooks OAuth Callback
 * GET /api/auth/quickbooks/callback
 * Exchanges authorization code for tokens and stores them (encrypted, in the database)
 */

import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, QB_STATE_COOKIE, saveTokens, tokensFromResponse } from "~/lib/quickbooks";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const realmId = searchParams.get("realmId");
  const error = searchParams.get("error");

  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.cookies.delete({ name: QB_STATE_COOKIE, path: "/api/auth/quickbooks" });
    return response;
  };

  // Handle errors from Intuit
  if (error) {
    const errorDescription = searchParams.get("error_description") || "Unknown error";
    return redirect(`/kpi?error=${encodeURIComponent(errorDescription)}`);
  }

  // Must match the state set when the connect flow started
  const expectedState = request.cookies.get(QB_STATE_COOKIE)?.value;
  if (!state || !expectedState || state !== expectedState) {
    return redirect("/kpi?error=QuickBooks connection expired or was not started here. Please try again.");
  }

  if (!code || !realmId) {
    return redirect("/kpi?error=Missing authorization code or realm ID");
  }

  try {
    const oauthClient = getOAuthClient();

    // Exchange code for tokens
    const authResponse = await oauthClient.createToken(request.url);
    await saveTokens(tokensFromResponse(realmId, authResponse.getJson()));

    // Redirect to KPI dashboard with success message
    return redirect("/kpi?quickbooks=connected");
  } catch (err) {
    console.error("QuickBooks OAuth error:", err);
    const message = err instanceof Error ? err.message : "Token exchange failed";
    return redirect(`/kpi?error=${encodeURIComponent(message)}`);
  }
}
