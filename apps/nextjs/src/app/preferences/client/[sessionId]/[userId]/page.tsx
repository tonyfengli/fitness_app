"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  categorizeExercisesByRecommendation,
  CheckIcon,
  ChevronDownIcon,
  ExerciseListItem,
  filterExercisesBySearch,
  formatMuscleLabel,
  getFilteredExercises,
  MUSCLE_GROUPS_ALPHABETICAL,
  PlusIcon,
  PreferenceListItem,
  SearchIcon,
  SpinnerIcon,
  useClientPreferences,
  useModalState,
  useRealtimePreferences,
  XIcon,
} from "@acme/ui-shared";

import { supabase } from "~/lib/supabase";
import { useTRPC } from "~/trpc/react";

// Exercise Change Modal Component
const ExerciseChangeModal = ({
  isOpen,
  onClose,
  exerciseName,
  availableExercises = [],
  blueprintRecommendations = [],
  currentRound,
  onConfirm,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  availableExercises?: any[];
  blueprintRecommendations?: any[];
  currentRound?: string;
  onConfirm?: (exerciseName: string) => void;
  isLoading?: boolean;
}) => {
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Reset selection and search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedExercise(null);
      setSearchQuery("");
    }
  }, [isOpen]);

  // Categorize exercises into Recommended and Other
  const categorizedExercises = React.useMemo(() => {
    // Use shared categorization logic
    const categorized = categorizeExercisesByRecommendation(
      availableExercises || [],
      blueprintRecommendations,
      {
        currentExerciseName: exerciseName,
        currentRound,
        maxRecommendations: undefined, // Don't limit in modal, show all recommendations
      },
    );

    // Apply search filter to both categories
    if (searchQuery.trim()) {
      return {
        recommended: filterExercisesBySearch(
          categorized.recommended,
          searchQuery,
        ),
        other: filterExercisesBySearch(categorized.other, searchQuery),
      };
    }

    return categorized;
  }, [
    availableExercises,
    blueprintRecommendations,
    exerciseName,
    searchQuery,
    currentRound,
  ]);

  if (!isOpen) return null;

  return (
    <>
      {/* Background overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 z-50 mx-auto flex max-h-[80vh] max-w-lg -translate-y-1/2 flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Change Exercise
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Replacing: {exerciseName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Search Bar */}
          <div className="sticky top-0 z-10 border-b bg-gray-50 px-6 py-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search exercises..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="p-6">
            {/* No results message */}
            {searchQuery.trim() &&
              categorizedExercises.recommended.length === 0 &&
              categorizedExercises.other.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-gray-500">
                    No exercises found matching "{searchQuery}"
                  </p>
                </div>
              )}

            {/* Recommended Section */}
            {categorizedExercises.recommended.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-600">
                  Recommended
                </h3>
                <div className="space-y-2">
                  {categorizedExercises.recommended.map((exercise, idx) => (
                    <ExerciseListItem
                      key={exercise.id || idx}
                      name={exercise.name}
                      isSelected={selectedExercise === exercise.name}
                      reason={exercise.reason}
                      onClick={() => setSelectedExercise(exercise.name)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All other exercises */}
            {categorizedExercises.other.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-600">
                  Other Exercises
                </h3>
                <div className="space-y-2">
                  {categorizedExercises.other.map((exercise, idx) => (
                    <ExerciseListItem
                      key={exercise.id || idx}
                      name={exercise.name}
                      isSelected={selectedExercise === exercise.name}
                      onClick={() => setSelectedExercise(exercise.name)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 justify-end gap-3 border-t bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 transition-colors hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedExercise && onConfirm) {
                onConfirm(selectedExercise);
              }
            }}
            disabled={!selectedExercise || isLoading}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
              selectedExercise && !isLoading
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "cursor-not-allowed bg-gray-300 text-gray-500"
            }`}
          >
            {isLoading ? (
              <>
                <SpinnerIcon className="h-4 w-4 animate-spin text-white" />
                Changing...
              </>
            ) : (
              "Confirm Change"
            )}
          </button>
        </div>
      </div>
    </>
  );
};

// Muscle Target/Limit Modal Component
const MuscleModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  existingTargets = [],
  existingLimits = [],
  initialTab = "target",
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (muscle: string, type: "target" | "limit") => void;
  isLoading?: boolean;
  existingTargets?: string[];
  existingLimits?: string[];
  initialTab?: "target" | "limit";
}) => {
  const [activeTab, setActiveTab] = useState<"target" | "limit">(initialTab);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab(initialTab);
      setSelectedMuscle(null);
      setSearchQuery("");
    }
  }, [isOpen, initialTab]);

  // Use shared muscle groups constant
  const muscleGroups = MUSCLE_GROUPS_ALPHABETICAL;

  // Get already selected muscles based on active tab
  const alreadySelected =
    activeTab === "target" ? existingTargets : existingLimits;

  // Filter muscles by search and remove already selected
  const filteredMuscles = muscleGroups.filter((muscle) => {
    const matchesSearch = muscle.label
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const notAlreadySelected = !alreadySelected.includes(muscle.value);
    return matchesSearch && notAlreadySelected;
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Background overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 z-50 mx-auto flex max-h-[80vh] max-w-lg -translate-y-1/2 flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Add Muscle Group
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Search Bar */}
          <div className="sticky top-0 z-10 border-b bg-gray-50 px-6 py-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search muscle group"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="p-6">
            {/* No results message */}
            {searchQuery.trim() && filteredMuscles.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-gray-500">
                  No muscle groups found matching "{searchQuery}"
                </p>
              </div>
            )}

            {/* Muscle List */}
            {filteredMuscles.length > 0 && (
              <div className="space-y-2">
                {filteredMuscles.map((muscle) => (
                  <button
                    key={muscle.value}
                    className={`flex w-full items-center justify-between rounded-lg p-3 text-left transition-all ${
                      selectedMuscle === muscle.value
                        ? "border-2 border-indigo-500 bg-indigo-100 shadow-sm"
                        : "border-2 border-transparent bg-gray-50 hover:bg-gray-100"
                    }`}
                    onClick={() => setSelectedMuscle(muscle.value)}
                  >
                    <span
                      className={`font-medium ${
                        selectedMuscle === muscle.value
                          ? "text-indigo-900"
                          : "text-gray-900"
                      }`}
                    >
                      {muscle.label}
                    </span>
                    {selectedMuscle === muscle.value && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600">
                        <CheckIcon className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 justify-end gap-3 border-t bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 transition-colors hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedMuscle && onConfirm) {
                onConfirm(selectedMuscle, activeTab);
              }
            }}
            disabled={!selectedMuscle || isLoading}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
              selectedMuscle && !isLoading
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "cursor-not-allowed bg-gray-300 text-gray-500"
            }`}
          >
            {isLoading ? (
              <>
                <SpinnerIcon className="h-4 w-4 animate-spin text-white" />
                Adding...
              </>
            ) : (
              "Add"
            )}
          </button>
        </div>
      </div>
    </>
  );
};

// Notes Modal Component
const NotesModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (note: string) => void;
  isLoading?: boolean;
}) => {
  const [noteText, setNoteText] = useState<string>("");

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNoteText("");
    }
  }, [isOpen]);

  const isValidNote = noteText.trim().length > 0;

  if (!isOpen) return null;

  return (
    <>
      {/* Background overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 z-50 mx-auto flex max-h-[80vh] max-w-lg -translate-y-1/2 flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Add Note</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add your note here..."
            className="w-full resize-none rounded-lg border border-gray-300 bg-white p-3 text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={4}
            disabled={isLoading}
          />
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 justify-end gap-3 border-t bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 transition-colors hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (isValidNote && onConfirm) {
                onConfirm(noteText.trim());
              }
            }}
            disabled={!isValidNote || isLoading}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
              isValidNote && !isLoading
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "cursor-not-allowed bg-gray-300 text-gray-500"
            }`}
          >
            {isLoading ? (
              <>
                <SpinnerIcon className="h-4 w-4 animate-spin text-white" />
                Adding...
              </>
            ) : (
              "Add"
            )}
          </button>
        </div>
      </div>
    </>
  );
};

// Add Exercise Modal Component
const AddExerciseModal = ({
  isOpen,
  onClose,
  availableExercises = [],
  existingExercises = [],
  onConfirm,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  availableExercises?: any[];
  existingExercises?: string[];
  onConfirm?: (exerciseName: string) => void;
  isLoading?: boolean;
}) => {
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Reset selection and search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedExercise(null);
      setSearchQuery("");
    }
  }, [isOpen]);

  // Filter exercises using shared utilities
  const filteredExercises = React.useMemo(() => {
    if (!availableExercises || availableExercises.length === 0) return [];

    // During loading, keep selected exercise visible but filter out other active exercises
    if (isLoading && selectedExercise) {
      // Filter out active exercises except the selected one
      const activeExercisesExceptSelected = existingExercises.filter(
        (name) => name !== selectedExercise,
      );

      return getFilteredExercises(availableExercises, {
        searchQuery,
        activeExerciseNames: activeExercisesExceptSelected,
      });
    }

    // Normal filtering
    return getFilteredExercises(availableExercises, {
      searchQuery,
      activeExerciseNames: existingExercises,
    });
  }, [
    availableExercises,
    existingExercises,
    searchQuery,
    isLoading,
    selectedExercise,
  ]);

  if (!isOpen) return null;

  return (
    <>
      {/* Background overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 z-50 mx-auto flex max-h-[80vh] max-w-lg -translate-y-1/2 flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Add Exercise</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Search Bar */}
          <div className="sticky top-0 z-10 border-b bg-gray-50 px-6 py-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search exercises..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="p-6">
            {/* No results message */}
            {searchQuery.trim() && filteredExercises.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-gray-500">
                  No exercises found matching "{searchQuery}"
                </p>
              </div>
            )}

            {/* All Exercises */}
            {filteredExercises.length > 0 && (
              <div className="space-y-2">
                {filteredExercises.map((exercise, idx) => (
                  <ExerciseListItem
                    key={exercise.id || idx}
                    name={exercise.name}
                    isSelected={selectedExercise === exercise.name}
                    isLoading={isLoading && selectedExercise === exercise.name}
                    onClick={() =>
                      !isLoading && setSelectedExercise(exercise.name)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 justify-end gap-3 border-t bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 transition-colors hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedExercise && onConfirm) {
                onConfirm(selectedExercise);
              }
            }}
            disabled={!selectedExercise || isLoading}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
              selectedExercise && !isLoading
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "cursor-not-allowed bg-gray-300 text-gray-500"
            }`}
          >
            {isLoading ? (
              <>
                <SpinnerIcon className="h-4 w-4 animate-spin text-white" />
                Adding...
              </>
            ) : (
              "Add Exercise"
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default function ClientPreferencePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const userId = params.userId as string;
  const trpc = useTRPC();
  const [currentStep, setCurrentStep] = useState(1); // 1: Workout Style, 2: Muscle Target, 3: Muscle Limit, 4: Intensity

  // Mutation for updating ready status
  const updateReadyStatus = useMutation(
    trpc.trainingSession.updateClientReadyStatusPublic.mutationOptions({
      onSuccess: () => {
        // Navigate to client-workout-overview after marking as ready
        console.log("Successfully marked as ready");
        router.push(
          `/client-workout-overview?sessionId=${sessionId}&userId=${userId}`,
        );
      },
      onError: (error) => {
        console.error("Failed to update ready status:", error);
        alert("Failed to mark as ready. Please try again.");
      },
    }),
  );

  // Use the shared hook for all business logic
  const {
    clientData,
    selectionsData,
    recommendationsData,
    availableExercises,
    exercises,
    isLoading,
    clientError,
    selectionsError,
    modalOpen,
    setModalOpen,
    selectedExerciseForChange,
    setSelectedExerciseForChange,
    addModalOpen,
    setAddModalOpen,
    handleExerciseReplacement,
    handleAddExercise,
    handlePreferenceUpdate,
    isProcessingChange,
    isAddingExercise,
    isAddingMuscle,
    handleAddMusclePreference,
    handleRemoveMusclePreference,
    workoutPreferences,
    isRemovingMuscle,
    handleAddNote,
    handleRemoveNote,
    isAddingNote,
    isRemovingNote,
  } = useClientPreferences({ sessionId, userId, trpc });

  const queryClient = useQueryClient();

  // Add workout type update mutation
  const updateWorkoutTypeMutation = useMutation({
    ...trpc.workoutPreferences.updateWorkoutTypePublic.mutationOptions(),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error("Failed to update workout type:", error);
    },
  });

  // Add intensity update mutation
  const updateIntensityMutation = useMutation({
    ...trpc.workoutPreferences.updateIntensityPublic.mutationOptions(),
    onSuccess: () => {
      // Invalidate queries to refresh data in global preferences
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error("Failed to update intensity:", error);
    },
  });

  // Use shared modal state hook
  const muscleModal = useModalState();
  const notesModal = useModalState();

  // Subscribe to realtime preference updates
  useRealtimePreferences({
    sessionId: sessionId || "",
    supabase,
    onPreferenceUpdate: handlePreferenceUpdate,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading your preferences...</p>
        </div>
      </div>
    );
  }

  // Check for errors or missing data
  if (clientError || selectionsError || !clientData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Client Not Found</h1>
          <p className="mt-2 text-gray-600">
            This preference link may be invalid or expired.
          </p>
          {(clientError || selectionsError) && (
            <p className="mt-2 text-sm text-red-600">
              Error: {clientError?.message || selectionsError?.message}
            </p>
          )}
        </div>
      </div>
    );
  }

  const client = clientData.user;
  const displayData = {
    id: client.userId,
    name: client.userName || "Unknown Client",
    avatar: client.userId,
    exerciseCount: exercises.length,
    confirmedExercises: exercises,
    muscleFocus: client.preferences?.muscleTargets || [],
    avoidance: client.preferences?.muscleLessens || [],
  };

  return (
    <div className="relative min-h-screen overflow-y-auto bg-gray-50">
      {/* Full screen loading overlay */}
      {updateWorkoutTypeMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-lg bg-white p-6 shadow-xl">
            <SpinnerIcon className="h-5 w-5 animate-spin text-indigo-600" />
            <span className="font-medium text-gray-700">
              Updating preferences...
            </span>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-md p-4 pb-20">
        {/* Client info outside card */}
        <div className="mb-6 mt-4 flex items-center justify-center">
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${displayData.avatar}`}
            alt={displayData.name}
            className="mr-3 h-10 w-10 rounded-full"
          />
          <h2 className="text-lg font-semibold text-gray-900">
            {displayData.name}
          </h2>
        </div>

        {/* Client Card - Single card view */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          {/* Progress indicator */}
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-center justify-center space-x-2">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-2 w-8 rounded-full transition-colors ${
                    step === currentStep
                      ? "bg-indigo-600"
                      : step < currentStep
                        ? "bg-indigo-300"
                        : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-center text-sm text-gray-500">
              Step {currentStep} of 4
            </p>
          </div>

          {/* Step 1: Workout Focus */}
          {currentStep === 1 && (
            <div className="p-6">
              <div className="mb-6 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                  1
                </div>
                <h4 className="font-medium text-gray-900">Workout Focus</h4>
              </div>

              {/* Workout Type - Full Body Only */}
              <div className="mb-8">
                <p className="mb-3 text-sm font-medium text-gray-700">
                  Workout Type
                </p>
                <div className="space-y-2">
                  <label className="flex cursor-default items-center rounded-lg border border-gray-300 bg-gray-50 p-3">
                    <input
                      type="radio"
                      name="workoutType"
                      value="full_body"
                      checked={true}
                      readOnly
                      className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-gray-700">Full Body</span>
                  </label>
                </div>
              </div>

              {/* Include Finisher */}
              <div className="mb-8">
                <p className="mb-3 text-sm font-medium text-gray-700">
                  Include Finisher?
                </p>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center rounded-lg border border-gray-300 p-3 transition-colors hover:bg-gray-50">
                    <input
                      type="radio"
                      name="includeFinisher"
                      value="no"
                      checked={
                        !workoutPreferences?.workoutType?.includes(
                          "with_finisher",
                        ) ?? true
                      }
                      onChange={(e) => {
                        const workoutType = "full_body_without_finisher";
                        handlePreferenceUpdate({
                          ...workoutPreferences,
                          workoutType: workoutType,
                        });
                        // Update in database
                        updateWorkoutTypeMutation.mutate({
                          sessionId,
                          userId,
                          workoutType,
                        });
                      }}
                      className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-gray-700">No</span>
                  </label>
                  <label className="flex cursor-pointer items-center rounded-lg border border-gray-300 p-3 transition-colors hover:bg-gray-50">
                    <input
                      type="radio"
                      name="includeFinisher"
                      value="yes"
                      checked={
                        workoutPreferences?.workoutType?.includes(
                          "with_finisher",
                        ) ?? false
                      }
                      onChange={(e) => {
                        const workoutType = "full_body_with_finisher";
                        handlePreferenceUpdate({
                          ...workoutPreferences,
                          workoutType: workoutType,
                        });
                        // Update in database
                        updateWorkoutTypeMutation.mutate({
                          sessionId,
                          userId,
                          workoutType,
                        });
                      }}
                      className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-gray-700">Yes</span>
                  </label>
                </div>
              </div>

              {/* Navigation */}
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Muscle Target */}
          {currentStep === 2 && (
            <div className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                  2
                </div>
                <h4 className="font-medium text-gray-900">Muscle Target</h4>
              </div>
              <p className="mb-4 text-sm text-gray-600">
                Select muscles you want to focus on during the workout
                <span className="mt-1 block text-xs text-gray-500">
                  Full Body workouts: Maximum 2 muscles
                </span>
              </p>
              <div className="space-y-3">
                {/* Muscle Target Items */}
                {displayData.muscleFocus.map((muscle, idx) => (
                  <PreferenceListItem
                    key={`focus-${idx}`}
                    label={formatMuscleLabel(muscle)}
                    type="target"
                    onRemove={() =>
                      handleRemoveMusclePreference(muscle, "target")
                    }
                    isRemoving={isRemovingMuscle}
                  />
                ))}

                {/* Add button */}
                {(() => {
                  const muscleCount = displayData.muscleFocus.length;
                  const canAddMore = muscleCount < 2;

                  return (
                    <button
                      onClick={() => {
                        if (canAddMore) {
                          muscleModal.open();
                        }
                      }}
                      disabled={!canAddMore}
                      className={`flex w-full items-center justify-center gap-2 rounded-lg border p-3 font-medium shadow-sm transition-colors ${
                        canAddMore
                          ? "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                          : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
                      }`}
                    >
                      <PlusIcon />
                      {muscleCount === 0
                        ? "Add Target Muscle"
                        : !canAddMore
                          ? `Maximum reached (${muscleCount}/2)`
                          : "Add More"}
                    </button>
                  );
                })()}
              </div>

              {/* Navigation buttons */}
              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-2 font-medium text-gray-700 transition-colors hover:text-gray-900"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  {displayData.muscleFocus.length === 0 ? "Skip" : "Next"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Muscle Limit */}
          {currentStep === 3 && (
            <div className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                  3
                </div>
                <h4 className="font-medium text-gray-900">Muscle Limit</h4>
              </div>
              <p className="mb-4 text-sm text-gray-600">
                Select muscles to avoid or limit during the workout
              </p>
              <div className="space-y-3">
                {/* Limit Items */}
                {displayData.avoidance.map((item, idx) => (
                  <PreferenceListItem
                    key={`avoid-${idx}`}
                    label={formatMuscleLabel(item)}
                    type="limit"
                    onRemove={() => handleRemoveMusclePreference(item, "limit")}
                    isRemoving={isRemovingMuscle}
                  />
                ))}

                {/* Add button */}
                <button
                  onClick={() => {
                    muscleModal.open();
                    // Set muscle modal to limit mode
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white p-3 font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50"
                >
                  <PlusIcon />
                  {displayData.avoidance.length === 0
                    ? "Add Muscle Limit"
                    : "Add More"}
                </button>
              </div>

              {/* Navigation buttons */}
              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-2 font-medium text-gray-700 transition-colors hover:text-gray-900"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(4)}
                  className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  {displayData.avoidance.length === 0 ? "Skip" : "Next"}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Intensity */}
          {currentStep === 4 && (
            <div className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                  4
                </div>
                <h4 className="font-medium text-gray-900">Intensity</h4>
              </div>
              <p className="mb-4 text-sm text-gray-600">
                Select your preferred workout intensity
              </p>
              <div className="space-y-3">
                <div className="relative">
                  <select
                    value={workoutPreferences?.intensity || "moderate"}
                    onChange={(e) => {
                      const newIntensity = e.target.value as
                        | "low"
                        | "moderate"
                        | "high";
                      // Update local state immediately
                      handlePreferenceUpdate({
                        ...workoutPreferences,
                        intensity: newIntensity,
                      });
                      // Update in database for global preferences
                      updateIntensityMutation.mutate({
                        sessionId,
                        userId,
                        intensity: newIntensity,
                      });
                    }}
                    disabled={updateIntensityMutation.isPending}
                    className="w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 font-medium text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="low">Low (4 exercises)</option>
                    <option value="moderate">Moderate (5 exercises)</option>
                    <option value="high">High (6 exercises)</option>
                    <option value="intense">Intense (7 exercises)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-2 font-medium text-gray-700 transition-colors hover:text-gray-900"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    updateReadyStatus.mutate({
                      sessionId,
                      userId,
                      isReady: true,
                    });
                  }}
                  disabled={updateReadyStatus.isPending}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  {updateReadyStatus.isPending ? "Completing..." : "Complete"}
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Exercise Change Modal */}
      <ExerciseChangeModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedExerciseForChange(null);
        }}
        exerciseName={selectedExerciseForChange?.name || ""}
        availableExercises={availableExercises || []}
        blueprintRecommendations={(() => {
          const recommendations = recommendationsData?.recommendations || [];
          console.log(
            "[ClientPreferencePage] Passing recommendations to modal:",
            {
              hasRecommendationsData: !!recommendationsData,
              recommendationsCount: recommendations.length,
              sampleRecommendations: recommendations
                .slice(0, 3)
                .map((r: any) => ({
                  name: r.name,
                  roundId: r.roundId,
                })),
            },
          );
          return recommendations;
        })()}
        currentRound={selectedExerciseForChange?.round}
        onConfirm={handleExerciseReplacement}
        isLoading={isProcessingChange}
      />

      {/* Add Exercise Modal */}
      <AddExerciseModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
        }}
        availableExercises={availableExercises || []}
        existingExercises={exercises
          .filter((ex) => ex.isActive)
          .map((ex) => ex.name)}
        onConfirm={handleAddExercise}
        isLoading={isAddingExercise}
      />

      {/* Muscle Target/Limit Modal */}
      <MuscleModal
        isOpen={muscleModal.isOpen}
        onClose={muscleModal.close}
        onConfirm={async (muscle, type) => {
          // Check constraints before adding
          if (type === "target") {
            const currentTargets =
              clientData?.user?.preferences?.muscleTargets || [];
            const isFullBody =
              workoutPreferences?.workoutType?.startsWith("full_body");
            const maxAllowed = isFullBody ? 2 : 3;

            if (currentTargets.length >= maxAllowed) {
              console.warn(
                `Cannot add more than ${maxAllowed} muscle targets for ${isFullBody ? "full body" : "targeted"} workouts`,
              );
              return;
            }
          }

          await handleAddMusclePreference(muscle, type);
          muscleModal.close();
        }}
        isLoading={isAddingMuscle}
        existingTargets={clientData?.user?.preferences?.muscleTargets || []}
        existingLimits={clientData?.user?.preferences?.muscleLessens || []}
        initialTab={currentStep === 2 ? "target" : "limit"}
      />

      {/* Notes Modal */}
      <NotesModal
        isOpen={notesModal.isOpen}
        onClose={notesModal.close}
        onConfirm={async (note) => {
          await handleAddNote(note);
          notesModal.close();
        }}
        isLoading={isAddingNote}
      />
    </div>
  );
}
