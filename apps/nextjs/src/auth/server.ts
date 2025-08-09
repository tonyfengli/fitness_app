import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { initAuth } from "@acme/auth";

import { env } from "~/env";

// Use a dynamic approach for Better Auth to accept requests from any Vercel URL
const baseUrl = "http://localhost:3000"; // This is just for initialization

// Removed auth server initialization logging

export const auth = initAuth({
  baseUrl,
  productionUrl: `https://${env.VERCEL_PROJECT_PRODUCTION_URL ?? "turbo.t3.gg"}`,
  secret: env.AUTH_SECRET,
});

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
