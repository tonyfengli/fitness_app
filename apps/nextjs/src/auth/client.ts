import { createAuthClient } from "better-auth/react";

// Use the same URL as the current page to avoid CORS issues
const baseURL = typeof window !== 'undefined' 
  ? window.location.origin
  : "http://localhost:3000";

// Enhanced debug logging
if (typeof window !== 'undefined') {
  console.log('Auth Client Debug:', {
    baseURL,
    origin: window.location.origin,
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    port: window.location.port,
    href: window.location.href,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
      NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
    }
  });
}

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    credentials: 'include', // Ensure cookies are sent with requests
    headers: {
      'Content-Type': 'application/json',
    },
  },
});
