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

// LLM Analysis Display Component
interface LLMAnalysisDisplayProps {
  llmParsing: any;
  direction: 'inbound' | 'outbound';
  index: number;
  isExerciseValidation?: boolean;
}

function LLMAnalysisDisplay({ llmParsing, direction, index, isExerciseValidation = false }: LLMAnalysisDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className={`mt-2 p-2 rounded text-xs ${
      direction === 'outbound' 
        ? 'bg-white/10' 
        : 'bg-gray-800/10 border border-gray-200'
    }`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 w-full text-left font-semibold ${
          direction === 'outbound' ? 'text-yellow-200' : 'text-yellow-600'
        } hover:opacity-80 transition-opacity`}
      >
        <span className="text-sm">{isExpanded ? '▼' : '▶'}</span>
        <span>🤖 LLM {index}: {llmParsing.model || 'Analysis'}</span>
        {llmParsing.parseTimeMs && (
          <span className="ml-auto font-normal text-xs opacity-70">
            {llmParsing.parseTimeMs}ms
          </span>
        )}
      </button>
      
      {isExpanded && (
        <div className="mt-3 space-y-3 text-sm">
          {/* LLM Input (System Prompt) */}
          <div className={direction === 'outbound' ? 'text-white' : 'text-gray-900'}>
            <span className="font-semibold">LLM Input:</span>
            <div className="mt-1 ml-4 whitespace-pre-wrap">
              {isExerciseValidation ? (
                // For LLM 2 (Exercise Matcher) - show the actual system prompt if available
                (() => {
                  // Try to find the system prompt from any of the matches
                  const systemPrompt = 
                    llmParsing.exerciseValidation?.avoidExercises?.matches?.[0]?.systemPrompt ||
                    llmParsing.exerciseValidation?.includeExercises?.matches?.[0]?.systemPrompt ||
                    llmParsing.exerciseValidation?.matches?.[0]?.systemPrompt;
                  
                  return systemPrompt ? (
                    <div className="opacity-70">{systemPrompt}</div>
                  ) : (
                    <div>
                      <div className="opacity-70">System: Match exercises to database</div>
                      <div className="mt-2">User Input: {llmParsing.userInput}</div>
                    </div>
                  );
                })()
              ) : (
                // For LLM 1 - show the system prompt
                llmParsing.systemPrompt ? (
                  <div className="opacity-70">{llmParsing.systemPrompt}</div>
                ) : (
                  <div className="opacity-70">No system prompt available</div>
                )
              )}
            </div>
          </div>
          
          {/* LLM Output (Raw) */}
          <div className={direction === 'outbound' ? 'text-white' : 'text-gray-900'}>
            <span className="font-semibold">LLM Output:</span>
            <div className="mt-1 ml-4">
              <pre className="whitespace-pre-wrap">
                {isExerciseValidation ? (
                  // For LLM 2 - show the raw exercise validation response without system prompts
                  (() => {
                    const cleanedValidation = JSON.parse(JSON.stringify(llmParsing.exerciseValidation));
                    // Remove system prompts from the output to avoid duplication
                    if (cleanedValidation.avoidExercises?.matches) {
                      cleanedValidation.avoidExercises.matches = cleanedValidation.avoidExercises.matches.map((match: any) => {
                        const { systemPrompt, ...cleanMatch } = match;
                        return cleanMatch;
                      });
                    }
                    if (cleanedValidation.includeExercises?.matches) {
                      cleanedValidation.includeExercises.matches = cleanedValidation.includeExercises.matches.map((match: any) => {
                        const { systemPrompt, ...cleanMatch } = match;
                        return cleanMatch;
                      });
                    }
                    if (cleanedValidation.matches) {
                      cleanedValidation.matches = cleanedValidation.matches.map((match: any) => {
                        const { systemPrompt, ...cleanMatch } = match;
                        return cleanMatch;
                      });
                    }
                    return JSON.stringify(cleanedValidation, null, 2);
                  })()
                ) : (
                  // For LLM 1 - show the raw LLM response
                  llmParsing.rawLLMResponse ? 
                    JSON.stringify(llmParsing.rawLLMResponse, null, 2) :
                    "No raw response available"
                )}
              </pre>
            </div>
          </div>
          
          {/* Debug Info - Only show if there's an error */}
          <div className={direction === 'outbound' ? 'text-white' : 'text-gray-900'}>
            <span className="font-semibold">Debug Info:</span>
            <div className="mt-1 ml-4">
              {(llmParsing.debugInfo?.parseSuccess === false || 
                llmParsing.debugInfo?.validationSuccess === false ||
                llmParsing.debugInfo?.error) ? (
                <pre className="whitespace-pre-wrap text-red-400">
                  {JSON.stringify(llmParsing.debugInfo, null, 2)}
                </pre>
              ) : (
                <span className="opacity-70">N/A</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
                        <>
                          <LLMAnalysisDisplay 
                            llmParsing={message.metadata.llmParsing}
                            direction={message.direction}
                            index={1}
                          />
                          
                          {/* Extract Exercise Validation as LLM 2 */}
                          {message.metadata.llmParsing.exerciseValidation && (
                            <LLMAnalysisDisplay 
                              llmParsing={{
                                model: message.metadata.llmParsing.exerciseValidation.model || 'gpt-4o-mini',
                                userInput: (() => {
                                  // Get all the actual user inputs from the matches
                                  const avoidInputs = message.metadata.llmParsing.exerciseValidation.avoidExercises?.matches?.map((m: any) => m.userInput) || [];
                                  const includeInputs = message.metadata.llmParsing.exerciseValidation.includeExercises?.matches?.map((m: any) => m.userInput) || [];
                                  return JSON.stringify({
                                    avoidExercises: avoidInputs,
                                    includeExercises: includeInputs
                                  });
                                })(),
                                exerciseValidation: message.metadata.llmParsing.exerciseValidation,
                                parseTimeMs: message.metadata.llmParsing.exerciseValidation.parseTimeMs || 
                                  message.metadata.llmParsing.exerciseValidation.matches?.reduce((sum: number, m: any) => sum + (m.parseTimeMs || 0), 0)
                              }}
                              direction={message.direction}
                              index={2}
                              isExerciseValidation={true}
                            />
                          )}
                        </>
                      )}
                      
                      {/* Alternative Second LLM if exists (for other chained LLM calls) */}
                      {message.metadata?.llmParsing2 && (
                        <LLMAnalysisDisplay 
                          llmParsing={message.metadata.llmParsing2}
                          direction={message.direction}
                          index={2}
                        />
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