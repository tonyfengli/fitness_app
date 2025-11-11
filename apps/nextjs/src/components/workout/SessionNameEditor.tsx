"use client";

import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "~/trpc/react";

interface SessionNameEditorProps {
  sessionId: string;
  sessionName: string;
  className?: string;
}

export function SessionNameEditor({ 
  sessionId, 
  sessionName,
  className = ""
}: SessionNameEditorProps) {
  const [isEditingSessionName, setIsEditingSessionName] = useState(false);
  const [editingSessionName, setEditingSessionName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const updateSessionNameMutation = useMutation({
    ...trpc.trainingSession.updateSessionName.mutationOptions(),
    onSuccess: (data) => {
      console.log("[updateSessionName] Success! Response:", data);
      
      // Exit editing mode
      setIsEditingSessionName(false);
      setEditingSessionName("");
      
      // Invalidate session data query to refresh the name
      queryClient.invalidateQueries({
        queryKey: trpc.trainingSession.getSession.queryOptions({ 
          id: sessionId || "" 
        }).queryKey,
      });
      
      toast.success("Session name updated successfully");
    },
    onError: (error) => {
      console.error("Failed to update session name:", error);
      toast.error("Failed to update session name. Please try again.");
    },
  });

  const handleSaveSessionName = () => {
    if (editingSessionName.trim() && editingSessionName.trim() !== sessionName) {
      updateSessionNameMutation.mutate({
        sessionId: sessionId,
        name: editingSessionName.trim(),
      });
    } else {
      setIsEditingSessionName(false);
      setEditingSessionName("");
    }
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {isEditingSessionName ? (
        <div className="flex items-center gap-3">
          <input
            ref={nameInputRef}
            type="text"
            value={editingSessionName}
            onChange={(e) => setEditingSessionName(e.target.value)}
            onBlur={handleSaveSessionName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveSessionName();
              } else if (e.key === 'Escape') {
                setIsEditingSessionName(false);
                setEditingSessionName(sessionName);
              }
            }}
            className="text-lg font-bold text-white bg-white/10 dark:bg-gray-700/30 backdrop-blur-sm border-2 border-white/30 dark:border-gray-500/50 focus:border-white dark:focus:border-gray-400 rounded-lg px-3 py-1.5 min-w-0 max-w-48 text-center focus:outline-none focus:ring-2 focus:ring-white/50 dark:focus:ring-gray-400/50 transition-all"
            placeholder="Session name"
            autoCapitalize="words"
            autoFocus
          />
          <button
            onClick={handleSaveSessionName}
            className="p-2 bg-white/20 hover:bg-white/30 dark:bg-gray-700/50 dark:hover:bg-gray-600/50 rounded-lg transition-colors"
            title="Save"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setIsEditingSessionName(true);
            setEditingSessionName(sessionName);
            setTimeout(() => nameInputRef.current?.select(), 100);
          }}
          className="group relative px-4 py-2.5 bg-white/25 dark:bg-gray-700/50 backdrop-blur-md rounded-lg flex items-center gap-3 shadow-lg border border-white/20 dark:border-gray-600/30 hover:bg-white/35 dark:hover:bg-gray-600/60 transition-all duration-200"
        >
          <span className="text-lg font-bold text-white tracking-wide truncate max-w-44">
            {sessionName}
          </span>
          <svg 
            className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}
    </div>
  );
}