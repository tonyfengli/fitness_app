/**
 * QuickBooks OAuth Callback
 * GET /api/auth/quickbooks/callback
 * Exchanges authorization code for tokens and stores them
 */

import { NextRequest, NextResponse } from "next/server";
import OAuthClient from "intuit-oauth";
import { writeFile, readFile } from "fs/promises";
import { join } from "path";
import { clearTokenInvalidated } from "~/lib/quickbooks";

const TOKEN_FILE = join(process.cwd(), ".quickbooks-tokens.json");

function getOAuthClient() {
  return new OAuthClient({
    clientId: process.env.QUICKBOOKS_CLIENT_ID!,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
    environment: process.env.QUICKBOOKS_ENVIRONMENT as "sandbox" | "production",
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI!,
  });
}

export interface QuickBooksTokens {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  updatedAt: string;
}

export async function saveTokens(tokens: QuickBooksTokens): Promise<void> {
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

export async function loadTokens(): Promise<QuickBooksTokens | null> {
  try {
    const data = await readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const realmId = searchParams.get("realmId");
  const error = searchParams.get("error");

  // Handle errors from Intuit
  if (error) {
    const errorDescription = searchParams.get("error_description") || "Unknown error";
    return NextResponse.redirect(
      new URL(`/kpi?error=${encodeURIComponent(errorDescription)}`, request.url)
    );
  }

  if (!code || !realmId) {
    return NextResponse.redirect(
      new URL("/kpi?error=Missing authorization code or realm ID", request.url)
    );
  }

  try {
    const oauthClient = getOAuthClient();

    // Exchange code for tokens
    const authResponse = await oauthClient.createToken(request.url);
    const tokenData = authResponse.getJson();

    // Store tokens
    const tokens: QuickBooksTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      realmId: realmId,
      accessTokenExpiresAt: new Date(
        Date.now() + tokenData.expires_in * 1000
      ).toISOString(),
      refreshTokenExpiresAt: new Date(
        Date.now() + tokenData.x_refresh_token_expires_in * 1000
      ).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTokens(tokens);

    // Clear any invalidated token flag
    clearTokenInvalidated();

    // Redirect to KPI dashboard with success message
    return NextResponse.redirect(
      new URL("/kpi?quickbooks=connected", request.url)
    );
  } catch (err) {
    console.error("QuickBooks OAuth error:", err);
    const message = err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.redirect(
      new URL(`/kpi?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
