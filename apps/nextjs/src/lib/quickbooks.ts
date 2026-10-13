/**
 * QuickBooks API Client
 * Handles token refresh and API calls
 */

import OAuthClient from "intuit-oauth";
import { readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";

const TOKEN_FILE = join(process.cwd(), ".quickbooks-tokens.json");

// Track if we've detected an invalid token (refresh failed)
let tokenInvalidated = false;

export interface QuickBooksTokens {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  updatedAt: string;
}

export interface ProfitAndLossRow {
  group?: string;
  account: string;
  amount: number;
}

export interface ProfitAndLossReport {
  startDate: string;
  endDate: string;
  income: ProfitAndLossRow[];
  expenses: ProfitAndLossRow[];
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  raw?: unknown;
}

function getOAuthClient() {
  return new OAuthClient({
    clientId: process.env.QUICKBOOKS_CLIENT_ID!,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
    environment: process.env.QUICKBOOKS_ENVIRONMENT as "sandbox" | "production",
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI!,
  });
}

export async function loadTokens(): Promise<QuickBooksTokens | null> {
  try {
    const data = await readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: QuickBooksTokens): Promise<void> {
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

export async function getValidTokens(): Promise<QuickBooksTokens | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;

  // Check if access token is expired (with 5 minute buffer)
  const expiresAt = new Date(tokens.accessTokenExpiresAt);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    // Token is still valid
    return tokens;
  }

  // Check if refresh token is expired
  const refreshExpiresAt = new Date(tokens.refreshTokenExpiresAt);
  if (refreshExpiresAt < now) {
    console.error("QuickBooks refresh token expired - re-authorization required");
    return null;
  }

  // Refresh the token
  try {
    const oauthClient = getOAuthClient();
    oauthClient.setToken({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: "Bearer",
      expires_in: 0,
      x_refresh_token_expires_in: 0,
      realmId: tokens.realmId,
    });

    const response = await oauthClient.refresh();
    const newTokenData = response.getJson();

    const newTokens: QuickBooksTokens = {
      accessToken: newTokenData.access_token,
      refreshToken: newTokenData.refresh_token,
      realmId: tokens.realmId,
      accessTokenExpiresAt: new Date(
        Date.now() + newTokenData.expires_in * 1000
      ).toISOString(),
      refreshTokenExpiresAt: new Date(
        Date.now() + newTokenData.x_refresh_token_expires_in * 1000
      ).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTokens(newTokens);
    tokenInvalidated = false;
    console.log("QuickBooks token refreshed successfully");
    return newTokens;
  } catch (err) {
    console.error("Failed to refresh QuickBooks token:", err);
    // Mark token as invalidated and delete the file
    tokenInvalidated = true;
    try {
      await unlink(TOKEN_FILE);
      console.log("Deleted invalid QuickBooks token file");
    } catch {
      // File may not exist, ignore
    }
    return null;
  }
}

/**
 * Clear the invalidated flag (call after successful re-auth)
 */
export function clearTokenInvalidated(): void {
  tokenInvalidated = false;
}

/**
 * Fetch Profit and Loss report from QuickBooks
 */
export async function fetchProfitAndLoss(
  startDate: string,
  endDate: string
): Promise<ProfitAndLossReport | null> {
  const tokens = await getValidTokens();
  if (!tokens) {
    console.error("No valid QuickBooks tokens available");
    return null;
  }

  const baseUrl =
    process.env.QUICKBOOKS_ENVIRONMENT === "sandbox"
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com";

  const url = `${baseUrl}/v3/company/${tokens.realmId}/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}&minorversion=65`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("QuickBooks API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    return parseProfitAndLossReport(data, startDate, endDate);
  } catch (err) {
    console.error("Failed to fetch P&L:", err);
    return null;
  }
}

/**
 * Parse QuickBooks P&L report into a simpler structure
 */
function parseProfitAndLossReport(
  data: any,
  startDate: string,
  endDate: string
): ProfitAndLossReport {
  const income: ProfitAndLossRow[] = [];
  const expenses: ProfitAndLossRow[] = [];
  let totalIncome = 0;
  let totalExpenses = 0;
  let netIncome = 0;

  // QuickBooks report structure uses nested Rows
  const rows = data?.Rows?.Row || [];

  for (const section of rows) {
    const sectionType = section?.group;
    const sectionRows = section?.Rows?.Row || [];

    if (sectionType === "Income") {
      for (const row of sectionRows) {
        if (row?.Summary?.ColData) {
          const cols = row.Summary.ColData;
          const name = cols[0]?.value || "Unknown";
          const amount = parseFloat(cols[1]?.value || "0");
          if (name.includes("Total")) {
            totalIncome = amount;
          } else if (amount !== 0) {
            income.push({ account: name, amount });
          }
        } else if (row?.ColData) {
          const cols = row.ColData;
          const name = cols[0]?.value || "Unknown";
          const amount = parseFloat(cols[1]?.value || "0");
          if (amount !== 0) {
            income.push({ account: name, amount });
          }
        }
      }
    } else if (sectionType === "Expenses") {
      for (const row of sectionRows) {
        if (row?.Summary?.ColData) {
          const cols = row.Summary.ColData;
          const name = cols[0]?.value || "Unknown";
          const amount = parseFloat(cols[1]?.value || "0");
          if (name.includes("Total")) {
            totalExpenses = amount;
          } else if (amount !== 0) {
            expenses.push({ account: name, amount });
          }
        } else if (row?.ColData) {
          const cols = row.ColData;
          const name = cols[0]?.value || "Unknown";
          const amount = parseFloat(cols[1]?.value || "0");
          if (amount !== 0) {
            expenses.push({ account: name, amount });
          }
        }
      }
    } else if (section?.Summary?.ColData) {
      // Net Income row
      const cols = section.Summary.ColData;
      const name = cols[0]?.value || "";
      if (name.includes("Net Income") || name.includes("Net Profit")) {
        netIncome = parseFloat(cols[1]?.value || "0");
      }
    }
  }

  // If totals weren't found in summaries, calculate them
  if (totalIncome === 0 && income.length > 0) {
    totalIncome = income.reduce((sum, r) => sum + r.amount, 0);
  }
  if (totalExpenses === 0 && expenses.length > 0) {
    totalExpenses = expenses.reduce((sum, r) => sum + r.amount, 0);
  }
  if (netIncome === 0) {
    netIncome = totalIncome - totalExpenses;
  }

  return {
    startDate,
    endDate,
    income,
    expenses,
    totalIncome,
    totalExpenses,
    netIncome,
    raw: data,
  };
}

/**
 * Check if QuickBooks is connected
 */
export async function isQuickBooksConnected(): Promise<boolean> {
  // If we've detected an invalid token, return false immediately
  if (tokenInvalidated) return false;

  const tokens = await loadTokens();
  if (!tokens) return false;

  // Check if refresh token is still valid
  const refreshExpiresAt = new Date(tokens.refreshTokenExpiresAt);
  return refreshExpiresAt > new Date();
}
