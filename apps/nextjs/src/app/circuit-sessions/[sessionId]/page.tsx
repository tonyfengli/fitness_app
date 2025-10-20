"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, SearchIcon, CheckIcon } from "@acme/ui-shared";
import { api } from "~/trpc/react";

// Custom icons
const UsersIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const SettingsIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const FeedbackIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);


interface SessionDetailPageProps {
  params: {
    sessionId: string;
  };
}

// Hard-coded client data
const CLIENTS = [
  { id: "1", name: "Sarah Johnson", status: "regular", lastSeen: "2024-01-15" },
  { id: "2", name: "Mike Chen", status: "new", lastSeen: "2024-01-14" },
  { id: "3", name: "Emily Davis", status: "regular", lastSeen: "2024-01-15" },
  { id: "4", name: "Alex Rodriguez", status: "returning", lastSeen: "2024-01-10" },
  { id: "5", name: "Jessica Wong", status: "regular", lastSeen: "2024-01-15" },
  { id: "6", name: "David Thompson", status: "new", lastSeen: "2024-01-13" },
  { id: "7", name: "Maria Garcia", status: "returning", lastSeen: "2024-01-08" },
  { id: "8", name: "Ryan Miller", status: "regular", lastSeen: "2024-01-14" },
  { id: "9", name: "Lisa Park", status: "new", lastSeen: "2024-01-12" },
  { id: "10", name: "Tom Wilson", status: "regular", lastSeen: "2024-01-15" },
];

export default function SessionDetailPage({ params }: SessionDetailPageProps) {
  const router = useRouter();
  const [showAttendance, setShowAttendance] = useState(false);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const trpc = api();
  
  // Load session data from API
  const { data: session, isLoading, error } = useQuery({
    ...trpc.trainingSession.getSession.queryOptions({ id: params.sessionId }),
    enabled: !!params.sessionId
  });

  // For now, we'll use a placeholder participant count since we don't have the count in the basic session data
  // In a real implementation, you'd get this from the UserTrainingSession table
  const participantCount = 0; // TODO: Implement actual participant count query

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading session...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Failed to load session</h1>
          <button 
            onClick={() => router.back()}
            className="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // Session not found state
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Session not found</h1>
          <button 
            onClick={() => router.back()}
            className="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }


  // Filter clients based on search and status
  const filteredClients = CLIENTS.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleClientToggle = (clientId: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedClients.size === filteredClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredClients.map(c => c.id)));
    }
  };

  // Show attendance view
  if (showAttendance) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowAttendance(false)}
                className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Get Attendance
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {session.name} • {selectedClients.size} selected
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
          {/* Search */}
          <div className="relative mb-4">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {["all", "regular", "new", "returning"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === status
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Select All */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-3 w-full text-left"
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              selectedClients.size === filteredClients.length && filteredClients.length > 0
                ? "bg-blue-600 border-blue-600"
                : "border-gray-300 dark:border-gray-600"
            }`}>
              {selectedClients.size === filteredClients.length && filteredClients.length > 0 && (
                <CheckIcon className="w-3 h-3 text-white" />
              )}
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Select All ({filteredClients.length})
            </span>
          </button>
        </div>

        {/* Client List */}
        <div className="px-4 py-4">
          <div className="space-y-2">
            {filteredClients.map((client) => {
              const isSelected = selectedClients.has(client.id);
              const getStatusColor = (status: string) => {
                switch (status) {
                  case "new":
                    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
                  case "returning":
                    return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
                  case "regular":
                    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
                  default:
                    return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
                }
              };

              return (
                <button
                  key={client.id}
                  onClick={() => handleClientToggle(client.id)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-blue-600 border-blue-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}>
                      {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {client.name}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
                          {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Last seen: {new Date(client.lastSeen).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredClients.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No clients found</p>
            </div>
          )}
        </div>

        {/* Bottom Action */}
        {selectedClients.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
            <button
              onClick={() => {
                console.log('Mark attendance for:', Array.from(selectedClients));
                // TODO: Handle attendance submission
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Mark {selectedClients.size} Client{selectedClients.size !== 1 ? 's' : ''} Present
            </button>
          </div>
        )}

        {/* Bottom Safe Area */}
        <div className="h-20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                {session.name}
              </h1>
              <div className="flex items-center gap-1 mt-1">
                <UsersIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {participantCount} participants
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-8">
        <div className="space-y-4">
          {/* Get Attendance Card */}
          <button
            onClick={() => {
              setShowAttendance(true);
            }}
            className="w-full bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all p-6 text-left group active:scale-98 transform"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
                <UsersIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Get Attendance
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  View and manage participant attendance for this session
                </p>
              </div>
              <div className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>

          {/* Configure Session Card */}
          <button
            onClick={() => {
              // TODO: Navigate to configuration page
              console.log('Navigate to configuration');
            }}
            className="w-full bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-all p-6 text-left group active:scale-98 transform"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition-colors">
                <SettingsIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Configure Session
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Set up exercises, timing, and session parameters
                </p>
              </div>
              <div className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>

          {/* View Feedback Card */}
          <button
            onClick={() => {
              router.push(`/circuit-sessions/${params.sessionId}/feedback`);
            }}
            className="w-full bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600 transition-all p-6 text-left group active:scale-98 transform"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-800/50 transition-colors">
                <FeedbackIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  View Feedback
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Review participant feedback and session insights
                </p>
              </div>
              <div className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        </div>

      </div>

      {/* Bottom Safe Area */}
      <div className="h-6" />
    </div>
  );
}