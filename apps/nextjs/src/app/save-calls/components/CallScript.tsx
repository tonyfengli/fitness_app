"use client";

import { SparklesIcon } from "./icons";

interface CallScriptProps {
  dayOfWeek: string;
}

export function CallScript({ dayOfWeek }: CallScriptProps) {
  // Dynamic tip based on day of week
  const getDayTip = () => {
    switch (dayOfWeek.toLowerCase()) {
      case "monday":
        return "It's Monday: the #1 comeback day. Book sessions for today or tomorrow.";
      case "tuesday":
        return "It's Tuesday: push for Wednesday or Thursday sessions.";
      case "wednesday":
        return "It's Wednesday: mid-week is a great time to restart. Book for tomorrow.";
      case "thursday":
        return "It's Thursday: book every yes for a Monday restart. Monday is the #1 comeback day.";
      case "friday":
        return "It's Friday: book for Monday. Weekend calls have lower pickup rates.";
      case "saturday":
      case "sunday":
        return "It's the weekend: focus on members who prefer weekend sessions.";
      default:
        return "Book every yes for the next available session.";
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
        <SparklesIcon className="w-4 h-4" />
        How every call goes
      </div>

      <ul className="space-y-2 text-sm text-gray-600 mb-4">
        <li className="flex gap-2">
          <span className="text-gray-400">•</span>
          <span>
            Open with <strong>"What's been getting in the way?"</strong> Never "we noticed you haven't been in."
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-gray-400">•</span>
          <span>
            Book it for them: <strong>"I've got you Monday at 6pm, keep it or move it?"</strong>
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-gray-400">•</span>
          <span>Only 3 concessions, never the rate. Guest pass only after a yes.</span>
        </li>
        <li className="flex gap-2">
          <span className="text-gray-400">•</span>
          <span>Log it right after you hang up.</span>
        </li>
      </ul>

      <div className="text-sm text-red-600 font-medium">
        {getDayTip()}
      </div>
    </div>
  );
}
