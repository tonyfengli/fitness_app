"use client";

import { ClockIcon } from "./icons";
import { CallBlock, STATUS_CONFIG } from "../types";

interface ScheduleCardProps {
  owner: string;
  blocks: CallBlock[];
  onBlockClick?: (block: CallBlock) => void;
}

function StatusBadge({ status, count }: { status: "past_due" | "deadline_soon"; count: number }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {count} {config.label.toLowerCase()}
    </span>
  );
}

function ScheduleRow({ block, onClick }: { block: CallBlock; onClick?: () => void }) {
  const config = STATUS_CONFIG[block.status];

  // Build the description text
  const getDescriptionText = () => {
    if (block.id === "carried-over") {
      return `${block.count} members missed their call day. Marked red in the lists below.`;
    }
    if (block.id === "new-member-checks") {
      return `${block.count} left · ${block.doneCount} done today`;
    }
    if (block.id === "missing-members") {
      return `${block.count} left of today's ${block.total} · ${block.doneCount} done`;
    }
    if (block.id === "retry-no-answers") {
      return `${block.count} to retry · ${block.doneCount} retried`;
    }
    if (block.id === "weekly-goal") {
      const toGo = block.total - block.count;
      const behindPace = block.total > 0 ? Math.max(0, Math.floor((block.total * 0.6) - block.count)) : 0;
      return `${block.count} of ${block.total} · ${toGo} to go · behind pace (${behindPace})`;
    }
    return block.description;
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center border-l-4 ${config.borderColor} hover:bg-gray-50 transition-colors`}
    >
      {/* Time column */}
      <div className="w-28 flex-shrink-0 py-3 px-3">
        <span className="text-sm text-gray-600">{block.timeLabel}</span>
      </div>

      {/* Content column */}
      <div className="flex-1 py-3 pr-4">
        <div className="font-medium text-gray-900">{block.title}</div>
        <div className="text-sm text-gray-500">{getDescriptionText()}</div>
      </div>

      {/* Status badge column */}
      <div className="flex-shrink-0 pr-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
          block.status === "past_due" ? "border-red-200 bg-red-50 text-red-600" :
          block.status === "to_do" ? "border-green-200 bg-green-50 text-green-600" :
          block.status === "deadline_soon" ? "border-yellow-200 bg-yellow-50 text-yellow-600" :
          "border-gray-200 bg-gray-50 text-gray-500"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
          {config.label}
        </span>
      </div>
    </button>
  );
}

export function ScheduleCard({ owner, blocks, onBlockClick }: ScheduleCardProps) {
  const pastDueCount = blocks.filter(b => b.status === "past_due").length;
  const deadlineSoonCount = blocks.filter(b => b.status === "deadline_soon").length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <ClockIcon className="w-4 h-4" />
          {owner}'s schedule today
        </div>
        <div className="flex items-center gap-2">
          {pastDueCount > 0 && <StatusBadge status="past_due" count={pastDueCount} />}
          {deadlineSoonCount > 0 && <StatusBadge status="deadline_soon" count={deadlineSoonCount} />}
        </div>
      </div>

      {/* Schedule rows */}
      <div className="divide-y divide-gray-100">
        {blocks.map((block) => (
          <ScheduleRow
            key={block.id}
            block={block}
            onClick={() => onBlockClick?.(block)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
        Green = needs to be done · Yellow = deadline coming up · Red = past deadline. 5 to 7pm is desk time, no calls.
      </div>
    </div>
  );
}
