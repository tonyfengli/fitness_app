// Read-only: can this environment's QUICKBOOKS_TOKEN_KEY decrypt the stored tokens? Prints no token values.
import { loadTokens, isQuickBooksConnected } from "~/lib/quickbooks";
console.log("connected (row present, not expired):", await isQuickBooksConnected());
const t = await loadTokens();
console.log("decrypt with local key:", t ? "ok" : "FAILED (or no row)");
if (t) console.log("access token expires:", t.accessTokenExpiresAt, "| refresh token expires:", t.refreshTokenExpiresAt);
process.exit(0);
