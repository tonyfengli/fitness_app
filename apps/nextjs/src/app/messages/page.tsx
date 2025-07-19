"use client";

import React, { useState, useRef, useEffect } from "react";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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

  // Sort messages by date (oldest first, so newest appears at bottom)
  const sortedMessages = React.useMemo(() => {
    if (!messages) return [];
    return [...messages].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messages]);

  // Scroll to bottom when messages change or selected client changes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Delay scroll to ensure DOM is updated
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [sortedMessages, selectedClientId]);
  
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
    <div className="h-[calc(100vh-4rem)]"> {/* Assuming navbar is 4rem/64px */}
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
        className="h-full"
      >
        <div className="flex flex-col h-full">
        {isLoading ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-gray-500">Loading clients...</div>
          </div>
        ) : clients.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center">
              <p className="text-gray-500 mb-4">No clients found in your business</p>
            </div>
          </div>
        ) : selectedClient ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Fixed header */}
            <header className="flex-shrink-0 p-8 pb-4 border-b border-gray-200">
              <div>
                <h1 className="text-4xl font-bold text-gray-900">{selectedClient.name}</h1>
                <p className="text-gray-500 mt-1">{selectedClient.program}</p>
              </div>
            </header>

            {/* Scrollable messages area */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-8">
              <div className="space-y-4 max-w-4xl mx-auto">
                {messagesLoading ? (
                  <div className="text-gray-500 text-center py-8">Loading messages...</div>
                ) : sortedMessages && sortedMessages.length > 0 ? (
                  sortedMessages.map((message) => (
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
                      
                      {/* LLM Parsing Details for Preference Collection */}
                      {message.metadata?.llmParsing && (
                        <div className={`mt-3 p-2 rounded text-xs space-y-2 ${
                          message.direction === 'outbound' 
                            ? 'bg-white/10' 
                            : 'bg-gray-800/10 border border-gray-200'
                        }`}>
                          <div className={`font-semibold ${
                            message.direction === 'outbound' ? 'text-yellow-200' : 'text-yellow-600'
                          }`}>🤖 LLM Analysis</div>
                          
                          {/* LLM System Prompt */}
                          <div className={
                            message.direction === 'outbound' ? 'text-gray-300' : 'text-gray-600'
                          }>
                            <span className="font-medium">System Prompt:</span>
                            <div className="mt-1 ml-2 text-xs italic">
                              "Extract workout preferences: intensity (tired→low, normal→moderate, energetic→high), 
                              muscle targets/avoidance, joint issues, session goals (strength/stability/conditioning), 
                              and specific exercise requests. Set needsFollowUp=true if vague."
                            </div>
                          </div>
                          
                          {/* User Input */}
                          <div className={
                            message.direction === 'outbound' ? 'text-cyan-100' : 'text-cyan-700'
                          }>
                            <span className="font-medium">User Input:</span> "{message.metadata.llmParsing.userInput}"
                          </div>
                          
                          {/* Extracted Fields */}
                          <div className={
                            message.direction === 'outbound' ? 'text-green-200' : 'text-green-700'
                          }>
                            <span className="font-medium">Extracted:</span>
                            {message.metadata.llmParsing.extractedFields.intensity && (
                              <span className="block ml-2">• Intensity: {message.metadata.llmParsing.extractedFields.intensity}</span>
                            )}
                            {message.metadata.llmParsing.extractedFields.muscleTargets?.length > 0 && (
                              <span className="block ml-2">• Targets: {message.metadata.llmParsing.extractedFields.muscleTargets.join(", ")}</span>
                            )}
                            {message.metadata.llmParsing.extractedFields.muscleLessens?.length > 0 && (
                              <span className="block ml-2">• Avoid muscles: {message.metadata.llmParsing.extractedFields.muscleLessens.join(", ")}</span>
                            )}
                            {message.metadata.llmParsing.extractedFields.avoidJoints?.length > 0 && (
                              <span className="block ml-2">• Avoid joints: {message.metadata.llmParsing.extractedFields.avoidJoints.join(", ")}</span>
                            )}
                            {message.metadata.llmParsing.extractedFields.includeExercises?.length > 0 && (
                              <span className="block ml-2">• Include exercises: {message.metadata.llmParsing.extractedFields.includeExercises.join(", ")}</span>
                            )}
                            {message.metadata.llmParsing.extractedFields.avoidExercises?.length > 0 && (
                              <span className="block ml-2">• Avoid exercises: {message.metadata.llmParsing.extractedFields.avoidExercises.join(", ")}</span>
                            )}
                            {message.metadata.llmParsing.extractedFields.sessionGoal && (
                              <span className="block ml-2">• Goal: {message.metadata.llmParsing.extractedFields.sessionGoal}</span>
                            )}
                            {message.metadata.llmParsing.extractedFields.generalNotes && (
                              <span className="block ml-2">• Notes: {message.metadata.llmParsing.extractedFields.generalNotes}</span>
                            )}
                            {(!message.metadata.llmParsing.extractedFields.intensity && 
                              !message.metadata.llmParsing.extractedFields.muscleTargets?.length && 
                              !message.metadata.llmParsing.extractedFields.muscleLessens?.length &&
                              !message.metadata.llmParsing.extractedFields.avoidJoints?.length &&
                              !message.metadata.llmParsing.extractedFields.sessionGoal) && (
                              <span className="block ml-2 italic">No specific preferences extracted</span>
                            )}
                          </div>
                          
                          {/* Confidence Indicators */}
                          <div className={
                            message.direction === 'outbound' ? 'text-orange-200' : 'text-orange-600'
                          }>
                            <span className="font-medium">Confidence:</span>
                            {message.metadata.llmParsing.confidenceIndicators.hasIntensity && <span className="ml-2">✓ Intensity</span>}
                            {message.metadata.llmParsing.confidenceIndicators.hasMuscleTargets && <span className="ml-2">✓ Targets</span>}
                            {message.metadata.llmParsing.confidenceIndicators.hasRestrictions && <span className="ml-2">✓ Restrictions</span>}
                            {message.metadata.llmParsing.confidenceIndicators.hasSpecificRequests && <span className="ml-2">✓ Requests</span>}
                            {message.metadata.llmParsing.confidenceIndicators.requiresFollowUp && (
                              <span className={`ml-2 ${
                                message.direction === 'outbound' ? 'text-red-300' : 'text-red-600'
                              }`}>⚠ Needs follow-up</span>
                            )}
                          </div>
                          
                          {/* Parse Metadata */}
                          <div className={
                            message.direction === 'outbound' ? 'text-purple-200' : 'text-purple-700'
                          }>
                            <span className="font-medium">Model:</span> {message.metadata.llmParsing.model} • 
                            <span className="font-medium"> Parse time:</span> {message.metadata.llmParsing.parseTimeMs}ms
                          </div>
                        </div>
                      )}
                      
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
                {/* Invisible element to scroll to */}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full p-8">
            <p className="text-gray-500">Select a client to view their messages</p>
          </div>
        )}
        </div>
      </SidebarLayout>
    </div>
  );
}