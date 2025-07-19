"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Icon } from "@acme/ui-shared";
import { useTRPC } from "~/trpc/react";
import { useRouter } from "next/navigation";
import NewTrainingSessionModal from "./new-training-session-modal";

// Constants
const AVATAR_API_URL = "https://api.dicebear.com/7.x/avataaars/svg";

// Helper function to determine session status
function getSessionStatus(scheduledAt: Date, durationMinutes?: number | null): "upcoming" | "past" | "active" {
  const now = new Date();
  const sessionStart = new Date(scheduledAt);
  const sessionEnd = new Date(sessionStart.getTime() + (durationMinutes || 60) * 60000);
  
  if (now < sessionStart) return "upcoming";
  if (now > sessionEnd) return "past";
  return "active";
}

// Helper function to format time
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
}

// Helper function to calculate end time
function getEndTime(startDate: Date, durationMinutes?: number | null): string {
  const endDate = new Date(startDate.getTime() + (durationMinutes || 60) * 60000);
  return formatTime(endDate);
}

// Client pill colors
const clientColors = [
  { bg: "bg-blue-100", text: "text-blue-800" },
  { bg: "bg-green-100", text: "text-green-800" },
  { bg: "bg-purple-100", text: "text-purple-800" },
  { bg: "bg-red-100", text: "text-red-800" },
  { bg: "bg-yellow-100", text: "text-yellow-800" },
];

function getClientColor(index: number) {
  return clientColors[index % clientColors.length];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
}

interface SessionWithParticipants {
  id: string;
  name: string;
  scheduledAt: Date;
  durationMinutes: number | null;
  maxParticipants: number | null;
  participants?: Array<{
    userId: string;
    userName?: string;
    status?: string;
  }>;
}

function SessionCard({ 
  session, 
  index,
  participants = []
}: { 
  session: SessionWithParticipants; 
  index: number;
  participants?: Array<{ id: string; name: string | null; email: string }>;
}) {
  const status = getSessionStatus(session.scheduledAt, session.durationMinutes);
  const isPast = status === "past";
  const isActive = status === "active";
  
  const sessionDate = new Date(session.scheduledAt);
  const startTime = formatTime(sessionDate);
  const endTime = getEndTime(sessionDate, session.durationMinutes);
  
  return (
    <div className={`bg-gray-50 rounded-xl p-4 ${isPast ? 'opacity-70' : ''} ${isActive ? 'ring-2 ring-green-500' : ''}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-lg text-gray-800">
            {formatDate(sessionDate)}
          </p>
          <p className="text-sm text-gray-500">
            {session.name} | {startTime} - {endTime}
            {isActive && <span className="ml-2 text-green-600 font-medium">(Active)</span>}
          </p>
        </div>
        <button className="text-gray-500 hover:text-gray-700">
          <Icon name="more_horiz" size={24} />
        </button>
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-gray-600 mb-2">
          Participants: {participants.length}
          {session.maxParticipants && ` / ${session.maxParticipants}`}
        </p>
        <div className="flex flex-wrap gap-2">
          {participants.length > 0 ? (
            participants.map((participant, clientIndex) => {
              const color = getClientColor(index * 10 + clientIndex);
              const displayName = participant.name || participant.email.split('@')[0];
              const avatarUrl = `${AVATAR_API_URL}?seed=${encodeURIComponent(displayName)}`;
              
              return (
                <div
                  key={participant.id}
                  className={`flex items-center ${color.bg} ${color.text} text-sm font-medium px-3 py-1 rounded-full`}
                >
                  <img
                    alt={`${displayName} Avatar`}
                    className="w-6 h-6 rounded-full mr-2 object-cover"
                    src={avatarUrl}
                  />
                  {displayName}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-400">No participants yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SessionsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch sessions from API
  const { data: sessions, isLoading: sessionsLoading, refetch } = useQuery(
    trpc.trainingSession.list.queryOptions({ limit: 100 })
  );

  // Fetch all clients to get participant info
  const { data: clients } = useQuery(
    trpc.auth.getClientsByBusiness.queryOptions()
  );

  // Create a map of user IDs to user info for easy lookup
  const userMap = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string | null; email: string }>();
    clients?.forEach(client => {
      map.set(client.id, client);
    });
    return map;
  }, [clients]);

  // Separate sessions into upcoming and past
  const { upcomingSessions, pastSessions, activeSessions } = React.useMemo(() => {
    if (!sessions) return { upcomingSessions: [], pastSessions: [], activeSessions: [] };
    
    const upcoming: typeof sessions = [];
    const past: typeof sessions = [];
    const active: typeof sessions = [];
    
    sessions.forEach(session => {
      const status = getSessionStatus(session.scheduledAt, session.durationMinutes);
      if (status === "upcoming") upcoming.push(session);
      else if (status === "past") past.push(session);
      else active.push(session);
    });
    
    // Sort upcoming by date (earliest first)
    upcoming.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    
    // Sort past by date (most recent first)
    past.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
    
    return { upcomingSessions: upcoming, pastSessions: past, activeSessions: active };
  }, [sessions]);

  // Refresh data after modal closes
  React.useEffect(() => {
    if (!isModalOpen) {
      refetch();
    }
  }, [isModalOpen, refetch]);

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Sessions</h1>
          <p className="text-gray-500">Track and manage your client sessions.</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 flex items-center space-x-2"
        >
          <Icon name="add" size={20} />
          <span>New Session</span>
        </Button>
      </header>

      <main className="space-y-6">
        {sessionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading sessions...</div>
          </div>
        ) : (
          <>
            {/* Active Sessions (if any) */}
            {activeSessions.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center">
                  Active Now
                  <span className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                </h2>
                <div className="space-y-4">
                  {activeSessions.map((session, index) => {
                    // For now, we don't have participant data linked to sessions
                    // This would need a separate query to UserTrainingSession
                    return (
                      <SessionCard 
                        key={session.id} 
                        session={session} 
                        index={index}
                        participants={[]}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upcoming Sessions */}
            <div>
              <h2 className="text-xl font-bold text-gray-700 mb-4">Upcoming Sessions</h2>
              <div className="space-y-4">
                {upcomingSessions.length > 0 ? (
                  upcomingSessions.map((session, index) => (
                    <SessionCard 
                      key={session.id} 
                      session={session} 
                      index={index + activeSessions.length}
                      participants={[]}
                    />
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No upcoming sessions scheduled.
                  </p>
                )}
              </div>
            </div>

            {/* Past Sessions */}
            <div>
              <h2 className="text-xl font-bold text-gray-700 mb-4">Past Sessions</h2>
              <div className="space-y-4">
                {pastSessions.length > 0 ? (
                  pastSessions.map((session, index) => (
                    <SessionCard 
                      key={session.id} 
                      session={session} 
                      index={index + upcomingSessions.length + activeSessions.length}
                      participants={[]}
                    />
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No past sessions found.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* New Training Session Modal */}
      <NewTrainingSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}