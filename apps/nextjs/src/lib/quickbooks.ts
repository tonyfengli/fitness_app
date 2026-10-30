/**
 * QuickBooks API Client
 * Handles token storage, refresh and API calls.
 *
 * Tokens live in the quickbooks_connection table, encrypted with AES-256-GCM
 * (QUICKBOOKS_TOKEN_KEY: 32 bytes, base64). Intuit rotates the refresh token on
 * every refresh, so each refresh rewrites the row. The refresh token expires after
 * 100 days without a refresh; after that, QuickBooks needs reconnecting.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import OAuthClient from "intuit-oauth";
import { and, desc, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { QuickBooksConnection } from "@acme/db/schema";

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

// Cookie holding the OAuth state between the connect redirect and the callback
export const QB_STATE_COOKIE = "qb_oauth_state";

export function getOAuthClient() {
  return new OAuthClient({
    clientId: process.env.QUICKBOOKS_CLIENT_ID!,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
    environment: process.env.QUICKBOOKS_ENVIRONMENT as "sandbox" | "production",
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI!,
  });
}

// ---------------------------------------------------------------------------
// Encryption at rest: "v1:<iv>:<auth tag>:<ciphertext>", all base64
// ---------------------------------------------------------------------------

function tokenKey(): Buffer {
  const key = Buffer.from(process.env.QUICKBOOKS_TOKEN_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("QUICKBOOKS_TOKEN_KEY must be 32 bytes, base64-encoded");
  return key;
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

function decrypt(stored: string): string {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognized QuickBooks token format");
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

type ConnectionRow = typeof QuickBooksConnection.$inferSelect;

function rowToTokens(row: ConnectionRow): QuickBooksTokens {
  return {
    accessToken: decrypt(row.accessToken),
    refreshToken: decrypt(row.refreshToken),
    realmId: row.realmId,
    accessTokenExpiresAt: row.accessTokenExpiresAt.toISOString(),
    refreshTokenExpiresAt: row.refreshTokenExpiresAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadRow(): Promise<ConnectionRow | null> {
  const [row] = await db.select().from(QuickBooksConnection).orderBy(desc(QuickBooksConnection.updatedAt)).limit(1);
  return row ?? null;
}

export async function loadTokens(): Promise<QuickBooksTokens | null> {
  try {
    const row = await loadRow();
    return row ? rowToTokens(row) : null;
  } catch (err) {
    console.error("Failed to load QuickBooks tokens:", err);
    return null;
  }
}

// Intuit token response → stored tokens
export function tokensFromResponse(
  realmId: string,
  data: { access_token: string; refresh_token: string; expires_in: number; x_refresh_token_expires_in: number }
): QuickBooksTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    realmId,
    accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + data.x_refresh_token_expires_in * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function toRow(tokens: QuickBooksTokens) {
  return {
    realmId: tokens.realmId,
    accessToken: encrypt(tokens.accessToken),
    refreshToken: encrypt(tokens.refreshToken),
    accessTokenExpiresAt: new Date(tokens.accessTokenExpiresAt),
    refreshTokenExpiresAt: new Date(tokens.refreshTokenExpiresAt),
    updatedAt: new Date(),
  };
}

export async function saveTokens(tokens: QuickBooksTokens): Promise<void> {
  const row = toRow(tokens);
  await db.insert(QuickBooksConnection).values(row).onConflictDoUpdate({ target: QuickBooksConnection.realmId, set: row });
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

const ACCESS_BUFFER_MS = 5 * 60 * 1000;

// Only one refresh at a time within this server instance
let refreshInFlight: Promise<QuickBooksTokens | null> | null = null;

function isInvalidGrant(err: unknown): boolean {
  const e = err as { error?: string; authResponse?: { json?: { error?: string } }; message?: string };
  return (
    e?.error === "invalid_grant" ||
    e?.authResponse?.json?.error === "invalid_grant" ||
    String(e?.message ?? err).includes("invalid_grant")
  );
}

async function refreshTokens(row: ConnectionRow): Promise<QuickBooksTokens | null> {
  const current = rowToTokens(row);
  try {
    const oauthClient = getOAuthClient();
    oauthClient.setToken({
      access_token: current.accessToken,
      refresh_token: current.refreshToken,
      token_type: "Bearer",
      expires_in: 0,
      x_refresh_token_expires_in: 0,
      realmId: current.realmId,
    });
    const fresh = tokensFromResponse(current.realmId, (await oauthClient.refresh()).getJson());

    // Save only if nobody else refreshed since we read the row; otherwise use theirs
    const saved = await db
      .update(QuickBooksConnection)
      .set(toRow(fresh))
      .where(and(eq(QuickBooksConnection.realmId, row.realmId), eq(QuickBooksConnection.updatedAt, row.updatedAt)))
      .returning({ id: QuickBooksConnection.id });
    if (!saved.length) {
      console.log("QuickBooks tokens were refreshed concurrently; using the stored ones");
      return loadTokens();
    }
    console.log("QuickBooks token refreshed successfully");
    return fresh;
  } catch (err) {
    if (isInvalidGrant(err)) {
      // The refresh token is revoked or expired: the connection is gone until re-authorized
      console.error("QuickBooks refresh token rejected (invalid_grant) - re-authorization required");
      await db.delete(QuickBooksConnection).where(eq(QuickBooksConnection.realmId, row.realmId));
    } else {
      // Network or Intuit hiccup: keep the tokens and try again on the next request
      console.error("Failed to refresh QuickBooks token (will retry):", err);
    }
    return null;
  }
}

/**
 * Valid tokens, refreshing when the access token is within 5 minutes of expiring
 */
