"use client";

import { useState } from "react";
import { UsersIcon, PhoneIcon, CopyIcon } from "./icons";
import { CallBlock, MemberCallItem, TIER_CONFIG, STATUS_CONFIG } from "../types";

interface MemberListProps {
  block: CallBlock;
  onCopyPhone?: (phone: string) => void;
  // Per-row button (e.g. "Mark onboarded"), shown in place of the touch history
  action?: { label: string; onClick: (member: MemberCallItem) => void };
  // Collapsible header, e.g. for "Recently onboarded"
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const formatShortDate = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** The Kilo board column as a status pill; no card yet reads as No Touches */
const BOARD_STATUS: Record<string, { label: string; className: string }> = {
  "At-Risk": { label: "No Touches", className: "bg-gray-100 text-gray-600" },
  "Reached Out": { label: "Reached Out", className: "bg-blue-50 text-blue-700" },
  "No Reply": { label: "No Reply", className: "bg-amber-50 text-amber-700" },
  "In Conversation": { label: "In Conversation", className: "bg-green-50 text-green-700" },
  Booked: { label: "Booked", className: "bg-teal-50 text-teal-700" },
};
const boardStatus = (stage?: string | null) => (stage && BOARD_STATUS[stage]) || BOARD_STATUS["At-Risk"]!;

/** "today", "1d ago", "5d ago" from a YYYY-MM-DD date */
function daysAgoLabel(date: string): string {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(`${date}T12:00:00`)) / 864e5));
  return days === 0 ? "today" : `${days}d ago`;
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
  action,
}: {
  member: MemberCallItem;
  onCopyPhone?: () => void;
  action?: MemberListProps["action"];
}) {
  const [expanded, setExpanded] = useState(false);
  const tierConfig = TIER_CONFIG[member.tier];
  const onboardedOn = member.onboarding?.onboardedOn ?? null;
  const borderColor = onboardedOn ? "border-l-gray-300" : tierConfig.borderColor;

  const hasWeeklyData = member.weeklyVisits !== undefined;

  return (
    // Row dividers set per side: divide-y's border-color would override the tier color on the left edge
    <div className={`border-l-4 ${borderColor} border-t border-t-gray-100 first:border-t-0`}>
      {/* Main row: wraps into name / stats / phone lines on phones */}
      <div
        className={`flex flex-wrap md:flex-nowrap items-center gap-y-2 hover:bg-gray-50 py-3 px-4 ${hasWeeklyData ? "cursor-pointer" : ""}`}
        onClick={() => hasWeeklyData && setExpanded(!expanded)}
      >
        {/* Expand button */}
        {hasWeeklyData && (
          <div className="w-6 flex-shrink-0 mr-2">
            <ChevronIcon className="w-4 h-4 text-gray-400" expanded={expanded} />
          </div>
        )}

        {/* Member info */}
        <div className="flex-1 basis-[calc(100%-2rem)] md:basis-0 min-w-0">
          <div className="font-medium text-gray-900">{member.name}</div>
        </div>

        {/* Days gone OR frequency info */}
        <div className={`${hasWeeklyData ? "ml-8" : ""} md:ml-0 md:w-32 md:text-center flex-shrink-0`}>
          {onboardedOn ? (
            <div className="flex items-baseline gap-1 md:block">
              <div className="text-sm font-semibold text-gray-700">{formatShortDate(onboardedOn)}</div>
              <div className="text-xs text-gray-400">onboarded</div>
            </div>
          ) : member.onboarding ? (
            <div className="flex items-baseline gap-1 md:block">
              <div className="text-lg font-semibold text-gray-900">{member.onboarding.daysUncontacted}d</div>
              <div className="text-xs text-gray-400">not contacted</div>
            </div>
          ) : member.frequencyInfo ? (
            <div className="text-sm text-gray-600">{member.frequencyInfo}</div>
          ) : (
            <div className="flex items-baseline gap-1 md:block">
              <div className="text-lg font-semibold text-gray-900">{member.daysGone}d</div>
              <div className="text-xs text-gray-400">gone</div>
            </div>
          )}
        </div>

        {/* Tier badge - only show for at-risk */}
        {!member.frequencyInfo && !member.onboarding && (
          <div className="md:w-24 flex-shrink-0 px-2">
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${tierConfig.bgColor} ${tierConfig.textColor}`}>
              {tierConfig.label}
            </span>
          </div>
        )}

        {/* Plan price per month */}
        <div className="md:w-28 flex-shrink-0 px-2 md:px-0">
          <span className="inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-700">{member.planPrice || "No plan price"}</span>
        </div>

        {/* Row action (e.g. Mark onboarded) replaces the touch history */}
        {action ? (
          <div
            className={`w-full md:w-44 ${hasWeeklyData ? "ml-8" : ""} md:ml-0 flex-shrink-0 md:text-right md:pr-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => action.onClick(member)}
              className="px-3 py-2.5 md:py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              {action.label}
            </button>
          </div>
        ) : (
        <div className="hidden md:block w-44 flex-shrink-0 text-xs text-right pr-4">
          {(() => {
            const status = boardStatus(member.kilo?.stage);
            return (
              <>
                <span className={`inline-block px-2 py-0.5 rounded font-medium ${status.className}`}>{status.label}</span>
                {member.touchCount > 0 && member.lastTouchDate && (
                  <div className="mt-0.5 text-gray-400">
                    {member.lastTouchType} · {daysAgoLabel(member.lastTouchDate)}
                    {member.touchCount > 1 ? ` · ${member.touchCount} touches` : ""}
                  </div>
                )}
                {member.kilo && (
                  <a href={member.kilo.url} target="_blank" rel="noreferrer" className="block mt-0.5 text-gray-400 hover:text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                    Open in Kilo ↗
                  </a>
                )}
              </>
            );
          })()}
        </div>
        )}

        {/* Phone & Actions */}
        <div
          className={`w-full md:w-48 ${hasWeeklyData ? "ml-8" : ""} md:ml-0 flex-shrink-0 flex items-center justify-start md:justify-end gap-2`}
          onClick={(e) => e.stopPropagation()}
        >
          {member.phone ? (
            <>
              <span className="text-sm text-gray-600">{member.phone}</span>
              <button
                onClick={onCopyPhone}
                className="p-3 md:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Copy phone number"
              >
                <CopyIcon className="w-4 h-4" />
              </button>
              <a
                href={`tel:${member.phone.replace(/[^\d]/g, "")}`}
                className="flex items-center gap-1.5 px-4 py-2.5 md:px-3 md:py-1.5 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
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
            {/* Rolling 7-day windows ending today, most recent on the left */}
            <div className="grid grid-cols-5 gap-2 text-center">
              {(
                [
                  ["week0", "Last 7 days"],
                  ["week1", "Last week"],
                  ["week2", "2 weeks ago"],
                  ["week3", "3 weeks ago"],
                  ["week4", "4 weeks ago"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="bg-white rounded p-2 border border-gray-200">
                  <div className="text-lg font-semibold text-gray-900">{member.weeklyVisits![key]}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              <span className="font-medium">{member.totalVisits ?? 0}</span> visits in the last 4 weeks
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

export function MemberList({ block, onCopyPhone, action, collapsible = false, defaultOpen = true }: MemberListProps) {
  const config = STATUS_CONFIG[block.status];
  const members = block.members || [];
  const [open, setOpen] = useState(defaultOpen);


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
      <div
        className={`px-4 py-3 ${open ? "border-b border-gray-100" : ""} ${collapsible ? "cursor-pointer hover:bg-gray-50" : ""}`}
        onClick={() => collapsible && setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <UsersIcon className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">{block.title}</span>
          <span className="text-sm font-medium text-gray-700">{block.count}</span>
          {block.description && collapsible && <span className="text-xs text-gray-400">{block.description}</span>}
          {collapsible && <ChevronIcon className="w-4 h-4 text-gray-400 ml-auto" expanded={open} />}
        </div>
      </div>

      {/* Member rows */}
      {open && (
        <div>
          {members.map((member) => (
            <MemberRow
              key={member.memberId}
              member={member}
              onCopyPhone={() => member.phone && onCopyPhone?.(member.phone)}
              action={action}
            />
          ))}
        </div>
      )}
    </div>
  );
}
