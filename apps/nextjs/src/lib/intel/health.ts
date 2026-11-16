/**
 * Is the intel collection healthy? Read by /api/agent/intel/health, which the Mac Mini's nightly
 * check calls so a problem reaches the health Slack channel. A problem is any of:
 *   - the latest pull failed
 *   - no pull has been stored for over 9 days (the weekly pull is overdue)
 *   - the latest pull stored no rows, or came back with under 80% of the accounts asked for
 *   - a run has been open for over 6 hours (the hourly store job is not running)
 *   - this month's spend is over the cap
 * Switched off on purpose (INTEL_COLLECTION_ENABLED) is reported, not a problem.
 */

import { and, desc, eq, ne } from "@acme/db";
import { db } from "@acme/db/client";
import { IntelRun } from "@acme/db/schema";

import { getGymBusinessId } from "../business";
import { monthSpendUsd } from "./collect";
import { collectionEnabled, monthlyCapUsd, RUN_TIMEOUT_HOURS } from "./config";

const OVERDUE_DAYS = 9;
const MIN_ACCOUNT_SHARE = 0.8;

export interface IntelHealth {
  ok: boolean;
  enabled: boolean;
  problems: string[];
  monthSpendUsd: number;
  monthCapUsd: number;
  /** The newest run of each part of the pull (posts, profiles) */
  latest: { actor: string | null; kind: string; status: string; startedAt: string; accountsRequested: number; accountsReturned: number | null; rowsInserted: number | null; costUsd: number | null; error: string | null }[];
}

export async function intelHealth(now = new Date()): Promise<IntelHealth> {
  const businessId = await getGymBusinessId();
  const runs = await db
    .select()
    .from(IntelRun)
    .where(and(eq(IntelRun.businessId, businessId), ne(IntelRun.kind, "backfill")))
    .orderBy(desc(IntelRun.startedAt))
    .limit(40);
  // Newest first, so the first run seen for each actor is its latest
  const latest = [...new Map([...runs].reverse().map((r) => [r.actor ?? "", r])).values()].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  const enabled = collectionEnabled();
  const spent = await monthSpendUsd(businessId, now);
  const cap = monthlyCapUsd();
  const problems: string[] = [];
  const ageDays = (d: Date) => (now.getTime() - d.getTime()) / 86_400_000;

  if (spent > cap) problems.push(`This month's spend is $${spent.toFixed(2)}, over the $${cap} cap`);
  if (enabled) {
    if (!runs.length) problems.push("No pull has ever run");
    const lastStored = runs.find((r) => r.status === "ingested");
    if (runs.length && (!lastStored || ageDays(lastStored.startedAt) > OVERDUE_DAYS)) {
      problems.push(lastStored ? `The weekly pull is overdue: the last one stored was ${ageDays(lastStored.startedAt).toFixed(0)} days ago` : "No pull has ever been stored");
    }
    for (const r of latest) {
      const name = r.actor ?? "run";
      if (r.status === "failed") problems.push(`${name}: the latest pull failed (${r.error ?? "no reason recorded"})`);
      else if (r.status !== "ingested") {
        if (ageDays(r.startedAt) * 24 > RUN_TIMEOUT_HOURS) problems.push(`${name}: still open after ${(ageDays(r.startedAt) * 24).toFixed(0)} hours; the store job may not be running`);
      } else {
        if (!r.rowsInserted) problems.push(`${name}: the latest pull stored no rows`);
        if (r.accountsRequested > 0 && (r.accountsReturned ?? 0) / r.accountsRequested < MIN_ACCOUNT_SHARE) {
          problems.push(`${name}: only ${r.accountsReturned ?? 0} of ${r.accountsRequested} accounts came back`);
        }
      }
    }
  }

  return {
    ok: problems.length === 0,
    enabled,
    problems,
    monthSpendUsd: Math.round(spent * 100) / 100,
    monthCapUsd: cap,
    latest: latest.map((r) => ({
      actor: r.actor,
      kind: r.kind,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      accountsRequested: r.accountsRequested,
      accountsReturned: r.accountsReturned,
      rowsInserted: r.rowsInserted,
      costUsd: r.costUsd === null ? null : Number(r.costUsd),
      error: r.error,
    })),
  };
}
