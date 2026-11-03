"use client";

/**
 * Revenue by source for phones: the selected month's total leads, with each source's
 * amount in its bar color (doubling as the legend). Stacked bars carry no labels;
 * tapping a month moves the headline to it.
 */

import { useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type MouseHandlerDataParam } from "recharts";

interface RevenuePoint {
  name: string; // "Oct 2026"
  openGymRevenue: number;
  classesRevenue: number;
  ptRevenue: number;
  otherNet: number; // everything else, net of uncategorized refunds (can be negative)
  otherNetPositive: number; // otherNet when positive, for the stacked bar
  totalRevenue: number; // GymMaster revenue
}

const MOBILE_RANGE = 6;
const SOURCES = [
  { key: "classesRevenue", label: "Classes", color: "#3b82f6" },
  { key: "openGymRevenue", label: "Open Gym", color: "#22c55e" },
  { key: "ptRevenue", label: "PT", color: "#a855f7" },
  { key: "otherNetPositive", label: "Other", color: "#9ca3af" },
] as const;

const shortMonth = (name: string) => name.split(" ")[0] ?? name;
const dollars = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function MobileRevenueChart({ data }: { data: RevenuePoint[] }) {
  const [range, setRange] = useState<"6M" | "All">(data.length > MOBILE_RANGE ? "6M" : "All");
  const points = range === "6M" ? data.slice(-MOBILE_RANGE) : data;
  const [selected, setSelected] = useState<number | null>(null);
  const index = selected !== null && selected < points.length ? selected : points.length - 1;
  const point = points[index];
  if (!point) return null;

  const isLatest = index === points.length - 1;
  const total = point.totalRevenue;

  const pick = (state: MouseHandlerDataParam) => {
    const i = Number(state.activeTooltipIndex);
    if (state.activeTooltipIndex != null && !Number.isNaN(i)) setSelected(i);
  };

  // Stack bottom to top as Open Gym, Classes, PT, Other (same as desktop); round only the top segment
  const stack = [SOURCES[1], SOURCES[0], SOURCES[2], SOURCES[3]];

  return (
    <div className="px-4 pt-3 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-gray-500">{isLatest ? `${point.name} · latest` : point.name}</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tabular-nums text-gray-900">{dollars(total)}</span>
            <span className="text-sm text-gray-600">GymMaster revenue</span>
          </div>
        </div>
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
      <div className="mt-2 grid grid-cols-3 gap-2">
        {SOURCES.slice(0, 3).map((s) => (
          <div key={s.key}>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </div>
            <div className="text-sm font-semibold tabular-nums text-gray-900">{dollars(point[s.key])}</div>
          </div>
        ))}
      </div>
      {Math.round(point.otherNet) !== 0 && (
        <div className="mt-1 text-xs text-gray-500">
          Other (net of refunds){" "}
          <span className={`tabular-nums ${point.otherNet < 0 ? "text-red-600" : "text-gray-900"}`}>
            {point.otherNet < 0 ? "−" : ""}
            {dollars(Math.abs(point.otherNet))}
          </span>{" "}
          (included in the total)
        </div>
      )}

      <div className="mt-3 -mx-2">
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={points} margin={{ top: 8, right: 12, left: 12, bottom: 0 }} onClick={pick} onMouseMove={pick}>
            <YAxis hide />
            <XAxis
              dataKey="name"
              tickFormatter={shortMonth}
              interval={0}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={() => null} cursor={{ fill: "#f3f4f6" }} />
            {stack.map((s, si) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="revenue"
                radius={si === stack.length - 1 ? [3, 3, 0, 0] : 0}
                isAnimationActive={false}
              >
                {points.map((_, i) => (
                  <Cell key={i} fill={s.color} fillOpacity={i === index ? 1 : 0.45} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 text-center text-xs text-gray-400">Tap a month to see it</div>
    </div>
  );
}
