"use client";

/**
 * Average Revenue per Member for phones. The desktop chart labels every point of both
 * lines, which overlaps at 390px. Here the selected month's two values lead (colored to
 * match their lines, so they double as the legend), the lines carry no labels, and
 * tapping a month moves the headline to it.
 */

import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type MouseHandlerDataParam } from "recharts";

interface MonthPoint {
  name: string; // "Oct 2026"
  arm: number;
  armGroups: number;
}

const MOBILE_RANGE = 6;
const ALL_COLOR = "#3b82f6";
const GROUPS_COLOR = "#22c55e";

const shortMonth = (name: string) => name.split(" ")[0] ?? name;

function Change({ now, before }: { now: number; before: number | undefined }) {
  if (before === undefined) return null;
  const diff = now - before;
  return (
    <span className="text-xs text-gray-500 tabular-nums">
      {diff === 0 ? "no change" : `${diff > 0 ? "+" : "−"}$${Math.abs(diff)}`}
    </span>
  );
}

export function MobileArmChart({ data }: { data: MonthPoint[] }) {
  const [range, setRange] = useState<"6M" | "All">(data.length > MOBILE_RANGE ? "6M" : "All");
  const offset = range === "6M" ? Math.max(0, data.length - MOBILE_RANGE) : 0;
  const points = data.slice(offset);
  const [selected, setSelected] = useState<number | null>(null);
  const index = selected !== null && selected < points.length ? selected : points.length - 1;
  const point = points[index];
  if (!point) return null;

  // Change vs the month before, even when that month is outside the visible range
  const previous = data[offset + index - 1];
  const isLatest = index === points.length - 1;

  const pick = (state: MouseHandlerDataParam) => {
    const i = Number(state.activeTooltipIndex);
    if (state.activeTooltipIndex != null && !Number.isNaN(i)) setSelected(i);
  };

  const dotFor = (color: string) => (props: { cx?: number; cy?: number; index?: number }) =>
    props.index === index ? (
      <circle key={`sel-${color}`} cx={props.cx} cy={props.cy} r={5} fill={color} stroke="#fff" strokeWidth={2} />
    ) : (
      <circle key={`d-${color}-${props.index}`} cx={props.cx} cy={props.cy} r={0} />
    );

  return (
    <div className="px-4 pt-3 pb-4">
      {/* Headline: the selected month, both values */}
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium text-gray-500">{isLatest ? `${point.name} · latest` : point.name}</div>
        <div className="flex rounded-md border border-gray-200 p-0.5 text-xs font-medium">
          {(["6M", "All"] as const).map((r) => (
            <button
              key={r}
              onClick={() => {
                setRange(r);
                setSelected(null);
              }}
              className={`px-2.5 py-1.5 rounded ${range === r ? "bg-gray-900 text-white" : "text-gray-600"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: ALL_COLOR }} />
            All members
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums text-gray-900">${point.arm}</span>
            <Change now={point.arm} before={previous?.arm} />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: GROUPS_COLOR }} />
            Groups only
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums text-gray-900">${point.armGroups}</span>
            <Change now={point.armGroups} before={previous?.armGroups} />
          </div>
        </div>
      </div>

      {/* Both lines, no labels */}
      <div className="mt-3 -mx-2">
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={points} margin={{ top: 10, right: 12, left: 12, bottom: 0 }} onClick={pick} onMouseMove={pick}>
            <YAxis hide domain={["dataMin - 15", "dataMax + 15"]} />
            <XAxis
              dataKey="name"
              tickFormatter={shortMonth}
              interval={0}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={() => null} cursor={{ stroke: "#d1d5db", strokeDasharray: "3 3" }} />
            <Line
              type="monotone"
              dataKey="arm"
              stroke={ALL_COLOR}
              strokeWidth={2.5}
              isAnimationActive={false}
              dot={dotFor(ALL_COLOR)}
              activeDot={false}
            />
            <Line
              type="monotone"
              dataKey="armGroups"
              stroke={GROUPS_COLOR}
              strokeWidth={2.5}
              isAnimationActive={false}
              dot={dotFor(GROUPS_COLOR)}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 text-center text-xs text-gray-400">Tap a month to see it</div>
    </div>
  );
}
