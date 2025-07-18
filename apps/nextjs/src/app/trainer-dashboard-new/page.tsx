"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  SidebarLayout, 
  ClientSidebar, 
  WorkoutProgramCard,
  AddExerciseModal,
  DuplicateWorkoutModal,
  EditModal,
  DeleteConfirmDialog
} from "@acme/ui-desktop";
import { Button, FeedbackSection, Icon } from "@acme/ui-shared";
import { useTRPC } from "~/trpc/react";
import { useRouter } from "next/navigation";
import type { ExerciseBlock, EditContext } from "@acme/ui-desktop";
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
  onDuplicateWorkout: () => void;
  onDeleteBlock: (workoutId: string, blockName: string) => void;
  onDeleteExercise: (workoutId: string, exerciseId: string) => void;
  onAddExercise: (workoutId: string, blockName: string) => void;
  onMoveExercise: (workoutId: string, exerciseId: string, direction: 'up' | 'down') => void;
  onEditWorkout: (workoutId: string) => void;
  onEditBlock: (workoutId: string, blockName: string) => void;
  onEditExercise: (workoutId: string, exerciseId: string, exerciseName: string, blockName: string) => void;
  movingExerciseId: string | null;
  isDeleting: boolean;
  deletingExerciseId: string | null;
  deletingBlockName: string | null;
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
  onDuplicateWorkout,
  onDeleteBlock,
  onDeleteExercise,
  onAddExercise,
  onMoveExercise,
  onEditWorkout,
  onEditBlock,
  onEditExercise,
  movingExerciseId,
  isDeleting,
  deletingExerciseId,
  deletingBlockName,
  llmOutput 
}: WorkoutSectionProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-lg">
        <WorkoutProgramCard
          title={date}
          week={week || DEFAULT_WORKOUT_WEEK}
          exerciseBlocks={exerciseBlocks}
          onAddExercise={(blockName) => onAddExercise(workoutId, blockName)}
          onEditExercise={(exerciseId, exerciseName, blockName) => onEditExercise(workoutId, exerciseId, exerciseName, blockName)}
          onEditWorkout={() => onEditWorkout(workoutId)}
          onEditBlock={(blockName) => onEditBlock(workoutId, blockName)}
          onDeleteExercise={(exerciseId, blockName) => onDeleteExercise(workoutId, exerciseId)}
          onDeleteWorkout={() => onDeleteWorkout(workoutId)}
          onDuplicateWorkout={onDuplicateWorkout}
          onDeleteBlock={(blockName) => onDeleteBlock(workoutId, blockName)}
          onMoveExercise={(exerciseId, direction) => onMoveExercise(workoutId, exerciseId, direction)}
          movingExerciseId={movingExerciseId}
          isDeleting={isDeleting}
          deletingExerciseId={deletingExerciseId}
          deletingBlockName={deletingBlockName}
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
  const [movingExerciseId, setMovingExerciseId] = useState<string | null>(null);
  const [addExerciseModal, setAddExerciseModal] = useState<{
    isOpen: boolean;
    workoutId: string;
    blockName: string;
  }>({
    isOpen: false,
    workoutId: "",
    blockName: "",
  });
  const [duplicateWorkoutModal, setDuplicateWorkoutModal] = useState<{
    isOpen: boolean;
    workoutData: any | null;
  }>({
    isOpen: false,
    workoutData: null,
  });
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    context: EditContext | null;
    currentData?: any;
  }>({
    isOpen: false,
    context: null,
    currentData: null,
  });
  
  // Delete confirmation dialog states
  const [deleteWorkoutDialog, setDeleteWorkoutDialog] = useState<{
    isOpen: boolean;
    workoutId: string | null;
    workoutDate: string | null;
  }>({
    isOpen: false,
    workoutId: null,
    workoutDate: null,
  });
  
  const [deleteBlockDialog, setDeleteBlockDialog] = useState<{
    isOpen: boolean;
    workoutId: string | null;
    blockName: string | null;
  }>({
    isOpen: false,
    workoutId: null,
    blockName: null,
  });
  
  const [deleteExerciseDialog, setDeleteExerciseDialog] = useState<{
    isOpen: boolean;
    workoutId: string | null;
    exerciseId: string | null;
    exerciseName: string | null;
  }>({
    isOpen: false,
    workoutId: null,
    exerciseId: null,
    exerciseName: null,
  });
  
  // Track which items are being deleted
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null);
  const [deletingBlockName, setDeletingBlockName] = useState<string | null>(null);
  
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
  
  // Add exercise mutation
  const addExerciseMutation = useMutation(
    trpc.workout.addExercise.mutationOptions()
  );
  
  // Duplicate workout mutation
  const duplicateWorkoutMutation = useMutation(
    trpc.workout.duplicateWorkout.mutationOptions()
  );
  
  // Move exercise mutation
  const moveExerciseMutation = useMutation(
    trpc.workout.updateExerciseOrder.mutationOptions()
  );
  
  // Fetch available exercises for the business
  const { data: availableExercises } = useQuery(
    trpc.exercise.all.queryOptions({ limit: 1000 })
  );

  const handleDeleteWorkout = async (workoutId: string) => {
    // Find workout to get the date for display
    const workout = workouts?.find(w => w.id === workoutId);
    const workoutDate = workout ? new Date(workout.createdAt).toLocaleDateString() : 'this workout';
    
    setDeleteWorkoutDialog({
      isOpen: true,
      workoutId,
      workoutDate,
    });
  };
  
  const confirmDeleteWorkout = async () => {
    if (!deleteWorkoutDialog.workoutId) return;
    
    setDeletingWorkoutId(deleteWorkoutDialog.workoutId);
    try {
      await deleteWorkoutMutation.mutateAsync({ workoutId: deleteWorkoutDialog.workoutId });
      
      // Close dialog
      setDeleteWorkoutDialog({ isOpen: false, workoutId: null, workoutDate: null });
      
      // Refresh the workouts list
      await queryClient.invalidateQueries({
        queryKey: [['workout', 'getClientWorkoutsWithExercises'], { input: { clientId: selectedClientId } }]
      });
      
      // Clear loading state after invalidation completes
      setDeletingWorkoutId(null);
    } catch (error) {
      console.error('Failed to delete workout:', error);
      alert('Failed to delete workout. Please try again.');
      setDeletingWorkoutId(null);
    }
  };
  
  const handleDeleteBlock = async (workoutId: string, blockName: string) => {
    setDeleteBlockDialog({
      isOpen: true,
      workoutId,
      blockName,
    });
  };
  
  const confirmDeleteBlock = async () => {
    if (!deleteBlockDialog.workoutId || !deleteBlockDialog.blockName) return;
    
    setDeletingBlockName(deleteBlockDialog.blockName);
    try {
      await deleteBlockMutation.mutateAsync({ 
        workoutId: deleteBlockDialog.workoutId, 
        groupName: deleteBlockDialog.blockName 
      });
      
      // Close dialog
      setDeleteBlockDialog({ isOpen: false, workoutId: null, blockName: null });
      
      // Refresh the workouts list
      await queryClient.invalidateQueries({
        queryKey: [['workout', 'getClientWorkoutsWithExercises'], { input: { clientId: selectedClientId } }]
      });
      
      // Clear loading state after invalidation completes
      setDeletingBlockName(null);
    } catch (error) {
      console.error('Failed to delete block:', error);
      alert('Failed to delete block. Please try again.');
      setDeletingBlockName(null);
    }
  };

  const handleDeleteExercise = async (workoutId: string, exerciseId: string) => {
    // Find exercise name for display
    const workout = workouts?.find(w => w.id === workoutId);
    let exerciseName = 'this exercise';
    if (workout) {
      for (const block of workout.exerciseBlocks) {
        const exercise = block.exercises.find(e => e.id === exerciseId);
        if (exercise) {
          exerciseName = exercise.name;
          break;
        }
      }
    }
    
    setDeleteExerciseDialog({
      isOpen: true,
      workoutId,
      exerciseId,
      exerciseName,
    });
  };
  
  const confirmDeleteExercise = async () => {
    if (!deleteExerciseDialog.workoutId || !deleteExerciseDialog.exerciseId) return;
    
    setDeletingExerciseId(deleteExerciseDialog.exerciseId);
    try {
      await deleteExerciseMutation.mutateAsync({ 
        workoutId: deleteExerciseDialog.workoutId, 
        workoutExerciseId: deleteExerciseDialog.exerciseId // exerciseId is actually the workoutExerciseId based on our data structure
      });
      
      // Close dialog
      setDeleteExerciseDialog({ isOpen: false, workoutId: null, exerciseId: null, exerciseName: null });
      
      // Refresh the workouts list
      await queryClient.invalidateQueries({
        queryKey: [['workout', 'getClientWorkoutsWithExercises'], { input: { clientId: selectedClientId } }]
      });
      
      // Clear loading state after invalidation completes
      setDeletingExerciseId(null);
    } catch (error) {
      console.error('Failed to delete exercise:', error);
      alert('Failed to delete exercise. Please try again.');
      setDeletingExerciseId(null);
    }
  };

  const handleAddExercise = (workoutId: string, blockName: string) => {
    setAddExerciseModal({
      isOpen: true,
      workoutId,
      blockName,
    });
  };

  const handleAddExerciseSubmit = async (exerciseId: string, sets: number) => {
    try {
      await addExerciseMutation.mutateAsync({
        workoutId: addExerciseModal.workoutId,
        exerciseId,
        groupName: addExerciseModal.blockName,
        position: 'end' as const,
        sets,
      });
      
      // Close modal
      setAddExerciseModal({
        isOpen: false,
        workoutId: "",
        blockName: "",
      });
      
      // Refresh the workouts list
      await queryClient.invalidateQueries({
        queryKey: [['workout', 'getClientWorkoutsWithExercises'], { input: { clientId: selectedClientId } }]
      });
    } catch (error) {
      console.error('Failed to add exercise:', error);
      alert('Failed to add exercise. Please try again.');
    }
  };

  const handleDuplicateWorkout = (workout: any) => {
    setDuplicateWorkoutModal({
      isOpen: true,
      workoutData: workout,
    });
  };

  const handleDuplicateWorkoutConfirm = async () => {
    if (!duplicateWorkoutModal.workoutData) return;
    
    try {
      await duplicateWorkoutMutation.mutateAsync({
        workoutId: duplicateWorkoutModal.workoutData.id,
      });
      
      // Close modal
      setDuplicateWorkoutModal({
        isOpen: false,
        workoutData: null,
      });
      
      // Refresh the workouts list
      await queryClient.invalidateQueries({
        queryKey: [['workout', 'getClientWorkoutsWithExercises'], { input: { clientId: selectedClientId } }]
      });
    } catch (error) {
      console.error('Failed to duplicate workout:', error);
      alert('Failed to duplicate workout. Please try again.');
    }
  };

  const handleMoveExercise = async (workoutId: string, exerciseId: string, direction: 'up' | 'down') => {
    setMovingExerciseId(exerciseId);
    
    try {
      await moveExerciseMutation.mutateAsync({
        workoutId,
        workoutExerciseId: exerciseId,
        direction,
      });
      
      // Refresh the workouts list
      await queryClient.invalidateQueries({
        queryKey: [['workout', 'getClientWorkoutsWithExercises'], { input: { clientId: selectedClientId } }]
      });
    } catch (error) {
      console.error('Failed to move exercise:', error);
      alert('Failed to move exercise. Please try again.');
    } finally {
      setMovingExerciseId(null);
    }
  };

  const handleEditWorkout = (workoutId: string) => {
    setEditModal({
      isOpen: true,
      context: { type: 'workout', workoutId },
    });
  };

  const handleEditBlock = (workoutId: string, blockName: string) => {
    setEditModal({
      isOpen: true,
      context: { type: 'block', workoutId, blockName },
    });
  };

  const handleEditExercise = (workoutId: string, exerciseId: string, exerciseName: string, blockName: string) => {
    // Find the exercise to get its current sets
    const workout = workouts?.find(w => w.id === workoutId);
    let exerciseData = null;
    if (workout) {
      for (const block of workout.exerciseBlocks) {
        const exercise = block.exercises.find(e => e.id === exerciseId);
        if (exercise) {
          exerciseData = exercise;
          break;
        }
      }
    }
    
    setEditModal({
      isOpen: true,
      context: { type: 'exercise', workoutId, exerciseId, exerciseName, blockName },
      currentData: exerciseData,
    });
  };

  const handleEditSave = async (data: any) => {
    // TODO: Implement save logic based on context
    console.log('Saving edit data:', data, editModal.context);
    
    // Close modal after save
    setEditModal({ isOpen: false, context: null, currentData: null });
    
    // Refresh data
    await queryClient.invalidateQueries({
      queryKey: [['workout', 'getClientWorkoutsWithExercises'], { input: { clientId: selectedClientId } }]
    });
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
                          onDuplicateWorkout={() => handleDuplicateWorkout(workout)}
                          onDeleteBlock={handleDeleteBlock}
                          onDeleteExercise={handleDeleteExercise}
                          onAddExercise={handleAddExercise}
                          onMoveExercise={handleMoveExercise}
                          onEditWorkout={handleEditWorkout}
                          onEditBlock={handleEditBlock}
                          onEditExercise={handleEditExercise}
                          movingExerciseId={movingExerciseId}
                          isDeleting={deletingWorkoutId === workout.id}
                          deletingExerciseId={deletingExerciseId}
                          deletingBlockName={deletingBlockName}
                          llmOutput={workout.llmOutput}
                        />
                      );
                    })
                  ) : (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <p className="text-gray-500 mb-4">No workouts found for this client</p>
                        <Button onClick={() => setIsNewWorkoutModalOpen(true)}>
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
      
      {/* Add Exercise Modal */}
      <AddExerciseModal
        isOpen={addExerciseModal.isOpen}
        onClose={() => setAddExerciseModal({ isOpen: false, workoutId: "", blockName: "" })}
        onAdd={handleAddExerciseSubmit}
        blockName={addExerciseModal.blockName}
        exercises={availableExercises || []}
      />
      
      {/* Duplicate Workout Modal */}
      <DuplicateWorkoutModal
        isOpen={duplicateWorkoutModal.isOpen}
        onClose={() => setDuplicateWorkoutModal({ isOpen: false, workoutData: null })}
        onConfirm={handleDuplicateWorkoutConfirm}
        workoutData={duplicateWorkoutModal.workoutData}
        isLoading={duplicateWorkoutMutation.isPending}
      />
      
      {/* Edit Modal */}
      <EditModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, context: null, currentData: null })}
        onSave={handleEditSave}
        context={editModal.context}
        currentData={editModal.currentData}
        availableExercises={availableExercises || []}
      />
      
      {/* Delete Confirmation Dialogs */}
      <DeleteConfirmDialog
        isOpen={deleteWorkoutDialog.isOpen}
        onClose={() => setDeleteWorkoutDialog({ isOpen: false, workoutId: null, workoutDate: null })}
        onConfirm={confirmDeleteWorkout}
        title="Delete Workout"
        message="Are you sure you want to delete this workout? This action cannot be undone."
        itemName={deleteWorkoutDialog.workoutDate ? `Workout from ${deleteWorkoutDialog.workoutDate}` : undefined}
        isDeleting={deleteWorkoutMutation.isPending}
      />
      
      <DeleteConfirmDialog
        isOpen={deleteBlockDialog.isOpen}
        onClose={() => setDeleteBlockDialog({ isOpen: false, workoutId: null, blockName: null })}
        onConfirm={confirmDeleteBlock}
        title="Delete Block"
        message="Are you sure you want to delete this block? This will remove all exercises in this block."
        itemName={deleteBlockDialog.blockName || undefined}
        isDeleting={deleteBlockMutation.isPending}
      />
      
      <DeleteConfirmDialog
        isOpen={deleteExerciseDialog.isOpen}
        onClose={() => setDeleteExerciseDialog({ isOpen: false, workoutId: null, exerciseId: null, exerciseName: null })}
        onConfirm={confirmDeleteExercise}
        title="Delete Exercise"
        message="Are you sure you want to delete this exercise?"
        itemName={deleteExerciseDialog.exerciseName || undefined}
        isDeleting={deleteExerciseMutation.isPending}
      />
    </SidebarLayout>
  );
}