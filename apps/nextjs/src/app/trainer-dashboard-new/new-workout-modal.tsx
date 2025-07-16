"use client";

import { useState, useRef, useEffect } from "react";
import { Button, Icon } from "@acme/ui-shared";
import { useRouter } from "next/navigation";
import { useTRPC } from "~/trpc/react";
import { useMutation } from "@tanstack/react-query";
import { isDebugEnabled } from "~/utils/debugConfig";

interface NewWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

interface WorkoutParameters {
  sessionGoal: 'strength' | 'stability' | '';
  intensity: 'low' | 'moderate' | 'high' | '';
  template: string;
  includeExercises: string[];
  avoidExercises: string[];
  muscleTarget: string[];
  muscleLessen: string[];
  avoidJoints: string[];
}

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

// Searchable Multi-Select Component
interface SearchableMultiSelectProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  tagColor?: string;
  dropdownDirection?: 'up' | 'down';
}

// Helper function to calculate session volume - matches the logic from trainer-dashboard
function calculateSessionVolume(exercises: any[], intensity: string, strengthLevel: string = 'moderate') {
  // Set range matrix based on strength x intensity - same as in setCountLogic.ts
  const setRangeMatrix: Record<string, Record<string, [number, number]>> = {
    // Very low strength
    very_low: {
      low: [14, 16],
      moderate: [16, 18],
      high: [18, 20]
    },
    // Low strength
    low: {
      low: [16, 18],
      moderate: [18, 20],
      high: [20, 22]
    },
    // Moderate strength (default)
    moderate: {
      low: [17, 19],
      moderate: [19, 22],
      high: [22, 25]
    },
    // High strength
    high: {
      low: [18, 20],
      moderate: [22, 25],
      high: [25, 27]  // capped at 27
    }
  };

  // Get ranges from matrix
  const [minSets, maxSets] = setRangeMatrix[strengthLevel]?.[intensity] || [19, 22]; // Default to moderate/moderate

  // Generate reasoning
  const parts: string[] = [];
  
  // Strength level reasoning
  if (strengthLevel === 'very_low' || strengthLevel === 'low') {
    parts.push("Lower strength capacity requires conservative volume");
  } else if (strengthLevel === 'high') {
    parts.push("Higher strength capacity allows for increased training volume");
  }
  
  // Intensity reasoning
  if (intensity === 'high') {
    parts.push("Higher intensity increases total work capacity");
  } else if (intensity === 'low') {
    parts.push("Lower intensity with controlled volume");
  }
  
  parts.push(`Total: ${minSets}-${maxSets} sets for optimal training stimulus`);
  
  const reasoning = parts.join(". ");

  return { minSets, maxSets, reasoning };
}

