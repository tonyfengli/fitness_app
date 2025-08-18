"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ClientSidebar, SidebarLayout } from "@acme/ui-desktop";

import { useTRPC } from "~/trpc/react";

// Constants
const AVATAR_API_URL = "https://api.dicebear.com/7.x/avataaars/svg";

// Helper function to format strength/skill levels
function formatLevel(level: string): string {
  return level
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
  direction: "inbound" | "outbound";
  content: string;
  metadata?: any;
  status: string;
  createdAt: Date | string;
}

// Preference Collection Summary Component
interface PreferenceCollectionSummaryProps {
  message: Message;
}

function PreferenceCollectionSummary({
  message,
}: PreferenceCollectionSummaryProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
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
  const preferenceParsingLLM =
    message.metadata?.llmCalls?.find(
      (call: any) => call.type === "preference_parsing",
    ) || message.metadata?.llmParsing;

  // Get exercise validation data
  const exerciseValidation =
    message.metadata?.exerciseValidation ||
    message.metadata?.llmParsing?.exerciseValidation;

  // Check for ambiguous matches (disambiguation cases)
  // For disambiguation messages, ambiguous matches are nested under llmParsing.exerciseValidation
  const ambiguousMatches =
    message.metadata?.ambiguousMatches ||
    message.metadata?.llmParsing?.exerciseValidation?.ambiguousMatches ||
    [];

  // Get all exercise matching LLM calls
  const exerciseMatchingLLMs =
    message.metadata?.llmCalls?.filter(
      (call: any) => call.type === "exercise_matching",
    ) || [];

  if (!preferenceParsingLLM && !exerciseValidation) {
    return null;
  }

  return (
    <div
      className={`mt-3 rounded-lg p-3 text-sm ${
        message.direction === "outbound"
          ? "border border-white/10 bg-white/5"
          : "border border-gray-200 bg-gray-50"
      }`}
    >
      <div
        className={`mb-3 text-base font-semibold ${
          message.direction === "outbound" ? "text-blue-100" : "text-gray-800"
        }`}
      >
        ═══ Preference Collection Summary ═══
      </div>

      {/* 1. Input Message */}
      <div
        className={`mb-3 ${message.direction === "outbound" ? "text-white" : "text-gray-900"}`}
      >
        <span className="font-semibold">1. Input Message:</span>
        <div className="ml-4 mt-1 italic">
          "{preferenceParsingLLM?.userInput || "N/A"}"
        </div>
      </div>

      {/* 2. Preference Parsing */}
      {preferenceParsingLLM && (
        <div
          className={`mb-3 ${message.direction === "outbound" ? "text-white" : "text-gray-900"}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              2. Preference Parsing{" "}
              {preferenceParsingLLM.parseTimeMs &&
                `(${preferenceParsingLLM.parseTimeMs}ms)`}
              :
            </span>
            <button
              onClick={() => toggleSection("preference-parsing")}
              className={`rounded px-2 py-1 text-xs ${
                message.direction === "outbound"
                  ? "bg-white/10 hover:bg-white/20"
                  : "bg-gray-200 hover:bg-gray-300"
              } transition-colors`}
            >
              {expandedSections.has("preference-parsing")
                ? "▼ Collapse"
                : "▶ Expand"}
            </button>
          </div>

          {!expandedSections.has("preference-parsing") ? (
            <div className="ml-4 mt-2 space-y-1">
              {preferenceParsingLLM.parsedResponse?.sessionGoal && (
                <div>
                  ✓ Session Goal:{" "}
                  {preferenceParsingLLM.parsedResponse.sessionGoal}
                </div>
              )}
              {preferenceParsingLLM.parsedResponse?.intensity && (
                <div>
                  ✓ Intensity: {preferenceParsingLLM.parsedResponse.intensity}
                </div>
              )}
              {preferenceParsingLLM.parsedResponse?.muscleTargets?.length >
                0 && (
                <div>
                  ✓ Muscle Targets:{" "}
                  {preferenceParsingLLM.parsedResponse.muscleTargets.join(", ")}
                </div>
              )}
              {preferenceParsingLLM.parsedResponse?.muscleLessens?.length >
                0 && (
                <div>
                  ✓ Muscle Lessens:{" "}
                  {preferenceParsingLLM.parsedResponse.muscleLessens.join(", ")}
                </div>
              )}
              {preferenceParsingLLM.parsedResponse?.includeExercises?.length >
                0 && (
                <div>
                  ✓ Include Exercises:{" "}
                  {preferenceParsingLLM.parsedResponse.includeExercises.join(
                    ", ",
                  )}
                </div>
              )}
              {preferenceParsingLLM.parsedResponse?.avoidExercises?.length >
                0 && (
                <div>
                  ✓ Avoid Exercises:{" "}
                  {preferenceParsingLLM.parsedResponse.avoidExercises.join(
                    ", ",
                  )}
                </div>
              )}
              {preferenceParsingLLM.parsedResponse?.avoidJoints?.length > 0 && (
                <div>
                  ✓ Avoid Joints:{" "}
                  {preferenceParsingLLM.parsedResponse.avoidJoints.join(", ")}
                </div>
              )}
            </div>
          ) : (
            <div className="ml-4 mt-2 space-y-3">
              <div>
                <div className="mb-1 text-sm font-semibold">
                  LLM Input (System Prompt):
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-black/10 p-2 text-xs">
                  {preferenceParsingLLM.systemPrompt ||
                    "No system prompt available"}
                </pre>
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold">
                  LLM Output (Raw):
                </div>
                <pre className="overflow-x-auto rounded bg-black/10 p-2 text-xs">
                  {JSON.stringify(
                    preferenceParsingLLM.rawResponse ||
                      preferenceParsingLLM.rawLLMResponse,
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Exclude Exercises */}
      {exerciseValidation?.avoidExercises?.matches?.length > 0 && (
        <div
          className={`mb-3 ${message.direction === "outbound" ? "text-white" : "text-gray-900"}`}
        >
          <div className="mb-2 font-semibold">3. Exclude Exercises:</div>
          <div className="ml-4 space-y-2">
            {exerciseValidation.avoidExercises.matches.map(
              (match: any, idx: number) => {
                const matchLLM = exerciseMatchingLLMs.find(
                  (llm: any) => llm.userInput === match.userInput,
                );
                const sectionId = `exclude-${idx}`;

                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between">
                      <span>
                        "{match.userInput}" →{" "}
                        {match.matchedExercises?.length || 0} matches [
                        {match.matchMethod?.toUpperCase()},{" "}
                        {match.parseTimeMs || 0}ms]
                      </span>
                      <button
                        onClick={() => toggleSection(sectionId)}
                        className={`ml-2 rounded px-2 py-1 text-xs ${
                          message.direction === "outbound"
                            ? "bg-white/10 hover:bg-white/20"
                            : "bg-gray-200 hover:bg-gray-300"
                        } transition-colors`}
                      >
                        {expandedSections.has(sectionId)
                          ? "▼ Details"
                          : "▶ Details"}
                      </button>
                    </div>

                    {expandedSections.has(sectionId) && (
                      <div className="ml-4 mt-2 space-y-2 text-xs">
                        <div>
                          <span className="font-semibold">
                            Matched Exercises:
                          </span>
                          <div className="ml-2 mt-1">
                            {match.matchedExercises
                              ?.map((ex: any) => ex.name)
                              .join(", ") || "None"}
                          </div>
                        </div>

                        {match.matchMethod === "llm" && matchLLM && (
                          <>
                            <div>
                              <span className="font-semibold">
                                LLM System Prompt:
                              </span>
                              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-black/10 p-2">
                                {matchLLM.systemPrompt}
                              </pre>
                            </div>
                            <div>
                              <span className="font-semibold">
                                LLM Raw Output:
                              </span>
                              <pre className="mt-1 overflow-x-auto rounded bg-black/10 p-2">
                                {JSON.stringify(matchLLM.rawResponse, null, 2)}
                              </pre>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}

      {/* 4. Include Exercises */}
      {(exerciseValidation?.includeExercises?.matches?.length > 0 ||
        ambiguousMatches.length > 0) && (
        <div
          className={`mb-3 ${message.direction === "outbound" ? "text-white" : "text-gray-900"}`}
        >
          <div className="mb-2 font-semibold">
            {exerciseValidation?.avoidExercises?.matches?.length > 0
              ? "4"
              : "3"}
            . Include Exercises:
          </div>
          <div className="ml-4 space-y-2">
            {/* Regular include matches */}
            {exerciseValidation?.includeExercises?.matches?.map(
              (match: any, idx: number) => {
                const matchLLM = exerciseMatchingLLMs.find(
                  (llm: any) => llm.userInput === match.userInput,
                );
                const sectionId = `include-${idx}`;

                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between">
                      <span>
                        "{match.userInput}" →{" "}
                        {match.matchedExercises?.length || 0} matches [
                        {match.matchMethod?.toUpperCase() || "UNKNOWN"},{" "}
                        {match.parseTimeMs || 0}ms]
                      </span>
                      <button
                        onClick={() => toggleSection(sectionId)}
                        className={`ml-2 rounded px-2 py-1 text-xs ${
                          message.direction === "outbound"
                            ? "bg-white/10 hover:bg-white/20"
                            : "bg-gray-200 hover:bg-gray-300"
                        } transition-colors`}
                      >
                        {expandedSections.has(sectionId)
                          ? "▼ Details"
                          : "▶ Details"}
                      </button>
                    </div>

                    {expandedSections.has(sectionId) && (
                      <div className="ml-4 mt-2 space-y-2 text-xs">
                        <div>
                          <span className="font-semibold">
                            Matched Exercises:
                          </span>
                          <div className="ml-2 mt-1">
                            {match.matchedExercises
                              ?.map((ex: any) => ex.name)
                              .join(", ") || "None"}
                          </div>
                        </div>

                        {match.matchMethod === "llm" && matchLLM && (
                          <>
                            <div>
                              <span className="font-semibold">
                                LLM System Prompt:
                              </span>
                              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-black/10 p-2">
                                {matchLLM.systemPrompt}
                              </pre>
                            </div>
                            <div>
                              <span className="font-semibold">
                                LLM Raw Output:
                              </span>
                              <pre className="mt-1 overflow-x-auto rounded bg-black/10 p-2">
                                {JSON.stringify(matchLLM.rawResponse, null, 2)}
                              </pre>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            )}

            {/* Ambiguous matches (for disambiguation) */}
            {ambiguousMatches.map((match: any, idx: number) => {
              const matchLLM = exerciseMatchingLLMs.find(
                (llm: any) => llm.userInput === match.userInput,
              );
              const sectionId = `include-ambiguous-${idx}`;

              return (
                <div key={`ambiguous-${idx}`}>
                  <div className="flex items-center justify-between">
                    <span>
                      "{match.userInput}" →{" "}
                      {match.matchedExercises?.length || 0} matches [
                      {match.matchMethod?.toUpperCase() ||
                        match.confidence?.toUpperCase() ||
                        "UNKNOWN"}
                      , {match.parseTimeMs || 0}ms]
                      <span className="ml-1 text-amber-600">
                        (disambiguation needed)
                      </span>
                    </span>
                    <button
                      onClick={() => toggleSection(sectionId)}
                      className={`ml-2 rounded px-2 py-1 text-xs ${
                        message.direction === "outbound"
                          ? "bg-white/10 hover:bg-white/20"
                          : "bg-gray-200 hover:bg-gray-300"
                      } transition-colors`}
                    >
                      {expandedSections.has(sectionId)
                        ? "▼ Details"
                        : "▶ Details"}
                    </button>
                  </div>

                  {expandedSections.has(sectionId) && (
                    <div className="ml-4 mt-2 space-y-2 text-xs">
                      <div>
                        <span className="font-semibold">
                          Matched Exercises:
                        </span>
                        <div className="ml-2 mt-1">
                          {match.matchedExercises
                            ?.map((ex: any) => ex.name)
                            .join(", ") || "None"}
                        </div>
                      </div>

                      {match.matchMethod === "llm" && matchLLM && (
                        <>
                          <div>
                            <span className="font-semibold">
                              LLM System Prompt:
                            </span>
                            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-black/10 p-2">
                              {matchLLM.systemPrompt}
                            </pre>
                          </div>
                          <div>
                            <span className="font-semibold">
                              LLM Raw Output:
                            </span>
                            <pre className="mt-1 overflow-x-auto rounded bg-black/10 p-2">
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
  const [messageInput, setMessageInput] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const trpc = useTRPC();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch clients from the API
  const {
    data: clientsData,
    isLoading,
    error,
  } = useQuery(trpc.auth.getClientsByBusiness.queryOptions());

  // Transform API data to match Client interface
  const clients =
    clientsData?.map((client) => ({
      id: client.id,
      name: client.name || client.email.split("@")[0],
      program: client.profile
        ? `${formatLevel(client.profile.strengthLevel)} strength, ${formatLevel(client.profile.skillLevel)} skill`
        : "No profile set",
      avatar: `${AVATAR_API_URL}?seed=${encodeURIComponent(client.name || client.email || client.id)}`,
    })) || [];

  // Set initial selected client when data loads
  React.useEffect(() => {
    if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
    // Debug logging
    if (clients.length > 0) {
      console.log(
        "Available clients:",
        clients.map((c) => ({ id: c.id, name: c.name })),
      );
    }
  }, [clients, selectedClientId]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // Fetch messages for selected client
  const {
    data: messages,
    isLoading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    ...trpc.messages.getByUser.queryOptions({ userId: selectedClientId || "" }),
    enabled: !!selectedClientId && selectedClientId !== "",
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    ...trpc.messages.sendMessage.mutationOptions(),
    onMutate: () => {
      setIsSending(true);
    },
    onSuccess: async () => {
      // Clear input
      setMessageInput("");

      // Refetch messages to show the new ones
      await refetchMessages();

      // Focus back on input
      inputRef.current?.focus();
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    },
    onSettled: () => {
      setIsSending(false);
    },
  });

  // Handle sending message
  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedClientId || isSending) return;

    sendMessageMutation.mutate({
      recipientId: selectedClientId,
      content: messageInput.trim(),
    });
  };

  // Handle enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Sort messages by date (oldest first, so newest appears at bottom)
  const sortedMessages = React.useMemo(() => {
    if (!messages) return [];
    return [...messages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [messages]);

  // Get current training session for the selected client if any
  const { data: activeSession } = useQuery({
    ...trpc.trainingSession.getActiveSessionForUser.queryOptions({
      userId: selectedClientId || "",
    }),
    enabled: !!selectedClientId && selectedClientId !== "",
  });

  // SSE removed - will be replaced with Supabase Realtime
  const isConnected = false;

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
      console.log(
        "Messages loaded:",
        messages.length,
        "for user:",
        selectedClientId,
      );
    }
  }, [messages, messagesError, selectedClientId]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-2 text-red-600">Error loading clients</p>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      {" "}
      {/* Assuming navbar is 4rem/64px */}
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
        <div className="flex h-full flex-col">
          {isLoading ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-gray-500">Loading clients...</div>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center">
                <p className="mb-4 text-gray-500">
                  No clients found in your business
                </p>
              </div>
            </div>
          ) : selectedClient ? (
            <div className="flex h-full flex-col overflow-hidden">
              {/* Fixed header */}
              <header className="flex-shrink-0 border-b border-gray-200 p-8 pb-4">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900">
                    {selectedClient.name}
                  </h1>
                  <p className="mt-1 text-gray-500">{selectedClient.program}</p>
                </div>
              </header>

              {/* Connection status indicator */}
              {activeSession && (
                <div className="px-8 py-2">
                  <div className="flex items-center text-sm text-gray-500">
                    {isConnected ? (
                      <>
                        <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                        Live updates enabled
                      </>
                    ) : (
                      <>
                        <span className="mr-2 h-2 w-2 rounded-full bg-gray-400"></span>
                        Not connected to live updates
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Scrollable messages area */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-8"
              >
                <div className="mx-auto max-w-4xl space-y-4">
                  {messagesLoading ? (
                    <div className="py-8 text-center text-gray-500">
                      Loading messages...
                    </div>
                  ) : sortedMessages && sortedMessages.length > 0 ? (
                    sortedMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-4 ${
                            message.direction === "outbound"
                              ? "bg-blue-500 text-white"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">
                            {message.content}
                          </p>

                          {/* Display preference collection summary if available */}
                          <PreferenceCollectionSummary message={message} />

                          <div
                            className={`mt-2 text-xs ${
                              message.direction === "outbound"
                                ? "text-blue-100"
                                : "text-gray-500"
                            }`}
                          >
                            <span>
                              {new Date(message.createdAt).toLocaleString()}
                            </span>
                            {message.metadata &&
                              typeof message.metadata === "object" &&
                              "intent" in message.metadata &&
                              message.metadata.intent && (
                                <span className="ml-2">
                                  • Intent:{" "}
                                  {(message.metadata.intent as any).type}
                                </span>
                              )}
                            <span className="ml-2">• {message.status}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-gray-500">
                      No messages yet
                    </div>
                  )}
                  {/* Invisible element to scroll to */}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message input area */}
              <div className="flex-shrink-0 border-t border-gray-200 bg-yellow-50 p-4">
                <div className="mx-auto max-w-4xl">
                  <p className="mb-2 flex items-center text-sm text-yellow-800">
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Test Mode: Simulating {selectedClient?.name} sending a
                    message
                  </p>
                  <div className="flex items-center space-x-4">
                    <input
                      ref={inputRef}
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message as the client..."
                      disabled={isSending}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || isSending}
                      className="rounded-lg bg-blue-500 px-6 py-2 text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSending ? (
                        <svg
                          className="h-5 w-5 animate-spin"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      ) : (
                        "Send"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <p className="text-gray-500">
                Select a client to view their messages
              </p>
            </div>
          )}
        </div>
      </SidebarLayout>
    </div>
  );
}
