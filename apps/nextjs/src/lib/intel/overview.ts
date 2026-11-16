/**
 * The competitor overview: where each tracked account stands, what moved since the pull before,
 * and the posts furthest above and below their own account's normal. Every number on the
 * Competitors tab (and later the bot's answers) comes from here.
 *
 * "Normal" is an account's own median over the last 90 days: plays for reels, likes for
 * images and carousels. A post's score is its number divided by that normal, so a small gym's
 * good post and a big gym's good post compare fairly. Posts younger than 4 days are left out
 * (still growing), and an account needs 3 posts of a kind before that kind has a normal.
 */

import { and, eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { IntelAccount, IntelRun } from "@acme/db/schema";

import { getGymBusinessId } from "../business";

const DAY = 86_400_000;
const NORMAL_WINDOW_DAYS = 90;
const RATE_WINDOW_DAYS = 28;
const MIN_POST_AGE_DAYS = 4;
const MIN_FOR_NORMAL = 3;
/** "Since the last pulse": the comparison snapshot is the newest one at least this much older */
const MIN_DAYS_BETWEEN_SNAPSHOTS = 5;
const HIGHLIGHTS = 5;

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface OverviewAccount {
  key: string;
  name: string;
  kind: "own" | "franchisor" | "inspiration" | "competitor";
  handle: string | null;
  followers: number | null;
  /** Followers gained or lost since the comparison pull; null until there are two pulls */
  followersChange: number | null;
  postsPerWeek: number | null;
  typicalReelPlays: number | null;
  typicalLikes: number | null;
  /** Typical reel plays for every 100 followers: reach against size */
  playsPer100Followers: number | null;
}

export interface OverviewPost {
  accountKey: string;
  accountName: string;
  kind: OverviewAccount["kind"];
  type: "reel" | "carousel" | "image";
  postedAt: string;
  caption: string;
  url: string;
  /** "plays" for a reel, "likes" otherwise */
  metric: "plays" | "likes";
  value: number;
  /** value ÷ the account's normal for that kind of post */
  score: number;
}

export interface IntelOverview {
  /** When the newest stored pull was captured; null when nothing has been collected */
  asOf: string | null;
  /** The pull the changes are measured against; null until there are two */
  comparedTo: string | null;
  pulls: number;
  accounts: OverviewAccount[];
  /** Tracked accounts with an Instagram handle that returned nothing in the newest pull */
  missing: string[];
  wins: OverviewPost[];
  flops: OverviewPost[];
}

interface PostRow {
  account_id: string;
  type: "reel" | "carousel" | "image";
  posted_at: string | null;
  caption: string | null;
  url: string;
  likes: number | null;
  views: number | null;
}
interface SnapRow {
  account_id: string;
  captured_at: string;
  followers: number | null;
}

export async function intelOverview(now = new Date()): Promise<IntelOverview> {
  const businessId = await getGymBusinessId();
  const accounts = await db.select().from(IntelAccount).where(and(eq(IntelAccount.businessId, businessId), eq(IntelAccount.active, true)));

  const snaps = (
    await db.execute(sql`
      select account_id, captured_at, followers from intel_account_snapshot
      where business_id = ${businessId} and source = 'instagram' order by captured_at desc`)
  ).rows as unknown as SnapRow[];
  // Each post with its newest numbers
  const posts = (
    await db.execute(sql`
      select distinct on (p.id) p.account_id, p.type, p.posted_at, p.caption, p.url, s.likes, s.views
      from intel_post p join intel_post_snapshot s on s.post_id = p.id
      where p.business_id = ${businessId} and p.account_id is not null
      order by p.id, s.captured_at desc`)
  ).rows as unknown as PostRow[];
  const [{ pulls } = { pulls: 0 }] = (
    await db.select({ pulls: sql<number>`count(distinct date_trunc('day', ${IntelRun.startedAt}))::int` }).from(IntelRun).where(and(eq(IntelRun.businessId, businessId), eq(IntelRun.status, "ingested")))
  );

  const asOf = snaps[0] ? new Date(snaps[0].captured_at) : null;
  let comparedTo: Date | null = null;
  const wins: OverviewPost[] = [];
  const flops: OverviewPost[] = [];
  const scored: OverviewPost[] = [];
  const missing: string[] = [];

  const rows: OverviewAccount[] = accounts.map((a) => {
    const mine = snaps.filter((s) => s.account_id === a.id);
    const latest = mine[0];
    const before = latest ? mine.find((s) => Date.parse(latest.captured_at) - Date.parse(s.captured_at) >= MIN_DAYS_BETWEEN_SNAPSHOTS * DAY) : undefined;
    if (before && (!comparedTo || Date.parse(before.captured_at) > comparedTo.getTime())) comparedTo = new Date(before.captured_at);
    if (a.instagramHandle && asOf && (!latest || asOf.getTime() - Date.parse(latest.captured_at) > DAY)) missing.push(a.name);

    const myPosts = posts.filter((p) => p.account_id === a.id && p.posted_at).map((p) => ({ ...p, at: Date.parse(p.posted_at!) }));
    const recent = myPosts.filter((p) => now.getTime() - p.at <= NORMAL_WINDOW_DAYS * DAY);
    const reelPlays = recent.filter((p) => p.type === "reel" && p.views !== null).map((p) => p.views!);
    const otherLikes = recent.filter((p) => p.type !== "reel" && p.likes !== null).map((p) => p.likes!);
    const typicalReelPlays = reelPlays.length >= MIN_FOR_NORMAL ? median(reelPlays) : null;
    const typicalLikes = otherLikes.length >= MIN_FOR_NORMAL ? median(otherLikes) : null;

    // Posts a week over the last 28 days. Only the latest posts are collected, so for an
    // account that posts more than that in 28 days, the window is the days the posts cover.
    let postsPerWeek: number | null = null;
    if (myPosts.length) {
      const oldest = Math.min(...myPosts.map((p) => p.at));
      const windowDays = Math.max(7, Math.min(RATE_WINDOW_DAYS, (now.getTime() - oldest) / DAY));
      postsPerWeek = round1((myPosts.filter((p) => now.getTime() - p.at <= windowDays * DAY).length / windowDays) * 7);
    }

    for (const p of recent) {
      if (now.getTime() - p.at < MIN_POST_AGE_DAYS * DAY) continue;
      const isReel = p.type === "reel";
      const value = isReel ? p.views : p.likes;
      const normal = isReel ? typicalReelPlays : typicalLikes;
      if (value === null || !normal) continue;
      scored.push({
        accountKey: a.key,
        accountName: a.name,
        kind: a.kind,
        type: p.type,
        postedAt: p.posted_at!,
        caption: (p.caption ?? "").split("\n")[0]!.slice(0, 140),
        url: p.url,
        metric: isReel ? "plays" : "likes",
        value,
        score: round1(value / normal),
      });
    }

    const followers = latest?.followers ?? null;
    return {
      key: a.key,
      name: a.name,
      kind: a.kind,
      handle: a.instagramHandle,
      followers,
      followersChange: followers !== null && before?.followers != null ? followers - before.followers : null,
      postsPerWeek,
      typicalReelPlays: typicalReelPlays === null ? null : Math.round(typicalReelPlays),
      typicalLikes: typicalLikes === null ? null : Math.round(typicalLikes),
      playsPer100Followers: typicalReelPlays !== null && followers ? Math.round((typicalReelPlays / followers) * 100) : null,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  wins.push(...scored.filter((p) => p.score > 1).slice(0, HIGHLIGHTS));
  flops.push(...scored.filter((p) => p.score < 1).slice(-HIGHLIGHTS).reverse());
  rows.sort((a, b) => (b.followers ?? -1) - (a.followers ?? -1));

  return { asOf: asOf?.toISOString() ?? null, comparedTo: (comparedTo as Date | null)?.toISOString() ?? null, pulls, accounts: rows, missing, wins, flops };
}
