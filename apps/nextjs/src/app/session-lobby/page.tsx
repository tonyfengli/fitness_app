"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { PlayerListItem } from "@acme/ui-desktop";
import type { PlayerStatus } from "@acme/ui-desktop";
import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useCheckInStream } from "~/hooks/useCheckInStream";
import type { CheckInEvent } from "~/hooks/useCheckInStream";

interface CheckedInClient {
  userId: string;
  userName: string | null;
  userEmail: string;
  checkedInAt: Date | null;
  isNew?: boolean; // For animation purposes
}

export default function SessionLobby() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const trpc = useTRPC();
  
  const [checkedInClients, setCheckedInClients] = useState<CheckedInClient[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "reconnecting">("disconnected");
  const [error, setError] = useState<string | null>(null);
  
  // Fetch initial checked-in clients
  const { data: initialClients, isLoading } = useQuery(
    sessionId ? trpc.trainingSession.getCheckedInClients.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ["disabled"],
      queryFn: () => Promise.resolve([])
    }
  );
  
  // Set initial clients when data loads
  useEffect(() => {
    if (initialClients) {
      setCheckedInClients(initialClients);
    }
  }, [initialClients]);
  
  // Handle new check-ins from SSE
  const handleCheckIn = useCallback((event: CheckInEvent) => {
    setCheckedInClients(prev => {
      // Check if client already exists
      const exists = prev.some(client => client.userId === event.userId);
      if (exists) {
        return prev;
      }
      
      // Add new client at the beginning with animation flag
      return [{
        userId: event.userId,
        userName: event.name,
        userEmail: "", // We don't have email from the event
        checkedInAt: new Date(event.checkedInAt),
        isNew: true
      }, ...prev];
    });
    
    // Remove the "new" flag after animation completes
    setTimeout(() => {
      setCheckedInClients(prev => 
        prev.map(client => ({ ...client, isNew: false }))
      );
    }, 1000);
  }, []);
  
  // Set up SSE connection only if we have a sessionId
  const { isConnected, isReconnecting, error: streamError } = useCheckInStream(
    sessionId ? {
      sessionId,
      onCheckIn: handleCheckIn,
      onConnect: () => setConnectionStatus("connected"),
      onDisconnect: () => setConnectionStatus("disconnected"),
      onError: (err) => setError(err.message)
    } : {
      sessionId: "",
      onCheckIn: () => {},
      onConnect: () => {},
      onDisconnect: () => {},
      onError: () => {}
    }
  );
  
  useEffect(() => {
    if (isConnected) setConnectionStatus("connected");
    else if (isReconnecting) setConnectionStatus("reconnecting");
    else setConnectionStatus("disconnected");
  }, [isConnected, isReconnecting]);
  
  if (!sessionId) {
    return (
      <div className="bg-white font-sans min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">No Session Selected</h1>
            <p className="mt-2 text-gray-600">Please select a session from the sessions page.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white font-sans min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          {/* Error Banner - only show for actual errors */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}
        </div>
        
        <main className="mt-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Session Lobby</h1>
            <p className="text-gray-600">
              {checkedInClients.length} client{checkedInClients.length !== 1 ? 's' : ''} checked in
            </p>
            <div className="mt-2 h-6 flex items-center justify-center">
              {connectionStatus === "connected" ? (
                <span className="text-green-600 text-xl">✓</span>
              ) : connectionStatus === "disconnected" && !error ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm text-gray-600">Connecting...</span>
                </div>
              ) : connectionStatus === "reconnecting" ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm text-yellow-600">Reconnecting...</span>
                </div>
              ) : null}
            </div>
          </div>
          
          <div className="text-center mb-8">
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-12 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 text-lg inline-flex items-center justify-center">
              Start Session
            </button>
          </div>
          
          <div className="mt-16 max-w-3xl mx-auto">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Loading checked-in clients...</p>
              </div>
            ) : checkedInClients.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No clients have checked in yet.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Clients can text "here" to your gym's number to check in.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {checkedInClients.map((client) => (
                  <div
                    key={client.userId}
                    className={`transition-all duration-1000 ${
                      client.isNew 
                        ? "animate-fadeIn bg-green-50 rounded-lg" 
                        : ""
                    }`}
                  >
                    <PlayerListItem
                      name={client.userName || "Unknown"}
                      avatar={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.userId}`}
                      status="online" as PlayerStatus
                      level={undefined}
                      description={`Checked in ${
                        client.checkedInAt 
                          ? new Date(client.checkedInAt).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })
                          : 'just now'
                      }`}
                      onEdit={() => console.log(`Edit ${client.userName}`)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}