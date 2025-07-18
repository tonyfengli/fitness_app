"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import type { WorkoutTemplateType } from "@acme/ai";

interface WorkoutGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  exercises: any; // LLM interpretation output
  templateType: WorkoutTemplateType; // Pre-selected template
  onWorkoutGenerated: (workout: any) => void;
}

export default function WorkoutGenerationModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  exercises,
  templateType,
  onWorkoutGenerated,
}: WorkoutGenerationModalProps) {
  const [error, setError] = useState<string | null>(null);
  const trpc = useTRPC();
  
  const generateWorkout = useMutation(
    trpc.workout.generateIndividual.mutationOptions({
      onSuccess: (result) => {
        onWorkoutGenerated(result);
        onClose();
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to generate workout");
      },
    }),
  );
  
  if (!isOpen) return null;

  const handleGenerate = () => {
    setError(null);
    generateWorkout.mutate({
      userId: clientId,
      templateType,
      exercises, // Pass the LLM interpretation
      workoutName: `${templateType.replace("_", " ").toUpperCase()} Workout - ${new Date().toLocaleDateString()}`,
      workoutDescription: `Individual ${templateType.replace("_", " ")} workout for ${clientName}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Generate Workout for {clientName}
            </h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 hover:bg-gray-100 text-gray-500 font-semibold text-xl leading-none"
            >
              ×
            </button>
          </div>
          
          {/* Content */}
          <div className="px-6 py-4">
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">Workout Summary</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• Client: {clientName}</p>
                  <p>• Template: {templateType.replace("_", " ").toUpperCase()}</p>
                  <p>• Available exercises: {exercises.length}</p>
                </div>
              </div>
              
              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
            <button
              onClick={onClose}
              disabled={generateWorkout.isPending}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generateWorkout.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {generateWorkout.isPending ? "Generating..." : "Generate Workout"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}