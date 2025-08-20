"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import type { ExerciseBlock } from "@acme/ui-desktop";
import {
  AddExerciseModal,
  ClientSidebar,
  DuplicateWorkoutModal,
  EditModal,
  SidebarLayout,
} from "@acme/ui-desktop";
import { Button, Icon } from "@acme/ui-shared";

import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useLoadingStates } from "~/hooks/useLoadingStates";
import { useModalState } from "~/hooks/useModalState";
// Import our new hooks
import { useWorkoutOperations } from "~/hooks/useWorkoutOperations";
import { useTRPC } from "~/trpc/react";
import NewWorkoutModal from "./new-workout-modal";
import FavoritesModal from "./FavoritesModal";
import { WorkoutSection } from "./WorkoutSection";

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

export default function TrainerDashboardPage() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<{
    feedback: Record<string, boolean>;
    llmOutput: Record<string, boolean>;
  }>({
    feedback: {},
    llmOutput: {},
  });

  const trpc = useTRPC();
  const router = useRouter();

  // Use our custom hooks
  const {
    modals,
    openModal,
    closeModal,
    deleteWorkoutModal,
    deleteExerciseModal,
    deleteBlockModal,
    editModal,
    duplicateModal,
    addExerciseModal,
    newWorkoutModal,
  } = useModalState();

  const loadingStates = useLoadingStates();
  const workoutOps = useWorkoutOperations(selectedClientId);

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
  }, [clients, selectedClientId]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // Fetch workouts for selected client
  const { data: workouts, isLoading: workoutsLoading } = useQuery({
    ...trpc.workout.getClientWorkoutsWithExercises.queryOptions({
      clientId: selectedClientId,
      limit: 3,
    }),
    enabled: !!selectedClientId,
  });

  // Fetch available exercises for the business
  const { data: availableExercises } = useQuery(
    trpc.exercise.all.queryOptions({ limit: 1000 }),
  );

  // Handlers
  const handleDeleteWorkout = async (workoutId: string) => {
    const workout = workouts?.find((w) => w.id === workoutId);
    if (workout) {
      openModal("deleteWorkout", {
        workoutId,
        workoutDate: new Date(workout.createdAt).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
      });
    }
  };

  const confirmDeleteWorkout = async () => {
    if (!deleteWorkoutModal.data?.workoutId) return;

    loadingStates.setLoading(
      "deletingWorkoutId",
      deleteWorkoutModal.data.workoutId,
    );
    try {
      await workoutOps.deleteWorkout.mutateAsync({
        workoutId: deleteWorkoutModal.data.workoutId,
      });
      closeModal("deleteWorkout");
    } catch (error) {
      console.error("Failed to delete workout:", error);
      alert("Failed to delete workout. Please try again.");
    } finally {
      loadingStates.clearLoading("deletingWorkoutId");
    }
  };

  const handleDeleteBlock = async (workoutId: string, blockName: string) => {
    openModal("deleteBlock", { workoutId, blockName });
  };

  const confirmDeleteBlock = async () => {
    if (!deleteBlockModal.data) return;

    loadingStates.setLoading(
      "deletingBlockName",
      deleteBlockModal.data.blockName,
    );
    try {
      await workoutOps.deleteBlock.mutateAsync({
        workoutId: deleteBlockModal.data.workoutId,
        groupName: deleteBlockModal.data.blockName,
      });
      closeModal("deleteBlock");
    } catch (error) {
      console.error("Failed to delete block:", error);
      alert("Failed to delete block. Please try again.");
    } finally {
      loadingStates.clearLoading("deletingBlockName");
    }
  };

  const handleDeleteExercise = async (
    workoutId: string,
    exerciseId: string,
  ) => {
    const workout = workouts?.find((w) => w.id === workoutId);
    let exerciseName = "this exercise";
    if (workout) {
      for (const block of workout.exerciseBlocks) {
        const exercise = block.exercises.find((e) => e.id === exerciseId);
        if (exercise) {
          exerciseName = exercise.name;
          break;
        }
      }
    }

    openModal("deleteExercise", { workoutId, exerciseId, exerciseName });
  };

  const confirmDeleteExercise = async () => {
    if (!deleteExerciseModal.data) return;

    loadingStates.setLoading(
      "deletingExerciseId",
      deleteExerciseModal.data.exerciseId,
    );
    try {
      await workoutOps.deleteExercise.mutateAsync({
        workoutId: deleteExerciseModal.data.workoutId,
        workoutExerciseId: deleteExerciseModal.data.exerciseId,
      });
      closeModal("deleteExercise");
    } catch (error) {
      console.error("Failed to delete exercise:", error);
      alert("Failed to delete exercise. Please try again.");
    } finally {
      loadingStates.clearLoading("deletingExerciseId");
    }
  };

  const handleAddExercise = (workoutId: string, blockName: string) => {
    openModal("addExercise", { workoutId, blockName });
  };

  const handleAddExerciseSubmit = async (exerciseId: string, sets: number) => {
    if (!addExerciseModal.data) return;

    try {
      await workoutOps.addExercise.mutateAsync({
        workoutId: addExerciseModal.data.workoutId,
        exerciseId,
        sets,
        groupName: addExerciseModal.data.blockName,
        position: "end",
      });
      closeModal("addExercise");
    } catch (error) {
      console.error("Failed to add exercise:", error);
      alert("Failed to add exercise. Please try again.");
    }
  };

  const handleDuplicateWorkout = (workoutId: string) => {
    const workout = workouts?.find((w) => w.id === workoutId);
    if (workout) {
      openModal("duplicate", {
        id: workoutId,
        exerciseBlocks: workout.exerciseBlocks,
      });
    }
  };

  const handleDuplicateConfirm = async () => {
    if (!duplicateModal.data) return;

    try {
      await workoutOps.duplicateWorkout.mutateAsync({
        workoutId: duplicateModal.data.id,
      });
      closeModal("duplicate");
    } catch (error) {
      console.error("Failed to duplicate workout:", error);
      alert("Failed to duplicate workout. Please try again.");
    }
  };

  const handleMoveExercise = async (
    workoutId: string,
    exerciseId: string,
    direction: "up" | "down",
  ) => {
    loadingStates.setLoading("movingExerciseId", exerciseId);

    try {
      await workoutOps.moveExercise.mutateAsync({
        workoutId,
        workoutExerciseId: exerciseId,
        direction,
      });
    } catch (error) {
      console.error("Failed to move exercise:", error);
      alert("Failed to move exercise. Please try again.");
    } finally {
      loadingStates.clearLoading("movingExerciseId");
    }
  };

  const handleEditWorkout = (workoutId: string) => {
    openModal("edit", {
      context: { type: "workout", workoutId },
      currentData: null,
    });
  };

  const handleEditBlock = (workoutId: string, blockName: string) => {
    openModal("edit", {
      context: { type: "block", workoutId, blockName },
      currentData: null,
    });
  };

  const handleEditExercise = (
    workoutId: string,
    exerciseId: string,
    exerciseName: string,
    blockName: string,
  ) => {
    const workout = workouts?.find((w) => w.id === workoutId);
    let exerciseData = null;
    if (workout) {
      for (const block of workout.exerciseBlocks) {
        const exercise = block.exercises.find((e) => e.id === exerciseId);
        if (exercise) {
          exerciseData = exercise;
          break;
        }
      }
    }

    openModal("edit", {
      context: {
        type: "exercise",
        workoutId,
        exerciseId,
        exerciseName,
        blockName,
      },
      currentData: exerciseData,
    });
  };

  const handleEditSave = async (data: any) => {
    if (!editModal.data?.context) return;

    try {
      if (editModal.data.context.type === "exercise") {
        const { workoutId, exerciseId } = editModal.data.context;
        const currentExercise = editModal.data.currentData;
        const isChangingExercise =
          data.exerciseId && data.exerciseId !== currentExercise?.exerciseId;

        if (isChangingExercise) {
          await workoutOps.replaceExercise.mutateAsync({
            workoutId,
            workoutExerciseId: exerciseId,
            newExerciseId: data.exerciseId,
          });
        }

        if (data.sets) {
          await workoutOps.updateExerciseSets.mutateAsync({
            workoutId,
            workoutExerciseId: exerciseId,
            sets: data.sets,
          });
        }
      }

      closeModal("edit");
    } catch (error) {
      console.error("Failed to save edit:", error);
      alert("Failed to save changes. Please try again.");
    }
  };

  // Toggle functions for expanded sections
  const toggleSection = (type: "feedback" | "llmOutput", workoutId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [workoutId]: !prev[type][workoutId],
      },
    }));
  };

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
      <div className="flex h-full flex-col">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center p-8">
            <div className="text-gray-500">Loading clients...</div>
          </div>
        ) : clients.length === 0 ? (
          <div className="flex h-64 items-center justify-center p-8">
            <div className="text-center">
              <p className="mb-4 text-gray-500">
                No clients found in your business
              </p>
              <Button onClick={() => router.push("/signup")}>
                Add Your First Client
              </Button>
            </div>
          </div>
        ) : selectedClient ? (
          <div className="flex-1 overflow-y-auto p-8">
            <header className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-gray-900">
                  {selectedClient.name}
                </h1>
                <p className="mt-1 text-gray-500">{selectedClient.program}</p>
              </div>
              <div className="flex gap-4">
                <Button
                  onClick={() => openModal("favorites")}
                  size="lg"
                  className="flex items-center bg-purple-600 px-6 py-3 text-white hover:bg-purple-700"
                >
                  <Icon name="star" size={20} className="mr-2" />
                  <span className="font-semibold">See Favorites</span>
                </Button>
                <Button
                  onClick={() => openModal("newWorkout")}
                  size="lg"
                  className="flex items-center bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-700"
                >
                  <Icon name="add" size={20} className="mr-2" />
                  <span className="font-semibold">New Workout</span>
                </Button>
              </div>
            </header>

            <div className="space-y-12">
              {workoutsLoading ? (
                <p>Loading workouts...</p>
              ) : workouts && workouts.length > 0 ? (
                workouts.map((workout) => {
                  const date = new Date(workout.createdAt);
                  const dayName = date.toLocaleDateString("en-US", {
                    weekday: "long",
                  });
                  const monthDay = date.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                  });
                  const formattedDate = `${dayName}, ${monthDay}`;

                  // Get template info from llmOutput or use defaults
                  const templateInfo =
                    workout.llmOutput?.template ||
                    workout.workoutType ||
                    "Standard";
                  const contextInfo =
                    workout.context === "individual" ? "Individual" : "Group";

                  return (
                    <WorkoutSection
                      key={workout.id}
                      workoutId={workout.id}
                      date={formattedDate}
                      week={`${templateInfo}, ${contextInfo}`}
                      exerciseBlocks={workout.exerciseBlocks}
                      feedbackExpanded={
                        expandedSections.feedback[workout.id] || false
                      }
                      llmOutputExpanded={
                        expandedSections.llmOutput[workout.id] || false
                      }
                      onFeedbackToggle={() =>
                        toggleSection("feedback", workout.id)
                      }
                      onLlmOutputToggle={() =>
                        toggleSection("llmOutput", workout.id)
                      }
                      onDeleteWorkout={handleDeleteWorkout}
                      onDuplicateWorkout={() =>
                        handleDuplicateWorkout(workout.id)
                      }
                      onDeleteBlock={handleDeleteBlock}
                      onDeleteExercise={handleDeleteExercise}
                      onAddExercise={handleAddExercise}
                      onMoveExercise={handleMoveExercise}
                      onEditWorkout={handleEditWorkout}
                      onEditBlock={handleEditBlock}
                      onEditExercise={handleEditExercise}
                      deletingWorkoutId={loadingStates.deletingWorkoutId}
                      deletingBlockName={loadingStates.deletingBlockName}
                      deletingExerciseId={loadingStates.deletingExerciseId}
                      movingExerciseId={loadingStates.movingExerciseId}
                      llmOutput={workout.llmOutput}
                    />
                  );
                })
              ) : (
                <div className="py-12 text-center">
                  <p className="text-gray-500">
                    No workouts found for {selectedClient.name}
                  </p>
                  <Button
                    onClick={() => openModal("newWorkout")}
                    className="mt-4"
                  >
                    Create First Workout
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center p-8">
            <p className="text-gray-500">
              Select a client to view their workouts
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedClient && (
        <NewWorkoutModal
          isOpen={newWorkoutModal.isOpen}
          onClose={() => closeModal("newWorkout")}
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          clientProfile={
            clientsData?.find((c) => c.id === selectedClient.id)?.profile
          }
        />
      )}

      {selectedClient && (
        <FavoritesModal
          isOpen={modals.favorites.isOpen}
          onClose={() => closeModal("favorites")}
          clientName={selectedClient.name}
        />
      )}

      <AddExerciseModal
        isOpen={addExerciseModal.isOpen}
        onClose={() => closeModal("addExercise")}
        onAdd={handleAddExerciseSubmit}
        blockName={addExerciseModal.data?.blockName || ""}
        exercises={availableExercises || []}
      />

      <DuplicateWorkoutModal
        isOpen={duplicateModal.isOpen}
        onClose={() => closeModal("duplicate")}
        onConfirm={handleDuplicateConfirm}
        workoutData={duplicateModal.data}
        isLoading={workoutOps.duplicateWorkout.isPending}
      />

      <EditModal
        isOpen={editModal.isOpen}
        onClose={() => closeModal("edit")}
        onSave={handleEditSave}
        context={editModal.data?.context || null}
        currentData={editModal.data?.currentData}
        availableExercises={availableExercises || []}
        isLoading={
          workoutOps.replaceExercise.isPending ||
          workoutOps.updateExerciseSets.isPending
        }
      />

      {/* Confirmation Dialogs using our generic component */}
      <ConfirmDialog
        isOpen={deleteWorkoutModal.isOpen}
        onClose={() => closeModal("deleteWorkout")}
        onConfirm={confirmDeleteWorkout}
        title="Delete Workout"
        message={`Are you sure you want to delete the workout from ${deleteWorkoutModal.data?.workoutDate}? This action cannot be undone.`}
        confirmText="Delete Workout"
        isLoading={loadingStates.isLoading("deletingWorkoutId")}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={deleteBlockModal.isOpen}
        onClose={() => closeModal("deleteBlock")}
        onConfirm={confirmDeleteBlock}
        title={`Delete ${deleteBlockModal.data?.blockName}`}
        message={`Are you sure you want to delete all exercises in ${deleteBlockModal.data?.blockName}? This action cannot be undone.`}
        confirmText="Delete Block"
        isLoading={loadingStates.isLoading("deletingBlockName")}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={deleteExerciseModal.isOpen}
        onClose={() => closeModal("deleteExercise")}
        onConfirm={confirmDeleteExercise}
        title="Delete Exercise"
        message={`Are you sure you want to delete "${deleteExerciseModal.data?.exerciseName}"? This action cannot be undone.`}
        confirmText="Delete Exercise"
        isLoading={loadingStates.isLoading("deletingExerciseId")}
        variant="danger"
      />
    </SidebarLayout>
  );
}
