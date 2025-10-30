"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon, SearchIcon, CheckIcon } from "@acme/ui-shared";
import { api } from "~/trpc/react";
import { toast } from "sonner";

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

const TrashIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PlayPauseIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);


interface SessionDetailPageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

// Client interface to match API response structure
interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  profile: {
    strengthLevel: string;
    skillLevel: string;
    notes?: string;
  } | null;
  status: "new" | "regular" | "returning"; // Derived status for UI
  lastSeen: string; // Will be derived from session attendance or profile data
  isCheckedIn: boolean; // Whether user is checked into this session
  checkedInAt?: Date | null; // When they checked in
}

export default function SessionDetailPage({ params }: SessionDetailPageProps) {
  const router = useRouter();
  const [showAttendance, setShowAttendance] = useState(false);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [navigatingToConfig, setNavigatingToConfig] = useState(false);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  
  // Unwrap params Promise (Next.js 15 pattern)
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;
  
  const trpc = api();
  const queryClient = useQueryClient();
  
  // Load session data from API
  const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery({
    ...trpc.trainingSession.getSession.queryOptions({ id: sessionId }),
    enabled: !!sessionId
  });

  // Check if workout exists for this session
  const { data: hasWorkout, isLoading: workoutCheckLoading } = useQuery({
    ...trpc.trainingSession.hasWorkoutForSession.queryOptions({ sessionId }),
    enabled: !!sessionId
  });

  // Fetch business clients for attendance
  const { data: clientsData, isLoading: clientsLoading, error: clientsError } = useQuery({
    ...trpc.auth.getClientsByBusiness.queryOptions(),
    enabled: !!sessionId
  });

  // Fetch checked-in clients for this session
  const { data: checkedInClients, isLoading: checkedInLoading } = useQuery({
    ...trpc.trainingSession.getCheckedInClients.queryOptions({ sessionId }),
    enabled: !!sessionId,
    onSuccess: (data) => {
      console.log(`[FRONTEND] getCheckedInClients returned ${data?.length || 0} users:`, 
        data?.map(u => ({
          userId: u.userId,
          userName: u.userName,
          checkedInAt: u.checkedInAt,
          status: u.status,
        }))
      );
    }
  });

  // Fetch ALL session participants (any status) to show remove buttons
  const { data: allParticipants, isLoading: allParticipantsLoading } = useQuery({
    ...trpc.trainingSession.getById.queryOptions({ id: sessionId }),
    enabled: !!sessionId,
    onSuccess: (data) => {
      console.log(`[FRONTEND] getAllParticipants returned session with ${data?.participants?.length || 0} total participants:`, 
        data?.participants?.map(p => ({
          userId: p.userId,
        }))
      );
    }
  });

  // Mutations for delete and status update
  const deleteSessionMutation = useMutation(
    trpc.trainingSession.deleteSessionPublic.mutationOptions({
      onSuccess: async () => {
        toast.success("Session deleted successfully");
        
        // Invalidate all circuit sessions list queries to ensure the UI updates
        await queryClient.invalidateQueries({
          queryKey: [["trainingSession", "listCircuitSessions"]],
        });
        
        router.push("/circuit-sessions");
      },
      onError: (error: any) => {
        toast.error("Failed to delete session");
        console.error("Delete error:", error);
      },
    })
  );

  const updateStatusMutation = useMutation(
    trpc.trainingSession.updateSessionStatusPublic.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Session status updated to ${data.newStatus}`);
        setShowStatusModal(false);
        // Refresh the page data
        window.location.reload();
      },
      onError: (error: any) => {
        toast.error("Failed to update session status");
        console.error("Update status error:", error);
      },
    })
  );

  // Bulk check-in mutation for selected users
  const addParticipantMutation = useMutation(
    trpc.trainingSession.addParticipant.mutationOptions({
      onSuccess: async (data) => {
        console.log(`[FRONTEND] addParticipant successful, returned:`, data);
        toast.success("User added to session!");
        // Refresh all related session data
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [["trainingSession", "getCheckedInClients"]],
          }),
          queryClient.invalidateQueries({
            queryKey: [["trainingSession", "getById"]],
          }),
          queryClient.invalidateQueries({
            queryKey: [["trainingSession", "listCircuitSessions"]],
          }),
        ]);
      },
      onError: (error: any) => {
        console.error(`[FRONTEND] addParticipant failed:`, error);
        toast.error("Failed to add user to session");
      },
    })
  );

  // Remove participant mutation
  const removeParticipantMutation = useMutation(
    trpc.trainingSession.removeParticipant.mutationOptions({
      onSuccess: async (data) => {
        console.log(`[FRONTEND] removeParticipant successful:`, data);
        toast.success("User removed from session");
        // Refresh all related session data
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [["trainingSession", "getCheckedInClients"]],
          }),
          queryClient.invalidateQueries({
            queryKey: [["trainingSession", "getById"]],
          }),
          queryClient.invalidateQueries({
            queryKey: [["trainingSession", "listCircuitSessions"]],
          }),
        ]);
      },
      onError: (error: any) => {
        console.error(`[FRONTEND] removeParticipant failed:`, error);
        toast.error("Failed to remove user from session");
      },
    })
  );

  // Handle bulk check-in by calling addParticipant for each user
  const handleBulkCheckIn = async (userIds: string[]) => {
    console.log(`[FRONTEND] handleBulkCheckIn called with userIds:`, userIds);
    console.log(`[FRONTEND] sessionId:`, sessionId);
    
    let successCount = 0;
    let errorCount = 0;

    for (const userId of userIds) {
      console.log(`[FRONTEND] Processing user ${userId}`);
      try {
        await new Promise<void>((resolve, reject) => {
          addParticipantMutation.mutate(
            { sessionId, userId },
            {
              onSuccess: (data) => {
                console.log(`[FRONTEND] User ${userId} added successfully:`, data);
                successCount++;
                resolve();
              },
              onError: (error) => {
                console.error(`[FRONTEND] Failed to add user ${userId}:`, error);
                errorCount++;
                resolve(); // Continue with other users
              },
            }
          );
        });
      } catch (error) {
        errorCount++;
        console.error(`[FRONTEND] Exception adding user ${userId}:`, error);
      }
    }

    // Show summary results
    if (successCount > 0) {
      toast.success(`${successCount} user${successCount !== 1 ? 's' : ''} added to session!`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} user${errorCount !== 1 ? 's' : ''} failed to add`);
    }

    // Clear selection after processing
    setSelectedClients(new Set());
  };

  // Handle removing a single client from the session
  const handleRemoveClient = (userId: string) => {
    console.log(`[FRONTEND] handleRemoveClient called for userId:`, userId);
    removeParticipantMutation.mutate({
      sessionId,
      userId
    });
  };

  // Calculate actual participant count from checked-in users
  const participantCount = checkedInClients?.length || 0;

  // Create a map of checked-in user IDs for quick lookup
  const checkedInUserIds = new Set(checkedInClients?.map(client => client.userId) || []);

  // Transform API clients data to match UI interface
  const clients: Client[] = clientsData?.map((client) => {
    // Determine client status based on profile and activity
    // This is a simplified logic - you might want more sophisticated status determination
    const getClientStatus = (): "new" | "regular" | "returning" => {
      if (!client.profile) return "new";
      // You could check session attendance history here
      // For now, using creation date as heuristic
      const profileAge = client.createdAt ? new Date().getTime() - new Date(client.createdAt).getTime() : 0;
      const daysOld = profileAge / (1000 * 60 * 60 * 24);
      
      if (daysOld < 7) return "new";
      if (daysOld > 30) return "returning";
      return "regular";
    };

    // Check if this client is already checked in
    const isCheckedIn = checkedInUserIds.has(client.id);
    const checkedInData = checkedInClients?.find(c => c.userId === client.id);

    return {
      id: client.id,
      name: client.name || client.email.split("@")[0], // Fallback to email username if no name
      email: client.email,
      phone: client.phone,
      profile: client.profile,
      status: getClientStatus(),
      lastSeen: client.createdAt || new Date().toISOString(), // TODO: Replace with actual last session attendance
      isCheckedIn,
      checkedInAt: checkedInData?.checkedInAt || null,
    };
  }) || [];

  // Create a set of ALL users who are in this session (any status)
  // This includes both checked-in users and registered users
  const allSessionUserIds = new Set(allParticipants?.participants?.map(p => p.userId) || []);

  // Initialize selection state (don't pre-select checked-in users)
  useEffect(() => {
    if (!hasInitializedSelection && clients.length > 0) {
      setSelectedClients(new Set());
      setHasInitializedSelection(true);
    }
  }, [clients, hasInitializedSelection]);

  // Combined loading state
  const isLoading = sessionLoading || workoutCheckLoading || clientsLoading || checkedInLoading || allParticipantsLoading;
  
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
  if (sessionError || clientsError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {sessionError ? "Failed to load session" : "Failed to load clients"}
          </h1>
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


  // Filter clients based on search and check-in status
  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchQuery.toLowerCase());
    // Use actual check-in status from session attendance
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "checked_in" && client.isCheckedIn) ||
                         (statusFilter === "not_checked_in" && !client.isCheckedIn);
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


  // Show attendance view
  if (showAttendance) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="lg:hidden sticky top-0 z-50 bg-gradient-to-r from-slate-900 to-purple-900 text-white shadow-lg">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setShowAttendance(false)}
              className="flex items-center space-x-2 active:opacity-70 transition-opacity"
            >
              <ChevronLeftIcon className="w-6 h-6" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="text-center">
              <h1 className="text-lg font-semibold">Attendance</h1>
              <p className="text-xs text-purple-200">{selectedClients.size} selected</p>
            </div>
            <div className="w-14"></div> {/* Spacer for centering */}
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
            {["all", "checked_in", "not_checked_in"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === status
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {status === "all" ? "All" : 
                 status === "checked_in" ? "Checked In" : 
                 status === "not_checked_in" ? "Not Checked In" : 
                 status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

        </div>


        {/* Client List */}
        <div className="px-4 py-4">
          <div className="space-y-2">
            {filteredClients.map((client) => {
              const isSelected = selectedClients.has(client.id);

              return (
                <button
                  key={client.id}
                  onClick={() => handleClientToggle(client.id)}
                  className={`w-full p-4 h-[75px] rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-3 h-full">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-blue-600 border-blue-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}>
                      {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {client.name}
                          </h3>
                          {allSessionUserIds.has(client.id) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {client.isCheckedIn 
                                ? client.checkedInAt 
                                  ? `Checked in at ${new Date(client.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                  : "Checked in"
                                : "Registered • Not checked in"
                              }
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 min-w-[80px]">
                          <span className={`w-full px-2.5 py-1 rounded-lg text-xs font-medium text-center transition-all ${
                            allSessionUserIds.has(client.id) 
                              ? client.isCheckedIn 
                                ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
                                : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
                              : "bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                          }`}>
                            <div className="flex items-center justify-center gap-1.5">
                              {allSessionUserIds.has(client.id) ? (
                                client.isCheckedIn ? (
                                  <>
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                    <span>Present</span>
                                  </>
                                ) : (
                                  <>
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                    <span>Pending</span>
                                  </>
                                )
                              ) : (
                                <span>Not in session</span>
                              )}
                            </div>
                          </span>
                          {allSessionUserIds.has(client.id) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveClient(client.id);
                              }}
                              className="w-full text-xs font-medium text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-all hover:scale-105 active:scale-95 text-center"
                              title={`Remove ${client.name} from session`}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
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
                const selectedUserIds = Array.from(selectedClients);
                void handleBulkCheckIn(selectedUserIds);
              }}
              disabled={addParticipantMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {addParticipantMutation.isPending ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Checking in...
                </span>
              ) : (
                `Check In ${selectedClients.size} Client${selectedClients.size !== 1 ? 's' : ''}`
              )}
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
      <div className="lg:hidden sticky top-0 z-50 bg-gradient-to-r from-slate-900 to-purple-900 text-white shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.push('/circuit-sessions')}
            className="flex items-center space-x-2 active:opacity-70 transition-opacity"
          >
            <ChevronLeftIcon className="w-6 h-6" />
            <span className="text-sm font-medium">Sessions</span>
          </button>
          <div className="text-center">
            <h1 className="text-lg font-semibold truncate max-w-40">{session.name}</h1>
            <div className="flex items-center justify-center gap-1">
              <UsersIcon className="w-3 h-3 text-purple-200" />
              <span className="text-xs text-purple-200">
                {participantCount} participants
              </span>
            </div>
          </div>
          <div className="w-14"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6 bg-gray-50 dark:bg-gray-900">
        <div className="space-y-4 max-w-lg mx-auto">
          {/* Get Attendance Card */}
          <button
            onClick={() => {
              setShowAttendance(true);
            }}
            className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm transition-all duration-200 cursor-pointer hover:shadow-lg active:scale-[0.98] transform overflow-hidden group border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 p-6 text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
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
              // Only navigate if we've finished checking for workout
              if (hasWorkout === undefined) {
                // Still loading workout check - could show a loading state
                return;
              }
              
              // Show loading state immediately
              setNavigatingToConfig(true);
              
              // Navigate based on whether a workout already exists
              const destination = hasWorkout 
                ? `/circuit-workout-overview?sessionId=${sessionId}`
                : `/circuit-sessions/${sessionId}/circuit-config`;
              router.push(destination);
            }}
            disabled={hasWorkout === undefined}
            className={`w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm transition-all duration-200 overflow-hidden group border border-gray-200 dark:border-gray-700 p-6 text-left ${
              hasWorkout === undefined 
                ? 'opacity-75 cursor-wait' 
                : 'hover:border-purple-300 dark:hover:border-purple-600 cursor-pointer hover:shadow-lg active:scale-[0.98] transform'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition-colors">
                <SettingsIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Configure Session
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {hasWorkout === undefined 
                    ? "Checking configuration status..." 
                    : hasWorkout 
                    ? "View and modify workout configuration" 
                    : "Set up exercises, timing, and session parameters"}
                </p>
              </div>
              <div className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                {hasWorkout === undefined || navigatingToConfig ? (
                  <div className="animate-spin">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            </div>
          </button>


          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowStatusModal(true)}
              className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all py-3 px-4 group"
            >
              <div className="flex items-center justify-center gap-2">
                <PlayPauseIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Update Status</span>
              </div>
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-600 transition-all py-3 px-4 group"
            >
              <div className="flex items-center justify-center gap-2">
                <TrashIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">Delete</span>
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete "{session.name}"?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteSessionMutation.mutate({ sessionId })}
                disabled={deleteSessionMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteSessionMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowStatusModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Update Status
            </h3>
            <div className="space-y-2 mb-6">
              {["open", "completed", "cancelled"].map((status) => (
                <button
                  key={status}
                  onClick={() => updateStatusMutation.mutate({ sessionId, status: status as "open" | "in_progress" | "completed" | "cancelled" })}
                  disabled={status === session.status || updateStatusMutation.isPending}
                  className={`w-full px-4 py-2.5 rounded-lg border transition-all ${
                    status === session.status
                      ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-400"
                      : "border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="capitalize">{status.replace("_", " ")}</span>
                    {status === session.status && (
                      <span className="text-xs">Current</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowStatusModal(false)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bottom Safe Area */}
      <div className="h-6" />
    </div>
  );
}