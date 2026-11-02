"use client";

/**
 * Retention > Classes: a weekday × time heatmap of average attendance per session,
 * each cell with its change vs the previous period of the same length. The time
 * range drives everything; the class filter narrows to one class type. Tapping a
 * cell opens that slot's sessions as a bar chart, one bar per date in the range.
 */

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell as BarCell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";

export interface ClassSlotData {
  classType: string;
  weekday: number; // 0 = Sun
  weekdayLabel: string;
  time: string;
  timeSort: number;
  current: { sessions: number; visits: number; avg: number };
  previous: { sessions: number; visits: number; avg: number } | null;
  sessionList: { date: string; attended: number }[];
}

export interface ClassAttendanceData {
  range: { start: string; end: string; days: number };
  previousRange: { start: string; end: string } | null;
  slots: ClassSlotData[];
}

type Preset = "4wk" | "8wk" | "3mo" | "aug1" | "custom";
const PRESETS: { id: Preset; label: string; caption: string }[] = [
  { id: "4wk", label: "4 wk", caption: "Last 4 weeks" },
  { id: "8wk", label: "8 wk", caption: "Last 8 weeks" },
  { id: "3mo", label: "3 mo", caption: "Last 3 months" },
  { id: "aug1", label: "Aug 1 +", caption: "Since Aug 1" },
  { id: "custom", label: "Custom", caption: "Custom range" },
];
const DATA_START = "2026-08-01";
const FILTERS = [
  { id: "all", label: "All" },
  { id: "Strength Training", label: "Strength" },
  { id: "METCON", label: "METCON" },
];
const LOW_ATTENDANCE = 2; // per session: number turns red below this
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon first
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const gymToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const addDays = (date: string, days: number) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const addMonths = (date: string, months: number) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};
const shortDate = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function presetRange(preset: Exclude<Preset, "custom">): { start: string; end: string } {
  const end = addDays(gymToday(), -1);
  if (preset === "4wk") return { start: addDays(end, -27), end };
  if (preset === "8wk") return { start: addDays(end, -55), end };
  if (preset === "3mo") return { start: addDays(addMonths(end, -3), 1), end };
  return { start: DATA_START, end };
}

// Five shades, lightest = fewest
const SHADES = [
  { cell: "bg-gray-100", text: "text-gray-900", dark: false },
  { cell: "bg-gray-300", text: "text-gray-900", dark: false },
  { cell: "bg-gray-400", text: "text-gray-900", dark: false },
  { cell: "bg-gray-600", text: "text-white", dark: true },
  { cell: "bg-gray-900", text: "text-white", dark: true },
];

interface Cell {
  avg: number;
  delta: number | null;
}

function Delta({ delta, dark }: { delta: number | null; dark: boolean }) {
  if (delta === null) return null;
  if (Math.abs(delta) < 0.05) return <span className={dark ? "text-gray-300" : "text-gray-500"}>→ same</span>;
  const up = delta > 0;
  const color = up ? (dark ? "text-green-300" : "text-green-700") : dark ? "text-red-300" : "text-red-600";
  return (
    <span className={color}>
      {up ? "↑" : "↓"}
      {Math.abs(delta).toFixed(1)}
    </span>
  );
}

