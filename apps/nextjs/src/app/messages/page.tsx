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

// Preference Collection Summary Component
interface PreferenceCollectionSummaryProps {
  message: Message;
}

function PreferenceCollectionSummary({ message }: PreferenceCollectionSummaryProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Get preference parsing data
  const preferenceParsingLLM = message.metadata?.llmCalls?.find((call: any) => call.type === 'preference_parsing') ||
                               message.metadata?.llmParsing;
  
  // Get exercise validation data
  const exerciseValidation = message.metadata?.exerciseValidation || 
                            message.metadata?.llmParsing?.exerciseValidation;
  
  // Check for ambiguous matches (disambiguation cases)
  // For disambiguation messages, ambiguous matches are nested under llmParsing.exerciseValidation
  const ambiguousMatches = message.metadata?.ambiguousMatches || 
                          message.metadata?.llmParsing?.exerciseValidation?.ambiguousMatches || 
                          [];

  // Get all exercise matching LLM calls
  const exerciseMatchingLLMs = message.metadata?.llmCalls?.filter((call: any) => call.type === 'exercise_matching') || [];

  if (!preferenceParsingLLM && !exerciseValidation) {
    return null;
  }

  return (
    <div className={`mt-3 p-3 rounded-lg text-sm ${
      message.direction === 'outbound' 
        ? 'bg-white/5 border border-white/10' 
        : 'bg-gray-50 border border-gray-200'
    }`}>
      <div className={`font-semibold mb-3 text-base ${
        message.direction === 'outbound' ? 'text-blue-100' : 'text-gray-800'
      }`}>
        ═══ Preference Collection Summary ═══
      </div>

      {/* 1. Input Message */}
      <div className={`mb-3 ${message.direction === 'outbound' ? 'text-white' : 'text-gray-900'}`}>
        <span className="font-semibold">1. Input Message:</span>
        <div className="ml-4 mt-1 italic">"{preferenceParsingLLM?.userInput || 'N/A'}"</div>
      </div>

      {/* 2. Preference Parsing */}
      {preferenceParsingLLM && (
        <div className={`mb-3 ${message.direction === 'outbound' ? 'text-white' : 'text-gray-900'}`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              2. Preference Parsing {preferenceParsingLLM.parseTimeMs && `(${preferenceParsingLLM.parseTimeMs}ms)`}:
            </span>
            <button
              onClick={() => toggleSection('preference-parsing')}
              className={`text-xs px-2 py-1 rounded ${
                message.direction === 'outbound' 
                  ? 'bg-white/10 hover:bg-white/20' 
                  : 'bg-gray-200 hover:bg-gray-300'
              } transition-colors`}
            >
              {expandedSections.has('preference-parsing') ? '▼ Collapse' : '▶ Expand'}
            </button>
          </div>
          
          {!expandedSections.has('preference-parsing') ? (
            <div className="ml-4 mt-2 space-y-1">
              {preferenceParsingLLM.parsedResponse?.sessionGoal && (
                <div>✓ Session Goal: {preferenceParsingLLM.parsedResponse.sessionGoal}</div>
              )}
              {preferenceParsingLLM.parsedResponse?.intensity && (
                <div>✓ Intensity: {preferenceParsingLLM.parsedResponse.intensity}</div>
              )}
              {preferenceParsingLLM.parsedResponse?.muscleTargets?.length > 0 && (
                <div>✓ Muscle Targets: {preferenceParsingLLM.parsedResponse.muscleTargets.join(', ')}</div>
              )}
              {preferenceParsingLLM.parsedResponse?.muscleLessens?.length > 0 && (
                <div>✓ Muscle Lessens: {preferenceParsingLLM.parsedResponse.muscleLessens.join(', ')}</div>
              )}
              {preferenceParsingLLM.parsedResponse?.includeExercises?.length > 0 && (
                <div>✓ Include Exercises: {preferenceParsingLLM.parsedResponse.includeExercises.join(', ')}</div>
              )}
              {preferenceParsingLLM.parsedResponse?.avoidExercises?.length > 0 && (
                <div>✓ Avoid Exercises: {preferenceParsingLLM.parsedResponse.avoidExercises.join(', ')}</div>
              )}
              {preferenceParsingLLM.parsedResponse?.avoidJoints?.length > 0 && (
                <div>✓ Avoid Joints: {preferenceParsingLLM.parsedResponse.avoidJoints.join(', ')}</div>
              )}
            </div>
          ) : (
            <div className="ml-4 mt-2 space-y-3">
              <div>
                <div className="font-semibold text-sm mb-1">LLM Input (System Prompt):</div>
                <pre className="text-xs bg-black/10 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                  {preferenceParsingLLM.systemPrompt || 'No system prompt available'}
                </pre>
              </div>
              <div>
                <div className="font-semibold text-sm mb-1">LLM Output (Raw):</div>
                <pre className="text-xs bg-black/10 p-2 rounded overflow-x-auto">
                  {JSON.stringify(preferenceParsingLLM.rawResponse || preferenceParsingLLM.rawLLMResponse, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Exclude Exercises */}
      {exerciseValidation?.avoidExercises?.matches?.length > 0 && (
        <div className={`mb-3 ${message.direction === 'outbound' ? 'text-white' : 'text-gray-900'}`}>
          <div className="font-semibold mb-2">3. Exclude Exercises:</div>
          <div className="ml-4 space-y-2">
            {exerciseValidation.avoidExercises.matches.map((match: any, idx: number) => {
              const matchLLM = exerciseMatchingLLMs.find((llm: any) => 
                llm.userInput === match.userInput
              );
              const sectionId = `exclude-${idx}`;
              
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between">
                    <span>
                      "{match.userInput}" → {match.matchedExercises?.length || 0} matches 
                      [{match.matchMethod?.toUpperCase()}, {match.parseTimeMs || 0}ms]
                    </span>
                    <button
                      onClick={() => toggleSection(sectionId)}
                      className={`text-xs px-2 py-1 rounded ml-2 ${
                        message.direction === 'outbound' 
                          ? 'bg-white/10 hover:bg-white/20' 
                          : 'bg-gray-200 hover:bg-gray-300'
                      } transition-colors`}
                    >
                      {expandedSections.has(sectionId) ? '▼ Details' : '▶ Details'}
                    </button>
                  </div>
                  
                  {expandedSections.has(sectionId) && (
                    <div className="ml-4 mt-2 text-xs space-y-2">
                      <div>
                        <span className="font-semibold">Matched Exercises:</span>
                        <div className="ml-2 mt-1">
                          {match.matchedExercises?.map((ex: any) => ex.name).join(', ') || 'None'}
                        </div>
                      </div>
                      
                      {match.matchMethod === 'llm' && matchLLM && (
                        <>
                          <div>
                            <span className="font-semibold">LLM System Prompt:</span>
                            <pre className="bg-black/10 p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap">
                              {matchLLM.systemPrompt}
                            </pre>
                          </div>
                          <div>
                            <span className="font-semibold">LLM Raw Output:</span>
                            <pre className="bg-black/10 p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(matchLLM.rawResponse, null, 2)}
                            </pre>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Include Exercises */}
      {(exerciseValidation?.includeExercises?.matches?.length > 0 || ambiguousMatches.length > 0) && (
        <div className={`mb-3 ${message.direction === 'outbound' ? 'text-white' : 'text-gray-900'}`}>
          <div className="font-semibold mb-2">
            {exerciseValidation?.avoidExercises?.matches?.length > 0 ? '4' : '3'}. Include Exercises:
          </div>
          <div className="ml-4 space-y-2">
            {/* Regular include matches */}
            {exerciseValidation?.includeExercises?.matches?.map((match: any, idx: number) => {
              const matchLLM = exerciseMatchingLLMs.find((llm: any) => 
                llm.userInput === match.userInput
              );
              const sectionId = `include-${idx}`;
              
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between">
                    <span>
                      "{match.userInput}" → {match.matchedExercises?.length || 0} matches 
                      [{match.matchMethod?.toUpperCase() || 'UNKNOWN'}, {match.parseTimeMs || 0}ms]
                    </span>
                    <button
                      onClick={() => toggleSection(sectionId)}
                      className={`text-xs px-2 py-1 rounded ml-2 ${
                        message.direction === 'outbound' 
                          ? 'bg-white/10 hover:bg-white/20' 
                          : 'bg-gray-200 hover:bg-gray-300'
                      } transition-colors`}
                    >
                      {expandedSections.has(sectionId) ? '▼ Details' : '▶ Details'}
                    </button>
                  </div>
                  
                  {expandedSections.has(sectionId) && (
                    <div className="ml-4 mt-2 text-xs space-y-2">
                      <div>
                        <span className="font-semibold">Matched Exercises:</span>
                        <div className="ml-2 mt-1">
                          {match.matchedExercises?.map((ex: any) => ex.name).join(', ') || 'None'}
                        </div>
                      </div>
                      
                      {match.matchMethod === 'llm' && matchLLM && (
                        <>
                          <div>
                            <span className="font-semibold">LLM System Prompt:</span>
                            <pre className="bg-black/10 p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap">
                              {matchLLM.systemPrompt}
                            </pre>
                          </div>
                          <div>
                            <span className="font-semibold">LLM Raw Output:</span>
                            <pre className="bg-black/10 p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(matchLLM.rawResponse, null, 2)}
                            </pre>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Ambiguous matches (for disambiguation) */}
            {ambiguousMatches.map((match: any, idx: number) => {
              const matchLLM = exerciseMatchingLLMs.find((llm: any) => 
                llm.userInput === match.userInput
              );
              const sectionId = `include-ambiguous-${idx}`;
              
              return (
                <div key={`ambiguous-${idx}`}>
                  <div className="flex items-center justify-between">
                    <span>
                      "{match.userInput}" → {match.matchedExercises?.length || 0} matches 
                      [{match.matchMethod?.toUpperCase() || match.confidence?.toUpperCase() || 'UNKNOWN'}, {match.parseTimeMs || 0}ms]
                      <span className="text-amber-600 ml-1">(disambiguation needed)</span>
                    </span>
                    <button
                      onClick={() => toggleSection(sectionId)}
                      className={`text-xs px-2 py-1 rounded ml-2 ${
                        message.direction === 'outbound' 
                          ? 'bg-white/10 hover:bg-white/20' 
                          : 'bg-gray-200 hover:bg-gray-300'
                      } transition-colors`}
                    >
                      {expandedSections.has(sectionId) ? '▼ Details' : '▶ Details'}
                    </button>
                  </div>
                  
                  {expandedSections.has(sectionId) && (
                    <div className="ml-4 mt-2 text-xs space-y-2">
                      <div>
                        <span className="font-semibold">Matched Exercises:</span>
                        <div className="ml-2 mt-1">
                          {match.matchedExercises?.map((ex: any) => ex.name).join(', ') || 'None'}
                        </div>
                      </div>
                      
                      {match.matchMethod === 'llm' && matchLLM && (
                        <>
                          <div>
                            <span className="font-semibold">LLM System Prompt:</span>
                            <pre className="bg-black/10 p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap">
                              {matchLLM.systemPrompt}
                            </pre>
                          </div>
                          <div>
                            <span className="font-semibold">LLM Raw Output:</span>
                            <pre className="bg-black/10 p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(matchLLM.rawResponse, null, 2)}
                            </pre>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
                      
                      {/* Display preference collection summary if available */}
                      <PreferenceCollectionSummary message={message} />
                      
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