"use client";

/**
 * Monthly churn rate for phones: the selected month's rate leads with the members
 * behind it, bars carry no labels, a dashed line marks the average, and tapping a
 * month moves the headline to it.
 */

import { useState } from "react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type MouseHandlerDataParam } from "recharts";

interface ChurnPoint {
  name: string; // "Oct 2026"
  churn: number | null; // % of the previous month's total; null for the first month
  lostCount: number;
  prevTotal: number;
}

const MOBILE_RANGE = 6;
const CHURN_COLOR = "#f97316";

const shortMonth = (name: string) => name.split(" ")[0] ?? name;

export function MobileChurnChart({ data, avgChurn }: { data: ChurnPoint[]; avgChurn: number }) {
  // The first month has no churn rate, so it's left out
  const months = data.filter((d) => d.churn !== null);
  const [range, setRange] = useState<"6M" | "All">(months.length > MOBILE_RANGE ? "6M" : "All");
  const points = range === "6M" ? months.slice(-MOBILE_RANGE) : months;
  const [selected, setSelected] = useState<number | null>(null);
  const index = selected !== null && selected < points.length ? selected : points.length - 1;
  const point = points[index];
  if (!point) return null;

  const isLatest = index === points.length - 1;
  const aboveAvg = (point.churn ?? 0) > avgChurn;

  const pick = (state: MouseHandlerDataParam) => {
    const i = Number(state.activeTooltipIndex);
    if (state.activeTooltipIndex != null && !Number.isNaN(i)) setSelected(i);
  };

  return (
    <div className="px-4 pt-3 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-gray-500">{isLatest ? `${point.name} · latest` : point.name}</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tabular-nums text-gray-900">{point.churn}%</span>
            <span className="text-sm text-gray-600">churn</span>
          </div>
          <div className="mt-0.5 text-sm text-gray-600 tabular-nums">
            {point.lostCount} of {point.prevTotal} members lost
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {avgChurn.toFixed(1)}% avg · {aboveAvg ? "above" : "at or below"} average
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

      <div className="mt-3 -mx-2">
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={points} margin={{ top: 8, right: 12, left: 12, bottom: 0 }} onClick={pick} onMouseMove={pick}>
            <YAxis hide domain={[0, "auto"]} />
            <XAxis
              dataKey="name"
              tickFormatter={shortMonth}
              interval={0}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={() => null} cursor={{ fill: "#f3f4f6" }} />
            <ReferenceLine y={avgChurn} stroke="#9ca3af" strokeDasharray="4 4" />
            <Bar dataKey="churn" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {points.map((_, i) => (
                <Cell key={i} fill={CHURN_COLOR} fillOpacity={i === index ? 1 : 0.45} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 text-center text-xs text-gray-400">Dashed line = average · tap a month to see it</div>
    </div>
  );
}
