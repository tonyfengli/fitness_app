import { initAuth } from "./src/index";

// Export the auth configuration for Better Auth CLI
export const auth = initAuth({
  baseUrl: process.env.AUTH_URL || "http://localhost:3000",
  secret: process.env.AUTH_SECRET || "supersecret",
});
