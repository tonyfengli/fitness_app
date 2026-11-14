/**
 * Keeps the Notion "Monthly KPIs" page for a month in step with the dashboard (lib/kpi-notion.ts).
 * Called after the response (next/server `after`) whenever a month's status changes:
 *   - Overview "Mark as Final" / "Reopen for Editing": PATCH /api/kpi/snapshot;
 *   - P&L "Finalized" chip on or off: PATCH /api/pnl/snapshots.
 * The page says Final or Draft for each, so a reopened month shows as Draft until it's
 * finalized again (Tony, Nov 14 2026: no button, Notion follows the finalize state).
 *
 * The latest saved month also gets the live Retention and Team views, "as of" the update.
 * They come from the same /api/agent/* handlers the dashboard and the bot use, called
 * in-process. Older months get membership, revenue and P&L only: their live state is gone.
 *
 * Server-only (it imports route handlers). Scripts use lib/kpi-notion.ts directly.
 * Never throws: a Notion failure must not break finalizing. Failures are logged.
 */

import { NextRequest } from "next/server";

import { GET as atRiskGET } from "~/app/api/agent/at-risk/route";
import { GET as classesGET } from "~/app/api/agent/classes/route";
import { GET as frequencyGET } from "~/app/api/agent/frequency-alerts/route";
import { GET as milestonesGET } from "~/app/api/agent/milestones/route";
import { GET as newMembersGET } from "~/app/api/agent/new-members/route";
import { GET as paymentsGET } from "~/app/api/agent/payments/route";
import { GET as reviewGET } from "~/app/api/agent/tasks/review/route";
import { getDerivedKpi } from "~/lib/kpi-derived";
import { buildMonthReport, sendReport, type LiveViews } from "~/lib/kpi-notion";

type Handler = (req: NextRequest) => Promise<Response>;

/** One live view: the agent route's JSON, or why it failed */
async function view(handler: Handler, path: string): Promise<Record<string, unknown> | string> {
  try {
    const req = new NextRequest(new URL(path, "https://internal.local"), { headers: { "X-OPENCLAW-API-KEY": process.env.OPENCLAW_API_KEY ?? "" } });
    const res = await handler(req);
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return String(data.error ?? data.message ?? `HTTP ${res.status}`);
    return data;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

async function liveViews(): Promise<LiveViews> {
  const [atRisk, frequency, newMembers, payments, milestones, classes, team] = await Promise.all([
    view(atRiskGET, "/api/agent/at-risk"),
    view(frequencyGET, "/api/agent/frequency-alerts"),
    view(newMembersGET, "/api/agent/new-members"),
    view(paymentsGET, "/api/agent/payments"),
    view(milestonesGET, "/api/agent/milestones"),
    view(classesGET, "/api/agent/classes"),
    view(reviewGET as Handler, "/api/agent/tasks/review"),
  ]);
  return { at: new Date(), atRisk, frequency, newMembers, payments, milestones, classes, team };
}

/** Write (or rewrite) one month's Notion page. Skips quietly when Notion isn't configured or the month has no KPI snapshot. */
export async function syncMonthToNotion(year: number, month: number, reason: string): Promise<void> {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_KPI_DATA_SOURCE_ID) return;
  try {
    const { months } = await getDerivedKpi();
    if (!months.some((m) => m.year === year && m.month === month)) {
      console.log(`[kpi-notion] ${year}-${month}: no KPI snapshot yet, not sent (${reason})`);
      return;
    }
    const latest = months[months.length - 1]!;
    const isLatest = latest.year === year && latest.month === month;
    const report = await buildMonthReport(year, month, isLatest ? await liveViews() : undefined);
    const sent = await sendReport(report);
    console.log(`[kpi-notion] ${reason}: ${report.summary} → ${sent.created ? "created" : "updated"} ${sent.url}`);
  } catch (err) {
    console.error(`[kpi-notion] ${year}-${month} (${reason}) failed:`, err instanceof Error ? err.message : err);
  }
}
