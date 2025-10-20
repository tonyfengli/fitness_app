"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon, CheckIcon } from "@acme/ui-shared";
import { api } from "~/trpc/react";

// Custom icons
const ClockIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const UsersIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const CalendarIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CheckCircleIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
  </svg>
);

// Load circuit sessions from API
const useCircuitSessions = () => {
  const trpc = api();
  return useQuery({
    ...trpc.trainingSession.listCircuitSessions.queryOptions({
      limit: 20,
      offset: 0,
    }),
  });
};

const getTimeOfDayBadge = (dateString: string) => {
  const date = new Date(dateString);
  const hour = date.getHours();
  
  if (hour >= 5 && hour < 12) {
    return {
      label: "Morning",
      className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
    };
  } else {
    return {
      label: "Evening", 
      className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
    };
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "open":
      return {
        label: "Open",
        className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
      };
    case "in progress":
      return {
        label: "In Progress",
        className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
      };
    case "complete":
      return {
        label: "Complete",
        className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
      };
    default:
      return {
        label: "Unknown",
        className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
      };
  }
};

const formatCreatedDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = sessionDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const time = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (diffDays === 0) {
    return { date: "Today", time };
  } else if (diffDays === 1) {
    return { date: "Tomorrow", time };
  } else if (diffDays === -1) {
    return { date: "Yesterday", time };
  } else if (diffDays > 1 && diffDays <= 7) {
    return { date: date.toLocaleDateString('en-US', { weekday: 'long' }), time };
  } else {
    return { 
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
      time 
    };
  }
};

export default function SessionsPage() {
  const router = useRouter();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  
  // Load circuit sessions from API
  const { data: sessions, isLoading, error } = useCircuitSessions();

  const handleSessionSelect = (sessionId: string) => {
    // Navigate to session detail page
    router.push(`/circuit-sessions/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Training Sessions</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Select a session to view details
          </p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="px-4 py-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading circuit sessions...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="px-4 py-6">
          <div className="text-center">
            <p className="text-sm text-red-600 dark:text-red-400">Failed to load sessions</p>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {sessions && (
        <div className="px-4 py-6 space-y-3">
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No circuit sessions found</p>
            </div>
          ) : (
            sessions.map((session) => {
              const isCompleted = session.status === "completed";
              const statusBadge = getStatusBadge(session.status);
              
              return (
                <div
                  key={session.id}
                  onClick={() => handleSessionSelect(session.id)}
                  className={`
                    relative bg-white dark:bg-gray-800 rounded-xl border-2 transition-all duration-200 cursor-pointer
                    border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md
                    ${isCompleted ? "opacity-75" : ""}
                    active:scale-98 transform
                  `}
                >
                  <div className="p-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                          {session.name}
                        </h3>
                      </div>
                      <ChevronRightIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    </div>

                    {/* Details Row */}
                    <div className="flex items-center justify-between">
                      {/* Participants Count */}
                      <div className="flex items-center gap-2">
                        <UsersIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {session.participantCount}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Participants
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge.className}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Bottom Safe Area */}
      <div className="h-6" />
    </div>
  );
}