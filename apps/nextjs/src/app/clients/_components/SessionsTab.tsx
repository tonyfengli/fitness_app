'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '~/trpc/react';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = mStr ?? '00';
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m} ${period}`;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Format YYYY-MM-DD → "Mon May 11" or similar
function formatWeekLabel(weekStart: string): string {
  // Treat the date as a date-only string (no TZ shift)
  const [y, m, d] = weekStart.split('-').map(Number);
  if (!y || !m || !d) return weekStart;
  const date = new Date(y, m - 1, d);
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][date.getMonth()];
  return `${month} ${date.getDate()}, ${y}`;
}

// Excel-style 3-color heatmap: red @ 0% → amber @ 50% → green @ 100%.
function getHeatmapColor(pct: number): string {
  const p = Math.max(0, Math.min(100, pct));
  if (p <= 50) {
    const t = p / 50;
    const r = Math.round(220 + (245 - 220) * t);
    const g = Math.round(38 + (158 - 38) * t);
    const b = Math.round(38 + (11 - 38) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const t = (p - 50) / 50;
  const r = Math.round(245 + (22 - 245) * t);
  const g = Math.round(158 + (163 - 158) * t);
  const b = Math.round(11 + (74 - 11) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

interface SessionsTabProps {
  weekStart: Date;
}

export function SessionsTab({ weekStart }: SessionsTabProps) {
  const trpc = api();

  const { data: schedules } = useQuery({
    ...trpc.classSchedule.list.queryOptions(),
  });
  const { data: stats, isLoading } = useQuery({
    ...trpc.classAttendance.weeklyStats.queryOptions(),
  });

  // Sort schedules deterministically by day_of_week then start_time
  const orderedSchedules = useMemo(() => {
    if (!schedules) return [];
    return [...schedules].sort((a, b) => {
      // Treat Sunday (0) as the end of the week to match Mon-first layouts
      const aDay = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
      const bDay = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
      if (aDay !== bDay) return aDay - bDay;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [schedules]);

  // Per-slot max for column-relative heatmap intensity.
  const slotMaxes = useMemo(() => {
    const m = new Map<string, number>();
    if (!stats) return m;
    for (const row of stats) {
      for (const [slotId, count] of Object.entries(row.bySlot)) {
        const cur = m.get(slotId) ?? 0;
        if (count > cur) m.set(slotId, count);
      }
    }
    return m;
  }, [stats]);

  // Total / AvgClient / AvgClass maxes for those columns' heatmap shading.
  const aggregateMaxes = useMemo(() => {
    let totalMax = 0;
    let avgClientMax = 0;
    let avgClassMax = 0;
    if (!stats) return { totalMax, avgClientMax, avgClassMax };
    const classCount = Math.max(orderedSchedules.length, 1);
    for (const row of stats) {
      if (row.total > totalMax) totalMax = row.total;
      const avgClient = row.activeClientCount > 0 ? row.total / row.activeClientCount : 0;
      if (avgClient > avgClientMax) avgClientMax = avgClient;
      const avgClass = row.total / classCount;
      if (avgClass > avgClassMax) avgClassMax = avgClass;
    }
    return { totalMax, avgClientMax, avgClassMax };
  }, [stats, orderedSchedules.length]);

  const selectedWeekKey = toDateString(weekStart);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return (
      <div className="text-center py-24 text-gray-500">
        No attendance recorded yet.
      </div>
    );
  }

  const classCount = Math.max(orderedSchedules.length, 1);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 select-none">
            <th className="text-left px-3 py-3 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">Week Start</th>
            <th className="text-center px-3 py-3 whitespace-nowrap">Total</th>
            <th className="text-center px-3 py-3 whitespace-nowrap">Avg/Client</th>
            {orderedSchedules.map((s) => (
              <th key={s.id} className="text-center px-2 py-3 whitespace-nowrap">
                <div className="flex flex-col items-center leading-tight">
                  <span>{DAY_SHORT[s.dayOfWeek] ?? '?'}</span>
                  <span className="text-gray-400 dark:text-gray-500 font-medium normal-case text-[10px]">
                    {formatTime(s.startTime)}
                  </span>
                </div>
              </th>
            ))}
            <th className="text-center px-3 py-3 whitespace-nowrap">Avg Class</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((row, i) => {
            const isSelected = row.weekStart === selectedWeekKey;
            const baseBg = i % 2 === 0
              ? 'bg-white dark:bg-gray-800'
              : 'bg-gray-50 dark:bg-gray-900/30';
            const selectedBg = isSelected
              ? 'bg-purple-50 dark:bg-purple-900/20'
              : baseBg;
            const stickyBg = isSelected
              ? 'bg-purple-50 dark:bg-purple-900/20'
              : i % 2 === 0
              ? 'bg-white dark:bg-gray-800'
              : 'bg-gray-50 dark:bg-gray-900/30';

            const avgClient = row.activeClientCount > 0
              ? row.total / row.activeClientCount
              : 0;
            const avgClass = row.total / classCount;

            return (
              <tr
                key={row.weekStart}
                className={`${selectedBg} border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 ${
                  isSelected ? 'font-semibold' : ''
                }`}
              >
                <td className={`px-3 py-2.5 text-gray-900 dark:text-gray-100 whitespace-nowrap sticky left-0 z-10 ${stickyBg} ${isSelected ? 'border-l-2 border-purple-500 dark:border-purple-400' : ''}`}>
                  {formatWeekLabel(row.weekStart)}
                </td>
                <td
                  className="px-3 py-2.5 text-center tabular-nums"
                  style={{
                    color: aggregateMaxes.totalMax > 0
                      ? getHeatmapColor((row.total / aggregateMaxes.totalMax) * 100)
                      : undefined,
                  }}
                >
                  {row.total}
                </td>
                <td
                  className="px-3 py-2.5 text-center tabular-nums"
                  style={{
                    color: aggregateMaxes.avgClientMax > 0
                      ? getHeatmapColor((avgClient / aggregateMaxes.avgClientMax) * 100)
                      : undefined,
                  }}
                >
                  {avgClient.toFixed(1)}
                </td>
                {orderedSchedules.map((s) => {
                  const count = row.bySlot[s.id] ?? 0;
                  const max = slotMaxes.get(s.id) ?? 0;
                  const color = count > 0 && max > 0
                    ? getHeatmapColor((count / max) * 100)
                    : undefined;
                  return (
                    <td
                      key={s.id}
                      className="px-2 py-2.5 text-center tabular-nums"
                      style={{
                        color: count === 0 ? 'rgb(156, 163, 175)' : color,
                      }}
                    >
                      {count}
                    </td>
                  );
                })}
                <td
                  className="px-3 py-2.5 text-center tabular-nums"
                  style={{
                    color: aggregateMaxes.avgClassMax > 0
                      ? getHeatmapColor((avgClass / aggregateMaxes.avgClassMax) * 100)
                      : undefined,
                  }}
                >
                  {avgClass.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
