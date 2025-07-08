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
  { value: "very_low", label: "Very Low Only" },
  { value: "low", label: "Low & Below" },
  { value: "moderate", label: "Moderate & Below" },
  { value: "high", label: "High & Below (All)" },
];

const INTENSITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
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

export default function ExerciseList() {
  const trpc = useTRPC();
  const businessId = useBusinessId();
  
  const { data: exercises } = useSuspenseQuery(
    trpc.exercise.all.queryOptions({
      limit: 1000, // Get all exercises for the library
      offset: 0
    })
  );

  // Filter states
  const [strengthFilter, setStrengthFilter] = useState("all");
  const [skillFilter, setSkillFilter] = useState("moderate");
  const [intensityFilter, setIntensityFilter] = useState("medium");
  
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
  const { data: filteredExercises, isLoading: isFiltering, error: filterError } = useQuery<any[]>({
    ...trpc.exercise.filter.queryOptions({
      clientName: "Web User",
      strengthCapacity: (filterCriteria?.strength || "moderate") as "very_low" | "low" | "moderate" | "high" | "very_high" | "all",
      skillCapacity: (filterCriteria?.skill || "moderate") as "very_low" | "low" | "moderate" | "high" | "all",
      includeExercises: filterCriteria?.include || [],
      avoidExercises: filterCriteria?.avoid || [],
      avoidJoints: filterCriteria?.avoidJoints || [],
      intensity: filterCriteria?.intensity as "low" | "medium" | "high" | undefined,
      muscleTarget: filterCriteria?.muscleTarget || [],
      muscleLessen: filterCriteria?.muscleLessen || [],
      isFullBody: filterCriteria?.isFullBody || false,
      businessId: businessId || undefined,
      userInput: "", // No user input for now
    }),
    enabled: filterCriteria !== null,
  });

  // Display exercises (either all or filtered)
  const displayedExercises = showFiltered && filteredExercises ? filteredExercises : exercises;

  // Log filtering errors
  if (filterError) {
    console.error('Filter error:', filterError);
    console.error('Filter error details:', {
      message: filterError.message,
      data: filterError.data,
      cause: (filterError as any).cause
    });
  }

  // Function to calculate TOP 6 for Block D with constraints
  const getBlockDTop6 = (exercises: any[]) => {
    const blockDExercises = exercises
      .filter(ex => ex.functionTags?.includes('core') || ex.functionTags?.includes('capacity'))
      .sort((a, b) => b.score - a.score);
    
    if (blockDExercises.length === 0) return new Set<string>();
    
    const selected: any[] = [];
    let coreCount = 0;
    let capacityCount = 0;
    
    const isCore = (ex: any) => ex.functionTags?.includes('core');
    const isCapacity = (ex: any) => ex.functionTags?.includes('capacity');
    
    // Check if minimum constraints are met
    const constraintsMet = () => coreCount >= 3 && capacityCount >= 3;
    
    // Calculate priority for constraint satisfaction
    const getConstraintPriority = (exercise: any) => {
      if (constraintsMet()) return 0;
      
      let priority = 0;
      if (coreCount < 3 && isCore(exercise)) priority += 3;
      if (capacityCount < 3 && isCapacity(exercise)) priority += 3;
      
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
      const remaining = blockDExercises.filter(ex => !selected.includes(ex));
      const slotsToFill = 6 - selected.length;
      const highestScoring = remaining.slice(0, slotsToFill);
      
      for (const candidate of highestScoring) {
        selected.push(candidate);
        if (isCore(candidate)) coreCount++;
        if (isCapacity(candidate)) capacityCount++;
      }
    }
    
    // Return a set of selected exercise IDs
    return new Set(selected.map(ex => ex.id));
  };

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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
            
            {/* Full Body Checkbox */}
            <div className="mb-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={isFullBody}
                  onChange={(e) => setIsFullBody(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Full Body Workout</span>
              </label>
              <p className="text-xs text-gray-500 ml-6 mt-1">Use full body template for exercise organization</p>
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
                intensity: intensityFilter as "low" | "medium" | "high",
                muscle_target: muscleTarget,
                muscle_lessen: muscleLessen,
                exercise_requests: {
                  include: includeExercises,
                  avoid: avoidExercises
                },
                avoid_joints: avoidJoints,
                business_id: businessId
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
                isFullBody: isFullBody,
              };
              
              setFilterCriteria(criteria);
              setShowFiltered(true);
              
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
                setMuscleTarget([]);
                setMuscleLessen([]);
                setIntensityFilter("medium");
                setIsFullBody(false);
              }}
              className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Show All
            </button>
          )}
        </div>
      </div>


      <p className="text-sm text-gray-600">
        {showFiltered ? (
          <>
            <span className="font-medium text-green-600">Filtering Applied:</span> Showing {displayedExercises?.length || 0} filtered exercises
            {displayedExercises && displayedExercises.length > 0 && (displayedExercises[0] as any).score !== undefined && (
              <span className="ml-2 text-blue-600 font-medium">(Scored & Sorted)</span>
            )}
          </>
        ) : (
          `Showing ${displayedExercises?.length || 0} exercises (unfiltered)`
        )}
      </p>

      <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
        <table className="w-full bg-white border-gray-200 shadow">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Exercise Name
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Movement Pattern
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Final Score
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Fatigue Profile
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Muscle Target
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Muscle Lessen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {displayedExercises?.map((exercise, index) => {
              const scoredExercise = exercise as any;
              const hasScore = scoredExercise.score !== undefined;
              
              // Calculate muscle target matches and scoring
              const muscleTargetCriteria = showFiltered && filterCriteria?.muscleTarget || [];
              const primaryTargetMatch = muscleTargetCriteria.includes(exercise.primaryMuscle);
              const secondaryTargetMatches = exercise.secondaryMuscles?.filter(muscle => 
                muscleTargetCriteria.includes(muscle)
              ) || [];
              const hasSecondaryTargetMatch = secondaryTargetMatches.length > 0;
              
              // Calculate muscle lessen matches and scoring
              const muscleLessenCriteria = showFiltered && filterCriteria?.muscleLessen || [];
              const primaryLessenMatch = muscleLessenCriteria.includes(exercise.primaryMuscle);
              const secondaryLessenMatches = exercise.secondaryMuscles?.filter(muscle => 
                muscleLessenCriteria.includes(muscle)
              ) || [];
              const hasSecondaryLessenMatch = secondaryLessenMatches.length > 0;
              
              // Calculate scoring changes
              const targetScoreChange = (primaryTargetMatch ? 3.0 : 0) + (hasSecondaryTargetMatch ? 1.5 : 0);
              const lessenScoreChange = (primaryLessenMatch ? -3.0 : 0) + (hasSecondaryLessenMatch ? -1.5 : 0);
              
              // Calculate intensity adjustment if scoring is active
              const intensityPreference = showFiltered && filterCriteria?.intensity;
              let intensityAdjustment = 0;
              if (intensityPreference && intensityPreference !== 'medium' && exercise.fatigueProfile) {
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
                const scoring = intensityScoring[intensityPreference as keyof typeof intensityScoring];
                if (scoring) {
                  intensityAdjustment = scoring[exercise.fatigueProfile as keyof typeof scoring] || 0;
                }
              }
              
              return (
                <tr key={exercise.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{exercise.name}</div>
                      <div className="text-xs text-gray-500">
                        Primary: {exercise.primaryMuscle}
                        {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
                          <span className="ml-2">
                            | Secondary: {exercise.secondaryMuscles.join(", ")}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Strength: {exercise.strengthLevel} • Skill: {exercise.complexityLevel}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      {exercise.movementPattern || '-'}
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
                      {intensityPreference && intensityPreference !== 'medium' && intensityAdjustment !== 0 && (
                        <div className={`text-xs px-2 py-1 rounded ${
                          intensityAdjustment > 0 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {exercise.fatigueProfile} ({intensityAdjustment > 0 ? '+' : ''}{intensityAdjustment})
                        </div>
                      )}
                      {intensityPreference && intensityPreference !== 'medium' && intensityAdjustment === 0 && (
                        <div className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded">
                          {exercise.fatigueProfile} (0)
                        </div>
                      )}
                      {(!intensityPreference || intensityPreference === 'medium') && (
                        <span className="text-xs text-gray-400">{exercise.fatigueProfile || '-'}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="space-y-1">
                      {primaryTargetMatch ? (
                        <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Primary: {exercise.primaryMuscle} (+3.0)
                        </div>
                      ) : hasSecondaryTargetMatch ? (
                        <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                          Secondary: {secondaryTargetMatches.join(", ")} (+1.5)
                        </div>
                      ) : muscleTargetCriteria.length > 0 ? (
                        <span className="text-xs text-gray-400">No matches</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="space-y-1">
                      {primaryLessenMatch ? (
                        <div className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                          Primary: {exercise.primaryMuscle} (-3.0)
                        </div>
                      ) : hasSecondaryLessenMatch ? (
                        <div className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded">
                          Secondary: {secondaryLessenMatches.join(", ")} (-1.5)
                        </div>
                      ) : muscleLessenCriteria.length > 0 ? (
                        <span className="text-xs text-gray-400">No matches</span>
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

      {/* Exercise Blocks Section */}
      {showFiltered && filteredExercises && (
        <div className="mt-8 space-y-6">
          <h2 className="text-xl font-bold text-gray-800 text-center">Exercise Blocks by Function Tags</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Block A - Primary Strength */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">Block A - Primary Strength</h3>
              <div className="space-y-2">
                {filteredExercises
                  .filter(ex => ex.functionTags?.includes('primary_strength'))
                  .sort((a, b) => b.score - a.score)
                  .map((exercise, idx) => {
                    // Use block-specific isTop6 flag if available (full body mode), otherwise use index
                    const isTop6 = 'isTop6BlockA' in exercise ? exercise.isTop6BlockA : idx < 6;
                    
                    return (
                      <div 
                        key={exercise.id} 
                        className={`text-sm p-2 rounded ${
                          isTop6 
                            ? 'bg-blue-200 border border-blue-400' 
                            : ''
                        }`}
                      >
                        <span className="font-medium">{exercise.name}</span>
                        <span className="text-blue-600 ml-2">({exercise.score.toFixed(1)})</span>
                        {isTop6 && <span className="ml-2 text-xs font-bold text-blue-700">TOP 6</span>}
                      </div>
                    );
                  })}
                {filteredExercises.filter(ex => ex.functionTags?.includes('primary_strength')).length === 0 && (
                  <p className="text-sm text-gray-500 italic">No exercises found</p>
                )}
              </div>
            </div>

            {/* Block B - Secondary Strength */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 mb-3">Block B - Secondary Strength</h3>
              <div className="space-y-2">
                {filteredExercises
                  .filter(ex => ex.functionTags?.includes('secondary_strength'))
                  .sort((a, b) => b.score - a.score)
                  .map((exercise, idx) => {
                    // Use block-specific isTop6 flag if available (full body mode), otherwise use index
                    const isTop6 = 'isTop6BlockB' in exercise ? exercise.isTop6BlockB : idx < 6;
                    
                    return (
                      <div 
                        key={exercise.id} 
                        className={`text-sm p-2 rounded ${
                          isTop6 
                            ? 'bg-green-200 border border-green-400' 
                            : ''
                        }`}
                      >
                        <span className="font-medium">{exercise.name}</span>
                        <span className="text-green-600 ml-2">
                          {(exercise as any).blockBPenalty > 0 
                            ? `(${exercise.score.toFixed(1)} → ${(exercise.score - (exercise as any).blockBPenalty).toFixed(1)})`
                            : `(${exercise.score.toFixed(1)})`
                          }
                        </span>
                        {isTop6 && <span className="ml-2 text-xs font-bold text-green-700">TOP 6</span>}
                      </div>
                    );
                  })}
                {filteredExercises.filter(ex => ex.functionTags?.includes('secondary_strength')).length === 0 && (
                  <p className="text-sm text-gray-500 italic">No exercises found</p>
                )}
              </div>
            </div>

            {/* Block C - Accessory */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-800 mb-3">Block C - Accessory</h3>
              <div className="space-y-2">
                {filteredExercises
                  .filter(ex => ex.functionTags?.includes('accessory'))
                  .sort((a, b) => b.score - a.score)
                  .map((exercise, idx) => (
                    <div 
                      key={exercise.id} 
                      className={`text-sm p-2 rounded ${
                        exercise.isTop6BlockC 
                          ? 'bg-purple-200 border border-purple-400' 
                          : ''
                      }`}
                    >
                      <span className="font-medium">{exercise.name}</span>
                      <span className="text-purple-600 ml-2">
                        {exercise.blockCPenalty > 0 
                          ? `(${exercise.score.toFixed(1)} → ${(exercise.score - exercise.blockCPenalty).toFixed(1)})`
                          : `(${exercise.score.toFixed(1)})`
                        }
                      </span>
                      {exercise.isTop6BlockC && <span className="ml-2 text-xs font-bold text-purple-700">TOP 6</span>}
                    </div>
                  ))}
                {filteredExercises.filter(ex => ex.functionTags?.includes('accessory')).length === 0 && (
                  <p className="text-sm text-gray-500 italic">No exercises found</p>
                )}
              </div>
            </div>

            {/* Block D - Core & Capacity */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-orange-800 mb-3">Block D - Core & Capacity</h3>
              <div className="space-y-2">
                {(() => {
                  const blockDTop6 = getBlockDTop6(filteredExercises);
                  const blockDExercises = filteredExercises
                    .filter(ex => ex.functionTags?.includes('core') || ex.functionTags?.includes('capacity'))
                    .sort((a, b) => b.score - a.score);
                  
                  return blockDExercises.map((exercise) => (
                    <div 
                      key={exercise.id} 
                      className={`text-sm p-2 rounded ${
                        blockDTop6.has(exercise.id) 
                          ? 'bg-orange-200 border border-orange-400' 
                          : ''
                      }`}
                    >
                      <span className="font-medium">{exercise.name}</span>
                      <span className="text-orange-600 ml-2">({exercise.score.toFixed(1)})</span>
                      {blockDTop6.has(exercise.id) && <span className="ml-2 text-xs font-bold text-orange-700">TOP 6</span>}
                    </div>
                  ));
                })()}
                {filteredExercises.filter(ex => ex.functionTags?.includes('core') || ex.functionTags?.includes('capacity')).length === 0 && (
                  <p className="text-sm text-gray-500 italic">No exercises found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Copy JSON button */}
      {showFiltered && filteredExercises && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(filteredExercises, null, 2));
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            Copy JSON
          </button>
        </div>
      )}
    </div>
  );
}