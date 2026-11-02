"use client";

/**
 * Revenue vs Expenses for phones, in the Overview charts' pattern: the selected
 * month's net income leads, with revenue (by source) and expenses under it in their
 * bar colors; a net income line on top, and a strip below with revenue up and
 * expenses down. Tapping a month moves the headline to it.
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
  name: string; // "Oct"
  stripeRevenue: number;
  otherRevenue: number;
  revenue: number;
  expenses: number; // negative
  netIncome: number;
}

const MOBILE_RANGE = 6;
const STRIPE_COLOR = "#22c55e";
const OTHER_COLOR = "#a855f7";
const EXPENSE_COLOR = "#ef4444";
const NET_COLOR = "#3b82f6";

const dollars = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString()}`;

export function MobilePnlTrendChart({ data, year }: { data: MonthPoint[]; year: number }) {
  const [range, setRange] = useState<"6M" | "All">(data.length > MOBILE_RANGE ? "6M" : "All");
  const points = range === "6M" ? data.slice(-MOBILE_RANGE) : data;
  const [selected, setSelected] = useState<number | null>(null);
  const index = selected !== null && selected < points.length ? selected : points.length - 1;
  const point = points[index];
  if (!point) return null;

  const isLatest = index === points.length - 1;

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
          <div className="text-xs font-medium text-gray-500">
            {point.name} {year}
            {isLatest ? " · latest" : ""}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className={`text-3xl font-semibold tabular-nums ${point.netIncome < 0 ? "text-red-600" : "text-gray-900"}`}>
              {dollars(point.netIncome)}
            </span>
            <span className="text-sm text-gray-600">net income</span>
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
        {[
          { label: "Stripe", value: point.stripeRevenue, color: STRIPE_COLOR },
          { label: "Other", value: point.otherRevenue, color: OTHER_COLOR },
          { label: "Expenses", value: -point.expenses, color: EXPENSE_COLOR },
        ].map((x) => (
          <div key={x.label}>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: x.color }} />
              {x.label}
            </div>
            <div className="text-sm font-semibold tabular-nums text-gray-900">{dollars(x.value)}</div>
          </div>
        ))}
      </div>

      {/* Net income */}
      <div className="mt-3 -mx-2">
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={points} margin={{ top: 10, right: 12, left: 12, bottom: 0 }} syncId="mobile-pnl" {...chartEvents}>
            <YAxis hide domain={["dataMin - 300", "dataMax + 300"]} />
            <XAxis dataKey="name" hide />
            <Tooltip content={() => null} cursor={{ stroke: "#d1d5db", strokeDasharray: "3 3" }} />
            <Line
              type="monotone"
              dataKey="netIncome"
              stroke={NET_COLOR}
              strokeWidth={2.5}
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; index?: number }) =>
                props.index === index ? (
                  <circle key="sel" cx={props.cx} cy={props.cy} r={5} fill={NET_COLOR} stroke="#fff" strokeWidth={2} />
                ) : (
                  <circle key={`d-${props.index}`} cx={props.cx} cy={props.cy} r={0} />
                )
              }
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue (up, by source) vs expenses (down) */}
      <div className="-mx-2">
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={points} margin={{ top: 4, right: 12, left: 12, bottom: 0 }} stackOffset="sign" syncId="mobile-pnl" {...chartEvents}>
            <YAxis hide />
            <XAxis dataKey="name" interval={0} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <Tooltip content={() => null} cursor={{ fill: "#f3f4f6" }} />
            <ReferenceLine y={0} stroke="#e5e7eb" />
            <Bar dataKey="stripeRevenue" stackId="pnl" isAnimationActive={false}>
              {points.map((_, i) => (
                <Cell key={i} fill={STRIPE_COLOR} fillOpacity={i === index ? 1 : 0.45} />
              ))}
            </Bar>
            <Bar dataKey="otherRevenue" stackId="pnl" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {points.map((_, i) => (
                <Cell key={i} fill={OTHER_COLOR} fillOpacity={i === index ? 1 : 0.45} />
              ))}
            </Bar>
            <Bar dataKey="expenses" stackId="pnl" radius={[0, 0, 3, 3]} isAnimationActive={false}>
              {points.map((_, i) => (
                <Cell key={i} fill={EXPENSE_COLOR} fillOpacity={i === index ? 1 : 0.45} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 text-center text-xs text-gray-400">Line = net income · tap a month to see it</div>
    </div>
  );
}
