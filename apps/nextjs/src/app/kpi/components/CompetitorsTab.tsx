"use client";

/**
 * Competitors tab: Tony's monitor of nearby gyms on Instagram (ai-crew/docs/INTEL-COLLECTION.md).
 * Three parts: where we stand (and what moved since the pull before), reach against size, and
 * the posts furthest above and below their own gym's normal. Every number comes from
 * /api/agent/intel/overview; this file only lays it out. Collected every Monday.
 */

import { useEffect, useState } from "react";

import type { IntelOverview, OverviewAccount, OverviewPost } from "~/lib/intel/overview";

const TZ = "America/Los_Angeles";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });
const n = (v: number | null) => (v === null ? "–" : v.toLocaleString("en-US"));
const label = (a: Pick<OverviewAccount, "name" | "kind">) => (a.kind === "own" ? `${a.name} (us)` : a.kind === "franchisor" ? `${a.name} (franchisor)` : a.name);

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-400">–</span>;
  if (value === 0) return <span className="text-gray-500">0</span>;
  return <span className={value > 0 ? "font-medium text-blue-700" : "font-medium text-orange-800"}>{value > 0 ? `+${value.toLocaleString("en-US")}` : value.toLocaleString("en-US")}</span>;
}

function PostList({ title, tone, posts, empty }: { title: string; tone: "win" | "flop"; posts: OverviewPost[]; empty: string }) {
  const color = tone === "win" ? "text-blue-800" : "text-orange-800";
  return (
    <div>
      <h3 className={`text-lg font-semibold ${color}`}>{title}</h3>
      {posts.length === 0 && <p className="mt-3 text-sm text-gray-500">{empty}</p>}
      <ul className="mt-3 space-y-3">
        {posts.map((p) => (
          <li key={p.url} className="flex gap-4 rounded-lg border border-gray-200 bg-white p-4">
            <div className={`w-14 shrink-0 text-xl font-bold ${color}`}>{p.score}×</div>
            <div className="min-w-0">
              <a href={p.url} target="_blank" rel="noreferrer" className="block text-sm font-semibold text-blue-700 hover:underline">
                {p.caption || "(no caption)"}
              </a>
              <div className="mt-1 text-xs text-gray-600">
                {label({ name: p.accountName, kind: p.kind })} · {p.type}, {p.value.toLocaleString("en-US")} {p.metric} · {day(p.postedAt)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CompetitorsTab() {
  const [data, setData] = useState<IntelOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agent/intel/overview")
      .then(async (res) => {
        const body = (await res.json()) as IntelOverview & { error?: string };
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setData(body);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) return <p className="mt-8 text-sm text-red-700">Couldn&apos;t load the competitor data: {error}</p>;
  if (!data) return <p className="mt-8 text-sm text-gray-500">Loading…</p>;
  if (!data.asOf) return <p className="mt-8 text-sm text-gray-600">Nothing collected yet. The first pull runs on Monday.</p>;

  const withData = data.accounts.filter((a) => a.followers !== null);
  const noData = data.accounts.filter((a) => a.followers === null);
  const byReach = withData.filter((a) => a.playsPer100Followers !== null).sort((a, b) => b.playsPer100Followers! - a.playsPer100Followers!);
  const topReach = Math.max(1, ...byReach.map((a) => a.playsPer100Followers!));

  return (
    <div className="mt-8 space-y-10">
      <p className="text-sm text-gray-600">
        Instagram, as of {day(data.asOf)}. {data.comparedTo ? `Changes are since ${day(data.comparedTo)}.` : "Changes appear after the next Monday pull."} Collected every Monday.
      </p>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">Where we stand</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 text-left text-xs uppercase tracking-wide text-gray-600">
                <th className="px-4 py-3 font-semibold">Gym</th>
                <th className="px-4 py-3 text-right font-semibold">Followers</th>
                <th className="px-4 py-3 text-right font-semibold">Change</th>
                <th className="px-4 py-3 text-right font-semibold">Posts a week</th>
                <th className="px-4 py-3 text-right font-semibold">Typical reel plays</th>
              </tr>
            </thead>
            <tbody>
              {withData.map((a) => (
                <tr key={a.key} className={`border-b border-gray-100 last:border-0 ${a.kind === "own" ? "bg-blue-50 font-semibold" : ""}`}>
                  <td className="px-4 py-2.5">
                    {a.handle ? (
                      <a href={`https://www.instagram.com/${a.handle}/`} target="_blank" rel="noreferrer" className="text-gray-900 hover:underline">
                        {label(a)}
                      </a>
                    ) : (
                      label(a)
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">{n(a.followers)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Change value={a.followersChange} />
                  </td>
                  <td className="px-4 py-2.5 text-right">{a.postsPerWeek === null ? "–" : a.postsPerWeek.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-right">{n(a.typicalReelPlays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {noData.length > 0 && <p className="mt-2 text-xs text-gray-500">No Instagram data yet for: {noData.map((a) => a.name).join(", ")}.</p>}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">Reach against size</h2>
        <p className="mt-1 text-sm text-gray-600">Typical reel plays for every 100 followers. Higher means each post travels further than the gym&apos;s size would suggest.</p>
        <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-white p-4">
          {byReach.map((a) => (
            <div key={a.key} className="flex items-center gap-3 text-sm">
              <div className={`w-56 shrink-0 truncate ${a.kind === "own" ? "font-semibold text-blue-800" : "text-gray-900"}`}>{label(a)}</div>
              <div className="h-3 min-w-0 flex-1 overflow-hidden rounded bg-gray-100">
                <div className={`h-3 rounded ${a.kind === "own" ? "bg-blue-600" : "bg-gray-400"}`} style={{ width: `${Math.max(2, (a.playsPer100Followers! / topReach) * 100)}%` }} />
              </div>
              <div className="w-14 shrink-0 text-right font-medium tabular-nums">{n(a.playsPer100Followers)}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">Wins and flops</h2>
        <p className="mt-1 text-sm text-gray-600">Each post against its own gym&apos;s typical post over the last 90 days. 1× is normal for them.</p>
        <div className="mt-4 grid gap-8 md:grid-cols-2">
          <PostList title="Wins" tone="win" posts={data.wins} empty="No post is above its gym's normal yet." />
          <PostList title="Flops" tone="flop" posts={data.flops} empty="No post is below its gym's normal yet." />
        </div>
      </section>
    </div>
  );
}
