import { createAuthClient } from "better-auth/react";
import { env } from "~/env";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_VERCEL_ENV === "production"
    ? `https://${env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
    : env.NEXT_PUBLIC_VERCEL_ENV === "preview"
      ? `https://${env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000",
  fetchOptions: {
    credentials: 'include', // Ensure cookies are sent with requests
  },
});
