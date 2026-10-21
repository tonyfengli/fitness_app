/**
 * QuickBooks Debug API
 * GET /api/quickbooks/debug
 * Shows connection details for debugging
 */

import { NextRequest, NextResponse } from "next/server";
import { loadTokens, getValidTokens } from "~/lib/quickbooks";
import { validateApiAccess } from "~/lib/api-auth";

export async function GET(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const tokens = await loadTokens();

  if (!tokens) {
    return NextResponse.json({ error: "No tokens found" });
  }

  // Try to get company info
  const validTokens = await getValidTokens();
  if (!validTokens) {
    return NextResponse.json({ error: "Tokens invalid/expired" });
  }

  const baseUrl =
    process.env.QUICKBOOKS_ENVIRONMENT === "sandbox"
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com";

  // Fetch company info
  try {
    const companyRes = await fetch(
      `${baseUrl}/v3/company/${tokens.realmId}/companyinfo/${tokens.realmId}?minorversion=65`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${validTokens.accessToken}`,
        },
      }
    );
    const companyData = await companyRes.json();

    return NextResponse.json({
      environment: process.env.QUICKBOOKS_ENVIRONMENT,
      baseUrl,
      realmId: tokens.realmId,
      tokenExpiresAt: tokens.accessTokenExpiresAt,
      companyInfo: companyData?.CompanyInfo || companyData,
    });
  } catch (err) {
    return NextResponse.json({
      environment: process.env.QUICKBOOKS_ENVIRONMENT,
      baseUrl,
      realmId: tokens.realmId,
      error: err instanceof Error ? err.message : "Failed to fetch company info",
    });
  }
}
