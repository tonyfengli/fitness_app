"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  SidebarLayout, 
  ClientSidebar,
} from "@acme/ui-desktop";
import { useTRPC } from "~/trpc/react";
import { useRouter } from "next/navigation";

// Constants
const AVATAR_API_URL = "https://api.dicebear.com/7.x/avataaars/svg";

// Helper function to format strength/skill levels
function formatLevel(level: string): string {
  return level.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

// Client type
interface Client {
  id: string;
  name: string;
  program: string;
  avatar: string;
}

// Message type
interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  metadata?: any;
  status: string;
  createdAt: Date | string;
}

export default function MessagesPage() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const trpc = useTRPC();
  const router = useRouter();

  // Fetch clients from the API
  const { data: clientsData, isLoading, error } = useQuery(
    trpc.auth.getClientsByBusiness.queryOptions()
  );

  // Transform API data to match Client interface
  const clients = clientsData?.map(client => ({
    id: client.id,
    name: client.name || client.email.split('@')[0],
    program: client.profile 
      ? `${formatLevel(client.profile.strengthLevel)} strength, ${formatLevel(client.profile.skillLevel)} skill`
      : "No profile set",
    avatar: `${AVATAR_API_URL}?seed=${encodeURIComponent(client.name || client.email || client.id)}`
  })) || [];

  // Set initial selected client when data loads
  React.useEffect(() => {
    if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
    // Debug logging
    if (clients.length > 0) {
      console.log("Available clients:", clients.map(c => ({ id: c.id, name: c.name })));
    }
  }, [clients, selectedClientId]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Fetch messages for selected client
  const { data: messages, isLoading: messagesLoading, error: messagesError } = useQuery({
    ...trpc.messages.getByUser.queryOptions({ userId: selectedClientId || "" }),
    enabled: !!selectedClientId && selectedClientId !== "",
  });
  
  // Debug logging
  React.useEffect(() => {
    if (messagesError && selectedClientId) {
      console.error("Error fetching messages:", messagesError);
    }
    if (messages) {
      console.log("Messages loaded:", messages.length, "for user:", selectedClientId);
    }
  }, [messages, messagesError, selectedClientId]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading clients</p>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarLayout
      sidebar={
        <ClientSidebar
          clients={clients}
          selectedClientId={selectedClientId}
          onClientSelect={(client) => setSelectedClientId(client.id)}
          onAddNewClient={() => router.push("/signup")}
        />
      }
      sidebarWidth="w-80"
    >
      <div className="flex flex-col h-full">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 p-8">
            <div className="text-gray-500">Loading clients...</div>
          </div>
        ) : clients.length === 0 ? (
          <div className="flex items-center justify-center h-64 p-8">
            <div className="text-center">
              <p className="text-gray-500 mb-4">No clients found in your business</p>
            </div>
          </div>
        ) : selectedClient ? (
          <div className="flex-1 overflow-y-auto p-8">
            <header className="mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-900">{selectedClient.name}</h1>
                <p className="text-gray-500 mt-1">{selectedClient.program}</p>
              </div>
            </header>

            {/* Messages area */}
            <div className="space-y-4 max-w-4xl mx-auto">
              {messagesLoading ? (
                <div className="text-gray-500 text-center py-8">Loading messages...</div>
              ) : messages && messages.length > 0 ? (
                (messages as Message[]).map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-4 ${
                        message.direction === 'outbound'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <div className={`text-xs mt-2 ${
                        message.direction === 'outbound' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        <span>{new Date(message.createdAt).toLocaleString()}</span>
                        {message.metadata && typeof message.metadata === 'object' && 'intent' in message.metadata && message.metadata.intent && (
                          <span className="ml-2">• Intent: {(message.metadata.intent as any).type}</span>
                        )}
                        <span className="ml-2">• {message.status}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-center py-8">No messages yet</div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 p-8">
            <p className="text-gray-500">Select a client to view their messages</p>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}