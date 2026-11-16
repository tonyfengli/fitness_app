/**
 * The intel collection: start what is due, and store what has finished.
 *   launchDue  (cron intel-start)  writes an intel_run row, then starts the scraper and returns
 *   pollRuns   (cron intel-poll)   reads finished runs into the tables; fails runs that never end
 * Storing is safe to repeat: a run read twice adds nothing the second time. Spending is held by
 * a cap on each run and a monthly cap checked before every start (config.ts).
 * Instagram only for now. Docs: ai-crew/docs/INTEL-COLLECTION.md.
 */

import { and, desc, eq, gte, inArray, isNotNull, ne, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { IntelAccount, IntelAccountSnapshot, IntelPost, IntelPostSnapshot, IntelRun } from "@acme/db/schema";

import { APIFY_DONE, getApifyItems, getApifyRun, startApifyRun } from "../apify";
import { getGymBusinessId } from "../business";
import { CATCH_UP_AFTER_DAYS, collectionEnabled, INSTAGRAM, MIN_DAYS_BETWEEN_PULLS, monthlyCapUsd, RUN_TIMEOUT_HOURS, runCapUsd, TIME_ZONE } from "./config";
import { isPostItem, isProfileItem, profileUrl, toPost, toProfile } from "./instagram";
import type { PostRow, ProfileRow } from "./instagram";

const DAY = 86_400_000;
const round = (usd: number) => Math.round(usd * 10_000) / 10_000;
const pacificWeekday = (d: Date) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(d));

