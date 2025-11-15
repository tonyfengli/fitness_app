import { pgTable } from "drizzle-orm/pg-core";

export const oauthTokens = pgTable("oauth_tokens", (t) => ({
  id: t.serial().primaryKey(),
  service: t.varchar({ length: 50 }).notNull().unique(),
  accessToken: t.text("access_token").notNull(),
  refreshToken: t.text("refresh_token").notNull(),
  expiresAt: t.timestamp("expires_at"),
  createdAt: t.timestamp("created_at").defaultNow().notNull(),
  updatedAt: t.timestamp("updated_at").defaultNow().notNull(),
}));