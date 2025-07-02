"use client";

import { useState } from "react";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useBusinessId } from "~/hooks/useBusinessContext";

const STRENGTH_OPTIONS = [
  { value: "all", label: "All Strength Levels" },
  { value: "very_low", label: "Very Low Only" },
  { value: "low", label: "Low & Below" },
  { value: "moderate", label: "Moderate & Below" },
  { value: "high", label: "High & Below (All)" },
  { value: "very_high", label: "Very High & Below (All)" },
];

const SKILL_OPTIONS = [
  { value: "all", label: "All Skill Levels" },
  { value: "very_low", label: "Very Low Only" },
  { value: "low", label: "Low & Below" },
  { value: "moderate", label: "Moderate & Below" },
  { value: "high", label: "High & Below (All)" },
];

const INTENSITY_OPTIONS = [
  { value: "all", label: "All Intensity Levels" },
  { value: "low_local", label: "Low Local" },
  { value: "moderate_local", label: "Moderate Local" },
  { value: "high_local", label: "High Local" },
  { value: "moderate_systemic", label: "Moderate Systemic" },
  { value: "high_systemic", label: "High Systemic" },
  { value: "metabolic", label: "Metabolic" },
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

const PRIMARY_GOAL_OPTIONS = [
  { value: "mobility", label: "Mobility" },
  { value: "strength", label: "Strength" },
  { value: "general_fitness", label: "General Fitness" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "burn_fat", label: "Burn Fat" },
];

const ROUTINE_GOAL_OPTIONS = [
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "mixed_focus", label: "Mixed Focus" },
  { value: "conditioning", label: "Conditioning" },
  { value: "mobility", label: "Mobility" },
  { value: "power", label: "Power" },
  { value: "stability_control", label: "Stability Control" },
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

export default function ExerciseList() {
  const trpc = useTRPC();
  const businessId = useBusinessId();
  
  const { data: exercises } = useSuspenseQuery(
    trpc.exercise.filter.queryOptions({ 
      businessId: businessId,
      strengthCapacity: "all" as const,
      skillCapacity: "all" as const,
      clientName: "Web User"
    })
  );

  // Filter states
  const [strengthFilter, setStrengthFilter] = useState("all");
  const [skillFilter, setSkillFilter] = useState("all");
  const [intensityFilter, setIntensityFilter] = useState("all");
  
  // Exercise inclusion/exclusion states
  const [includeExercises, setIncludeExercises] = useState<string[]>([]);
  const [avoidExercises, setAvoidExercises] = useState<string[]>([]);
  
  // Joint avoidance states
  const [avoidJoints, setAvoidJoints] = useState<string[]>([]);
  
  // Primary goal state
  const [primaryGoal, setPrimaryGoal] = useState("general_fitness");
  
  // Muscle targeting states
  const [muscleTarget, setMuscleTarget] = useState<string[]>([]);
  const [muscleLessen, setMuscleLessen] = useState<string[]>([]);
  
  // Routine goal state
  const [routineGoal, setRoutineGoal] = useState("mixed_focus");
  
  // Routine template muscle target state (default to all muscles for full body)
  const [routineMuscleTarget, setRoutineMuscleTarget] = useState<string[]>(
    MUSCLE_OPTIONS.map(muscle => muscle.value)
  );
  
  // Routine template intensity state
  const [routineIntensity, setRoutineIntensity] = useState("moderate_local");
  
  // State to track whether we're showing filtered results
  const [showFiltered, setShowFiltered] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState<{
    strength: string;
    skill: string;
    intensity: string;
    include: string[];
    avoid: string[];
    avoidJoints: string[];
    primaryGoal?: string;
    muscleTarget: string[];
    muscleLessen: string[];
    routineGoal?: string;
    routineMuscleTarget: string[];
    routineIntensity?: string;
  } | null>(null);

  // Query for filtered exercises (only runs when filterCriteria is set)
  const { data: filteredExercises, isLoading: isFiltering, error: filterError } = useQuery({
    ...trpc.exercise.filter.queryOptions({
      clientName: "Web User",
      strengthCapacity: (filterCriteria?.strength || "moderate") as "very_low" | "low" | "moderate" | "high" | "very_high" | "all",
      skillCapacity: (filterCriteria?.skill || "moderate") as "very_low" | "low" | "moderate" | "high" | "all",
      includeExercises: filterCriteria?.include || [],
      avoidExercises: filterCriteria?.avoid || [],
      avoidJoints: filterCriteria?.avoidJoints || [],
      primaryGoal: filterCriteria?.primaryGoal as "mobility" | "strength" | "general_fitness" | "hypertrophy" | "burn_fat" | undefined,
      intensity: filterCriteria?.intensity as "low_local" | "moderate_local" | "high_local" | "moderate_systemic" | "high_systemic" | "metabolic" | "all" | undefined,
      muscleTarget: filterCriteria?.muscleTarget || [],
      muscleLessen: filterCriteria?.muscleLessen || [],
      routineGoal: filterCriteria?.routineGoal as "hypertrophy" | "mixed_focus" | "conditioning" | "mobility" | "power" | "stability_control" | undefined,
      routineMuscleTarget: filterCriteria?.routineMuscleTarget || [],
      routineIntensity: filterCriteria?.routineIntensity as "low_local" | "moderate_local" | "high_local" | "moderate_systemic" | "high_systemic" | "metabolic" | "all" | undefined,
      businessId: businessId,
      userInput: "", // No user input for now
    }),
    enabled: filterCriteria !== null,
  });

  // Display exercises (either all or filtered)
  const displayedExercises = showFiltered && filteredExercises ? filteredExercises : exercises;

  // Log all exercises to console
  console.log('All exercises from database:', exercises);
  
  // Log filtering state and errors
  if (filterError) {
    console.error('Filter error:', filterError);
  }
  
  if (filterCriteria) {
    console.log('Filter criteria set:', filterCriteria);
    console.log('Filtered exercises result:', filteredExercises);
    console.log('Is filtering:', isFiltering);
  }

  if (exercises.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-lg text-gray-600">No exercises found.</p>
        <p className="text-sm text-gray-500 mt-2">
          Add some exercises to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Dropdowns */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        {/* Client Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-2">Client</h3>
          
          {/* Phase 1 */}
          <div className="mb-4">
            <h4 className="text-md font-medium text-gray-700 mb-2">Phase 1</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label htmlFor="strength" className="block text-sm font-medium text-gray-700 mb-1">
              Strength Level
            </label>
            <select
              id="strength"
              value={strengthFilter}
              onChange={(e) => setStrengthFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STRENGTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="skill" className="block text-sm font-medium text-gray-700 mb-1">
              Skill Level
            </label>
            <select
              id="skill"
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SKILL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="include" className="block text-sm font-medium text-gray-700 mb-1">
              Include Exercises
            </label>
            <select
              id="include"
              multiple
              value={includeExercises}
              onChange={(e) => {
                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                setIncludeExercises(selectedOptions);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
            >
              {exercises?.map((exercise) => (
                <option key={exercise.id} value={exercise.name}>
                  {exercise.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
          </div>
          
          <div>
            <label htmlFor="avoid" className="block text-sm font-medium text-gray-700 mb-1">
              Avoid Exercises
            </label>
            <select
              id="avoid"
              multiple
              value={avoidExercises}
              onChange={(e) => {
                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                setAvoidExercises(selectedOptions);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
            >
              {exercises?.map((exercise) => (
                <option key={exercise.id} value={exercise.name}>
                  {exercise.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
          </div>
          
          <div>
            <label htmlFor="avoidJoints" className="block text-sm font-medium text-gray-700 mb-1">
              Avoid Joints
            </label>
            <select
              id="avoidJoints"
              multiple
              value={avoidJoints}
              onChange={(e) => {
                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                setAvoidJoints(selectedOptions);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
            >
              {JOINT_OPTIONS.map((joint) => (
                <option key={joint.value} value={joint.value}>
                  {joint.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
          </div>
            </div>
          </div>
          
          {/* Phase 2 */}
          <div className="mb-4">
            <h4 className="text-md font-medium text-gray-700 mb-2">Phase 2</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label htmlFor="primaryGoal" className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Goal
                </label>
                <select
                  id="primaryGoal"
                  value={primaryGoal}
                  onChange={(e) => setPrimaryGoal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PRIMARY_GOAL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="muscleTarget" className="block text-sm font-medium text-gray-700 mb-1">
                  Muscle Target
                </label>
                <select
                  id="muscleTarget"
                  multiple
                  value={muscleTarget}
                  onChange={(e) => {
                    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                    setMuscleTarget(selectedOptions);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                >
                  {MUSCLE_OPTIONS.map((muscle) => (
                    <option key={muscle.value} value={muscle.value}>
                      {muscle.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>
              
              <div>
                <label htmlFor="muscleLessen" className="block text-sm font-medium text-gray-700 mb-1">
                  Muscle Lessen
                </label>
                <select
                  id="muscleLessen"
                  multiple
                  value={muscleLessen}
                  onChange={(e) => {
                    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                    setMuscleLessen(selectedOptions);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                >
                  {MUSCLE_OPTIONS.map((muscle) => (
                    <option key={muscle.value} value={muscle.value}>
                      {muscle.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>
              
              <div>
                <label htmlFor="intensity" className="block text-sm font-medium text-gray-700 mb-1">
                  Intensity
                </label>
                <select
                  id="intensity"
                  value={intensityFilter}
                  onChange={(e) => setIntensityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {INTENSITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        
        {/* Routine Template Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-2">Routine Template</h3>
          
          {/* Phase 2 */}
          <div className="mb-4">
            <h4 className="text-md font-medium text-gray-700 mb-2">Phase 2</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label htmlFor="routineGoal" className="block text-sm font-medium text-gray-700 mb-1">
                  Routine Goal
                </label>
                <select
                  id="routineGoal"
                  value={routineGoal}
                  onChange={(e) => setRoutineGoal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ROUTINE_GOAL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="routineMuscleTarget" className="block text-sm font-medium text-gray-700 mb-1">
                  Muscle Target
                </label>
                <select
                  id="routineMuscleTarget"
                  multiple
                  value={routineMuscleTarget}
                  onChange={(e) => {
                    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                    setRoutineMuscleTarget(selectedOptions);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                >
                  {MUSCLE_OPTIONS.map((muscle) => (
                    <option key={muscle.value} value={muscle.value}>
                      {muscle.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple (defaults to full body)</p>
              </div>
              
              <div>
                <label htmlFor="routineIntensity" className="block text-sm font-medium text-gray-700 mb-1">
                  Routine Intensity
                </label>
                <select
                  id="routineIntensity"
                  value={routineIntensity}
                  onChange={(e) => setRoutineIntensity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {INTENSITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
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
                strength_capacity: strengthFilter as "very_low" | "low" | "moderate" | "high" | "very_high" | "all",
                skill_capacity: skillFilter as "very_low" | "low" | "moderate" | "high" | "all",
                primary_goal: primaryGoal as "mobility" | "strength" | "general_fitness" | "hypertrophy" | "burn_fat",
                intensity: intensityFilter as "low_local" | "moderate_local" | "high_local" | "moderate_systemic" | "high_systemic" | "metabolic" | "all",
                muscle_target: muscleTarget,
                muscle_lessen: muscleLessen,
                exercise_requests: {
                  include: includeExercises,
                  avoid: avoidExercises
                },
                avoid_joints: avoidJoints,
                business_id: businessId
              };

              // Build routine template with all fields
              const routineTemplate = {
                routine_goal: routineGoal as "hypertrophy" | "mixed_focus" | "conditioning" | "mobility" | "power" | "stability_control",
                muscle_target: routineMuscleTarget,
                routine_intensity: routineIntensity as "low_local" | "moderate_local" | "high_local" | "moderate_systemic" | "high_systemic" | "metabolic" | "all"
              };

              // Build complete filter criteria with all Phase 2 fields
              const criteria = {
                strength: strengthFilter,
                skill: skillFilter,
                intensity: intensityFilter,
                include: includeExercises,
                avoid: avoidExercises,
                avoidJoints: avoidJoints,
                primaryGoal: primaryGoal,
                muscleTarget: muscleTarget,
                muscleLessen: muscleLessen,
                routineGoal: routineGoal,
                routineMuscleTarget: routineMuscleTarget,
                routineIntensity: routineIntensity,
              };
              
              setFilterCriteria(criteria);
              setShowFiltered(true);
              
              console.log('=== FULL LANGGRAPH CONTEXT ===');
              console.log('Client Context:', clientContext);
              console.log('Routine Template:', routineTemplate);
              console.log('Filter Criteria (sent to API):', criteria);
            }}
            disabled={isFiltering}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFiltering ? 'Filtering...' : 'Filter Workouts'}
          </button>
          
          {showFiltered && (
            <button
              onClick={() => {
                setShowFiltered(false);
                setFilterCriteria(null);
                setStrengthFilter("all");
                setSkillFilter("all");
                setIncludeExercises([]);
                setAvoidExercises([]);
                setAvoidJoints([]);
                setPrimaryGoal("general_fitness");
                setMuscleTarget([]);
                setMuscleLessen([]);
                setIntensityFilter("all");
                setRoutineGoal("mixed_focus");
                setRoutineMuscleTarget(MUSCLE_OPTIONS.map(muscle => muscle.value));
                setRoutineIntensity("moderate_local");
              }}
              className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Show All
            </button>
          )}
        </div>
      </div>

      {/* Display Applied Context when Filtering */}
      {showFiltered && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold text-blue-800">Applied LangGraph Context</h3>
          
          {/* Client Context Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-blue-700">Client Context</h4>
              <div className="bg-white rounded p-3 space-y-1 text-sm">
                <div><span className="font-medium">Primary Goal:</span> {primaryGoal}</div>
                <div><span className="font-medium">Strength:</span> {strengthFilter}</div>
                <div><span className="font-medium">Skill:</span> {skillFilter}</div>
                <div><span className="font-medium">Intensity:</span> {intensityFilter}</div>
                <div><span className="font-medium">Muscle Target:</span> {muscleTarget.length > 0 ? muscleTarget.join(", ") : "None"}</div>
                <div><span className="font-medium">Muscle Lessen:</span> {muscleLessen.length > 0 ? muscleLessen.join(", ") : "None"}</div>
                <div><span className="font-medium">Include Exercises:</span> {includeExercises.length > 0 ? includeExercises.join(", ") : "None"}</div>
                <div><span className="font-medium">Avoid Exercises:</span> {avoidExercises.length > 0 ? avoidExercises.join(", ") : "None"}</div>
                <div><span className="font-medium">Avoid Joints:</span> {avoidJoints.length > 0 ? avoidJoints.join(", ") : "None"}</div>
              </div>
            </div>
            
            {/* Routine Template Display */}
            <div className="space-y-2">
              <h4 className="font-medium text-blue-700">Routine Template</h4>
              <div className="bg-white rounded p-3 space-y-1 text-sm">
                <div><span className="font-medium">Routine Goal:</span> {routineGoal}</div>
                <div><span className="font-medium">Muscle Target:</span> {routineMuscleTarget.length > 0 ? `${routineMuscleTarget.length} muscles selected` : "None"}</div>
                <div><span className="font-medium">Routine Intensity:</span> {routineIntensity}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-600">
        {showFiltered ? (
          <>
            <span className="font-medium text-green-600">LangGraph Filtering Applied:</span> Showing {displayedExercises?.length || 0} exercises after rulesBasedFilterNode 
            {filterCriteria && (
              <span className="text-blue-600 ml-1">
                → Ready for llmPreferenceNode
              </span>
            )}
          </>
        ) : (
          `Showing ${displayedExercises?.length || 0} exercises (unfiltered)`
        )}
      </p>
      
      <div className="grid gap-4">
        {displayedExercises?.map((exercise) => (
          <div
            key={exercise.id}
            className="bg-white border rounded-lg p-4 shadow hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {exercise.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Primary: {exercise.primaryMuscle} | Pattern: {exercise.movementPattern}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {exercise.modality} • {exercise.complexityLevel} complexity • {exercise.strengthLevel} strength
                </p>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(exercise.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}