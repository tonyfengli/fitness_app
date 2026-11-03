/**
 * Parity check: the agent routes' numbers (getDerivedKpi, from saved snapshots) against
 * what the KPI dashboard Overview showed. For each finalized month that has approved
 * numbers (saved by "Mark as Final"), compares new/lost/members, revenue, ARM and churn.
 * Months finalized before that existed use the DASHBOARD numbers below, read off the
 * screen. Exits 1 on any mismatch.
 *
 * Run from apps/nextjs with the database env loaded:
 *   npx tsx --tsconfig tsconfig.json scripts/check-kpi-parity.ts
 *
 * CI (.github/workflows/kpi-parity.yml) runs it with the KPI_PARITY_POSTGRES_URL secret:
 * a role that can only SELECT kpi_monthly_snapshot, kpi_member_override and kpi_billing_link.
 */

import { getDerivedKpi } from "~/lib/kpi-derived";

// [new, lost, members] per month, from the Overview's Member Details (start: Jan 2026).
// Only used for months without approved numbers.
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

  const keyOf = (m: { year: number; month: number }) => `${m.year}-${String(m.month).padStart(2, "0")}`;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  let failures = 0;
  const report = (key: string, source: string, expected: number[], got: (number | null)[] | null) => {
    const ok = !!got && got.every((v, i) => v === expected[i]);
    if (!ok) failures++;
    console.log(`${key}  ${source} ${expected.join("/")}  agent ${got?.join("/") ?? "no snapshot"}  ${ok ? "OK" : "MISMATCH"}`);
  };

  // Finalized months with approved numbers: new/lost/members/revenue/ARM/churn
  const approvedKeys = new Set<string>();
  for (const m of months) {
    const a = m.status === "finalized" ? m.approved : undefined;
    if (!a) continue;
    approvedKeys.add(keyOf(m));
    const d = m.derived;
    report(keyOf(m), "approved", [a.newMembers, a.lostMembers, a.totalMembers, a.totalRevenue, a.arm, a.churnRate ?? -1], [
      d.filteredNewCount,
      d.filteredLostCount,
      d.derivedTotalMembers,
      round2(d.totalRevenue),
      d.derivedTotalMembers > 0 ? round2(d.totalRevenue / d.derivedTotalMembers) : 0,
      m.prevDerivedTotal ? round2((d.filteredLostCount / m.prevDerivedTotal) * 100) : -1,
    ]);
  }

  // Older months: numbers read off the dashboard
  for (const [key, expected] of Object.entries(DASHBOARD)) {
    if (approvedKeys.has(key)) continue;
    const m = months.find((x) => keyOf(x) === key);
    report(key, "dashboard", expected, m ? [m.derived.filteredNewCount, m.derived.filteredLostCount, m.derived.derivedTotalMembers] : null);
  }

  // A finalized month with neither is unchecked: say so
  for (const m of months) {
    if (m.status === "finalized" && !approvedKeys.has(keyOf(m)) && !(keyOf(m) in DASHBOARD)) {
      console.log(`${keyOf(m)}  not checked: finalized before approved numbers were saved. Reopen and Mark as Final again to check it.`);
    }
  }
  console.log(failures ? `${failures} month(s) differ` : "All months match the dashboard");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
