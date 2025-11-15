import { db, eq, oauthTokens } from "@acme/db";

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt?: Date;
}

export interface TokenStorageService {
  getTokens(service: string): Promise<TokenData | null>;
  updateTokens(service: string, tokens: TokenData): Promise<void>;
}

/**
 * Database-based token storage for production
 */
class DatabaseTokenStorage implements TokenStorageService {
  async getTokens(service: string): Promise<TokenData | null> {
    const result = await db
      .select({
        accessToken: oauthTokens.accessToken,
        refreshToken: oauthTokens.refreshToken,
        expiresAt: oauthTokens.expiresAt,
      })
      .from(oauthTokens)
      .where(eq(oauthTokens.service, service))
      .limit(1);

    if (!result[0]) {
      return null;
    }

    const token = result[0];
    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt || undefined,
    };
  }

  async updateTokens(service: string, tokens: TokenData): Promise<void> {
    await db
      .insert(oauthTokens)
      .values({
        service,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: oauthTokens.service,
        set: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          updatedAt: new Date(),
        },
      });
  }
}

/**
 * Factory function to create database token storage
 */
export function createTokenStorage(): TokenStorageService {
  return new DatabaseTokenStorage();
}