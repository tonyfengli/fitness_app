"use client";

import { useEffect, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { useBusinessId } from "~/hooks/useBusinessContext";
import { useTRPC } from "~/trpc/react";
import { BlockDebugClient } from "~/utils/blockDebugClient";
import { extractBlockInfo, getBlockColorClasses } from "~/utils/blockHelpers";
import { isDebugEnabled } from "~/utils/debugConfig";
import WorkoutGenerationModal from "./workout-generation-modal";

const STRENGTH_OPTIONS = [
  { value: "very_low", label: "Very Low Only" },
  { value: "low", label: "Low & Below" },
  { value: "moderate", label: "Moderate & Below" },
  { value: "high", label: "High & Below" },
];

const SKILL_OPTIONS = [
  { value: "very_low", label: "Very Low Only" },
  { value: "low", label: "Low & Below" },
  { value: "moderate", label: "Moderate & Below" },
  { value: "high", label: "High & Below (All)" },
];

const INTENSITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
];

const JOINT_OPTIONS = [
  { value: "ankles", label: "Ankles" },
  { value: "knees", label: "Knees" },
  { value: "hips", label: "Hips" },
  { value: "shoulders", label: "Shoulders" },
  { value: "elbows", label: "Elbows" },
  { value: "wrists", label: "Wrists" },
  { value: "neck", label: "Neck" },
  { value: "lower_back", label: "Lower Back" },
  { value: "spine", label: "Spine" },
  { value: "sacroiliac_joint", label: "Sacroiliac Joint" },
  { value: "patella", label: "Patella" },
  { value: "rotator_cuff", label: "Rotator Cuff" },
];

const MUSCLE_OPTIONS = [
  { value: "glutes", label: "Glutes" },
  { value: "quads", label: "Quads" },
  { value: "hamstrings", label: "Hamstrings" },
  { value: "calves", label: "Calves" },
  { value: "adductors", label: "Adductors" },
  { value: "abductors", label: "Abductors" },
  { value: "core", label: "Core" },
  { value: "lower_abs", label: "Lower Abs" },
  { value: "upper_abs", label: "Upper Abs" },
  { value: "obliques", label: "Obliques" },
  { value: "chest", label: "Chest" },
  { value: "upper_chest", label: "Upper Chest" },
  { value: "lower_chest", label: "Lower Chest" },
  { value: "lats", label: "Lats" },
  { value: "traps", label: "Traps" },
  { value: "biceps", label: "Biceps" },
  { value: "triceps", label: "Triceps" },
  { value: "shoulders", label: "Shoulders" },
  { value: "delts", label: "Delts" },
  { value: "upper_back", label: "Upper Back" },
  { value: "lower_back", label: "Lower Back" },
  { value: "shins", label: "Shins" },
  { value: "tibialis_anterior", label: "Tibialis Anterior" },
];

interface Client {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  profile?: {
    strengthLevel: string;
    skillLevel: string;
    notes: string | null;
  } | null;
}

interface ExerciseListProps {
  selectedClient: Client | null;
}