/** What scheduled and manual runs have cost this calendar month (UTC). Backfills are not counted. */
export async function monthSpendUsd(businessId: string, now = new Date()): Promise<number> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${IntelRun.costUsd}), 0)` })
    .from(IntelRun)
    .where(and(eq(IntelRun.businessId, businessId), ne(IntelRun.kind, "backfill"), gte(IntelRun.startedAt, monthStart)));
  return Number(row?.total ?? 0);
}

export interface LaunchResult {
  enabled: boolean;
  applied: boolean;
  due: boolean;
  reason: string;
  accounts: number;
  estimateUsd: number;
  monthSpendUsd: number;
  monthCapUsd: number;
  started: { runId: string; part: string; apifyRunId: string | null; capUsd: number }[];
}

/**
 * Starts the weekly Instagram pull when it is due: on the set Pacific weekday, or on any day
 * once the last pull is over a week old. `force` starts one now, as a manual run (a founder's
 * "collect now"). With apply false it only reports.
 */
export async function launchDue(opts: { apply: boolean; force?: boolean; now?: Date }): Promise<LaunchResult> {
  const now = opts.now ?? new Date();
  const businessId = await getGymBusinessId();
  const accounts = await db
    .select({ id: IntelAccount.id, handle: IntelAccount.instagramHandle })
    .from(IntelAccount)
    .where(and(eq(IntelAccount.businessId, businessId), eq(IntelAccount.active, true), isNotNull(IntelAccount.instagramHandle)));

  const [last] = await db
    .select({ startedAt: IntelRun.startedAt })
    .from(IntelRun)
    // A pull started by hand counts too: "collect now" on Saturday means Monday's is not needed
    .where(and(eq(IntelRun.businessId, businessId), eq(IntelRun.source, "instagram"), ne(IntelRun.kind, "backfill"), ne(IntelRun.status, "failed")))
    .orderBy(desc(IntelRun.startedAt))
    .limit(1);
  const daysSince = last ? (now.getTime() - last.startedAt.getTime()) / DAY : Infinity;

  // One result per post and one per profile
  const estimateUsd = round(accounts.length * (INSTAGRAM.postsPerAccount + 1) * INSTAGRAM.usdPerResult);
  const spent = await monthSpendUsd(businessId, now);
  const cap = monthlyCapUsd();
  const result: LaunchResult = { enabled: collectionEnabled(), applied: false, due: false, reason: "", accounts: accounts.length, estimateUsd, monthSpendUsd: round(spent), monthCapUsd: cap, started: [] };

  if (!accounts.length) return { ...result, reason: "No active accounts with an Instagram handle" };
  if (opts.force) result.due = true;
  else if (daysSince < MIN_DAYS_BETWEEN_PULLS) return { ...result, reason: `Last pull was ${daysSince.toFixed(1)} days ago` };
  else if (pacificWeekday(now) === INSTAGRAM.weekday || daysSince >= CATCH_UP_AFTER_DAYS) result.due = true;
  else return { ...result, reason: "Not the pull day" };

  if (!result.enabled) return { ...result, reason: "Due, but collection is off (INTEL_COLLECTION_ENABLED)" };
  if (spent + estimateUsd > cap) return { ...result, reason: `Due, but it would pass the monthly cap ($${round(spent)} spent + $${estimateUsd} > $${cap})` };
  if (!opts.apply) return { ...result, reason: "Due; dry run, nothing started" };

  const urls = accounts.map((a) => profileUrl(a.handle!));
  const accountIds = accounts.map((a) => a.id);
  const parts = [
    { part: "posts", input: { directUrls: urls, resultsType: "posts", resultsLimit: INSTAGRAM.postsPerAccount }, estimate: accounts.length * INSTAGRAM.postsPerAccount * INSTAGRAM.usdPerResult },
    { part: "profiles", input: { directUrls: urls, resultsType: "details", resultsLimit: 1 }, estimate: accounts.length * INSTAGRAM.usdPerResult },
  ];
  for (const p of parts) {
    // The row first, so a run that never comes back is still on record
    const [row] = await db
      .insert(IntelRun)
      .values({ businessId, source: "instagram", kind: opts.force ? "manual" : "scheduled", status: "launching", actor: `${INSTAGRAM.actor} (${p.part})`, accountIds, accountsRequested: accounts.length, startedAt: now })
      .returning({ id: IntelRun.id });
    const capUsd = runCapUsd(p.estimate);
    try {
      const run = await startApifyRun(INSTAGRAM.actor, p.input, { maxTotalChargeUsd: capUsd });
      await db.update(IntelRun).set({ status: "running", apifyRunId: run.id, apifyDatasetId: run.defaultDatasetId }).where(eq(IntelRun.id, row!.id));
      result.started.push({ runId: row!.id, part: p.part, apifyRunId: run.id, capUsd });
    } catch (err) {
      await db.update(IntelRun).set({ status: "failed", error: (err instanceof Error ? err.message : String(err)).slice(0, 500), finishedAt: new Date() }).where(eq(IntelRun.id, row!.id));
      result.started.push({ runId: row!.id, part: p.part, apifyRunId: null, capUsd });
    }
  }
  return { ...result, applied: true, reason: opts.force ? "Started now (manual)" : "Started" };
}

/** Rows in chunks, so one statement never carries thousands of values */
async function inChunks<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<number>): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += size) n += await fn(rows.slice(i, i + size));
  return n;
}

/**
 * Stores one finished run's items. Posts and profiles from accounts not asked for are ignored.
 * Returns the rows added (0 when the run was already stored) and how many accounts had data.
 */
export async function storeInstagramItems(run: { id: string; businessId: string; accountIds: string[] }, items: Record<string, unknown>[], capturedAt: Date) {
  const accounts = run.accountIds.length
    ? await db.select({ id: IntelAccount.id, handle: IntelAccount.instagramHandle }).from(IntelAccount).where(inArray(IntelAccount.id, run.accountIds))
    : [];
  const idByHandle = new Map(accounts.filter((a) => a.handle).map((a) => [a.handle!.toLowerCase(), a.id]));

  const profiles = items.filter(isProfileItem).map(toProfile).filter((p): p is ProfileRow => !!p && idByHandle.has(p.handle));
  // The same post can come back twice (a pinned post, a collaboration): keep the first
  const posts = [...new Map(items.filter(isPostItem).map(toPost).filter((p): p is PostRow => !!p && idByHandle.has(p.handle)).map((p) => [p.externalId, p])).values()];
  const returned = new Set([...profiles, ...posts].map((r) => r.handle));
  let inserted = 0;

  inserted += await inChunks(profiles, 500, async (chunk) => {
    const rows = await db
      .insert(IntelAccountSnapshot)
      .values(chunk.map((p) => ({ businessId: run.businessId, accountId: idByHandle.get(p.handle)!, runId: run.id, source: "instagram" as const, capturedAt, followers: p.followers, following: p.following, postCount: p.postCount, raw: p.raw })))
      .onConflictDoNothing()
      .returning({ id: IntelAccountSnapshot.id });
    return rows.length;
  });

  inserted += await inChunks(posts, 200, async (chunk) => {
    const added = await db
      .insert(IntelPost)
      .values(
        chunk.map((p) => ({
          businessId: run.businessId,
          accountId: idByHandle.get(p.handle)!,
          platform: "instagram" as const,
          origin: "tracked" as const,
          externalId: p.externalId,
          mediaId: p.mediaId,
          authorHandle: p.authorHandle,
          type: p.type,
          postedAt: p.postedAt,
          caption: p.caption,
          url: p.url,
          durationSeconds: p.durationSeconds,
          audio: p.audio,
          firstRunId: run.id,
          firstSeenAt: capturedAt,
          raw: p.raw,
        })),
      )
      .onConflictDoNothing({ target: [IntelPost.businessId, IntelPost.platform, IntelPost.externalId] })
      .returning({ id: IntelPost.id });
    const known = await db
      .select({ id: IntelPost.id, externalId: IntelPost.externalId })
      .from(IntelPost)
      .where(and(eq(IntelPost.businessId, run.businessId), eq(IntelPost.platform, "instagram"), inArray(IntelPost.externalId, chunk.map((p) => p.externalId))));
    const postId = new Map(known.map((k) => [k.externalId, k.id]));
    const snaps = await db
      .insert(IntelPostSnapshot)
      .values(chunk.filter((p) => postId.has(p.externalId)).map((p) => ({ businessId: run.businessId, postId: postId.get(p.externalId)!, runId: run.id, capturedAt, likes: p.likes, comments: p.comments, views: p.views, pinned: p.pinned })))
      .onConflictDoNothing({ target: [IntelPostSnapshot.runId, IntelPostSnapshot.postId] })
      .returning({ id: IntelPostSnapshot.id });
    return added.length + snaps.length;
  });

  return { inserted, accountsReturned: returned.size, posts: posts.length, profiles: profiles.length };
}

export interface PollResult {
  applied: boolean;
  checked: number;
  runs: { runId: string; actor: string | null; outcome: string; rowsInserted?: number; accountsReturned?: number; costUsd?: number }[];
}

/** Reads every unfinished run: stores the ones Apify has finished, fails the ones that never will */
export async function pollRuns(opts: { apply: boolean; now?: Date }): Promise<PollResult> {
  const now = opts.now ?? new Date();
  const open = await db.select().from(IntelRun).where(inArray(IntelRun.status, ["launching", "running"]));
  const result: PollResult = { applied: opts.apply, checked: open.length, runs: [] };

  for (const run of open) {
    const ageHours = (now.getTime() - run.startedAt.getTime()) / 3_600_000;
    const fail = async (error: string) => {
      if (opts.apply) await db.update(IntelRun).set({ status: "failed", error: error.slice(0, 500), finishedAt: now }).where(eq(IntelRun.id, run.id));
      result.runs.push({ runId: run.id, actor: run.actor, outcome: `failed: ${error}` });
    };
    try {
      if (!run.apifyRunId) {
        // The row was written but the scraper never started (the start call died in between)
        if (ageHours > 0.25) await fail("The scraper was never started");
        else result.runs.push({ runId: run.id, actor: run.actor, outcome: "still launching" });
        continue;
      }
      const remote = await getApifyRun(run.apifyRunId);
      if (!APIFY_DONE.includes(remote.status)) {
        if (ageHours > RUN_TIMEOUT_HOURS) await fail(`Not finished after ${RUN_TIMEOUT_HOURS} hours (Apify status ${remote.status})`);
        else result.runs.push({ runId: run.id, actor: run.actor, outcome: `waiting (${remote.status})` });
        continue;
      }
      if (remote.status !== "SUCCEEDED") {
        await fail(`Apify ${remote.status}${remote.statusMessage ? `: ${remote.statusMessage}` : ""}`);
        continue;
      }
      const items = await getApifyItems(remote.defaultDatasetId);
      const costUsd = round(remote.usageTotalUsd ?? 0);
      if (!opts.apply) {
        result.runs.push({ runId: run.id, actor: run.actor, outcome: `finished, ${items.length} items to store (dry run)`, costUsd });
        continue;
      }
      const capturedAt = remote.finishedAt ? new Date(remote.finishedAt) : now;
      const stored = await storeInstagramItems({ id: run.id, businessId: run.businessId, accountIds: run.accountIds }, items, capturedAt);
      await db
        .update(IntelRun)
        .set({ status: "ingested", accountsReturned: stored.accountsReturned, rowsInserted: stored.inserted, costUsd: String(costUsd), finishedAt: now, error: null })
        .where(eq(IntelRun.id, run.id));
      result.runs.push({ runId: run.id, actor: run.actor, outcome: "stored", rowsInserted: stored.inserted, accountsReturned: stored.accountsReturned, costUsd });
    } catch (err) {
      // A network or database error: leave the run open, the next poll tries again
      result.runs.push({ runId: run.id, actor: run.actor, outcome: `error, will retry: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // Apify settles a run's cost a little after it finishes: bring recent runs' cost up to date
  if (opts.apply) {
    const recent = await db
      .select({ id: IntelRun.id, apifyRunId: IntelRun.apifyRunId, costUsd: IntelRun.costUsd })
      .from(IntelRun)
      .where(and(eq(IntelRun.status, "ingested"), isNotNull(IntelRun.apifyRunId), gte(IntelRun.finishedAt, new Date(now.getTime() - 2 * DAY))));
    for (const r of recent) {
      try {
        const cost = round((await getApifyRun(r.apifyRunId!)).usageTotalUsd ?? 0);
        if (cost > Number(r.costUsd ?? 0)) await db.update(IntelRun).set({ costUsd: String(cost) }).where(eq(IntelRun.id, r.id));
      } catch {
        // Cost is refreshed again on the next poll
      }
    }
  }
  return result;
}
