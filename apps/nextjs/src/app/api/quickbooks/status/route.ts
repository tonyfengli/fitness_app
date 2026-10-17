/**
 * QuickBooks Status API
 * GET /api/quickbooks/status
 * Returns connection status
 */

import { NextResponse } from "next/server";
import { loadTokens, isQuickBooksConnected } from "~/lib/quickbooks";

export async function GET() {
  const connected = await isQuickBooksConnected();
  const tokens = await loadTokens();

  if (!connected || !tokens) {
    return NextResponse.json({
      connected: false,
      message: "QuickBooks not connected",
    });
  }

  return NextResponse.json({
    connected: true,
    realmId: tokens.realmId,
    environment: process.env.QUICKBOOKS_ENVIRONMENT,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    lastUpdated: tokens.updatedAt,
  });
}