function SearchableMultiSelect({ 
  options, 
  selected, 
  onChange, 
  placeholder = "Type to search...",
  tagColor = "indigo",
  dropdownDirection = "down"
}: SearchableMultiSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase()) &&
    !selected.includes(option.value)
  );

  const handleSelect = (value: string) => {
    onChange([...selected, value]);
    setSearch("");
    setIsOpen(false);
  };

  const handleRemove = (value: string) => {
    onChange(selected.filter(v => v !== value));
  };

  const colorClasses = {
    indigo: "bg-indigo-100 text-indigo-800",
    red: "bg-red-100 text-red-800",
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      
      {isOpen && filteredOptions.length > 0 && (
        <div className={`absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto ${
          dropdownDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}>
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selected.map((value) => {
            const option = options.find(o => o.value === value);
            return (
              <span
                key={value}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${colorClasses[tagColor as keyof typeof colorClasses]}`}
              >
                {option?.label || value}
                <button
                  onClick={() => handleRemove(value)}
                  className="ml-2 hover:opacity-70"
                >
                  <Icon name="close" size={16} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NewWorkoutModal({
  isOpen,
  onClose,
  clientId,
  clientName,
}: NewWorkoutModalProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const filterMutation = useMutation(
    trpc.exercise.filterForWorkoutGeneration.mutationOptions()
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [workoutParams, setWorkoutParams] = useState<WorkoutParameters>({
    sessionGoal: "strength",
    intensity: "moderate",
    template: "",
    includeExercises: [],
    avoidExercises: [],
    muscleTarget: [],
    muscleLessen: [],
    avoidJoints: [],
  });
  const [filteredExercises, setFilteredExercises] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Mock exercise options - in a real app, this would come from the API
  const EXERCISE_OPTIONS = [
    { value: "bench_press", label: "Bench Press" },
    { value: "squat", label: "Squat" },
    { value: "deadlift", label: "Deadlift" },
    { value: "pull_up", label: "Pull-up" },
    { value: "push_up", label: "Push-up" },
    { value: "overhead_press", label: "Overhead Press" },
    { value: "barbell_row", label: "Barbell Row" },
    { value: "dumbbell_curl", label: "Dumbbell Curl" },
    { value: "tricep_extension", label: "Tricep Extension" },
    { value: "leg_press", label: "Leg Press" },
    { value: "leg_curl", label: "Leg Curl" },
    { value: "leg_extension", label: "Leg Extension" },
    { value: "calf_raise", label: "Calf Raise" },
    { value: "lat_pulldown", label: "Lat Pulldown" },
    { value: "cable_row", label: "Cable Row" },
    { value: "dumbbell_press", label: "Dumbbell Press" },
    { value: "plank", label: "Plank" },
    { value: "russian_twist", label: "Russian Twist" },
    { value: "bicycle_crunch", label: "Bicycle Crunch" },
    { value: "mountain_climber", label: "Mountain Climber" },
  ];

  if (!isOpen) return null;

  const handleNext = async () => {
    if (currentStep === 1) {
      // Validate step 1 inputs
      if (!workoutParams.sessionGoal || !workoutParams.intensity || !workoutParams.template) {
        setError('Please fill in all required fields before proceeding.');
        return;
      }
      setError(null);
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Call the filtering endpoint when going to review step
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await filterMutation.mutateAsync({
          clientId,
          sessionGoal: workoutParams.sessionGoal as 'strength' | 'stability',
          intensity: workoutParams.intensity as 'low' | 'moderate' | 'high',
          template: workoutParams.template as 'standard' | 'circuit' | 'full_body',
          includeExercises: workoutParams.includeExercises,
          avoidExercises: workoutParams.avoidExercises,
          muscleTarget: workoutParams.muscleTarget,
          muscleLessen: workoutParams.muscleLessen,
          avoidJoints: workoutParams.avoidJoints,
          debug: isDebugEnabled(),
        });
        
        setFilteredExercises(result);
        
        // Debug logging
        if (isDebugEnabled()) {
          console.log('=== WORKOUT FILTER RESULTS ===');
          console.log('Total exercises:', result.exercises?.length || 0);
          console.log('Block A:', result.blocks?.blockA?.length || 0);
          console.log('Block B:', result.blocks?.blockB?.length || 0);
          console.log('Block C:', result.blocks?.blockC?.length || 0);
          console.log('Block D:', result.blocks?.blockD?.length || 0);
          console.log('Timing:', result.timing);
          console.log('==============================');
        }
        
        setCurrentStep(3);
      } catch (err) {
        console.error('Failed to filter exercises:', err);
        setError('Failed to filter exercises. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } else if (currentStep === 3) {
      // Generate workout will be handled later
      console.log('Generate workout with:', workoutParams, filteredExercises);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null); // Clear any errors when going back
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setCurrentStep(1);
    setWorkoutParams({
      sessionGoal: "strength",
      intensity: "moderate",
      template: "",
      includeExercises: [],
      avoidExercises: [],
      muscleTarget: [],
      muscleLessen: [],
      avoidJoints: [],
    });
    setFilteredExercises(null);
    setError(null);
    setIsLoading(false);
    setIsFullscreen(false);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center ${isFullscreen ? '' : 'p-4'}`}>
        <div className={`bg-white shadow-xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen 
            ? 'w-full h-full rounded-none' 
            : 'rounded-2xl max-w-2xl w-full h-[85vh]'
        }`}>
          {/* Header */}
          <div className="px-8 py-6 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">New Workout</h2>
                <p className="text-gray-500 mt-1">Create a workout for {clientName}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  <Icon name={isFullscreen ? "fullscreen_exit" : "fullscreen"} size={24} />
                </button>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Icon name="close" size={24} />
                </button>
              </div>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="px-8 py-4 border-b bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-center space-x-2">
              <div className={`flex items-center ${currentStep >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentStep >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200'
                }`}>
                  1
                </div>
                <span className="ml-2 text-sm font-medium hidden sm:inline">Settings</span>
              </div>
              <div className="w-8 sm:w-16 h-0.5 bg-gray-200" />
              <div className={`flex items-center ${currentStep >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentStep >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200'
                }`}>
                  2
                </div>
                <span className="ml-2 text-sm font-medium hidden sm:inline">Preferences</span>
              </div>
              <div className="w-8 sm:w-16 h-0.5 bg-gray-200" />
              <div className={`flex items-center ${currentStep >= 3 ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentStep >= 3 ? 'bg-indigo-600 text-white' : 'bg-gray-200'
                }`}>
                  3
                </div>
                <span className="ml-2 text-sm font-medium hidden sm:inline">Review</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6 flex-1 overflow-y-auto">
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex">
                  <Icon name="error" className="text-red-500 mr-2" size={20} />
                  <div className="flex-1">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Basic Settings</h3>
                
                {/* Session Goal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Session Goal
                  </label>
                  <select
                    value={workoutParams.sessionGoal}
                    onChange={(e) => setWorkoutParams({ ...workoutParams, sessionGoal: e.target.value as 'strength' | 'stability' })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="strength">Strength</option>
                    <option value="stability">Stability</option>
                  </select>
                </div>

                {/* Intensity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Intensity
                  </label>
                  <select
                    value={workoutParams.intensity}
                    onChange={(e) => setWorkoutParams({ ...workoutParams, intensity: e.target.value as 'low' | 'moderate' | 'high' })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>

                {/* Template */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Workout Template
                  </label>
                  <div className="grid gap-3">
                    {[
                      { id: "standard", name: "Standard", description: "Traditional strength training", icon: "fitness_center" },
                      { id: "circuit", name: "Circuit", description: "High-intensity rounds", icon: "timer" },
                      { id: "full_body", name: "Full Body", description: "All muscle groups", icon: "accessibility_new" },
                    ].map((template) => (
                      <div
                        key={template.id}
                        onClick={() => setWorkoutParams({ ...workoutParams, template: template.id })}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          workoutParams.template === template.id
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${
                            workoutParams.template === template.id
                              ? "bg-indigo-100 text-indigo-600"
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            <Icon name={template.icon} size={20} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{template.name}</h4>
                            <p className="text-xs text-gray-600">{template.description}</p>
                          </div>
                          {workoutParams.template === template.id && (
                            <Icon name="check_circle" className="text-indigo-500" size={20} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Workout Preferences</h3>
                
                {/* Include Exercises */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Include Exercises (Optional)
                  </label>
                  <SearchableMultiSelect
                    options={EXERCISE_OPTIONS}
                    selected={workoutParams.includeExercises}
                    onChange={(selected) => setWorkoutParams({ ...workoutParams, includeExercises: selected })}
                    placeholder="Search and select exercises to include..."
                    tagColor="indigo"
                  />
                </div>

                {/* Avoid Exercises */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Avoid Exercises (Optional)
                  </label>
                  <SearchableMultiSelect
                    options={EXERCISE_OPTIONS}
                    selected={workoutParams.avoidExercises}
                    onChange={(selected) => setWorkoutParams({ ...workoutParams, avoidExercises: selected })}
                    placeholder="Search and select exercises to avoid..."
                    tagColor="red"
                  />
                </div>

                {/* Muscle Target */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Muscle Target (Optional)
                  </label>
                  <SearchableMultiSelect
                    options={MUSCLE_OPTIONS}
                    selected={workoutParams.muscleTarget}
                    onChange={(selected) => setWorkoutParams({ ...workoutParams, muscleTarget: selected })}
                    placeholder="Search and select muscles to target..."
                    tagColor="green"
                    dropdownDirection="up"
                  />
                </div>

                {/* Muscle Lessen */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Muscle Lessen (Optional)
                  </label>
                  <SearchableMultiSelect
                    options={MUSCLE_OPTIONS}
                    selected={workoutParams.muscleLessen}
                    onChange={(selected) => setWorkoutParams({ ...workoutParams, muscleLessen: selected })}
                    placeholder="Search and select muscles to de-emphasize..."
                    tagColor="yellow"
                    dropdownDirection="up"
                  />
                </div>

                {/* Avoid Joints */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Avoid Joints (Optional)
                  </label>
                  <SearchableMultiSelect
                    options={JOINT_OPTIONS}
                    selected={workoutParams.avoidJoints}
                    onChange={(selected) => setWorkoutParams({ ...workoutParams, avoidJoints: selected })}
                    placeholder="Search and select joints to avoid loading..."
                    tagColor="red"
                    dropdownDirection="up"
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Review Your Workout</h3>
                
                {/* Basic Settings Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Basic Settings</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Session Goal:</span>
                      <span className="font-medium capitalize">{workoutParams.sessionGoal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Intensity:</span>
                      <span className="font-medium capitalize">{workoutParams.intensity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Template:</span>
                      <span className="font-medium capitalize">{workoutParams.template.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>

                {/* Preferences Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Preferences</h4>
                  <div className="space-y-3 text-sm">
                    {workoutParams.includeExercises.length > 0 && (
                      <div>
                        <span className="text-gray-600">Include Exercises:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {workoutParams.includeExercises.map((exercise) => {
                            const option = EXERCISE_OPTIONS.find(o => o.value === exercise);
                            return (
                              <span key={exercise} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">
                                {option?.label || exercise}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {workoutParams.avoidExercises.length > 0 && (
                      <div>
                        <span className="text-gray-600">Avoid Exercises:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {workoutParams.avoidExercises.map((exercise) => {
                            const option = EXERCISE_OPTIONS.find(o => o.value === exercise);
                            return (
                              <span key={exercise} className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                                {option?.label || exercise}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {workoutParams.muscleTarget.length > 0 && (
                      <div>
                        <span className="text-gray-600">Target Muscles:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {workoutParams.muscleTarget.map((muscle) => {
                            const option = MUSCLE_OPTIONS.find(o => o.value === muscle);
                            return (
                              <span key={muscle} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                {option?.label || muscle}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {workoutParams.muscleLessen.length > 0 && (
                      <div>
                        <span className="text-gray-600">De-emphasize Muscles:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {workoutParams.muscleLessen.map((muscle) => {
                            const option = MUSCLE_OPTIONS.find(o => o.value === muscle);
                            return (
                              <span key={muscle} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                                {option?.label || muscle}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {workoutParams.avoidJoints.length > 0 && (
                      <div>
                        <span className="text-gray-600">Avoid Joints:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {workoutParams.avoidJoints.map((joint) => {
                            const option = JOINT_OPTIONS.find(o => o.value === joint);
                            return (
                              <span key={joint} className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                                {option?.label || joint}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {workoutParams.includeExercises.length === 0 && 
                     workoutParams.avoidExercises.length === 0 && 
                     workoutParams.muscleTarget.length === 0 && 
                     workoutParams.muscleLessen.length === 0 && 
                     workoutParams.avoidJoints.length === 0 && (
                      <p className="text-gray-500 italic">No specific preferences selected</p>
                    )}
                  </div>
                </div>

                {/* Session Volume */}
                {filteredExercises && filteredExercises.exercises.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Session Volume</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Sets:</span>
                        <span className="font-medium">
                          {calculateSessionVolume(filteredExercises.exercises, workoutParams.intensity, 'moderate').minSets}-{calculateSessionVolume(filteredExercises.exercises, workoutParams.intensity, 'moderate').maxSets} sets
                        </span>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs mt-1">
                          {calculateSessionVolume(filteredExercises.exercises, workoutParams.intensity, 'moderate').reasoning}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show More Button */}
                {filteredExercises && filteredExercises.exercises.length > 0 && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => setShowMore(!showMore)}
                      className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors flex items-center space-x-2"
                    >
                      <span>{showMore ? 'Show Less' : 'Show More'}</span>
                      <Icon 
                        name={showMore ? 'expand_less' : 'expand_more'} 
                        size={20} 
                        className="text-gray-500"
                      />
                    </button>
                  </div>
                )}

                {/* Collapsible Content */}
                {showMore && (
                  <>
                {/* Exercise Blocks Section */}
                {filteredExercises && filteredExercises.exercises.length > 0 && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-gray-800 text-center">Top Exercises</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Block A - Primary Strength */}
                      <div className="bg-blue-50 border-blue-200 border rounded-lg p-3">
                        <h3 className="text-base font-semibold text-blue-800 mb-2">Block A - Primary Strength</h3>
                        <div className="space-y-2">
                          {filteredExercises.exercises
                            .filter((ex: any) => ex.functionTags?.includes('primary_strength'))
                            .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
                            .map((exercise: any, idx: number) => {
                              const isSelected = exercise.isSelectedBlockA;
                              return (
                                <div 
                                  key={exercise.id || idx} 
                                  className={`text-sm p-2 rounded ${
                                    isSelected 
                                      ? 'bg-blue-200 border-blue-400 border' 
                                      : ''
                                  }`}
                                >
                                  <span className="font-medium">{exercise.name}</span>
                                  {exercise.score !== undefined && (
                                    <span className="text-blue-600 ml-2">({exercise.score.toFixed(1)})</span>
                                  )}
                                  {isSelected && <span className="ml-2 text-xs font-bold text-blue-700">SELECTED</span>}
                                </div>
                              );
                            })}
                          {filteredExercises.exercises.filter((ex: any) => ex.functionTags?.includes('primary_strength')).length === 0 && (
                            <p className="text-sm text-gray-500 italic">No exercises found</p>
                          )}
                        </div>
                      </div>

                      {/* Block B - Secondary Strength */}
                      <div className="bg-green-50 border-green-200 border rounded-lg p-3">
                        <h3 className="text-base font-semibold text-green-800 mb-2">Block B - Secondary Strength</h3>
                        <div className="space-y-2">
                          {filteredExercises.exercises
                            .filter((ex: any) => ex.functionTags?.includes('secondary_strength'))
                            .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
                            .map((exercise: any, idx: number) => {
                              const isSelected = exercise.isSelectedBlockB;
                              return (
                                <div 
                                  key={exercise.id || idx} 
                                  className={`text-sm p-2 rounded ${
                                    isSelected 
                                      ? 'bg-green-200 border-green-400 border' 
                                      : ''
                                  }`}
                                >
                                  <span className="font-medium">{exercise.name}</span>
                                  {exercise.score !== undefined && (
                                    <span className="text-green-600 ml-2">({exercise.score.toFixed(1)})</span>
                                  )}
                                  {isSelected && <span className="ml-2 text-xs font-bold text-green-700">SELECTED</span>}
                                </div>
                              );
                            })}
                          {filteredExercises.exercises.filter((ex: any) => ex.functionTags?.includes('secondary_strength')).length === 0 && (
                            <p className="text-sm text-gray-500 italic">No exercises found</p>
                          )}
                        </div>
                      </div>

                      {/* Block C - Accessory */}
                      <div className="bg-purple-50 border-purple-200 border rounded-lg p-3">
                        <h3 className="text-base font-semibold text-purple-800 mb-2">Block C - Accessory</h3>
                        <div className="space-y-2">
                          {filteredExercises.exercises
                            .filter((ex: any) => ex.functionTags?.includes('accessory'))
                            .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
                            .map((exercise: any, idx: number) => {
                              const isSelected = exercise.isSelectedBlockC;
                              return (
                                <div 
                                  key={exercise.id || idx} 
                                  className={`text-sm p-2 rounded ${
                                    isSelected 
                                      ? 'bg-purple-200 border-purple-400 border' 
                                      : ''
                                  }`}
                                >
                                  <span className="font-medium">{exercise.name}</span>
                                  {exercise.score !== undefined && (
                                    <span className="text-purple-600 ml-2">({exercise.score.toFixed(1)})</span>
                                  )}
                                  {isSelected && <span className="ml-2 text-xs font-bold text-purple-700">SELECTED</span>}
                                </div>
                              );
                            })}
                          {filteredExercises.exercises.filter((ex: any) => ex.functionTags?.includes('accessory')).length === 0 && (
                            <p className="text-sm text-gray-500 italic">No exercises found</p>
                          )}
                        </div>
                      </div>

                      {/* Block D - Core & Capacity */}
                      <div className="bg-orange-50 border-orange-200 border rounded-lg p-3">
                        <h3 className="text-base font-semibold text-orange-800 mb-2">Block D - Core & Capacity</h3>
                        <div className="space-y-2">
                          {filteredExercises.exercises
                            .filter((ex: any) => ex.functionTags?.includes('core') || ex.functionTags?.includes('capacity'))
                            .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
                            .map((exercise: any, idx: number) => {
                              const isSelected = exercise.isSelectedBlockD;
                              return (
                                <div 
                                  key={exercise.id || idx} 
                                  className={`text-sm p-2 rounded ${
                                    isSelected 
                                      ? 'bg-orange-200 border-orange-400 border' 
                                      : ''
                                  }`}
                                >
                                  <span className="font-medium">{exercise.name}</span>
                                  {exercise.score !== undefined && (
                                    <span className="text-orange-600 ml-2">({exercise.score.toFixed(1)})</span>
                                  )}
                                  {isSelected && <span className="ml-2 text-xs font-bold text-orange-700">SELECTED</span>}
                                </div>
                              );
                            })}
                          {filteredExercises.exercises.filter((ex: any) => ex.functionTags?.includes('core') || ex.functionTags?.includes('capacity')).length === 0 && (
                            <p className="text-sm text-gray-500 italic">No exercises found</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filtering Status Display */}
                {filteredExercises && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-green-600">Filtering Applied:</span> Showing {filteredExercises.exercises.length} filtered exercises
                    {filteredExercises.timing && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({(filteredExercises.timing.total / 1000).toFixed(2)}s)
                      </span>
                    )}
                  </div>
                )}


                {/* Detailed Exercise Table */}
                {filteredExercises && filteredExercises.exercises.length > 0 && (
                  <div className="overflow-x-auto border rounded-lg">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full bg-white border-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                              Exercise
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                              Score
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                              Target
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                              Fatigue
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filteredExercises.exercises.map((exercise: any, index: number) => {
                            const isPrimaryTarget = workoutParams.muscleTarget.includes(exercise.primaryMuscle);
                            const hasSecondaryTarget = exercise.secondaryMuscles?.some((muscle: string) => 
                              workoutParams.muscleTarget.includes(muscle)
                            );
                            const isPrimaryLessen = workoutParams.muscleLessen.includes(exercise.primaryMuscle);
                            const hasSecondaryLessen = exercise.secondaryMuscles?.some((muscle: string) => 
                              workoutParams.muscleLessen.includes(muscle)
                            );
                            
                            return (
                              <tr key={exercise.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                <td className="px-3 py-2">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{exercise.name}</div>
                                    <div className="text-xs text-gray-500">
                                      {exercise.primaryMuscle}
                                      {exercise.secondaryMuscles?.length > 0 && (
                                        <span className="ml-1">• {exercise.secondaryMuscles.join(", ")}</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {exercise.score ? (
                                    <span className="text-sm font-semibold text-blue-600">
                                      {exercise.score.toFixed(1)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <div className="space-y-1">
                                    {isPrimaryTarget && (
                                      <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                        +3.0
                                      </div>
                                    )}
                                    {hasSecondaryTarget && (
                                      <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                                        +1.5
                                      </div>
                                    )}
                                    {isPrimaryLessen && (
                                      <div className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                        -3.0
                                      </div>
                                    )}
                                    {hasSecondaryLessen && (
                                      <div className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded">
                                        -1.5
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className="text-xs text-gray-600">
                                    {exercise.fatigueProfile || '-'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t bg-gray-50 flex justify-between flex-shrink-0">
            <div>
              {currentStep > 1 && (
                <Button
                  onClick={handleBack}
                  variant="secondary"
                  className="px-6"
                >
                  Back
                </Button>
              )}
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={handleClose}
                variant="secondary"
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                onClick={handleNext}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <Icon name="refresh" className="animate-spin mr-2" size={16} />
                    Loading...
                  </div>
                ) : (
                  currentStep === 1 ? 'Next' : currentStep === 2 ? 'Review' : 'Generate Workout'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}