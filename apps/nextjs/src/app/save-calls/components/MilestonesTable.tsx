"use client";

import { useState } from "react";
import { UsersIcon, PhoneIcon, CopyIcon } from "./icons";
import { MilestoneRow } from "../types";

interface MilestonesTableProps {
  members: MilestoneRow[];
  onCopyPhone?: (phone: string) => void;
}

// Who to celebrate now, and who to get ready for
export const JUST_HIT_DAYS = 14;
export const COMING_UP_WITHIN = 3;

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

function formatDate(s: string) {
  if (!s) return "";
  const d = new Date(s + "T12:00:00");
  if (isNaN(d.getTime())) return s;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

function daysAgo(s: string) {
  return Math.round((Date.now() - new Date(s + "T12:00:00").getTime()) / 864e5);
}

const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th"}`;
};

// Most recent milestone, if it was reached within the celebration window
export function latestRecentMilestone(m: MilestoneRow) {
  const last = m.reached[m.reached.length - 1];
  return last && daysAgo(last.date) <= JUST_HIT_DAYS ? last : null;
}

function MilestoneLadder({ member }: { member: MilestoneRow }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {member.reached.map(r => (
        <span key={r.milestone} className="inline-flex items-baseline gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-sm">
          <span className="font-semibold text-gray-900">{r.milestone}</span>
          <span className="text-xs text-gray-500">{formatDate(r.date)}</span>
        </span>
      ))}
      <span className="inline-flex items-baseline gap-1.5 rounded border border-dashed border-gray-300 px-2 py-1 text-sm">
        <span className="font-semibold text-gray-500">{member.next}</span>
        <span className="text-xs text-gray-500">next · {member.toGo} to go</span>
      </span>
    </div>
  );
}

function MilestoneMemberRow({ member, onCopyPhone }: { member: MilestoneRow; onCopyPhone?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const recent = latestRecentMilestone(member);

  return (
    <div className={`border-l-4 ${recent ? "border-l-green-500" : "border-l-gray-300"} border-t border-t-gray-100 first:border-t-0`}>
      {/* Main row */}
      <div
        className="flex flex-wrap md:flex-nowrap items-center gap-y-2 hover:bg-gray-50 py-3 px-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-6 flex-shrink-0 mr-2">
          <ChevronIcon className="w-4 h-4 text-gray-400" expanded={expanded} />
        </div>

        {/* Member info */}
        <div className="flex-1 basis-[calc(100%-2rem)] md:basis-0 min-w-0">
          <div className="font-medium text-gray-900">{member.name}</div>
        </div>

        {/* Classes */}
        <div className="ml-8 md:ml-0 md:w-28 md:text-center flex-shrink-0 flex items-baseline gap-1 md:block">
          <div className="text-lg font-semibold text-gray-900">{member.classes}</div>
          <div className="text-xs text-gray-400">classes</div>
        </div>

        {/* Milestone */}
        <div className="md:w-44 flex-shrink-0 px-2">
          <span
            className={`inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
              recent ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
            }`}
          >
            {recent ? `${ordinal(recent.milestone)} class · ${formatDate(recent.date)}` : `${member.toGo} to go → ${member.next}`}
          </span>
        </div>

        {/* Plan price per month */}
        <div className="md:w-28 flex-shrink-0">
          <span className="inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-700">{member.planPrice || "No plan price"}</span>
        </div>

        {/* Phone & Actions */}
        <div
          className="w-full md:w-56 ml-8 md:ml-0 flex-shrink-0 flex items-center justify-start md:justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {member.phone ? (
            <>
              <span className="text-sm text-gray-600 whitespace-nowrap">{member.phone}</span>
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
      {expanded && (
        <div className="bg-gray-50 px-4 pt-4 pb-4 border-t border-gray-100">
          <div className="ml-8 space-y-3">
            <MilestoneLadder member={member} />
            <div className="flex flex-wrap gap-x-10 gap-y-2 text-sm">
              {[
                ["Classes per week", `${member.perWeek}`],
                ["Last class", member.lastClass ? formatDate(member.lastClass) : "No classes yet"],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-gray-900">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MilestoneBlock({
  title,
  description,
  members,
  onCopyPhone,
  defaultOpen = true,
}: {
  title: string;
  description: string;
  members: MilestoneRow[];
  onCopyPhone?: (phone: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-6">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${open ? "border-b border-gray-100" : ""}`}
      >
        <div className="flex items-center gap-3">
          <UsersIcon className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">{title}</span>
          <span className="text-sm font-medium text-gray-700">{members.length}</span>
          <span className="text-xs text-gray-400">{description}</span>
          <ChevronIcon className="w-4 h-4 text-gray-400 ml-auto" expanded={open} />
        </div>
      </button>
      {!open ? null : members.length ? (
        <div>
          {members.map(member => (
            <MilestoneMemberRow
              key={member.memberId}
              member={member}
              onCopyPhone={() => member.phone && onCopyPhone?.(member.phone)}
            />
          ))}
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-gray-500">Nothing here.</div>
      )}
    </div>
  );
}

// Just hit: newest milestone first. Coming up: closest to their next milestone first.
export function milestoneGroups(members: MilestoneRow[]) {
  const justHit = members
    .filter(m => latestRecentMilestone(m))
    .sort((a, b) => latestRecentMilestone(b)!.date.localeCompare(latestRecentMilestone(a)!.date) || a.name.localeCompare(b.name));
  const comingUp = members
    .filter(m => !latestRecentMilestone(m) && m.classes > 0 && m.toGo <= COMING_UP_WITHIN)
    .sort((a, b) => a.toGo - b.toGo || b.classes - a.classes);
  return { justHit, comingUp };
}

export function MilestonesTable({ members, onCopyPhone }: MilestonesTableProps) {
  const { justHit, comingUp } = milestoneGroups(members);
  const everyone = [...members].sort((a, b) => b.classes - a.classes || a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <MilestoneBlock title="Just hit" description={`last ${JUST_HIT_DAYS} days`} members={justHit} onCopyPhone={onCopyPhone} />
      <MilestoneBlock
        title="Coming up"
        description={`within ${COMING_UP_WITHIN} classes`}
        members={comingUp}
        onCopyPhone={onCopyPhone}
        defaultOpen={false}
      />
      <MilestoneBlock
        title="Everyone"
        description="classes since Aug 1"
        members={everyone}
        onCopyPhone={onCopyPhone}
        defaultOpen={false}
      />
    </div>
  );
}
