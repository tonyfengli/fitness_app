/**
 * QuickBooks OAuth Initiation
 * GET /api/auth/quickbooks
 * Redirects user to Intuit's authorization page
 */

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import OAuthClient from "intuit-oauth";
import { getOAuthClient, QB_STATE_COOKIE } from "~/lib/quickbooks";

export async function GET() {
  const oauthClient = getOAuthClient();

  // CSRF protection: random state, checked against this cookie in the callback
  const state = randomBytes(16).toString("hex");

  // Generate authorization URL with required scopes
  const authUri = oauthClient.authorizeUri({
    scope: [
      OAuthClient.scopes.Accounting, // For P&L and financial reports
      OAuthClient.scopes.OpenId,     // For user info
    ],
    state,
  });

  const response = NextResponse.redirect(authUri);
  response.cookies.set(QB_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/quickbooks",
    maxAge: 10 * 60,
  });
  return response;
}
