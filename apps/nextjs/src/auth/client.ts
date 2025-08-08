import { createAuthClient } from "better-auth/react";

// Use the same URL as the current page to avoid CORS issues
const baseURL = typeof window !== 'undefined' 
  ? window.location.origin
  : "http://localhost:3000";

// Keep essential debug logging
if (typeof window !== 'undefined') {
  console.log('[Auth Client] Using baseURL:', baseURL);
}

export const authClient = createAuthClient({
  baseURL,
});
