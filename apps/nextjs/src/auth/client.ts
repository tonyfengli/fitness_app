import { createAuthClient } from "better-auth/react";
import { env } from "~/env";

// Debug logging
if (typeof window !== 'undefined') {
  console.log('Auth Client Environment:', {
    NEXT_PUBLIC_VERCEL_ENV: env.NEXT_PUBLIC_VERCEL_ENV,
    NEXT_PUBLIC_VERCEL_URL: env.NEXT_PUBLIC_VERCEL_URL,
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  });
}

// Temporary fix - use window.location.origin
const baseURL = typeof window !== 'undefined' 
  ? window.location.origin
  : "http://localhost:3000";

// Log the final URL
if (typeof window !== 'undefined') {
  console.log('Auth baseURL:', baseURL);
}

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    credentials: 'include', // Ensure cookies are sent with requests
  },
});
