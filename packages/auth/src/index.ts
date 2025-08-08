import type { BetterAuthOptions } from "better-auth";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";

import { db } from "@acme/db/client";

export function initAuth(options: {
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;
}) {
  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    // Don't set a fixed baseURL - let Better Auth determine it from the request
    baseURL: undefined,
    secret: options.secret,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 6, // Allow shorter passwords for development
    },
    plugins: [
      expo(),
    ],
    user: {
      additionalFields: {
        phone: {
          type: "string",
          required: false,
        },
        role: {
          type: "string",
          required: true,
          defaultValue: "client",
        },
        businessId: {
          type: "string",
          required: true,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // Update session if older than 1 day
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // Cache for 5 minutes
      }
    },
    advanced: {
      cookiePrefix: "better-auth",
      database: {
        generateId: () => {
          // Generate a unique ID for sessions and other entities
          return Math.random().toString(36).substring(2) + Date.now().toString(36);
        },
      },
      useSecureCookies: process.env.NODE_ENV === "production",
      crossSubDomainCookies: {
        enabled: false,
      },
    },
    trustedOrigins: [
      "expo://",
      // Allow all Vercel preview URLs
      "https://*.vercel.app",
      // Allow the production URL
      options.productionUrl,
      // Allow localhost for development
      "http://localhost:3000",
    ],
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