export function ClassesView({ initial }: { initial: ClassAttendanceData | null }) {
  const [preset, setPreset] = useState<Preset>("4wk");
  const [custom, setCustom] = useState(() => presetRange("4wk"));
  const [filter, setFilter] = useState("all");
  const [data, setData] = useState<ClassAttendanceData | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null); // "weekday|time"

  const range = preset === "custom" ? custom : presetRange(preset);

  useEffect(() => {
    if (data && data.range.start === range.start && data.range.end === range.end) return;
    let cancelled = false;
    setError(null);
    fetch(`/api/agent/classes?start=${range.start}&end=${range.end}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.message || body.error || "Failed to load class attendance");
        if (!cancelled) setData(body);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load class attendance"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  // Cells for the selected class filter: class types in the same weekday/time are combined
  const view = useMemo(() => {
    if (!data) return null;
    const slots = data.slots.filter((s) => filter === "all" || s.classType === filter);
    const cells = new Map<string, { cur: [number, number]; prev: [number, number] | null }>();
    const times = new Map<string, number>();
    const days = new Set<number>();
    let cur: [number, number] = [0, 0];
    let prev: [number, number] = [0, 0];
    for (const s of slots) {
      const key = `${s.weekday}|${s.time}`;
      const c = cells.get(key) ?? { cur: [0, 0], prev: null };
      c.cur = [c.cur[0] + s.current.visits, c.cur[1] + s.current.sessions];
      if (s.previous) {
        c.prev = [(c.prev?.[0] ?? 0) + s.previous.visits, (c.prev?.[1] ?? 0) + s.previous.sessions];
        prev = [prev[0] + s.previous.visits, prev[1] + s.previous.sessions];
      }
      cur = [cur[0] + s.current.visits, cur[1] + s.current.sessions];
      cells.set(key, c);
      times.set(s.time, Math.min(times.get(s.time) ?? Infinity, s.timeSort));
      days.add(s.weekday);
    }
    const avg = ([visits, sessions]: [number, number]) => (sessions ? visits / sessions : 0);
    const grid = new Map<string, Cell>();
    for (const [key, c] of cells) {
      const a = avg(c.cur);
      grid.set(key, { avg: a, delta: c.prev && c.prev[1] ? a - avg(c.prev) : null });
    }
    const max = Math.max(0, ...[...grid.values()].map((c) => c.avg));
    const withDelta = [...grid.entries()].filter(([, c]) => c.delta !== null);
    const label = (key: string) => {
      const [day, time] = key.split("|");
      const types = slots.filter((s) => `${s.weekday}|${s.time}` === key).map((s) => (s.classType === "Strength Training" ? "Strength" : s.classType));
      return `${DAY_LABELS[Number(day)]} ${time} · ${[...new Set(types)].join(" + ")}`;
    };
    const gain = withDelta.sort((a, b) => b[1].delta! - a[1].delta!)[0];
    const drop = [...withDelta].sort((a, b) => a[1].delta! - b[1].delta!)[0];
    return {
      grid,
      max,
      days: WEEK_ORDER.filter((d) => days.has(d)),
      times: [...times.entries()].sort((a, b) => a[1] - b[1]).map(([t]) => t),
      overall: avg(cur),
      overallDelta: prev[1] ? avg(cur) - avg(prev) : null,
      gain: gain && gain[1].delta! > 0 ? { label: label(gain[0]), ...gain[1] } : null,
      drop: drop && drop[1].delta! < 0 ? { label: label(drop[0]), ...drop[1] } : null,
    };
  }, [data, filter]);

  // Sessions behind the selected cell, for the bar chart (class types combined for "All")
  const detail = useMemo(() => {
    if (!data || !selected || !view?.grid.has(selected)) return null;
    const slots = data.slots.filter(
      (s) => `${s.weekday}|${s.time}` === selected && (filter === "all" || s.classType === filter)
    );
    const types = [...new Set(slots.map((s) => (s.classType === "Strength Training" ? "Strength" : s.classType)))];
    const bars = slots
      .flatMap((s) => s.sessionList.map((x) => ({ ...x, type: s.classType === "Strength Training" ? "Strength" : s.classType })))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((x) => ({ ...x, label: shortDate(x.date) + (types.length > 1 ? ` · ${x.type}` : "") }));
    const [day, time] = selected.split("|");
    return { title: `${DAY_LABELS[Number(day)]} ${time} · ${types.join(" + ")}`, cell: view.grid.get(selected)!, bars };
  }, [data, selected, filter, view]);

  const shade = (value: number) => SHADES[Math.min(SHADES.length - 1, Math.floor((value / (view?.max || 1)) * SHADES.length - 1e-9))]!;
  const loading = !data || data.range.start !== range.start || data.range.end !== range.end;
  const caption = PRESETS.find((p) => p.id === preset)!.caption;

  return (
    <div className="space-y-4">
      {/* Time range: drives every number below */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-gray-50">
        <div className="grid grid-cols-5 gap-1 rounded-lg border border-gray-200 bg-white p-1 text-sm font-medium">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`rounded-md py-2 whitespace-nowrap transition-colors ${
                preset === p.id ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <input
              type="date"
              value={custom.start}
              min={DATA_START}
              max={custom.end}
              onChange={(e) => e.target.value && setCustom({ ...custom, start: e.target.value })}
              className="rounded-md border border-gray-300 px-2 py-1.5 bg-white"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={custom.end}
              min={custom.start}
              max={addDays(gymToday(), -1)}
              onChange={(e) => e.target.value && setCustom({ ...custom, end: e.target.value })}
              className="rounded-md border border-gray-300 px-2 py-1.5 bg-white"
            />
          </div>
        )}
        <div className="mt-2 text-xs text-gray-500">
          {caption} · {shortDate(range.start)} – {shortDate(range.end)}
          {data && !loading && (data.previousRange
            ? ` · trends vs ${shortDate(data.previousRange.start)} – ${shortDate(data.previousRange.end)}`
            : " · no earlier data to compare")}
        </div>
      </div>

      {/* Class filter + overall average */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                filter === f.id ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {view && !loading && (
          <div className="text-right">
            <div className="text-lg font-semibold tabular-nums text-gray-900">
              {view.overall.toFixed(1)}{" "}
              <span className="text-sm font-medium">
                <Delta delta={view.overallDelta} dark={false} />
              </span>
            </div>
            <div className="text-xs text-gray-500">avg / session</div>
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <strong>Error:</strong> {error}
        </div>
      ) : loading || !view ? (
        <div className="text-center py-12 text-gray-500">Loading class attendance...</div>
      ) : !view.times.length ? (
        <div className="text-center py-12 text-gray-500">No classes in this range.</div>
      ) : (
        <>
          {/* Heatmap: weekday × time, number = avg attendance per session, small = change */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
            <div
              className="grid gap-1 sm:gap-1.5"
              style={{ gridTemplateColumns: `2.75rem repeat(${view.days.length}, minmax(0, 1fr))` }}
            >
              <div />
              {view.days.map((d) => (
                <div key={d} className="pb-1 text-center text-xs font-medium text-gray-500">
                  {DAY_LABELS[d]}
                </div>
              ))}
              {view.times.map((time) => (
                <div key={time} className="contents">
                  <div className="flex items-center text-xs text-gray-500 whitespace-nowrap">{time}</div>
                  {view.days.map((d) => {
                    const cell = view.grid.get(`${d}|${time}`);
                    if (!cell) return <div key={d} className="aspect-square md:aspect-auto md:h-20 rounded-md bg-gray-50" />;
                    const s = shade(cell.avg);
                    const low = cell.avg < LOW_ATTENDANCE;
                    const key = `${d}|${time}`;
                    return (
                      <button
                        key={d}
                        onClick={() => setSelected(selected === key ? null : key)}
                        aria-pressed={selected === key}
                        className={`aspect-square md:aspect-auto md:h-20 rounded-md ${s.cell} flex flex-col justify-between p-1.5 sm:p-2 text-left transition-shadow ${
                          selected === key ? "ring-2 ring-offset-2 ring-gray-900" : "hover:ring-2 hover:ring-gray-300"
                        }`}
                        title={`${DAY_LABELS[d]} ${time}: ${cell.avg.toFixed(1)} per session`}
                      >
                        <span
                          className={`text-sm sm:text-lg font-semibold tabular-nums leading-none ${
                            low ? (s.dark ? "text-red-300" : "text-red-600") : s.text
                          }`}
                        >
                          {cell.avg.toFixed(1)}
                        </span>
                        <span className="text-[10px] sm:text-xs font-medium leading-none">
                          <Delta delta={cell.delta} dark={s.dark} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                Fewer
                {SHADES.map((s, i) => (
                  <span key={i} className={`h-3 w-4 rounded-sm ${s.cell}`} />
                ))}
                More
              </div>
              <span>Small number = change vs previous {data?.range.days ?? ""} days</span>
            </div>
          </div>

          {/* Selected slot: every session in the range */}
          {detail && (
            <div className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{detail.title}</div>
                  <div className="mt-0.5 text-xs text-gray-500 tabular-nums">
                    {detail.cell.avg.toFixed(1)} avg · {detail.bars.length} session{detail.bars.length === 1 ? "" : "s"} ·{" "}
                    {detail.bars.reduce((t, b) => t + b.attended, 0)} visits
                    {detail.cell.delta !== null && (
                      <>
                        {" · "}
                        <Delta delta={detail.cell.delta} dark={false} />
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="-mr-1 -mt-1 rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-3 -mx-1">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={detail.bars} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                    <YAxis hide domain={[0, "dataMax"]} allowDecimals={false} />
                    <XAxis
                      dataKey="label"
                      interval={detail.bars.length > 8 ? "preserveStartEnd" : 0}
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Bar dataKey="attended" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {detail.bars.map((b, i) => (
                        <BarCell key={i} fill={b.attended < LOW_ATTENDANCE ? "#dc2626" : "#374151"} />
                      ))}
                      <LabelList dataKey="attended" position="top" fontSize={11} fill="#111827" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Biggest gain / drop */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-green-700">↑ Biggest gain</div>
              {view.gain ? (
                <>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{view.gain.label}</div>
                  <div className="text-sm text-gray-600 tabular-nums">
                    <span className="text-green-700">+{view.gain.delta!.toFixed(1)}</span> → {view.gain.avg.toFixed(1)} avg
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm text-gray-400">No gains this period</div>
              )}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-red-600">↓ Biggest drop</div>
              {view.drop ? (
                <>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{view.drop.label}</div>
                  <div className="text-sm text-gray-600 tabular-nums">
                    <span className="text-red-600">−{Math.abs(view.drop.delta!).toFixed(1)}</span> → {view.drop.avg.toFixed(1)} avg
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm text-gray-400">No drops this period</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
