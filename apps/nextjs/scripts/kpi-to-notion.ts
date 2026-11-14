/**
 * Backfill the Notion "Monthly KPIs" database (lib/kpi-notion.ts) for a range of months:
 * membership, revenue and P&L, the same page that marking a month Final writes, without the
 * live Retention and Team views (those only exist for "now"; send the latest month from the
 * dashboard to get them).
 *
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/kpi-to-notion.ts 2026 1 10            # dry run: what would be sent
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/kpi-to-notion.ts 2026 1 10 --apply    # send
 *
 * Re-running replaces each month's page. The dry run prints counts only, never names.
 */

import { buildMonthReport, sendReport } from "~/lib/kpi-notion";

const [year, from, to] = process.argv.slice(2, 5).map(Number);
const apply = process.argv.includes("--apply");
if (!year || !from || !to || from < 1 || to > 12 || from > to) {
  console.error("Usage: kpi-to-notion.ts <year> <fromMonth> <toMonth> [--apply]");
  process.exit(1);
}

for (let month = from!; month <= to!; month++) {
  try {
    const report = await buildMonthReport(year!, month);
    if (!apply) {
      console.log(`would send  ${report.summary}`);
      continue;
    }
    const sent = await sendReport(report);
    console.log(`${sent.created ? "created" : "updated"}  ${report.summary}  ${sent.url}`);
  } catch (err) {
    console.log(`skipped     ${year}-${String(month).padStart(2, "0")}: ${err instanceof Error ? err.message : err}`);
  }
}
if (!apply) console.log("\nDry run. Add --apply to send.");
process.exit(0);
