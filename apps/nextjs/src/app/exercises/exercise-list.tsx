"use client";

import { useState } from "react";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

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

export default function ExerciseList() {
  const trpc = useTRPC();
  const { data: exercises } = useSuspenseQuery(
    trpc.exercise.filter.queryOptions({ 
      businessId: "d33b41e2-f700-4a08-9489-cb6e3daa7f20", // Tony Gym ID
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
  
  // State to track whether we're showing filtered results
  const [showFiltered, setShowFiltered] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState<{
    strength: string;
    skill: string;
    intensity: string;
    include: string[];
    avoid: string[];
    avoidJoints: string[];
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
      businessId: "d33b41e2-f700-4a08-9489-cb6e3daa7f20", // Tony Gym ID
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
          
          {/* Intensity filter temporarily disabled - will be LLM-controlled */}
          {/* 
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
          */}
        </div>
        
        {/* Filter Button */}
        <div className="flex justify-center gap-3">
          <button
            onClick={() => {
              // Trigger LangGraph filtering (intensity disabled - set to "all")
              const criteria = {
                strength: strengthFilter,
                skill: skillFilter,
                intensity: "all", // Always "all" - intensity will be LLM-controlled
                include: includeExercises,
                avoid: avoidExercises,
                avoidJoints: avoidJoints,
              };
              
              setFilterCriteria(criteria);
              setShowFiltered(true);
              
              console.log('Applying LangGraph filter with criteria:', criteria);
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
                // intensityFilter stays as-is since it's disabled
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
            Showing {displayedExercises?.length || 0} filtered exercises 
            {filterCriteria && (
              <span className="text-blue-600 ml-1">
                (Strength: {filterCriteria.strength}, Skill: {filterCriteria.skill})
              </span>
            )}
          </>
        ) : (
          `Showing ${displayedExercises?.length || 0} exercises`
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