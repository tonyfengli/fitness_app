"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon, CheckIcon, ChevronDownIcon } from "@acme/ui-shared";
import { api } from "~/trpc/react";
import { CircuitHeader } from "~/components/CircuitHeader";

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

// Program label mapping
const PROGRAM_LABELS: Record<string, string> = {
  'h4h_5am': 'Coach Will',
  'h4h_5pm': 'Coach Tony',
  'saturday_cg': 'Saturday CG',
  'monday_cg': 'Monday CG',
  'coach_frank': 'Coach Frank',
  'coach_steph': 'Coach Steph',
  'coach_kyle': 'Coach Kyle',
  'unassigned': 'Unassigned'
};

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
        // Option 1: Purple/Pink theme - "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
        // Option 2: Blue theme - "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        // Option 3: Amber/Gold theme - ACTIVE
        // Option 4: Violet theme - "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
        // Option 5: Rose theme - "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
        className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
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
  const [user, setUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showCompletedSessions, setShowCompletedSessions] = useState(false);
  const [navigatingToSession, setNavigatingToSession] = useState<string | null>(null);

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/get-session', {
          credentials: 'include',
          cache: 'no-store',
        });
        const sessionData = await response.json();
        if (sessionData?.user) {
          setUser(sessionData.user);
        } else {
          router.push('/login');
          return;
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        router.push('/login');
        return;
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router]);
  
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

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-purple-600 dark:border-gray-700 dark:border-t-purple-400"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, user will be redirected by useEffect
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <CircuitHeader
        onBack={() => router.push('/trainer-home')}
        backText="Home"
        title="Sessions"
        rightAction={
          <button
            onClick={() => router.push('/circuit-config')}
            className="relative p-2.5 -mr-2 rounded-lg bg-white/10 backdrop-blur-sm active:bg-white/20 transition-all duration-200 group"
            aria-label="Create new session"
          >
            <div className="absolute inset-0 bg-white/20 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <PlusIcon className="relative w-7 h-7 text-white drop-shadow-lg" strokeWidth={2.5} />
          </button>
        }
      />

      {/* Main Content Area - No redundant header on mobile */}
      <div className="lg:bg-white lg:dark:bg-gray-800 lg:shadow-sm lg:border-b lg:border-gray-200 lg:dark:border-gray-700">
        <div className="hidden lg:block px-6 py-6">
          <div className="flex items-center justify-between">
            {/* Desktop: Show breadcrumb navigation */}
            <div className="flex items-center space-x-4 flex-1">
              <Link href="/trainer-home" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div className="text-gray-300 dark:text-gray-600">|</div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Training Sessions</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Manage your circuit training sessions
                </p>
              </div>
            </div>
            
            {/* Desktop Create Button */}
            <button
              onClick={() => router.push('/circuit-config')}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              <span>New Session</span>
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
        <div className="px-4 pb-20 lg:pb-6 lg:px-6">
          {/* Active Sessions Section */}
          {activeSessions && activeSessions.length > 0 ? (
            <div className="space-y-4 max-w-4xl mx-auto mt-4">
              {activeSessions.map((session) => {
                const statusBadge = getStatusBadge(session.status);
                
                return (
                  <div
                    key={session.id}
                    onClick={() => handleSessionSelect(session.id)}
                    onMouseEnter={() => handleSessionHover(session.id)}
                    className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm transition-all duration-200 cursor-pointer hover:shadow-lg active:scale-[0.98] transform overflow-hidden group"
                  >
                    {/* Status indicator bar */}
                    {/* Option 1: Purple to Pink (Analogous) - from-purple-500 to-pink-500 */}
                    {/* Option 2: Purple to Blue (Analogous) - from-indigo-500 to-blue-500 */}
                    {/* Option 3: Gold to Amber (Complementary) - ACTIVE */}
                    {/* Option 4: Purple to Violet (Monochromatic) - from-purple-600 to-violet-500 */}
                    {/* Option 5: Coral to Rose (Split-complementary) - from-orange-400 to-rose-500 */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-amber-500"></div>
                    
                    <div className="p-4 lg:p-5">
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white shrink-0">
                              {PROGRAM_LABELS[session.program] || 'Unassigned'}
                            </h3>
                            <span className="text-sm font-medium text-gray-400 dark:text-gray-500 truncate min-w-0">
                              · {session.name}
                            </span>
                          </div>
                          {/* Mobile: Show date inline */}
                          <p className="lg:hidden text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {new Date(session.scheduledAt).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {statusBadge && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusBadge.className}`}>
                              {statusBadge.label}
                            </span>
                          )}
                          <ChevronRightIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>

                      {/* Details Row - Responsive */}
                      <div className="flex items-center justify-between">
                        {/* Participants Count */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                              <UsersIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {session.participantCount || 0} clients
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 hidden lg:block">
                                Participants
                              </p>
                            </div>
                          </div>

                          {/* Desktop: Show scheduled date */}
                          <div className="hidden lg:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <CalendarIcon className="w-4 h-4" />
                            <span>
                              {(() => {
                                const { date } = formatCreatedDate(session.scheduledAt);
                                return date;
                              })()}
                            </span>
                          </div>
                        </div>
                        
                        {/* Loading indicator on navigation */}
                        {navigatingToSession === session.id && (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Completed Sessions Section - Always show expandable header */}
          <div className="space-y-4 mt-6">
            {/* Collapsible Header */}
            <button
              onClick={() => setShowCompletedSessions(!showCompletedSessions)}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800/30 rounded-xl border border-gray-200 dark:border-gray-700 hover:from-gray-100 hover:to-gray-150 dark:hover:from-gray-700/50 dark:hover:to-gray-700/30 transition-all duration-200 shadow-sm hover:shadow-md"
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
            <div className={`space-y-4 transition-all duration-300 ease-in-out ${
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
                      className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm transition-all duration-200 cursor-pointer opacity-75 hover:opacity-100 hover:shadow-md active:scale-[0.98] transform overflow-hidden group"
                    >
                      {/* Completed status indicator bar */}
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
                      
                      <div className="p-4">
                        {/* Compact Header Row */}
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-2">
                              <h3 className="text-base font-medium text-gray-700 dark:text-gray-300 shrink-0">
                                {PROGRAM_LABELS[session.program] || 'Unassigned'}
                              </h3>
                              <span className="text-xs text-gray-400 dark:text-gray-500 truncate min-w-0">
                                · {session.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-1.5">
                                <UsersIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {session.participantCount || 0} clients
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <CalendarIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(session.scheduledAt).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <CheckCircleIcon className="w-5 h-5 text-green-500 dark:text-green-400 ml-2" />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : showCompletedSessions && completedSessions && completedSessions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                    <CheckCircleIcon className="w-8 h-8 text-gray-400 dark:text-gray-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No completed sessions yet</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Completed sessions will appear here</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Show empty state only if no active sessions and user hasn't checked completed sessions yet */}
          {(!activeSessions || activeSessions.length === 0) && !showCompletedSessions && (
            <div className="text-center py-12">
              {/* Empty state illustration */}
              <div className="mb-6">
                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110 4m0-4v2m0-6V4" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Active Sessions
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Get started by creating your first circuit training session
              </p>
              <button
                onClick={() => router.push('/circuit-config')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-full shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95">
                <PlusIcon className="w-5 h-5" />
                <span>Create Session</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom Safe Area */}
      <div className="h-6" />
    </div>
  );
}