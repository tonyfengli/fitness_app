"use client";

/**
 * Membership Overview for phones. The desktop chart answers three questions on two
 * y-axes with every point labeled, which gets cramped at 390px. Here the number leads
 * (total members for the selected month), a total-members line sits on top, and a
 * new vs lost strip below shares the same months. Tapping a month moves the headline
 * to it, so no point needs a label.
 */

import { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type MouseHandlerDataParam,
} from "recharts";

interface MonthPoint {
  name: string; // "Oct 2026"
  totalMembers: number;
  newMembers: number;
  lostMembers: number; // negative
}

const MOBILE_RANGE = 6;
const TOTAL_COLOR = "#3b82f6";
const NEW_COLOR = "#22c55e";
const LOST_COLOR = "#ef4444";

const shortMonth = (name: string) => name.split(" ")[0] ?? name;

export function MobileMembershipChart({
  data,
  avgNewMembersPerMonth,
  memberGrowth,
}: {
  data: MonthPoint[];
  avgNewMembersPerMonth: number;
  memberGrowth: number;
}) {
  const [range, setRange] = useState<"6M" | "All">(data.length > MOBILE_RANGE ? "6M" : "All");
  const points = range === "6M" ? data.slice(-MOBILE_RANGE) : data;
  const [selected, setSelected] = useState<number | null>(null);
  const index = selected !== null && selected < points.length ? selected : points.length - 1;
  const point = points[index];
  if (!point) return null;

  const isLatest = index === points.length - 1;
  const lost = Math.abs(point.lostMembers);

  // Tap or drag across either chart to pick a month
  const pick = (state: MouseHandlerDataParam) => {
    const i = Number(state.activeTooltipIndex);
    if (state.activeTooltipIndex != null && !Number.isNaN(i)) setSelected(i);
  };
  const chartEvents = { onClick: pick, onMouseMove: pick };

  return (
    <div className="px-4 pt-3 pb-4">
      {/* Headline: the selected month */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-gray-500">{isLatest ? `${point.name} · latest` : point.name}</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tabular-nums text-gray-900">{point.totalMembers}</span>
            <span className="text-sm text-gray-600">members</span>
          </div>
          <div className="mt-0.5 text-sm tabular-nums">
            <span className="text-green-700">+{point.newMembers} new</span>
            <span className="text-gray-400"> · </span>
            <span className="text-red-600">−{lost} lost</span>
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
      {(memberGrowth > 0 || avgNewMembersPerMonth > 0) && (
        <div className="mt-1 text-xs text-gray-500">
          {[
            memberGrowth > 0 && `${memberGrowth}% growth since ${shortMonth(data[0]!.name)}`,
            avgNewMembersPerMonth > 0 && `${avgNewMembersPerMonth} new / month`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}

      {/* Total members */}
      <div className="mt-3 -mx-2">
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={points} margin={{ top: 10, right: 12, left: 12, bottom: 0 }} syncId="mobile-membership" {...chartEvents}>
            <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
            <XAxis dataKey="name" hide />
            <Tooltip content={() => null} cursor={{ stroke: "#d1d5db", strokeDasharray: "3 3" }} />
            <Line
              type="monotone"
              dataKey="totalMembers"
              stroke={TOTAL_COLOR}
              strokeWidth={2.5}
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; index?: number }) =>
                props.index === index ? (
                  <circle key="sel" cx={props.cx} cy={props.cy} r={5} fill={TOTAL_COLOR} stroke="#fff" strokeWidth={2} />
                ) : (
                  <circle key={`d-${props.index}`} cx={props.cx} cy={props.cy} r={0} />
                )
              }
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* New (up) vs lost (down) */}
      <div className="-mx-2">
        <ResponsiveContainer width="100%" height={96}>
          <BarChart data={points} margin={{ top: 4, right: 12, left: 12, bottom: 0 }} stackOffset="sign" syncId="mobile-membership" {...chartEvents}>
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
            <ReferenceLine y={0} stroke="#e5e7eb" />
            <Bar dataKey="newMembers" stackId="change" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {points.map((_, i) => (
                <Cell key={i} fill={NEW_COLOR} fillOpacity={i === index ? 1 : 0.45} />
              ))}
            </Bar>
            <Bar dataKey="lostMembers" stackId="change" radius={[0, 0, 3, 3]} isAnimationActive={false}>
              {points.map((_, i) => (
                <Cell key={i} fill={LOST_COLOR} fillOpacity={i === index ? 1 : 0.45} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 text-center text-xs text-gray-400">Tap a month to see it</div>
    </div>
  );
}
