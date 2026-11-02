// Read-only against QuickBooks: one P&L pull (refreshes the access token if needed). Prints totals only.
import { fetchProfitAndLoss, loadTokens } from "~/lib/quickbooks";
const before = (await loadTokens())?.accessTokenExpiresAt;
const r = await fetchProfitAndLoss("2026-09-01", "2026-09-30");
console.log("Sep P&L:", r ? `income ${r.totalIncome}, expenses ${r.totalExpenses}` : "FAILED");
console.log("access token expiry before/after:", before, "→", (await loadTokens())?.accessTokenExpiresAt);
process.exit(0);
