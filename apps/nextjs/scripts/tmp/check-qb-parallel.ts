// Read-only: 10 monthly P&L pulls in parallel, like the reconciliation route. Prints status only.
import { fetchProfitAndLoss } from "~/lib/quickbooks";
const months = Array.from({ length: 10 }, (_, i) => i + 1);
const res = await Promise.all(months.map(m => {
  const mm = String(m).padStart(2, "0"); const last = new Date(2026, m, 0).getDate();
  return fetchProfitAndLoss(`2026-${mm}-01`, `2026-${mm}-${last}`).then(r => [m, r ? "ok" : "FAILED"]);
}));
console.log(res.map(([m, s]) => `${m}:${s}`).join("  "));
process.exit(0);
