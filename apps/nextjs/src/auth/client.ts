import { createAuthClient } from "better-auth/react";

// Use the same URL as the current page to avoid CORS issues
const baseURL = typeof window !== 'undefined' 
  ? window.location.origin
  : "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    credentials: 'include', // Ensure cookies are sent with requests
  },
});
