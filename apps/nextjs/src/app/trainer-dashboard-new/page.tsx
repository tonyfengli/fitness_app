"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  SidebarLayout, 
  ClientSidebar, 
  WorkoutProgramCard
} from "@acme/ui-desktop";
import { Button, FeedbackSection, Icon } from "@acme/ui-shared";
import { useTRPC } from "~/trpc/react";
import { useRouter } from "next/navigation";
import type { ExerciseBlock } from "@acme/ui-desktop";
import NewWorkoutModal from "./new-workout-modal";

// Constants
const AVATAR_API_URL = "https://api.dicebear.com/7.x/avataaars/svg";
const DEFAULT_WORKOUT_WEEK = "Standard, Individual";
const LLM_OUTPUT_TEXT = "Generated workout based on client profile: Moderate strength, Moderate skill level. Focus on compound movements with progressive overload. 3 sets of 8-12 reps for primary exercises.";


// Helper function to format strength/skill levels
function formatLevel(level: string): string {
  return level.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

// Workout Section Component
interface WorkoutSectionProps {
  workoutId: string;
  date: string;
  week?: string;
  exerciseBlocks: ExerciseBlock[];
  feedbackExpanded: boolean;
  llmOutputExpanded: boolean;
  onFeedbackToggle: () => void;
  onLlmOutputToggle: () => void;
  onDeleteWorkout: (workoutId: string) => void;
  onDeleteBlock: (workoutId: string, blockName: string) => void;
  onDeleteExercise: (workoutId: string, exerciseId: string) => void;
  isDeleting: boolean;
  llmOutput?: any;
}

function WorkoutSection({ 
  workoutId, 
  date, 
  week,
  exerciseBlocks, 
  feedbackExpanded, 
  llmOutputExpanded, 
  onFeedbackToggle, 
  onLlmOutputToggle,
  onDeleteWorkout,
  onDeleteBlock,
  onDeleteExercise,
  isDeleting,
  llmOutput 
}: WorkoutSectionProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-lg">
        <WorkoutProgramCard
          title={date}
          week={week || DEFAULT_WORKOUT_WEEK}
          exerciseBlocks={exerciseBlocks}
          onAddExercise={() => console.log("Add exercise")}
          onEditExercise={(id) => console.log("Edit exercise", id)}
          onDeleteExercise={(exerciseId, blockName) => onDeleteExercise(workoutId, exerciseId)}
          onDeleteWorkout={() => onDeleteWorkout(workoutId)}
          onDeleteBlock={(blockName) => onDeleteBlock(workoutId, blockName)}
          isDeleting={isDeleting}
          className="rounded-2xl shadow-none"
        />
        {/* LLM Output Section */}
        <div className="border-t border-gray-200">
          <button
            onClick={onLlmOutputToggle}
            className="w-full flex justify-between items-center p-6 text-left hover:bg-gray-50 transition-colors duration-200"
          >
            <div className="flex items-center gap-4">
              <span className="text-lg font-semibold text-gray-700">LLM Output</span>
              {llmOutput?.processingTime && (
                <span className="text-sm text-gray-500">
                  Generated in {llmOutput.processingTime.toFixed(2)}s
                </span>
              )}
            </div>
            <Icon 
              name={llmOutputExpanded ? "expand_less" : "expand_more"} 
              className="text-gray-400"
            />
          </button>
          {llmOutputExpanded && (
            <div className="px-6 pb-6">
              <div className="p-4 bg-gray-50 rounded-xl">
                {llmOutput ? (
                  <div className="space-y-4">
                    {/* Show timing breakdown if available */}
                    {llmOutput.timing && (
                      <div className="mb-4">
                        <details className="text-sm text-gray-600">
                          <summary className="cursor-pointer hover:text-gray-800 font-medium">
                            Show timing breakdown
                          </summary>
                          <div className="mt-2 space-y-1 text-sm">
                            <div>Exercise formatting: {(llmOutput.timing.exerciseFormatting || 0).toFixed(0)}ms</div>
                            <div>Set calculation: {(llmOutput.timing.setCountCalculation || 0).toFixed(0)}ms</div>
                            <div>Prompt building: {(llmOutput.timing.promptBuilding || 0).toFixed(0)}ms</div>
                            <div className="font-semibold">LLM API call: {((llmOutput.timing.llmApiCall || 0) / 1000).toFixed(2)}s</div>
                            <div>Response parsing: {(llmOutput.timing.responseParsing || 0).toFixed(0)}ms</div>
                          </div>
                        </details>
                      </div>
                    )}
                    
                    {/* Show reasoning if available */}
                    {llmOutput.reasoning && (
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Workout Reasoning</h4>
                        <p className="text-gray-600">{llmOutput.reasoning}</p>
                      </div>
                    )}
                    
                    {/* Show block details */}
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Exercise Details</h4>
                      <div className="space-y-3">
                        {Object.entries(llmOutput).map(([key, value]) => {
                          if (key === 'reasoning' || key === 'timing' || key === 'processingTime' || !Array.isArray(value)) return null;
                          
                          const blockName = key.replace('block', 'Block ').toUpperCase();
                          return (
                            <div key={key} className="border-l-4 border-indigo-200 pl-4">
                              <h5 className="font-medium text-gray-700 mb-1">{blockName}</h5>
                              <div className="space-y-1">
                                {value.map((exercise: any, idx: number) => (
                                  <div key={idx} className="text-sm text-gray-600">
                                    <span className="font-medium">{exercise.exercise}</span>
                                    {exercise.sets && <span> - {exercise.sets} sets</span>}
                                    {exercise.reps && <span> x {exercise.reps} reps</span>}
                                    {exercise.rest && <span> ({exercise.rest} rest)</span>}
                                    {exercise.notes && <div className="text-xs text-gray-500 mt-1">{exercise.notes}</div>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600">{LLM_OUTPUT_TEXT}</p>
                )}
              </div>
            </div>
          )}
        </div>
        {/* Client Feedback Section */}
        <div className="border-t border-gray-200">
          <FeedbackSection
            isExpanded={feedbackExpanded}
            onToggle={onFeedbackToggle}
            onAddNote={() => console.log("Add note")}
            className="rounded-b-2xl"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() => console.log("Add exercise")}
          variant="primary"
          size="sm"
          className="bg-gray-800 hover:bg-gray-700 flex items-center"
        >
          <Icon name="add" size={16} className="mr-2" />
          <span>Add Exercise</span>
        </Button>
      </div>
    </div>
  );
}

export default function TrainerDashboardNew() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isNewWorkoutModalOpen, setIsNewWorkoutModalOpen] = useState(false);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null);
  
  // Combined state for expanded sections
  interface ExpandedState {
    feedback: Record<string, boolean>;
    llmOutput: Record<string, boolean>;
  }
  
  const [expandedState, setExpandedState] = useState<ExpandedState>({
    feedback: {},
    llmOutput: {},
  });
  
  // Toggle function for expanded states
  const toggleExpanded = (type: 'feedback' | 'llmOutput', workoutId: string) => {
    setExpandedState(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [workoutId]: !prev[type][workoutId]
      }
    }));
  };
  
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch clients from the API
  const { data: clientsData, isLoading, error } = useQuery(
    trpc.auth.getClientsByBusiness.queryOptions()
  );

  // Transform API data to match Client interface
  const clients = clientsData?.map(client => ({
    id: client.id,
    name: client.name || client.email.split('@')[0], // Use name or email prefix
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
  }, [clients, selectedClientId]);

  const selectedClient = clients.find(c => c.id === selectedClientId);
  
  // Fetch workouts for selected client
  const { data: workouts, isLoading: workoutsLoading, error: workoutsError } = useQuery({
    ...trpc.workout.getClientWorkoutsWithExercises.queryOptions({
      clientId: selectedClientId,
      limit: 3,
    }),
    enabled: !!selectedClientId, // Only fetch when a client is selected
  });

  // Delete workout mutation
  const deleteWorkoutMutation = useMutation(
    trpc.workout.deleteWorkout.mutationOptions()
  );
  
  // Delete block mutation
  const deleteBlockMutation = useMutation(
    trpc.workout.deleteBlock.mutationOptions()
  );
  
  // Delete exercise mutation
  const deleteExerciseMutation = useMutation(
    trpc.workout.deleteExercise.mutationOptions()
  );

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm('Are you sure you want to delete this workout? This action cannot be undone.')) {
      return;
    }

    setDeletingWorkoutId(workoutId);
    try {
      await deleteWorkoutMutation.mutateAsync({ workoutId });
      
      // Refresh the workouts list
      await queryClient.invalidateQueries({
        queryKey: [['workout', 'getClientWorkoutsWithExercises'], { input: { clientId: selectedClientId } }]
      });
    } catch (error) {
      console.error('Failed to delete workout:', error);
      alert('Failed to delete workout. Please try again.');
    } finally {
      setDeletingWorkoutId(null);
    }
  };
  
  const handleDeleteBlock = async (workoutId: string, blockName: string) => {
    if (!confirm(`Are you sure you want to delete ${blockName}? This will remove all exercises in this block.`)) {
      return;
    }

    try {
      await deleteBlockMutation.mutateAsync({ 
        workoutId, 
        groupName: blockName 
      });
      
      // Refresh the workouts list
      await queryClient.invalidateQueries({
        queryKey: [['workout', 'getClientWorkoutsWithExercises'], { input: { clientId: selectedClientId } }]
      });
    } catch (error) {
      console.error('Failed to delete block:', error);
      alert('Failed to delete block. Please try again.');
    }
  };

  const handleDeleteExercise = async (workoutId: string, exerciseId: string) => {
    if (!confirm('Are you sure you want to delete this exercise?')) {
      return;
    }

    try {
      await deleteExerciseMutation.mutateAsync({ 
        workoutId, 
        workoutExerciseId: exerciseId // exerciseId is actually the workoutExerciseId based on our data structure
      });
      
      // Refresh the workouts list
      await queryClient.invalidateQueries({
        queryKey: [['workout', 'getClientWorkoutsWithExercises'], { input: { clientId: selectedClientId } }]
      });
    } catch (error) {
      console.error('Failed to delete exercise:', error);
      alert('Failed to delete exercise. Please try again.');
    }
  };

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
              <Button onClick={() => router.push("/signup")}>
                Add Your First Client
              </Button>
            </div>
          </div>
        ) : selectedClient ? (
          <div className="flex-1 overflow-y-auto p-8">
            {/* Header - Now scrolls with content */}
            <header className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-900">{selectedClient.name}</h1>
                <p className="text-gray-500 mt-1">{selectedClient.program}</p>
              </div>
              <Button
                onClick={() => setIsNewWorkoutModalOpen(true)}
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 flex items-center"
              >
                <Icon name="add" size={20} className="mr-2" />
                <span className="font-semibold">New Workout</span>
              </Button>
            </header>

            {/* Content */}
            <div className="space-y-12">
              {/* Workouts */}
              <section>
                
                <div className="max-w-6xl space-y-8">
                  {workoutsLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-gray-500">Loading workouts...</div>
                    </div>
                  ) : workoutsError ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <p className="text-red-600 mb-2">Error loading workouts</p>
                        <p className="text-gray-600">{workoutsError.message}</p>
                      </div>
                    </div>
                  ) : workouts && workouts.length > 0 ? (
                    workouts.map((workout) => {
                      // Format date with day name
                      const date = new Date(workout.createdAt);
                      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                      const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
                      const formattedDate = `${dayName}, ${monthDay}`;
                      
                      // Get template info from llmOutput or use defaults
                      const templateInfo = workout.llmOutput?.template || workout.workoutType || "Standard";
                      const contextInfo = workout.context === "individual" ? "Individual" : "Group";
                      
                      return (
                        <WorkoutSection
                          key={workout.id}
                          workoutId={workout.id}
                          date={formattedDate}
                          week={`${templateInfo}, ${contextInfo}`}
                          exerciseBlocks={workout.exerciseBlocks}
                          feedbackExpanded={expandedState.feedback[workout.id] || false}
                          llmOutputExpanded={expandedState.llmOutput[workout.id] || false}
                          onFeedbackToggle={() => toggleExpanded('feedback', workout.id)}
                          onLlmOutputToggle={() => toggleExpanded('llmOutput', workout.id)}
                          onDeleteWorkout={handleDeleteWorkout}
                          onDeleteBlock={handleDeleteBlock}
                          onDeleteExercise={handleDeleteExercise}
                          isDeleting={deletingWorkoutId === workout.id}
                          llmOutput={workout.llmOutput}
                        />
                      );
                    })
                  ) : (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <p className="text-gray-500 mb-4">No workouts found for this client</p>
                        <Button onClick={() => router.push("/workout-generator")}>
                          Generate First Workout
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 p-8">
            <p className="text-gray-500">Select a client from the sidebar</p>
          </div>
        )}
      </div>
      
      {/* New Workout Modal */}
      {selectedClient && (
        <NewWorkoutModal
          isOpen={isNewWorkoutModalOpen}
          onClose={() => setIsNewWorkoutModalOpen(false)}
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          clientProfile={clientsData?.find(c => c.id === selectedClient.id)?.profile}
        />
      )}
    </SidebarLayout>
  );
}