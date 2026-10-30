"use client";

import { useState } from "react";
import { UsersIcon, PhoneIcon, CopyIcon } from "./icons";
import { CallBlock, MemberCallItem, TIER_CONFIG, STATUS_CONFIG } from "../types";

interface MemberListProps {
  block: CallBlock;
  onCopyPhone?: (phone: string) => void;
}

function ChevronIcon({ className, expanded }: { className?: string; expanded?: boolean }) {
  return (
    <svg
      className={`${className} transition-transform ${expanded ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function MemberRow({
  member,
  onCopyPhone,
}: {
  member: MemberCallItem;
  onCopyPhone?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tierConfig = TIER_CONFIG[member.tier];

  const formatTenure = (months: number) => {
    if (months < 1) return "new";
    return `${months} mo member`;
  };

  const formatRate = (rate: number) => {
    if (rate === 0) return "prepaid";
    return `$${rate}/mo`;
  };

  const hasWeeklyData = member.weeklyVisits !== undefined;

  return (
    <div className={`border-l-4 ${tierConfig.borderColor}`}>
      {/* Main row */}
      <div
        className={`flex items-center hover:bg-gray-50 py-3 px-4 ${hasWeeklyData ? "cursor-pointer" : ""}`}
        onClick={() => hasWeeklyData && setExpanded(!expanded)}
      >
        {/* Expand button */}
        {hasWeeklyData && (
          <div className="w-6 flex-shrink-0 mr-2">
            <ChevronIcon className="w-4 h-4 text-gray-400" expanded={expanded} />
          </div>
        )}

        {/* Member info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900">{member.name}</div>
          <div className="text-sm text-gray-500 truncate">
            {member.onboarding ? (
              member.membershipType
            ) : (
              <>
                {member.membershipType} · {member.paidBy ? `paid by ${member.paidBy}` : formatRate(member.monthlyRate)} ·{" "}
                {formatTenure(member.tenureMonths)}
              </>
            )}
          </div>
        </div>

        {/* Days gone OR frequency info */}
        <div className="w-32 text-center flex-shrink-0">
          {member.onboarding ? (
            <>
              <div className="text-lg font-semibold text-gray-900">{member.onboarding.daysUncontacted}d</div>
              <div className="text-xs text-gray-400">not contacted</div>
            </>
          ) : member.frequencyInfo ? (
            <div className="text-sm text-gray-600">{member.frequencyInfo}</div>
          ) : (
            <>
              <div className="text-lg font-semibold text-gray-900">{member.daysGone}d</div>
              <div className="text-xs text-gray-400">gone</div>
            </>
          )}
        </div>

        {/* Plan price - new members, in place of the tier badge */}
        {member.onboarding && (
          <div className="w-32 flex-shrink-0 px-2">
            <span className="inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-700">
              {member.onboarding.planPrice || "No plan price"}
            </span>
          </div>
        )}

        {/* Tier badge - only show for at-risk */}
        {!member.frequencyInfo && !member.onboarding && (
          <div className="w-24 flex-shrink-0 px-2">
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${tierConfig.bgColor} ${tierConfig.textColor}`}>
              {tierConfig.label}
            </span>
          </div>
        )}

        {/* Touch history */}
        <div className="w-44 flex-shrink-0 text-xs text-right pr-4">
          {member.touchCount > 0 ? (
            <>
              <div className="text-gray-600">
                Touch {member.touchCount} · day {member.daysGone} gone: {member.lastTouchType || "call"}
              </div>
              <div className="text-red-500">
                Call was due {member.callDueDate || "today"}
              </div>
              {member.lastAttemptResult && (
                <div className="text-gray-400">Last: {member.lastAttemptResult}</div>
              )}
            </>
          ) : (
            <div className="text-gray-400">No touches yet</div>
          )}
        </div>

        {/* Phone & Actions */}
        <div className="w-48 flex-shrink-0 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {member.phone ? (
            <>
              <span className="text-sm text-gray-600">{member.phone}</span>
              <button
                onClick={onCopyPhone}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Copy phone number"
              >
                <CopyIcon className="w-4 h-4" />
              </button>
              <a
                href={`tel:${member.phone.replace(/[^\d]/g, "")}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
              >
                <PhoneIcon className="w-3.5 h-3.5" />
                Call
              </a>
            </>
          ) : (
            <span className="text-sm text-gray-400 italic">No phone</span>
          )}
        </div>
      </div>

      {/* Expanded detail view */}
      {expanded && member.weeklyVisits && (
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
          <div className="ml-8">
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Weekly visits breakdown</div>
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="bg-white rounded p-2 border border-gray-200">
                <div className="text-lg font-semibold text-gray-900">{member.weeklyVisits.week0}</div>
                <div className="text-xs text-gray-500">This week</div>
              </div>
              <div className="bg-white rounded p-2 border border-gray-200">
                <div className="text-lg font-semibold text-gray-900">{member.weeklyVisits.week1}</div>
                <div className="text-xs text-gray-500">Week 1</div>
              </div>
              <div className="bg-white rounded p-2 border border-gray-200">
                <div className="text-lg font-semibold text-gray-900">{member.weeklyVisits.week2}</div>
                <div className="text-xs text-gray-500">Week 2</div>
              </div>
              <div className="bg-white rounded p-2 border border-gray-200">
                <div className="text-lg font-semibold text-gray-900">{member.weeklyVisits.week3}</div>
                <div className="text-xs text-gray-500">Week 3</div>
              </div>
              <div className="bg-white rounded p-2 border border-gray-200">
                <div className="text-lg font-semibold text-gray-900">{member.weeklyVisits.week4}</div>
                <div className="text-xs text-gray-500">Week 4</div>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Total visits (weeks 0-3): <span className="font-medium">{member.totalVisits ?? 0}</span>
              {(member.totalVisits ?? 0) < 6 && (
                <span className="text-red-500 ml-2">Below healthy (6+ expected)</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MemberList({ block, onCopyPhone }: MemberListProps) {
  const config = STATUS_CONFIG[block.status];
  const members = block.members || [];


  if (members.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <UsersIcon className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">{block.title}</span>
          <span className="text-sm text-gray-500">{block.count}</span>
        </div>
        <div className="px-4 py-8 text-center text-gray-500">
          No {block.title.toLowerCase()} due.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-6">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <UsersIcon className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">{block.title}</span>
          <span className="text-sm font-medium text-gray-700">{block.count}</span>
        </div>
      </div>

      {/* Member rows */}
      <div className="divide-y divide-gray-100">
        {members.map((member) => (
          <MemberRow
            key={member.memberId}
            member={member}
            onCopyPhone={() => member.phone && onCopyPhone?.(member.phone)}
          />
        ))}
      </div>
    </div>
  );
}
