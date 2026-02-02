"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon, SearchIcon, CheckIcon } from "@acme/ui-shared";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { CircuitHeader } from "~/components/CircuitHeader";

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

const CalendarIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
  'strength': 'Strength',
  'unassigned': 'Unassigned'
};

interface SessionDetailPageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

// Client interface to match API response structure (includes both clients and trainers)
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
  role?: "client" | "trainer"; // User role
  packageName?: string; // Training package name
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
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [editingSessionName, setEditingSessionName] = useState("");
  const [selectedProgram, setSelectedProgram] = useState<"h4h_5am" | "h4h_5pm" | "saturday_cg" | "monday_cg" | "coach_frank" | "coach_steph" | "coach_kyle" | "strength" | "unassigned">("unassigned");
  
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

  // Fetch clients with active training packages for attendance
  const { data: clientsData, isLoading: clientsLoading, error: clientsError } = useQuery({
    ...trpc.clients.getClientsWithActivePackages.queryOptions(),
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

  // Update scheduled date mutation
  const updateScheduledDateMutation = useMutation(
    trpc.trainingSession.updateScheduledDate.mutationOptions({
      onSuccess: async (data) => {
        console.log(`[FRONTEND] updateScheduledDate successful:`, data);
        toast.success("Session date updated successfully");
        setShowDateModal(false);
        setSelectedDate(null);
        // Refresh session data
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [["trainingSession", "getSession"]],
          }),
          queryClient.invalidateQueries({
            queryKey: [["trainingSession", "listCircuitSessions"]],
          }),
        ]);
      },
      onError: (error: any) => {
        console.error(`[FRONTEND] updateScheduledDate failed:`, error);
        toast.error("Failed to update session date");
      },
    })
  );

  // Update program assignment mutation
  const updateProgramMutation = useMutation(
    trpc.trainingSession.updateSessionProgram.mutationOptions({
      onSuccess: async (data) => {
        console.log(`[FRONTEND] updateSessionProgram successful:`, data);
        toast.success("Session program updated successfully");
        setShowProgramModal(false);
        // Refresh session data
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [["trainingSession", "getSession"]],
          }),
          queryClient.invalidateQueries({
            queryKey: [["trainingSession", "listCircuitSessions"]],
          }),
        ]);
      },
      onError: (error: any) => {
        console.error(`[FRONTEND] updateSessionProgram failed:`, error);
        toast.error("Failed to update session program");
      },
    })
  );

  // Update session name mutation
  const updateSessionNameMutation = useMutation(
    trpc.trainingSession.updateSessionName.mutationOptions({
      onSuccess: async (data) => {
        console.log(`[FRONTEND] updateSessionName successful:`, data);
        toast.success("Session name updated successfully");
        // Refresh session data
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [["trainingSession", "getSession"]],
          }),
          queryClient.invalidateQueries({
            queryKey: [["trainingSession", "listCircuitSessions"]],
          }),
        ]);
      },
      onError: (error: any) => {
        console.error(`[FRONTEND] updateSessionName failed:`, error);
        toast.error("Failed to update session name");
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

  // Handle updating scheduled date
  const handleDateUpdate = () => {
    if (!selectedDate) {
      toast.error("Please select a date and time");
      return;
    }

    updateScheduledDateMutation.mutate({
      sessionId,
      scheduledAt: selectedDate
    });
  };

  // Handle opening date modal
  const handleOpenDateModal = () => {
    setSelectedDate(session?.scheduledAt ? new Date(session.scheduledAt) : new Date());
    setShowDateModal(true);
  };

  // Handle opening program modal
  const handleOpenProgramModal = () => {
    setEditingSessionName(session?.name || "");
    setSelectedProgram(session?.program || "unassigned");
    setShowProgramModal(true);
  };

  // Handle saving both description and program
  const handleSaveSessionConfig = async () => {
    const promises = [];
    
    // Update session name if changed
    if (editingSessionName.trim() && editingSessionName !== session?.name) {
      promises.push(
        new Promise<void>((resolve, reject) => {
          updateSessionNameMutation.mutate(
            { sessionId, name: editingSessionName.trim() },
            {
              onSuccess: () => resolve(),
              onError: (error) => reject(error),
            }
          );
        })
      );
    }

    // Update program if changed
    if (selectedProgram !== session?.program) {
      promises.push(
        new Promise<void>((resolve, reject) => {
          updateProgramMutation.mutate(
            { sessionId, program: selectedProgram },
            {
              onSuccess: () => resolve(),
              onError: (error) => reject(error),
            }
          );
        })
      );
    }

    try {
      await Promise.all(promises);
      if (promises.length > 0) {
        toast.success("Session updated successfully");
      }
      setShowProgramModal(false);
    } catch (error) {
      console.error("Failed to update session:", error);
      toast.error("Failed to update session");
    }
  };

  // Calculate actual participant count from checked-in users
  const participantCount = checkedInClients?.length || 0;

  // Create a map of checked-in user IDs for quick lookup
  const checkedInUserIds = new Set(checkedInClients?.map(client => client.userId) || []);

  // Transform API users data (clients and trainers) to match UI interface
  const clients: Client[] = clientsData?.map((user) => {
    // Determine user status based on role and profile
    const getUserStatus = (): "new" | "regular" | "returning" => {
      // Trainers are always considered "regular"
      if (user.role === "trainer") return "regular";
      
      if (!user.profile) return "new";
      // For clients, use creation date as heuristic
      const profileAge = user.createdAt ? new Date().getTime() - new Date(user.createdAt).getTime() : 0;
      const daysOld = profileAge / (1000 * 60 * 60 * 24);
      
      if (daysOld < 7) return "new";
      if (daysOld > 30) return "returning";
      return "regular";
    };

    // Check if this user is already checked in
    const isCheckedIn = checkedInUserIds.has(user.id);
    const checkedInData = checkedInClients?.find(c => c.userId === user.id);

    return {
      id: user.id,
      name: user.name || user.email.split("@")[0], // Fallback to email username if no name
      email: user.email,
      phone: user.phone,
      profile: user.profile,
      role: user.role, // Add role to client interface
      packageName: user.packageName, // Add package info
      status: getUserStatus(),
      lastSeen: user.createdAt || new Date().toISOString(),
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <CircuitHeader
          onBack={() => router.push('/circuit-sessions')}
          backText="Sessions"
          title="Session Details"
          subtitle="Loading session..."
        />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading session...</p>
          </div>
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
            {filteredClients.map((client, index) => {
              const isSelected = selectedClients.has(client.id);

              return (
                <div
                  key={`${client.id}-${index}`}
                  onClick={() => handleClientToggle(client.id)}
                  className={`w-full p-4 h-[75px] rounded-lg border-2 transition-all text-left cursor-pointer ${
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
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {client.name}
                            </h3>
                            {client.role === "trainer" && (
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 text-xs font-medium rounded-full">
                                T
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {client.packageName && (
                              <span className="font-medium">{client.packageName}</span>
                            )}
                            {allSessionUserIds.has(client.id) && (
                              <>
                                {client.packageName && " • "}
                                {client.isCheckedIn 
                                  ? client.checkedInAt 
                                    ? `Checked in at ${new Date(client.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                    : "Checked in"
                                  : "Registered • Not checked in"
                                }
                              </>
                            )}
                          </div>
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
                </div>
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
      {/* Custom Header with Status Badge */}
      <div className="bg-gradient-to-r from-slate-900 to-purple-900 text-white">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/circuit-sessions')}
              className="flex items-center space-x-2 active:opacity-70 transition-opacity"
            >
              <ChevronLeftIcon className="w-6 h-6" />
              <span className="text-sm font-medium">Sessions</span>
            </button>
            <div className="text-center flex-1 mx-8">
              <h1 className="text-xl font-bold">
                {PROGRAM_LABELS[session.program] || 'Unassigned'}
              </h1>
              <p className="text-purple-200 text-sm">{session.name}</p>
            </div>
            <span className="px-2.5 py-1 text-xs font-medium border border-white/20 text-white bg-white/10 rounded-full">
              {session.status.replace('_', ' ').charAt(0).toUpperCase() + session.status.replace('_', ' ').slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Session Toolkit - Unified Control Panel */}
      <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 px-4 py-4">
        <div className="max-w-lg mx-auto">
          {/* Date Display & Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            {/* Scheduled Date Header */}
            <div className="flex items-center gap-2 mb-4">
              <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Scheduled</h3>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {session?.scheduledAt 
                    ? new Date(session.scheduledAt).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : "No date set"
                  }
                </p>
              </div>
            </div>
            
            {/* Action Buttons Grid */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleOpenDateModal}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-all duration-200 active:scale-95"
              >
                <CalendarIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Edit Date</span>
              </button>
              
              <button
                onClick={() => setShowStatusModal(true)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-all duration-200 active:scale-95"
              >
                <SettingsIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Edit Status</span>
              </button>
              
              <button
                onClick={handleOpenProgramModal}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-all duration-200 active:scale-95"
              >
                <UsersIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Edit Name</span>
              </button>
            </div>
          </div>
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
                <div className="flex items-center gap-1.5 mt-2">
                  <UsersIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {participantCount} {participantCount === 1 ? 'participant' : 'participants'} checked in
                  </span>
                </div>
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

          {/* Danger Zone */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowDeleteModal(true)}
              className="group flex items-center justify-between w-full px-4 py-3 text-left bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-100 dark:border-red-900/30 hover:border-red-200 dark:hover:border-red-800/50 rounded-lg transition-all duration-200 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors">
                  <TrashIcon className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-red-700 dark:text-red-300">Delete Session</div>
                  <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">Permanently remove this session</div>
                </div>
              </div>
              <svg className="w-4 h-4 text-red-400 dark:text-red-500 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
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
              {["open", "in_progress", "completed", "cancelled", "draft"].map((status) => (
                <button
                  key={status}
                  onClick={() => updateStatusMutation.mutate({ sessionId, status: status as "open" | "in_progress" | "completed" | "cancelled" | "draft" })}
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

      {/* Date Update Modal */}
      {showDateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDateModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Update Scheduled Date
            </h3>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                When is this session?
              </label>
              
              {/* Quick Date Options */}
              <div className="space-y-3">
                {/* Quick Select Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Today', offset: 0 },
                    { label: 'Tomorrow', offset: 1 },
                    { label: 'In 2 Days', offset: 2 }
                  ].map((option) => {
                    const today = new Date();
                    const optionDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + option.offset);
                    const isSelected = selectedDate && selectedDate.toDateString() === optionDate.toDateString();
                    
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => setSelectedDate(optionDate)}
                        className={`py-3 px-3 text-sm font-medium rounded-lg border transition-colors ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400"
                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                
                {/* Custom Date Picker - Safari iOS Optimized */}
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate ? (
                      selectedDate.getFullYear() + '-' + 
                      String(selectedDate.getMonth() + 1).padStart(2, '0') + '-' +
                      String(selectedDate.getDate()).padStart(2, '0')
                    ) : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        // Create date in local timezone to avoid UTC conversion issues
                        const dateString = e.target.value; // YYYY-MM-DD format
                        const dateParts = dateString.split('-').map(Number);
                        if (dateParts.length === 3 && dateParts[0] && dateParts[1] && dateParts[2]) {
                          const year = dateParts[0];
                          const month = dateParts[1];
                          const day = dateParts[2];
                          const localDate = new Date(year, month - 1, day); // month is 0-indexed
                          setSelectedDate(localDate);
                        }
                      } else {
                        setSelectedDate(null);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full py-4 px-4 text-left border-2 rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-emerald-400 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all duration-200 shadow-sm hover:shadow-md pointer-events-none">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                          <CalendarIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {selectedDate ? selectedDate.toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              month: 'long', 
                              day: 'numeric'
                            }) : 'Select a date'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Tap to change date
                          </div>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDateUpdate}
                disabled={updateScheduledDateMutation.isPending || !selectedDate}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {updateScheduledDateMutation.isPending ? "Updating..." : "Update Date"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Configuration Modal */}
      {showProgramModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowProgramModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Edit Session Name
            </h3>
            
            {/* Description Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Session Name
              </label>
              <input
                type="text"
                value={editingSessionName}
                onChange={(e) => setEditingSessionName(e.target.value)}
                placeholder="Enter session description"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Program Assignment Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Program Assignment
              </label>
              <div className="space-y-2">
                {[
                  { value: "h4h_5am", label: "Coach Will" },
                  { value: "h4h_5pm", label: "Coach Tony" },
                  { value: "saturday_cg", label: "Saturday CG" },
                  { value: "monday_cg", label: "Monday CG" },
                  { value: "coach_frank", label: "Coach Frank" },
                  { value: "coach_steph", label: "Coach Steph" },
                  { value: "coach_kyle", label: "Coach Kyle" },
                  { value: "strength", label: "Strength" },
                  { value: "unassigned", label: "Unassigned" }
                ].map((program) => (
                  <button
                    key={program.value}
                    onClick={() => setSelectedProgram(program.value as "h4h_5am" | "h4h_5pm" | "saturday_cg" | "monday_cg" | "coach_frank" | "coach_steph" | "coach_kyle" | "strength" | "unassigned")}
                    className={`w-full px-4 py-2.5 rounded-lg border transition-all text-left ${
                      program.value === selectedProgram
                        ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300"
                        : "border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{program.label}</span>
                      {program.value === selectedProgram && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-xs">Selected</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowProgramModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSessionConfig}
                disabled={updateSessionNameMutation.isPending || updateProgramMutation.isPending || !editingSessionName.trim()}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {(updateSessionNameMutation.isPending || updateProgramMutation.isPending) ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Safe Area */}
      <div className="h-6" />
    </div>
  );
}