export async function getValidTokens(): Promise<QuickBooksTokens | null> {
  const row = await loadRow().catch((err) => {
    console.error("Failed to load QuickBooks tokens:", err);
    return null;
  });
  if (!row) return null;

  if (row.refreshTokenExpiresAt <= new Date()) {
    console.error("QuickBooks refresh token expired - re-authorization required");
    return null;
  }
  if (row.accessTokenExpiresAt.getTime() - Date.now() > ACCESS_BUFFER_MS) {
    return rowToTokens(row);
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshTokens(row).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
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
 * Recursively extract accounts from QB row structure
 * Handles nested sub-accounts (e.g., Sales > Stripe Deposits)
 */
function extractAccounts(
  rows: any[],
  results: ProfitAndLossRow[],
  parentName?: string
): number {
  let sectionTotal = 0;

  for (const row of rows) {
    // Check if this row has nested sub-accounts
    if (row?.Header?.ColData && row?.Rows?.Row) {
      // Parent account with sub-accounts
      const headerCols = row.Header.ColData;
      const parentAccountName = headerCols[0]?.value || "Unknown";
      const parentAmount = parseFloat(headerCols[1]?.value || "0");
      const fullName = parentName
        ? `${parentName}:${parentAccountName}`
        : parentAccountName;

      // If parent has its own amount (not just sum of children), add it
      if (parentAmount !== 0) {
        results.push({ account: fullName, amount: parentAmount });
      }

      // Recursively process sub-accounts
      extractAccounts(row.Rows.Row, results, fullName);

      // Get total from Summary if available
      if (row?.Summary?.ColData) {
        const summaryCols = row.Summary.ColData;
        const summaryName = summaryCols[0]?.value || "";
        const summaryAmount = parseFloat(summaryCols[1]?.value || "0");
        if (summaryName.includes("Total")) {
          sectionTotal = summaryAmount;
        }
      }
    } else if (row?.ColData) {
      // Leaf account (no children)
      const cols = row.ColData;
      const name = cols[0]?.value || "Unknown";
      const amount = parseFloat(cols[1]?.value || "0");
      const fullName = parentName ? `${parentName}:${name}` : name;

      if (amount !== 0) {
        results.push({ account: fullName, amount });
      }
    } else if (row?.Summary?.ColData) {
      // Summary/total row
      const cols = row.Summary.ColData;
      const name = cols[0]?.value || "";
      const amount = parseFloat(cols[1]?.value || "0");
      if (name.includes("Total")) {
        sectionTotal = amount;
      }
    }
  }

  return sectionTotal;
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
      const total = extractAccounts(sectionRows, income);
      // Also check section summary for total
      if (section?.Summary?.ColData) {
        const cols = section.Summary.ColData;
        const name = cols[0]?.value || "";
        if (name.includes("Total")) {
          totalIncome = parseFloat(cols[1]?.value || "0");
        }
      }
      if (totalIncome === 0) {
        totalIncome = total;
      }
    } else if (sectionType === "Expenses") {
      const total = extractAccounts(sectionRows, expenses);
      // Also check section summary for total
      if (section?.Summary?.ColData) {
        const cols = section.Summary.ColData;
        const name = cols[0]?.value || "";
        if (name.includes("Total")) {
          totalExpenses = parseFloat(cols[1]?.value || "0");
        }
      }
      if (totalExpenses === 0) {
        totalExpenses = total;
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
  const row = await loadRow().catch(() => null);
  return !!row && row.refreshTokenExpiresAt > new Date();
}
