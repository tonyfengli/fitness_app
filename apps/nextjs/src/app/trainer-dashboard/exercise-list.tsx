"use client";

import { useState, useEffect } from "react";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useBusinessId } from "~/hooks/useBusinessContext";
import { BlockDebugClient } from "~/utils/blockDebugClient";
import { isDebugEnabled } from "~/utils/debugConfig";
import { extractBlockInfo, getBlockColorClasses } from "~/utils/blockHelpers";

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

export default function ExerciseList() {
  const trpc = useTRPC();
  const businessId = useBusinessId();
  
  // Make debug client available globally in development
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as any).blockDebug = BlockDebugClient;
      // Only show console messages if explicitly enabled via localStorage or URL param
      const debugEnabled = 
        localStorage.getItem('debug') === 'true' || 
        window.location.search.includes('debug=true');
      if (debugEnabled) {
        console.log('🔍 Block Debug Client available as window.blockDebug');
      }
    }
  }, []);
  
  const { data: exercises } = useSuspenseQuery(
    trpc.exercise.all.queryOptions({
      limit: 1000, // Get all exercises for the library
      offset: 0
    })
  );

  // Filter states
  const [strengthFilter, setStrengthFilter] = useState("moderate");
  const [skillFilter, setSkillFilter] = useState("moderate");
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
  const [sessionGoal, setSessionGoal] = useState<'strength' | 'stability'>('strength');
  
  // Filter timing state
  const [filterTiming, setFilterTiming] = useState<number | null>(null);
  const [filterStartTime, setFilterStartTime] = useState<number | null>(null);
  const [currentElapsed, setCurrentElapsed] = useState<number>(0);
  
  // State to toggle table visibility
  const [showTable, setShowTable] = useState(false);
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
  const { data: filteredExercises, isLoading: isFiltering, error: filterError } = useQuery({
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
  const displayedExercises = showFiltered && filteredExercises ? filteredExercises : exercises as any[];

  // Log filtering errors
  if (filterError) {
    console.error('Filter error:', filterError);
    console.error('Filter error details:', {
      message: filterError.message,
      data: filterError.data,
      cause: (filterError as any).cause
    });
  }


  // Automatically call LLM interpretation when filtered exercises are ready
  useEffect(() => {
    if (!showFiltered || !filteredExercises || filteredExercises.length === 0 || isInterpreting) {
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
        
        blocks.forEach(block => {
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
              equipment: ex.equipment
            }));
          
          // Map to legacy block names for backward compatibility
          if (block.id === 'A') exercises.blockA = topExercises;
          else if (block.id === 'B') exercises.blockB = topExercises;
          else if (block.id === 'C') exercises.blockC = topExercises;
          else if (block.id === 'D') exercises.blockD = topExercises;
        });
        
        // Build client context with only non-empty values
        const clientContext: Record<string, any> = {};
        
        // Only add values that are not default/empty
        if (sessionGoal) clientContext.sessionGoal = sessionGoal;
        if (strengthFilter !== 'all') clientContext.strength_capacity = strengthFilter;
        if (skillFilter) clientContext.skill_capacity = skillFilter;
        if (intensityFilter) clientContext.intensity = intensityFilter;
        if (includeExercises.length > 0) clientContext.exercise_requests = { include: includeExercises, avoid: [] };
        if (muscleTarget.length > 0) clientContext.muscle_target = muscleTarget;
        if (muscleLessen.length > 0) clientContext.muscle_lessen = muscleLessen;
        
        // Call the API route
        const response = await fetch('/api/interpret-workout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ exercises, clientContext }),
        });
        
        const result = await response.json();
        const processingTime = (Date.now() - startTime) / 1000; // Convert to seconds
        
        if (!response.ok || result.error) {
          setLlmInterpretation({ error: result.error || 'Failed to interpret workout', processingTime });
        } else {
          setLlmInterpretation({ 
            ...result.structuredOutput, 
            processingTime,
            timing: result.timing // Include timing breakdown from backend
          });
          // Set the set range from the API response
          if (result.setRange) {
            setSetRange(result.setRange);
          }
        }
      } catch (error) {
        console.error('Error interpreting workout:', error);
        const processingTime = (Date.now() - startTime) / 1000;
        setLlmInterpretation({ error: 'Failed to interpret workout', processingTime });
      } finally {
        setIsInterpreting(false);
      }
    };

    interpretWorkout();
  }, [showFiltered, filteredExercises, sessionGoal, strengthFilter, skillFilter, intensityFilter, includeExercises, muscleTarget, muscleLessen]);

  // Function to calculate selected exercises for Block D with constraints
  const getBlockDSelected = (exercises: any[]) => {
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
          {/* Session Goal Dropdown */}
          <div>
            <label htmlFor="sessionGoal" className="block text-sm font-medium text-gray-700 mb-1">
              Session Goal
            </label>
            <select
              id="sessionGoal"
              value={sessionGoal}
              onChange={(e) => setSessionGoal(e.target.value as 'strength' | 'stability')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="strength">Strength</option>
              <option value="stability">Stability</option>
            </select>
          </div>
          
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
            {isFiltering ? `Filtering... ${(currentElapsed / 1000).toFixed(1)}s` : 'Filter Workouts'}
          </button>
          
        </div>
      </div>


      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          {showFiltered ? (
            <>
              <span className="font-medium text-green-600">Filtering Applied:</span> Showing {displayedExercises?.length || 0} filtered exercises
              {filterTiming && (
                <span className="ml-2 text-xs text-gray-500">
                  ({(filterTiming / 1000).toFixed(2)}s)
                </span>
              )}
              {displayedExercises && displayedExercises.length > 0 && (displayedExercises[0] as any).score !== undefined && (
                <span className="ml-2 text-blue-600 font-medium">(Scored & Sorted)</span>
              )}
            </>
          ) : (
            `Showing ${displayedExercises?.length || 0} exercises (unfiltered)`
          )}
        </p>
        
        {/* Set Range Display */}
        {setRange && showFiltered && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-md px-4 py-2">
            <p className="text-sm font-medium text-indigo-900">
              Session Volume: {setRange.minSets}-{setRange.maxSets} total sets
            </p>
            <p className="text-xs text-indigo-700 mt-1">
              {setRange.reasoning}
            </p>
          </div>
        )}
      </div>

      {/* Toggle Table Button */}
      <div className="flex justify-center my-4">
        <button
          onClick={() => setShowTable(!showTable)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
        >
          {showTable ? 'Hide Table' : 'Show Table'}
        </button>
      </div>

      {/* Table - conditionally rendered */}
      {showTable && (
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
              if (intensityPreference && intensityPreference !== 'moderate' && exercise.fatigueProfile) {
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
      )}

      {/* Exercise Blocks Section */}
      {showFiltered && filteredExercises && (
        <div className="mt-8 space-y-6">
          <h2 className="text-xl font-bold text-gray-800 text-center">Exercise Blocks by Function Tags</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Dynamic Blocks */}
            {extractBlockInfo(filteredExercises).map(block => {
              const colors = getBlockColorClasses(block.color);
              
              return (
                <div key={block.id} className={`${colors.container} border rounded-lg p-3`}>
                  <h3 className={`text-base font-semibold ${colors.header} mb-2`}>{block.name}</h3>
                  <div className="space-y-2">
                    {block.exercises
                      .sort((a, b) => b.score - a.score)
                      .map((exercise, idx) => {
                        // Check if exercise is selected for this block
                        // First try dynamic selectedBlocks array, fallback to legacy flags
                        const isSelected = exercise.selectedBlocks?.includes(block.id) ||
                          (block.id === 'A' ? exercise.isSelectedBlockA :
                           block.id === 'B' ? exercise.isSelectedBlockB :
                           block.id === 'C' ? exercise.isSelectedBlockC :
                           block.id === 'D' ? exercise.isSelectedBlockD :
                           false);
                        
                        return (
                          <div 
                            key={exercise.id} 
                            className={`text-sm p-2 rounded ${
                              isSelected 
                                ? colors.selected + ' border' 
                                : ''
                            }`}
                          >
                            <span className="font-medium">{exercise.name}</span>
                            {exercise.score !== undefined && (
                              <span className={colors.score + ' ml-2'}>({exercise.score.toFixed(1)})</span>
                            )}
                            {isSelected && <span className={`ml-2 text-xs font-bold ${colors.label}`}>SELECTED</span>}
                          </div>
                        );
                      })}
                    {block.exercises.length === 0 && (
                      <p className="text-sm text-gray-500 italic">No exercises found</p>
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
                const { isSelected, isSelectedBlockA, isSelectedBlockB, isSelectedBlockC, isSelectedBlockD, blockBPenalty, blockCPenalty, selectedBlocks, blockPenalties, ...cleanedExercise } = exercise;
                return cleanedExercise;
              };

              // Get blocks dynamically
              const blocks = extractBlockInfo(filteredExercises);
              const blockData: Record<string, any[]> = {};

              blocks.forEach(block => {
                // Only get top exercises based on maxCount
                const topExercises = block.exercises
                  .sort((a, b) => b.score - a.score)
                  .slice(0, block.maxCount)
                  .map(cleanExercise);
                blockData[block.name] = topExercises;
              });

              // Format the output
              const formattedOutput = Object.entries(blockData)
                .map(([name, exercises]) => `${name}:\n${JSON.stringify(exercises, null, 2)}`)
                .join('\n\n');

              navigator.clipboard.writeText(formattedOutput);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            Copy JSON
          </button>

        </div>

        {/* LLM Results Display */}
        {(llmInterpretation || isInterpreting) && (
          <div className="mt-6 mx-auto max-w-4xl p-6 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">LLM Workout Interpretation</h3>
              <div className="text-right">
                {llmInterpretation?.processingTime && (
                  <div className="text-sm text-gray-600">
                    Total time: {llmInterpretation.processingTime.toFixed(2)}s
                  </div>
                )}
                {llmInterpretation?.timing && (
                  <details className="text-xs text-gray-500 mt-1">
                    <summary className="cursor-pointer hover:text-gray-700">Show timing breakdown</summary>
                    <div className="mt-2 space-y-1 text-left">
                      <div>Exercise formatting: {(llmInterpretation.timing.exerciseFormatting || 0).toFixed(0)}ms</div>
                      <div>Set calculation: {(llmInterpretation.timing.setCountCalculation || 0).toFixed(0)}ms</div>
                      <div>Prompt building: {(llmInterpretation.timing.promptBuilding || 0).toFixed(0)}ms</div>
                      <div className="font-semibold">LLM API call: {((llmInterpretation.timing.llmApiCall || 0) / 1000).toFixed(2)}s</div>
                      <div>Response parsing: {(llmInterpretation.timing.responseParsing || 0).toFixed(0)}ms</div>
                    </div>
                  </details>
                )}
              </div>
            </div>
            
            {isInterpreting ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-600">Processing workout interpretation...</div>
              </div>
            ) : llmInterpretation?.error ? (
              <div className="text-red-600">Error: {llmInterpretation.error}</div>
            ) : llmInterpretation ? (
              <>
                {/* Workout Table */}
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Block
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Exercise
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sets
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {['blockA', 'blockB', 'blockC', 'blockD'].map((block) => {
                        const exercises = llmInterpretation[block as keyof typeof llmInterpretation] as any[];
                        return exercises?.map((item, idx) => (
                          <tr key={`${block}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {idx === 0 ? block.replace('block', 'Block ').toUpperCase() : ''}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {typeof item === 'string' ? item : item.exercise}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                              {typeof item === 'string' ? '-' : item.sets}
                            </td>
                          </tr>
                        ));
                      }).flat()}
                    </tbody>
                    <tfoot className="bg-gray-100">
                      <tr>
                        <td colSpan={2} className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                          Total Sets
                        </td>
                        <td className="px-6 py-3 text-center text-sm font-medium text-gray-900">
                          {['blockA', 'blockB', 'blockC', 'blockD'].reduce((total, block) => {
                            const exercises = llmInterpretation[block as keyof typeof llmInterpretation] as any[];
                            return total + (exercises?.reduce((blockTotal, item) => 
                              blockTotal + (typeof item === 'object' ? item.sets : 0), 0) || 0);
                          }, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                {llmInterpretation.reasoning && (
                  <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
                    <h4 className="font-medium text-gray-700 mb-2">Exercise Selection Reasoning</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      {llmInterpretation.reasoning.split('\n').map((line, idx) => (
                        <div key={idx}>{line}</div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
      )}
    </div>
  );
}