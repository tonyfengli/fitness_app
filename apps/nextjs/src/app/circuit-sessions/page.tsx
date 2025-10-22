"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon, CheckIcon, ChevronDownIcon } from "@acme/ui-shared";
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

const PlusIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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

// Load active circuit sessions from API (excludes completed sessions)
const useActiveCircuitSessions = () => {
  const trpc = api();
  return useQuery({
    ...trpc.trainingSession.listCircuitSessions.queryOptions({
      limit: 20,
      offset: 0,
      businessId: "d33b41e2-f700-4a08-9489-cb6e3daa7f20", // Hardcoded business ID
      status: "active", // Only fetch active (non-completed) sessions
    }),
  });
};

// Load completed circuit sessions from API (only when needed)
const useCompletedCircuitSessions = (enabled: boolean) => {
  const trpc = api();
  return useQuery({
    ...trpc.trainingSession.listCircuitSessions.queryOptions({
      limit: 50, // Higher limit for completed sessions
      offset: 0,
      businessId: "d33b41e2-f700-4a08-9489-cb6e3daa7f20",
      status: "completed", // Only fetch completed sessions
    }),
    enabled,
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
    case "in_progress":
      return {
        label: "In Progress",
        className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
      };
    case "completed":
      return {
        label: "Complete",
        className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      };
    default:
      return {
        label: "Unknown",
        className: "bg-gray-100 text-gray-700 dark:bg-gray-300"
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
  const [showCompletedSessions, setShowCompletedSessions] = useState(false);
  const [navigatingToSession, setNavigatingToSession] = useState<string | null>(null);
  
  // Load active circuit sessions immediately
  const { data: activeSessions, isLoading: activeLoading, error: activeError } = useActiveCircuitSessions();
  
  // Load completed circuit sessions only when expanded
  const { data: completedSessions, isLoading: completedLoading, error: completedError } = useCompletedCircuitSessions(showCompletedSessions);
  
  // Get query client for prefetching
  const queryClient = useQueryClient();
  const trpc = api();
  
  // Combine loading states
  const isLoading = activeLoading;
  const error = activeError || completedError;

  // Debug logging
  console.log('[CircuitSessions] State:', {
    isLoading,
    error: !!error,
    activeSessions: activeSessions?.length || 0,
    completedSessions: completedSessions?.length || 0,
    showCompletedSessions,
    completedLoading,
    hasActiveData: !!activeSessions,
    hasCompletedData: !!completedSessions,
  });

  const handleSessionSelect = (sessionId: string) => {
    // Show loading state immediately
    setNavigatingToSession(sessionId);
    // Navigate to session detail page
    router.push(`/circuit-sessions/${sessionId}`);
  };

  const handleSessionHover = async (sessionId: string) => {
    // Prefetch session data on hover for instant navigation
    // Using queryClient.prefetchQuery with TRPC query options
    await queryClient.prefetchQuery(
      trpc.trainingSession.getSession.queryOptions({ id: sessionId })
    );
    await queryClient.prefetchQuery(
      trpc.trainingSession.hasWorkoutForSession.queryOptions({ sessionId })
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Training Sessions</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Select a session to view details
              </p>
            </div>
            
            {/* Create Session Button */}
            <button
              onClick={() => router.push('/circuit-config')}
              className="group relative w-12 h-12 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl transition-all duration-300 ease-out shadow-lg hover:shadow-xl active:shadow-md active:scale-90 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-200 dark:focus:ring-emerald-800"
              aria-label="Create new training session"
            >
              <PlusIcon className="w-6 h-6 absolute inset-0 m-auto group-active:scale-75 transition-transform duration-200 ease-out" />
              
              {/* Subtle background glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-emerald-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 ease-out" />
              
              {/* Ripple effect on click */}
              <div className="absolute inset-0 rounded-2xl bg-white opacity-0 group-active:opacity-30 group-active:animate-ping transition-opacity duration-150" />
            </button>
          </div>
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
      {!isLoading && !error && (
        <div className="px-4 py-6 space-y-6">
          {/* Active Sessions Section */}
          {activeSessions && activeSessions.length > 0 && (
            <div className="space-y-3">
              {activeSessions.map((session) => {
                const statusBadge = getStatusBadge(session.status);
                
                return (
                  <div
                    key={session.id}
                    onClick={() => handleSessionSelect(session.id)}
                    onMouseEnter={() => handleSessionHover(session.id)}
                    className="relative bg-white dark:bg-gray-800 rounded-xl border-2 transition-all duration-200 cursor-pointer border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md active:scale-98 transform"
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

                        {/* Status Badge or Loading */}
                        <div className="flex items-center">
                          {navigatingToSession === session.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                          ) : (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge.className}`}>
                              {statusBadge.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed Sessions Section - Always show expandable header */}
          <div className="space-y-3">
            {/* Collapsible Header */}
            <button
              onClick={() => setShowCompletedSessions(!showCompletedSessions)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <CheckIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Completed Sessions
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {completedLoading && showCompletedSessions ? "Loading..." : 
                     completedSessions ? `${completedSessions.length} session${completedSessions.length !== 1 ? 's' : ''}` : 
                     showCompletedSessions ? "Loading..." : "Tap to view"}
                  </p>
                </div>
              </div>
              <div className={`transition-transform duration-200 ${showCompletedSessions ? 'rotate-180' : ''}`}>
                <ChevronDownIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
            </button>

            {/* Completed Sessions List */}
            <div className={`space-y-2 transition-all duration-300 ease-in-out ${
              showCompletedSessions 
                ? 'opacity-100 max-h-[2000px]' 
                : 'opacity-0 max-h-0 overflow-hidden'
            }`}>
              {completedLoading && showCompletedSessions ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Loading completed sessions...</p>
                </div>
              ) : completedSessions && completedSessions.length > 0 ? (
                completedSessions.map((session) => {
                  const statusBadge = getStatusBadge(session.status);
                  
                  return (
                    <div
                      key={session.id}
                      onClick={() => handleSessionSelect(session.id)}
                      onMouseEnter={() => handleSessionHover(session.id)}
                      className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all duration-200 cursor-pointer opacity-75 hover:opacity-100 active:scale-98 transform"
                    >
                      <div className="p-3">
                        {/* Compact Header Row */}
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {session.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex items-center gap-1">
                                <UsersIcon className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {session.participantCount}
                                </span>
                              </div>
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusBadge.className}`}>
                                {statusBadge.label}
                              </span>
                            </div>
                          </div>
                          <ChevronRightIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 ml-2" />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : showCompletedSessions && completedSessions && completedSessions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">No completed sessions found</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Show empty state only if no active sessions and user hasn't checked completed sessions yet */}
          {(!activeSessions || activeSessions.length === 0) && !showCompletedSessions && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No active sessions found. Check completed sessions above.</p>
            </div>
          )}
        </div>
      )}

      {/* Bottom Safe Area */}
      <div className="h-6" />
    </div>
  );
}