/**
 * QuickBooks OAuth Initiation
 * GET /api/auth/quickbooks
 * Redirects user to Intuit's authorization page
 */

import { NextResponse } from "next/server";
import OAuthClient from "intuit-oauth";

function getOAuthClient() {
  return new OAuthClient({
    clientId: process.env.QUICKBOOKS_CLIENT_ID!,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
    environment: process.env.QUICKBOOKS_ENVIRONMENT as "sandbox" | "production",
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI!,
  });
}

export async function GET() {
  const oauthClient = getOAuthClient();

  // Generate authorization URL with required scopes
  const authUri = oauthClient.authorizeUri({
    scope: [
      OAuthClient.scopes.Accounting, // For P&L and financial reports
      OAuthClient.scopes.OpenId,     // For user info
    ],
    state: "kpi-dashboard", // CSRF protection - in production, use a random token
  });

  return NextResponse.redirect(authUri);
}
