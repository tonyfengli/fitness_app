"use client";

import { RefreshIcon } from "./icons";

interface HeaderProps {
  date: Date;
  owner: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function Header({ date, owner, onRefresh, isRefreshing }: HeaderProps) {
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Today's calls</h1>
        <p className="mt-1 text-sm text-gray-500">
          {formattedDate} · {owner} owns every call · no answers get a second try 7 to 8pm from the desk
        </p>
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshIcon className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh list
        </button>
      )}
    </div>
  );
}
