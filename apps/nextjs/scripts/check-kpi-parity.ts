/**
 * Parity check: the agent routes' membership numbers (getDerivedKpi, from saved
 * snapshots) against the KPI dashboard Overview as Tony read it off the screen.
 * Add a month here after finalizing it. Exits 1 on any mismatch.
 *
 * Run from apps/nextjs with the database env loaded:
 *   npx tsx --tsconfig tsconfig.json scripts/check-kpi-parity.ts
 *
 * CI (.github/workflows/kpi-parity.yml) runs it with the KPI_PARITY_POSTGRES_URL secret:
 * a role that can only SELECT kpi_monthly_snapshot, kpi_member_override and kpi_billing_link.
 */

import { getDerivedKpi } from "~/lib/kpi-derived";

// [new, lost, members] per month, from the Overview's Member Details (start: Jan 2026)
const DASHBOARD: Record<string, [number, number, number]> = {
  "2026-01": [22, 0, 22],
  "2026-02": [6, 1, 27],
  "2026-03": [1, 1, 27],
  "2026-04": [4, 2, 29],
  "2026-05": [3, 2, 30],
  "2026-06": [4, 5, 29],
  "2026-07": [2, 6, 25],
  "2026-08": [2, 1, 26],
  "2026-09": [9, 2, 33],
  "2026-10": [7, 1, 39],
};

async function main() {
  const { months, gaps } = await getDerivedKpi();
  if (gaps.length) console.log("Missing months:", gaps.join(", "));

  let failures = 0;
  for (const [key, expected] of Object.entries(DASHBOARD)) {
    const m = months.find((x) => `${x.year}-${String(x.month).padStart(2, "0")}` === key);
    const got = m ? [m.derived.filteredNewCount, m.derived.filteredLostCount, m.derived.derivedTotalMembers] : null;
    const ok = !!got && got.every((v, i) => v === expected[i]);
    if (!ok) failures++;
    console.log(`${key}  dashboard ${expected.join("/")}  agent ${got?.join("/") ?? "no snapshot"}  ${ok ? "OK" : "MISMATCH"}`);
  }
  console.log(failures ? `${failures} month(s) differ` : "All months match the dashboard");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