export default function ExerciseList({ selectedClient }: ExerciseListProps) {
  const trpc = useTRPC();
  const businessId = useBusinessId();

  // Make debug client available globally in development
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "development"
    ) {
      (window as any).blockDebug = BlockDebugClient;
      // Only show console messages if explicitly enabled via localStorage or URL param
      const debugEnabled =
        localStorage.getItem("debug") === "true" ||
        window.location.search.includes("debug=true");
      if (debugEnabled) {
        console.log("🔍 Block Debug Client available as window.blockDebug");
      }
    }
  }, []);

  const { data: exercises } = useSuspenseQuery(
    trpc.exercise.all.queryOptions({
      limit: 1000, // Get all exercises for the library
      offset: 0,
    }),
  );

  // Filter states
  // Strength and skill come from selected client now
  const strengthFilter = selectedClient?.profile?.strengthLevel || "moderate";
  const skillFilter = selectedClient?.profile?.skillLevel || "moderate";
  const [intensityFilter, setIntensityFilter] = useState("moderate");

  // Exercise inclusion/exclusion states
  const [includeExercises, setIncludeExercises] = useState<string[]>([]);
  const [avoidExercises, setAvoidExercises] = useState<string[]>([]);

  // Joint avoidance states
  const [avoidJoints, setAvoidJoints] = useState<string[]>([]);

  // Muscle targeting states
  const [muscleTarget, setMuscleTarget] = useState<string[]>([]);
  const [muscleLessen, setMuscleLessen] = useState<string[]>([]);

  // Full body workout state
  const [isFullBody, setIsFullBody] = useState(false);

  // Session goal state
  const [sessionGoal, setSessionGoal] = useState<"strength" | "stability">(
    "strength",
  );

  // Filter timing state
  const [filterTiming, setFilterTiming] = useState<number | null>(null);
  const [filterStartTime, setFilterStartTime] = useState<number | null>(null);
  const [currentElapsed, setCurrentElapsed] = useState<number>(0);

  // State to toggle table visibility
  const [showTable, setShowTable] = useState(false);

  // Workout generation modal state
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);

  // Template selection state
  const [selectedTemplate, setSelectedTemplate] = useState<
    "standard" | "circuit" | "full_body"
  >("standard");

  const [llmInterpretation, setLlmInterpretation] = useState<{
    blockA?: string[];
    blockB?: string[];
    blockC?: string[];
    blockD?: string[];
    reasoning?: string;
    error?: string;
    processingTime?: number; // Time in seconds
    rawResponse?: string; // Add raw LLM response for debugging
    timing?: {
      exerciseFormatting?: number;
      setCountCalculation?: number;
      promptBuilding?: number;
      llmApiCall?: number;
      responseParsing?: number;
    };
  } | null>(null);
  const [setRange, setSetRange] = useState<{
    minSets: number;
    maxSets: number;
    reasoning: string;
  } | null>(null);
  const [isInterpreting, setIsInterpreting] = useState(false);

  // State to track whether we're showing filtered results
  const [showFiltered, setShowFiltered] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState<{
    strength: string;
    skill: string;
    intensity: string;
    include: string[];
    avoid: string[];
    avoidJoints: string[];
    muscleTarget: string[];
    muscleLessen: string[];
    isFullBody: boolean;
  } | null>(null);

  // Query for filtered exercises (only runs when filterCriteria is set)
  const {
    data: filteredExercises,
    isLoading: isFiltering,
    error: filterError,
  } = useQuery({
    ...trpc.exercise.filter.queryOptions({
      clientId: selectedClient?.id, // Pass the client's user ID
      clientName:
        selectedClient?.name || selectedClient?.email || "Unknown Client",
      strengthCapacity: (filterCriteria?.strength || "moderate") as
        | "very_low"
        | "low"
        | "moderate"
        | "high"
        | "very_high"
        | "all",
      skillCapacity: (filterCriteria?.skill || "moderate") as
        | "very_low"
        | "low"
        | "moderate"
        | "high"
        | "all",
      includeExercises: filterCriteria?.include || [],
      avoidExercises: filterCriteria?.avoid || [],
      avoidJoints: filterCriteria?.avoidJoints || [],
      intensity: filterCriteria?.intensity as
        | "low"
        | "medium"
        | "high"
        | undefined,
      muscleTarget: filterCriteria?.muscleTarget || [],
      muscleLessen: filterCriteria?.muscleLessen || [],
      isFullBody: filterCriteria?.isFullBody || false,
      businessId: businessId || undefined,
      userInput: "", // No user input for now
    }),
    enabled: filterCriteria !== null,
  });

  // Track filter timing
  useEffect(() => {
    if (isFiltering && !filterStartTime) {
      setFilterStartTime(Date.now());
      setCurrentElapsed(0);
    } else if (!isFiltering && filterStartTime && filteredExercises) {
      const endTime = Date.now();
      const duration = endTime - filterStartTime;
      setFilterTiming(duration);
      setFilterStartTime(null);
      setCurrentElapsed(0);
    }
  }, [isFiltering, filterStartTime, filteredExercises]);

  // Update elapsed time while filtering
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isFiltering && filterStartTime) {
      interval = setInterval(() => {
        setCurrentElapsed(Date.now() - filterStartTime);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isFiltering, filterStartTime]);

  // Display exercises (either all or filtered)
  const displayedExercises =
    showFiltered && filteredExercises
      ? filteredExercises
      : (exercises as any[]);

  // Log filtering errors
  if (filterError) {
    console.error("Filter error:", filterError);
    console.error("Filter error details:", {
      message: filterError.message,
      data: filterError.data,
      cause: (filterError as any).cause,
    });
  }

  // Automatically call LLM interpretation when filtered exercises are ready
  useEffect(() => {
    if (
      !showFiltered ||
      !filteredExercises ||
      filteredExercises.length === 0 ||
      isInterpreting
    ) {
      return;
    }

    const interpretWorkout = async () => {
      const startTime = Date.now();
      setIsInterpreting(true);
      setLlmInterpretation(null);

      try {
        // Get blocks dynamically
        const blocks = extractBlockInfo(filteredExercises);

        // Prepare exercises object for LLM - maintain legacy format for now
        const exercises: any = {};

        blocks.forEach((block) => {
          // Only get top exercises based on maxCount
          const topExercises = block.exercises
            .sort((a, b) => b.score - a.score)
            .slice(0, block.maxCount)
            .map((ex: any) => ({
              id: ex.id,
              name: ex.name,
              score: ex.score,
              tags: ex.functionTags || [],
              primaryMuscle: ex.primaryMuscle,
              equipment: ex.equipment,
            }));

          // Map to legacy block names for backward compatibility
          if (block.id === "A") exercises.blockA = topExercises;
          else if (block.id === "B") exercises.blockB = topExercises;
          else if (block.id === "C") exercises.blockC = topExercises;
          else if (block.id === "D") exercises.blockD = topExercises;
        });

        // Build client context with only non-empty values
        const clientContext: Record<string, any> = {};

        // Only add values that are not default/empty
        if (sessionGoal) clientContext.sessionGoal = sessionGoal;
        if (strengthFilter !== "all")
          clientContext.strength_capacity = strengthFilter;
        if (skillFilter) clientContext.skill_capacity = skillFilter;
        if (intensityFilter) clientContext.intensity = intensityFilter;
        if (includeExercises.length > 0)
          clientContext.exercise_requests = {
            include: includeExercises,
            avoid: [],
          };
        if (muscleTarget.length > 0) clientContext.muscle_target = muscleTarget;
        if (muscleLessen.length > 0) clientContext.muscle_lessen = muscleLessen;

        // Call the API route
        const response = await fetch("/api/interpret-workout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ exercises, clientContext }),
        });

        const result = await response.json();
        const processingTime = (Date.now() - startTime) / 1000; // Convert to seconds

        if (!response.ok || result.error) {
          setLlmInterpretation({
            error: result.error || "Failed to interpret workout",
            processingTime,
          });
        } else {
          console.log("LLM Response:", result); // Debug log
          console.log("Structured Output:", result.structuredOutput); // Debug log
          setLlmInterpretation({
            ...result.structuredOutput,
            processingTime,
            timing: result.timing, // Include timing breakdown from backend
          });
          // Set the set range from the API response
          if (result.setRange) {
            setSetRange(result.setRange);
          }
        }
      } catch (error) {
        console.error("Error interpreting workout:", error);
        const processingTime = (Date.now() - startTime) / 1000;
        setLlmInterpretation({
          error: "Failed to interpret workout",
          processingTime,
        });
      } finally {
        setIsInterpreting(false);
      }
    };

    interpretWorkout();
  }, [
    showFiltered,
    filteredExercises,
    sessionGoal,
    strengthFilter,
    skillFilter,
    intensityFilter,
    includeExercises,
    muscleTarget,
    muscleLessen,
  ]);

  // Function to calculate selected exercises for Block D with constraints
  const getBlockDSelected = (exercises: any[]) => {
    const blockDExercises = exercises
      .filter(
        (ex) =>
          ex.functionTags?.includes("core") ||
          ex.functionTags?.includes("capacity"),
      )
      .sort((a, b) => b.score - a.score);

    if (blockDExercises.length === 0) return new Set<string>();

    const selected: any[] = [];
    let coreCount = 0;
    let capacityCount = 0;

    const isCore = (ex: any) => ex.functionTags?.includes("core");
    const isCapacity = (ex: any) => ex.functionTags?.includes("capacity");

    // Check if minimum constraints are met
    const constraintsMet = () => coreCount >= 1 && capacityCount >= 2;

    // Calculate priority for constraint satisfaction
    const getConstraintPriority = (exercise: any) => {
      if (constraintsMet()) return 0;

      let priority = 0;
      if (coreCount < 1 && isCore(exercise)) priority += 3;
      if (capacityCount < 2 && isCapacity(exercise)) priority += 3;

      return priority;
    };

    // Selection algorithm: Prioritize constraints until met, then go by score
    for (const candidate of blockDExercises) {
      if (selected.length >= 6) break;

      const priority = getConstraintPriority(candidate);

      // Select if it helps meet constraints
      if (priority > 0) {
        selected.push(candidate);
        if (isCore(candidate)) coreCount++;
        if (isCapacity(candidate)) capacityCount++;
      }
    }

    // After constraints are met (or attempted), fill remaining slots with highest scoring exercises
    if (selected.length < 6) {
      const remaining = blockDExercises.filter((ex) => !selected.includes(ex));
      const slotsToFill = 6 - selected.length;
      const highestScoring = remaining.slice(0, slotsToFill);

      for (const candidate of highestScoring) {
        selected.push(candidate);
        if (isCore(candidate)) coreCount++;
        if (isCapacity(candidate)) capacityCount++;
      }
    }

    // Return a set of selected exercise IDs
    return new Set(selected.map((ex) => ex.id));
  };

  if (exercises.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-lg text-gray-600">No exercises found.</p>
        <p className="mt-2 text-sm text-gray-500">
          Add some exercises to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Dropdowns */}
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        {/* Client Section */}
        <div className="mb-6">
          <h3 className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800">
            Client
          </h3>

          {/* Phase 1 */}
          <div className="mb-4">
            <h4 className="text-md mb-2 font-medium text-gray-700">Phase 1</h4>
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
              {/* Session Goal Dropdown */}
              <div>
                <label
                  htmlFor="sessionGoal"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Session Goal
                </label>
                <select
                  id="sessionGoal"
                  value={sessionGoal}
                  onChange={(e) =>
                    setSessionGoal(e.target.value as "strength" | "stability")
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="strength">Strength</option>
                  <option value="stability">Stability</option>
                </select>
              </div>

              {/* Client levels display - replacing manual dropdowns */}
              <div className="col-span-2">
                {selectedClient ? (
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-sm font-medium text-gray-700">
                      Client Levels:
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Strength:{" "}
                      <span className="font-medium">{strengthFilter}</span> |
                      Skill:{" "}
                      <span className="ml-1 font-medium">{skillFilter}</span>
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md bg-yellow-50 p-3">
                    <p className="text-sm text-yellow-800">
                      Please select a client from the dropdown above to filter
                      exercises.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="include"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Include Exercises
                </label>
                <select
                  id="include"
                  multiple
                  value={includeExercises}
                  onChange={(e) => {
                    const selectedOptions = Array.from(
                      e.target.selectedOptions,
                      (option) => option.value,
                    );
                    setIncludeExercises(selectedOptions);
                  }}
                  className="h-24 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {exercises?.map((exercise) => (
                    <option key={exercise.id} value={exercise.name}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Hold Ctrl/Cmd to select multiple
                </p>
              </div>

              <div>
                <label
                  htmlFor="avoid"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Avoid Exercises
                </label>
                <select
                  id="avoid"
                  multiple
                  value={avoidExercises}
                  onChange={(e) => {
                    const selectedOptions = Array.from(
                      e.target.selectedOptions,
                      (option) => option.value,
                    );
                    setAvoidExercises(selectedOptions);
                  }}
                  className="h-24 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {exercises?.map((exercise) => (
                    <option key={exercise.id} value={exercise.name}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Hold Ctrl/Cmd to select multiple
                </p>
              </div>

              <div>
                <label
                  htmlFor="avoidJoints"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Avoid Joints
                </label>
                <select
                  id="avoidJoints"
                  multiple
                  value={avoidJoints}
                  onChange={(e) => {
                    const selectedOptions = Array.from(
                      e.target.selectedOptions,
                      (option) => option.value,
                    );
                    setAvoidJoints(selectedOptions);
                  }}
                  className="h-24 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {JOINT_OPTIONS.map((joint) => (
                    <option key={joint.value} value={joint.value}>
                      {joint.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Hold Ctrl/Cmd to select multiple
                </p>
              </div>
            </div>
          </div>

          {/* Phase 2 */}
          <div className="mb-4">
            <h4 className="text-md mb-2 font-medium text-gray-700">Phase 2</h4>
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label
                  htmlFor="muscleTarget"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Muscle Target
                </label>
                <select
                  id="muscleTarget"
                  multiple
                  value={muscleTarget}
                  onChange={(e) => {
                    const selectedOptions = Array.from(
                      e.target.selectedOptions,
                      (option) => option.value,
                    );
                    setMuscleTarget(selectedOptions);
                  }}
                  className="h-24 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MUSCLE_OPTIONS.map((muscle) => (
                    <option key={muscle.value} value={muscle.value}>
                      {muscle.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Hold Ctrl/Cmd to select multiple
                </p>
              </div>

              <div>
                <label
                  htmlFor="muscleLessen"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Muscle Lessen
                </label>
                <select
                  id="muscleLessen"
                  multiple
                  value={muscleLessen}
                  onChange={(e) => {
                    const selectedOptions = Array.from(
                      e.target.selectedOptions,
                      (option) => option.value,
                    );
                    setMuscleLessen(selectedOptions);
                  }}
                  className="h-24 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MUSCLE_OPTIONS.map((muscle) => (
                    <option key={muscle.value} value={muscle.value}>
                      {muscle.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Hold Ctrl/Cmd to select multiple
                </p>
              </div>

              <div>
                <label
                  htmlFor="intensity"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Intensity
                </label>
                <select
                  id="intensity"
                  value={intensityFilter}
                  onChange={(e) => setIntensityFilter(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {INTENSITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Template Selection */}
            <div className="mb-4">
              <label
                htmlFor="template"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Workout Template
              </label>
              <select
                id="template"
                value={selectedTemplate}
                onChange={(e) =>
                  setSelectedTemplate(
                    e.target.value as "standard" | "circuit" | "full_body",
                  )
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="standard">
                  Standard - Traditional strength training
                </option>
                <option value="circuit">Circuit - High-intensity rounds</option>
                <option value="full_body">
                  Full Body - Balanced muscle groups
                </option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Template affects how exercises are organized into blocks
              </p>
            </div>
          </div>
        </div>

        {/* Filter Button */}
        <div className="flex justify-center gap-3">
          <button
            onClick={() => {
              // Build complete client context with all Phase 2 fields
              const clientContext = {
                name: "Web User",
                strength_capacity: strengthFilter as
                  | "very_low"
                  | "low"
                  | "moderate"
                  | "high"
                  | "very_high"
                  | "all",
                skill_capacity: skillFilter as
                  | "very_low"
                  | "low"
                  | "moderate"
                  | "high"
                  | "all",
                intensity: intensityFilter as "low" | "medium" | "high",
                muscle_target: muscleTarget,
                muscle_lessen: muscleLessen,
                exercise_requests: {
                  include: includeExercises,
                  avoid: avoidExercises,
                },
                avoid_joints: avoidJoints,
                business_id: businessId,
              };

              // Build complete filter criteria with all Phase 2 fields
              const criteria = {
                strength: strengthFilter,
                skill: skillFilter,
                intensity: intensityFilter,
                include: includeExercises,
                avoid: avoidExercises,
                avoidJoints: avoidJoints,
                muscleTarget: muscleTarget,
                muscleLessen: muscleLessen,
                isFullBody: selectedTemplate === "full_body",
              };

              setFilterCriteria(criteria);
              setShowFiltered(true);
            }}
            disabled={isFiltering || !selectedClient}
            className="rounded-md bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isFiltering
              ? `Filtering... ${(currentElapsed / 1000).toFixed(1)}s`
              : !selectedClient
                ? "Select a Client First"
                : "Filter Workouts"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          {showFiltered ? (
            <>
              <span className="font-medium text-green-600">
                Filtering Applied:
              </span>{" "}
              Showing {displayedExercises?.length || 0} filtered exercises
              {filterTiming && (
                <span className="ml-2 text-xs text-gray-500">
                  ({(filterTiming / 1000).toFixed(2)}s)
                </span>
              )}
              {displayedExercises &&
                displayedExercises.length > 0 &&
                (displayedExercises[0] as any).score !== undefined && (
                  <span className="ml-2 font-medium text-blue-600">
                    (Scored & Sorted)
                  </span>
                )}
            </>
          ) : (
            `Showing ${displayedExercises?.length || 0} exercises (unfiltered)`
          )}
        </p>

        {/* Set Range Display */}
        {setRange && showFiltered && (
          <div className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2">
            <p className="text-sm font-medium text-indigo-900">
              Session Volume: {setRange.minSets}-{setRange.maxSets} total sets
            </p>
            <p className="mt-1 text-xs text-indigo-700">{setRange.reasoning}</p>
          </div>
        )}
      </div>

      {/* Toggle Table Button */}
      <div className="my-4 flex justify-center">
        <button
          onClick={() => setShowTable(!showTable)}
          className="rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          {showTable ? "Hide Table" : "Show Table"}
        </button>
      </div>

      {/* Table - conditionally rendered */}
      {showTable && (
        <div className="max-h-96 overflow-x-auto overflow-y-auto rounded-lg border">
          <table className="w-full border-gray-200 bg-white shadow">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Exercise Name
                </th>
                <th className="border-b px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Movement Pattern
                </th>
                <th className="border-b px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Final Score
                </th>
                <th className="border-b px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Fatigue Profile
                </th>
                <th className="border-b px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Muscle Target
                </th>
                <th className="border-b px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Muscle Lessen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayedExercises?.map((exercise, index) => {
                const scoredExercise = exercise as any;
                const hasScore = scoredExercise.score !== undefined;

                // Calculate muscle target matches and scoring
                const muscleTargetCriteria =
                  (showFiltered && filterCriteria?.muscleTarget) || [];
                const primaryTargetMatch = muscleTargetCriteria.includes(
                  exercise.primaryMuscle,
                );
                const secondaryTargetMatches =
                  exercise.secondaryMuscles?.filter((muscle) =>
                    muscleTargetCriteria.includes(muscle),
                  ) || [];
                const hasSecondaryTargetMatch =
                  secondaryTargetMatches.length > 0;

                // Calculate muscle lessen matches and scoring
                const muscleLessenCriteria =
                  (showFiltered && filterCriteria?.muscleLessen) || [];
                const primaryLessenMatch = muscleLessenCriteria.includes(
                  exercise.primaryMuscle,
                );
                const secondaryLessenMatches =
                  exercise.secondaryMuscles?.filter((muscle) =>
                    muscleLessenCriteria.includes(muscle),
                  ) || [];
                const hasSecondaryLessenMatch =
                  secondaryLessenMatches.length > 0;

                // Calculate scoring changes
                const targetScoreChange =
                  (primaryTargetMatch ? 3.0 : 0) +
                  (hasSecondaryTargetMatch ? 1.5 : 0);
                const lessenScoreChange =
                  (primaryLessenMatch ? -3.0 : 0) +
                  (hasSecondaryLessenMatch ? -1.5 : 0);

                // Calculate intensity adjustment if scoring is active
                const intensityPreference =
                  showFiltered && filterCriteria?.intensity;
                let intensityAdjustment = 0;
                if (
                  intensityPreference &&
                  intensityPreference !== "moderate" &&
                  exercise.fatigueProfile
                ) {
                  const intensityScoring = {
                    low: {
                      low_local: 1.5,
                      moderate_local: 0.75,
                      high_local: -1.5,
                      moderate_systemic: -0.75,
                      high_systemic: -1.5,
                      metabolic: -1.5,
                    },
                    high: {
                      low_local: -1.5,
                      moderate_local: -0.75,
                      high_local: 1.5,
                      moderate_systemic: 0.75,
                      high_systemic: 1.5,
                      metabolic: 1.5,
                    },
                  };
                  const scoring =
                    intensityScoring[
                      intensityPreference as keyof typeof intensityScoring
                    ];
                  if (scoring) {
                    intensityAdjustment =
                      scoring[
                        exercise.fatigueProfile as keyof typeof scoring
                      ] || 0;
                  }
                }

                return (
                  <tr
                    key={exercise.id}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {exercise.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          Primary: {exercise.primaryMuscle}
                          {exercise.secondaryMuscles &&
                            exercise.secondaryMuscles.length > 0 && (
                              <span className="ml-2">
                                | Secondary:{" "}
                                {exercise.secondaryMuscles.join(", ")}
                              </span>
                            )}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          Strength: {exercise.strengthLevel} • Skill:{" "}
                          {exercise.complexityLevel}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                        {exercise.movementPattern || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasScore ? (
                        <span className="text-lg font-semibold text-blue-600">
                          {scoredExercise.score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="space-y-1">
                        {intensityPreference &&
                          intensityPreference !== "medium" &&
                          intensityAdjustment !== 0 && (
                            <div
                              className={`rounded px-2 py-1 text-xs ${
                                intensityAdjustment > 0
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {exercise.fatigueProfile} (
                              {intensityAdjustment > 0 ? "+" : ""}
                              {intensityAdjustment})
                            </div>
                          )}
                        {intensityPreference &&
                          intensityPreference !== "medium" &&
                          intensityAdjustment === 0 && (
                            <div className="rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                              {exercise.fatigueProfile} (0)
                            </div>
                          )}
                        {(!intensityPreference ||
                          intensityPreference === "medium") && (
                          <span className="text-xs text-gray-400">
                            {exercise.fatigueProfile || "-"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="space-y-1">
                        {primaryTargetMatch ? (
                          <div className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
                            Primary: {exercise.primaryMuscle} (+3.0)
                          </div>
                        ) : hasSecondaryTargetMatch ? (
                          <div className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">
                            Secondary: {secondaryTargetMatches.join(", ")}{" "}
                            (+1.5)
                          </div>
                        ) : muscleTargetCriteria.length > 0 ? (
                          <span className="text-xs text-gray-400">
                            No matches
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="space-y-1">
                        {primaryLessenMatch ? (
                          <div className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
                            Primary: {exercise.primaryMuscle} (-3.0)
                          </div>
                        ) : hasSecondaryLessenMatch ? (
                          <div className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                            Secondary: {secondaryLessenMatches.join(", ")}{" "}
                            (-1.5)
                          </div>
                        ) : muscleLessenCriteria.length > 0 ? (
                          <span className="text-xs text-gray-400">
                            No matches
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Exercise Blocks Section */}
      {showFiltered && filteredExercises && (
        <div className="mt-8 space-y-6">
          <h2 className="text-center text-xl font-bold text-gray-800">
            Exercise Blocks by Function Tags
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Dynamic Blocks */}
            {extractBlockInfo(filteredExercises).map((block) => {
              const colors = getBlockColorClasses(block.color);

              return (
                <div
                  key={block.id}
                  className={`${colors.container} rounded-lg border p-3`}
                >
                  <h3
                    className={`text-base font-semibold ${colors.header} mb-2`}
                  >
                    {block.name}
                  </h3>
                  <div className="space-y-2">
                    {block.exercises
                      .sort((a, b) => b.score - a.score)
                      .map((exercise, idx) => {
                        // Check if exercise is selected for this block
                        // First try dynamic selectedBlocks array, fallback to legacy flags
                        const isSelected =
                          exercise.selectedBlocks?.includes(block.id) ||
                          (block.id === "A"
                            ? exercise.isSelectedBlockA
                            : block.id === "B"
                              ? exercise.isSelectedBlockB
                              : block.id === "C"
                                ? exercise.isSelectedBlockC
                                : block.id === "D"
                                  ? exercise.isSelectedBlockD
                                  : false);

                        return (
                          <div
                            key={exercise.id}
                            className={`rounded p-2 text-sm ${
                              isSelected ? colors.selected + " border" : ""
                            }`}
                          >
                            <span className="font-medium">{exercise.name}</span>
                            {exercise.score !== undefined && (
                              <span className={colors.score + " ml-2"}>
                                ({exercise.score.toFixed(1)})
                              </span>
                            )}
                            {isSelected && (
                              <span
                                className={`ml-2 text-xs font-bold ${colors.label}`}
                              >
                                SELECTED
                              </span>
                            )}
                          </div>
                        );
                      })}
                    {block.exercises.length === 0 && (
                      <p className="text-sm italic text-gray-500">
                        No exercises found
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Copy JSON button and LLM Interpretation */}
      {showFiltered && filteredExercises && (
        <div className="mt-6">
          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                // Helper function to clean exercise data
                const cleanExercise = (exercise: any) => {
                  const {
                    isSelected,
                    isSelectedBlockA,
                    isSelectedBlockB,
                    isSelectedBlockC,
                    isSelectedBlockD,
                    blockBPenalty,
                    blockCPenalty,
                    selectedBlocks,
                    blockPenalties,
                    ...cleanedExercise
                  } = exercise;
                  return cleanedExercise;
                };

                // Get blocks dynamically
                const blocks = extractBlockInfo(filteredExercises);
                const blockData: Record<string, any[]> = {};

                blocks.forEach((block) => {
                  // Only get top exercises based on maxCount
                  const topExercises = block.exercises
                    .sort((a, b) => b.score - a.score)
                    .slice(0, block.maxCount)
                    .map(cleanExercise);
                  blockData[block.name] = topExercises;
                });

                // Format the output
                const formattedOutput = Object.entries(blockData)
                  .map(
                    ([name, exercises]) =>
                      `${name}:\n${JSON.stringify(exercises, null, 2)}`,
                  )
                  .join("\n\n");

                navigator.clipboard.writeText(formattedOutput);
              }}
              className="rounded-md bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Copy JSON
            </button>
          </div>

          {/* LLM Results Display */}
          {(llmInterpretation || isInterpreting) && (
            <div className="mx-auto mt-6 max-w-4xl rounded-lg border border-gray-200 bg-gray-50 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  LLM Workout Interpretation
                </h3>
                <div className="text-right">
                  {llmInterpretation?.processingTime && (
                    <div className="text-sm text-gray-600">
                      Total time: {llmInterpretation.processingTime.toFixed(2)}s
                    </div>
                  )}
                  {llmInterpretation?.timing && (
                    <details className="mt-1 text-xs text-gray-500">
                      <summary className="cursor-pointer hover:text-gray-700">
                        Show timing breakdown
                      </summary>
                      <div className="mt-2 space-y-1 text-left">
                        <div>
                          Exercise formatting:{" "}
                          {(
                            llmInterpretation.timing.exerciseFormatting || 0
                          ).toFixed(0)}
                          ms
                        </div>
                        <div>
                          Set calculation:{" "}
                          {(
                            llmInterpretation.timing.setCountCalculation || 0
                          ).toFixed(0)}
                          ms
                        </div>
                        <div>
                          Prompt building:{" "}
                          {(
                            llmInterpretation.timing.promptBuilding || 0
                          ).toFixed(0)}
                          ms
                        </div>
                        <div className="font-semibold">
                          LLM API call:{" "}
                          {(
                            (llmInterpretation.timing.llmApiCall || 0) / 1000
                          ).toFixed(2)}
                          s
                        </div>
                        <div>
                          Response parsing:{" "}
                          {(
                            llmInterpretation.timing.responseParsing || 0
                          ).toFixed(0)}
                          ms
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {isInterpreting ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-600">
                    Processing workout interpretation...
                  </div>
                </div>
              ) : llmInterpretation?.error ? (
                <div className="text-red-600">
                  Error: {llmInterpretation.error}
                </div>
              ) : llmInterpretation ? (
                <>
                  {/* Workout Table */}
                  <div className="mb-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Block
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Exercise
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                            Sets
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {["blockA", "blockB", "blockC", "blockD"]
                          .map((block) => {
                            // Try both camelCase and lowercase versions
                            const exercises =
                              (llmInterpretation[
                                block as keyof typeof llmInterpretation
                              ] as any[]) ||
                              (llmInterpretation[
                                block.toLowerCase() as keyof typeof llmInterpretation
                              ] as any[]);
                            return exercises?.map((item, idx) => (
                              <tr
                                key={`${block}-${idx}`}
                                className={
                                  idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                                }
                              >
                                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                                  {idx === 0
                                    ? block
                                        .replace("block", "Block ")
                                        .toUpperCase()
                                    : ""}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                  {typeof item === "string"
                                    ? item
                                    : item.exercise}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500">
                                  {typeof item === "string" ? "-" : item.sets}
                                </td>
                              </tr>
                            ));
                          })
                          .flat()}
                      </tbody>
                      <tfoot className="bg-gray-100">
                        <tr>
                          <td
                            colSpan={2}
                            className="px-6 py-3 text-left text-sm font-medium text-gray-900"
                          >
                            Total Sets
                          </td>
                          <td className="px-6 py-3 text-center text-sm font-medium text-gray-900">
                            {["blockA", "blockB", "blockC", "blockD"].reduce(
                              (total, block) => {
                                // Try both camelCase and lowercase versions
                                const exercises =
                                  (llmInterpretation[
                                    block as keyof typeof llmInterpretation
                                  ] as any[]) ||
                                  (llmInterpretation[
                                    block.toLowerCase() as keyof typeof llmInterpretation
                                  ] as any[]);
                                return (
                                  total +
                                  (exercises?.reduce(
                                    (blockTotal, item) =>
                                      blockTotal +
                                      (typeof item === "object"
                                        ? item.sets
                                        : 0),
                                    0,
                                  ) || 0)
                                );
                              },
                              0,
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {llmInterpretation.reasoning && (
                    <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-4">
                      <h4 className="mb-2 font-medium text-gray-700">
                        Exercise Selection Reasoning
                      </h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        {llmInterpretation.reasoning
                          .split("\n")
                          .map((line, idx) => (
                            <div key={idx}>{line}</div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Generate Workout Button */}
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => setShowWorkoutModal(true)}
                      disabled={!selectedClient}
                      className="rounded-lg bg-green-600 px-8 py-3 font-semibold text-white shadow-md transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Generate Full Workout
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Workout Generation Modal */}
      <WorkoutGenerationModal
        isOpen={showWorkoutModal}
        onClose={() => setShowWorkoutModal(false)}
        clientId={selectedClient?.id || ""}
        clientName={selectedClient?.name || selectedClient?.email || "Client"}
        exercises={llmInterpretation} // Pass the LLM interpretation
        templateType={selectedTemplate}
        onWorkoutGenerated={(workout) => {
          console.log("Workout generated:", workout);
          // Show success message (you could add a toast notification here)
          alert(
            `Workout successfully generated for ${selectedClient?.name || selectedClient?.email}!`,
          );
          // TODO: Navigate to workout view or show workout details
        }}
      />
    </div>
  );
}
