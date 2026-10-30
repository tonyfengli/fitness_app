"use client";

import { DayStats } from "../types";

interface StatsBarProps {
  stats: DayStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  const progressPercent = Math.min(100, (stats.liveConversations / stats.liveConversationsGoal) * 100);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
      <div className="grid grid-cols-4 gap-8">
        {/* Live conversations with progress bar */}
        <div>
          <div className="text-sm text-gray-500 mb-2">Live conversations this week</div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-3xl font-bold text-gray-900">{stats.liveConversations}</span>
            <span className="text-lg text-gray-400">/ {stats.liveConversationsGoal}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Touches */}
        <div>
          <div className="text-sm text-gray-500 mb-2">Touches</div>
          <div className="text-3xl font-bold text-gray-900">{stats.touches}</div>
        </div>

        {/* Booked */}
        <div>
          <div className="text-sm text-gray-500 mb-2">Booked</div>
          <div className="text-3xl font-bold text-gray-900">{stats.booked}</div>
        </div>

        {/* Swiped back in */}
        <div>
          <div className="text-sm text-gray-500 mb-2">Swiped back in</div>
          <div className="text-3xl font-bold text-gray-900">{stats.swipedBackIn}</div>
          <div className="text-xs text-gray-400 mt-1">a save = a door swipe</div>
        </div>
      </div>
    </div>
  );
}
