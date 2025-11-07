"use client";

import { useState, useEffect } from "react";
import { cn, ChevronLeftIcon, ChevronRightIcon } from "@acme/ui-shared";

interface AddRoundDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (config: RoundConfig) => void;
  isAdding?: boolean;
}

interface RoundConfig {
  type: 'circuit_round' | 'stations_round' | 'amrap_round';
  exercisesPerRound: number;
  workDuration?: number;
  restDuration?: number;
  sets?: number;
  restBetweenSets?: number;
  totalDuration?: number;
}

const ROUND_TYPES = [
  {
    id: 'circuit_round' as const,
    name: 'Circuit Round',
    description: 'Complete all exercises in sequence with timed intervals',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: 'purple'
  },
  {
    id: 'stations_round' as const,
    name: 'Stations Round',
    description: 'Multiple stations with different exercises',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    color: 'blue'
  },
  {
    id: 'amrap_round' as const,
    name: 'AMRAP Round',
    description: 'As Many Rounds As Possible in set time',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'orange'
  }
];

const CIRCUIT_PRESET_DURATIONS = [
  { work: 30, rest: 30, label: '30/30' },
  { work: 30, rest: 0, label: '30/0' },
  { work: 40, rest: 20, label: '40/20' },
  { work: 60, rest: 30, label: '60/30' }
];

const STATIONS_PRESET_DURATIONS = [
  { work: 180, rest: 60, label: '3m/1m' },
  { work: 120, rest: 60, label: '2m/1m' },
  { work: 460, rest: 60, label: '460s/1m' },
  { work: 450, rest: 60, label: '450s/1m' }
];

const CIRCUIT_EXERCISE_OPTIONS = {
  primary: [3, 4, 5, 6],
  expanded: [1, 2, 7, 8, 9, 10, 11, 12]
};

const STATIONS_EXERCISE_OPTIONS = {
  primary: [2, 3, 4, 5],
  expanded: [1, 6, 7, 8, 9, 10, 11, 12]
};


export function AddRoundDrawer({ isOpen, onClose, onAdd, isAdding = false }: AddRoundDrawerProps) {
  const [step, setStep] = useState(1);
  const [showMoreExerciseOptions, setShowMoreExerciseOptions] = useState(false);
  const [showMoreDurationOptions, setShowMoreDurationOptions] = useState(false);
  const [showMoreRestOptions, setShowMoreRestOptions] = useState(false);
  const [config, setConfig] = useState<RoundConfig>({
    type: 'circuit_round',
    exercisesPerRound: 3, // First option for circuit rounds
    workDuration: 30,
    restDuration: 30,
    sets: 1,
    restBetweenSets: 60,
  });

  // Get appropriate presets based on round type
  const getPresetDurations = () => {
    return config.type === 'stations_round' ? STATIONS_PRESET_DURATIONS : CIRCUIT_PRESET_DURATIONS;
  };

  // Get appropriate exercise options based on round type
  const getExerciseOptions = () => {
    return config.type === 'stations_round' ? STATIONS_EXERCISE_OPTIONS : CIRCUIT_EXERCISE_OPTIONS;
  };

  // Update duration and exercise count when round type changes
  useEffect(() => {
    const presets = getPresetDurations();
    const exerciseOptions = getExerciseOptions();
    const defaultPreset = presets[0];
    const defaultExerciseCount = exerciseOptions.primary[0];
    
    setConfig(prev => ({
      ...prev,
      workDuration: defaultPreset.work,
      restDuration: defaultPreset.rest,
      exercisesPerRound: defaultExerciseCount,
      // Ensure sets and restBetweenSets are preserved/set properly
      sets: prev.sets || 1,
      restBetweenSets: prev.restBetweenSets || 60,
    }));
  }, [config.type]);

  const handleReset = () => {
    setStep(1);
    setShowMoreExerciseOptions(false);
    setShowMoreDurationOptions(false);
    setShowMoreRestOptions(false);
    setConfig({
      type: 'circuit_round',
      exercisesPerRound: 3,
      workDuration: 30,
      restDuration: 30,
      sets: 1,
      restBetweenSets: 60,
    });
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleNext = () => {
    // For AMRAP, skip sets step (3) and go directly to review (4)
    if (config.type === 'amrap_round' && step === 2) {
      setStep(4);
    } else if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    // For AMRAP, skip sets step (3) when going back from review (4)
    if (config.type === 'amrap_round' && step === 4) {
      setStep(2);
    } else if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleAdd = () => {
    onAdd(config);
    handleReset();
  };

  const scrollToTop = () => {
    setTimeout(() => {
      const container = document.querySelector('[data-radix-scroll-area-viewport]');
      if (container) {
        container.scrollTop = 0;
      }
    }, 0);
  };

  const handleStepChange = (newStep: number) => {
    setStep(newStep);
    scrollToTop();
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="flex-shrink-0 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Go back"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                Add New Round
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                {step === 1 && "Choose the type of round"}
                {step === 2 && "Configure round settings"}
                {step === 3 && "Configure sets and rest"}
                {step === 4 && "Review your round"}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleClose}
            className="flex-shrink-0 ml-4 p-3 rounded-xl text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200 hover:scale-105 active:scale-95"
            aria-label="Close drawer"
          >
            <svg 
              className="w-6 h-6" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress indicator */}
        <div className="mt-3">
          <div className="flex gap-1">
            {(config.type === 'amrap_round' ? [1, 2, 4] : [1, 2, 3, 4]).map((stepNum, index) => (
              <div
                key={stepNum}
                className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-300",
                  step >= stepNum 
                    ? "bg-purple-500 dark:bg-purple-400" 
                    : "bg-gray-200 dark:bg-gray-700"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Step 1: Round Type Selection */}
          {step === 1 && (
            <div className="space-y-3">
              {ROUND_TYPES.map((roundType) => (
                <button
                  key={roundType.id}
                  onClick={() => {
                    setConfig(prev => ({ ...prev, type: roundType.id }));
                    handleStepChange(2);
                  }}
                  className={cn(
                    "w-full p-4 rounded-lg border-2 text-left transition-all duration-200",
                    config.type === roundType.id
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400">
                      {roundType.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {roundType.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {roundType.description}
                      </p>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Configuration */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Exercises per round */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Exercises per round
                  </label>
                  {/* Show selected value if it's not in primary options */}
                  {!(getExerciseOptions().primary.includes(config.exercisesPerRound)) && (
                    <button
                      onClick={() => setShowMoreExerciseOptions(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium"
                      aria-label="Change selection"
                    >
                      <span className="text-base font-semibold">{config.exercisesPerRound}</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  
                  {/* Primary options */}
                  <div className="grid grid-cols-4 gap-2">
                    {getExerciseOptions().primary.map((num) => (
                      <button
                        key={num}
                        onClick={() => {
                          setConfig(prev => ({ ...prev, exercisesPerRound: num }));
                          setShowMoreExerciseOptions(false); // Close expanded options when selecting primary
                        }}
                        className={cn(
                          "p-3 rounded-lg border text-center font-medium transition-all duration-200",
                          config.exercisesPerRound === num
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 ring-2 ring-purple-200 dark:ring-purple-800"
                            : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  
                  {/* More options */}
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowMoreExerciseOptions(!showMoreExerciseOptions)}
                      className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <span>More options</span>
                      <ChevronRightIcon 
                        className={cn(
                          "w-4 h-4 transition-transform duration-200",
                          showMoreExerciseOptions && "rotate-90"
                        )} 
                      />
                    </button>
                    
                    {showMoreExerciseOptions && (
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                        {getExerciseOptions().expanded.map((num) => (
                          <button
                            key={num}
                            onClick={() => {
                              setConfig(prev => ({ ...prev, exercisesPerRound: num }));
                              setShowMoreExerciseOptions(false); // Auto-collapse after selection
                            }}
                            className={cn(
                              "p-3 rounded-lg border text-center font-medium transition-all duration-200",
                              config.exercisesPerRound === num
                                ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 ring-2 ring-purple-200 dark:ring-purple-800"
                                : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
                            )}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Duration settings for circuit and stations */}
              {(config.type === 'circuit_round' || config.type === 'stations_round') && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {config.type === 'circuit_round' ? 'Work/Rest Duration (seconds)' : 'Work/Rest Duration'}
                    </label>
                    {/* Show selected value if it's not in primary options */}
                    {!(getPresetDurations().some(preset => preset.work === config.workDuration && preset.rest === config.restDuration)) && (
                      <button
                        onClick={() => setShowMoreDurationOptions(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium"
                        aria-label="Change duration"
                      >
                        <span className="text-base font-semibold">{config.workDuration}/{config.restDuration}</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">

                    {/* Primary duration options */}
                    <div className="grid grid-cols-2 gap-2">
                      {getPresetDurations().map((preset) => (
                        <button
                          key={preset.label}
                          onClick={() => {
                            setConfig(prev => ({ 
                              ...prev, 
                              workDuration: preset.work, 
                              restDuration: preset.rest 
                            }));
                            setShowMoreDurationOptions(false); // Close expanded options when selecting primary
                          }}
                          className={cn(
                            "p-3 rounded-lg border text-center font-medium transition-all duration-200",
                            config.workDuration === preset.work && config.restDuration === preset.rest
                              ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 ring-2 ring-purple-200 dark:ring-purple-800"
                              : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* More duration options */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowMoreDurationOptions(!showMoreDurationOptions)}
                        className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <span>More options</span>
                        <ChevronRightIcon 
                          className={cn(
                            "w-4 h-4 transition-transform duration-200",
                            showMoreDurationOptions && "rotate-90"
                          )} 
                        />
                      </button>
                      
                      {showMoreDurationOptions && (
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                          {config.type === 'circuit_round' ? (
                            // Circuit: Simple seconds input
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1 text-center">
                                  Work (sec)
                                </label>
                                <input
                                  type="number"
                                  value={config.workDuration || ''}
                                  onChange={(e) => setConfig(prev => ({ ...prev, workDuration: parseInt(e.target.value) || 0 }))}
                                  className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-center font-medium"
                                  min="1"
                                  max="300"
                                  placeholder="30"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1 text-center">
                                  Rest (sec)
                                </label>
                                <input
                                  type="number"
                                  value={config.restDuration || ''}
                                  onChange={(e) => setConfig(prev => ({ ...prev, restDuration: parseInt(e.target.value) || 0 }))}
                                  className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-center font-medium"
                                  min="0"
                                  max="300"
                                  placeholder="30"
                                />
                              </div>
                            </div>
                          ) : (
                            // Stations: Compact work (min:sec) and rest (seconds) input
                            <div className="grid grid-cols-2 gap-3">
                              {/* Work Duration - Compact minutes:seconds */}
                              <div>
                                <label className="block text-xs text-gray-400 dark:text-gray-500 mb-2 text-center">
                                  Work Duration
                                </label>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1 text-center">min</div>
                                    <input
                                      type="number"
                                      value={Math.floor((config.workDuration || 0) / 60) || ''}
                                      onChange={(e) => {
                                        const minutes = parseInt(e.target.value) || 0;
                                        const seconds = (config.workDuration || 0) % 60;
                                        setConfig(prev => ({ ...prev, workDuration: minutes * 60 + seconds }));
                                      }}
                                      className="w-full h-10 p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-center font-medium"
                                      min="0"
                                      max="30"
                                      placeholder=""
                                    />
                                  </div>
                                  <span className="text-lg text-gray-500 dark:text-gray-400 mt-6">:</span>
                                  <div className="flex-1">
                                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1 text-center">sec</div>
                                    <input
                                      type="number"
                                      value={(config.workDuration || 0) % 60 || ''}
                                      onChange={(e) => {
                                        const minutes = Math.floor((config.workDuration || 0) / 60);
                                        const seconds = parseInt(e.target.value) || 0;
                                        setConfig(prev => ({ ...prev, workDuration: minutes * 60 + seconds }));
                                      }}
                                      className="w-full h-10 p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-center font-medium"
                                      min="0"
                                      max="59"
                                      placeholder=""
                                    />
                                  </div>
                                </div>
                              </div>
                              
                              {/* Rest Duration - Simple seconds */}
                              <div>
                                <label className="block text-xs text-gray-400 dark:text-gray-500 mb-2 text-center">
                                  Rest Duration
                                </label>
                                <div>
                                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1 text-center">sec</div>
                                  <input
                                    type="number"
                                    value={config.restDuration || ''}
                                    onChange={(e) => setConfig(prev => ({ ...prev, restDuration: parseInt(e.target.value) || 0 }))}
                                    className="w-full h-10 p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-center font-medium"
                                    min="0"
                                    max="600"
                                    placeholder=""
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* AMRAP specific settings */}
              {config.type === 'amrap_round' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Total Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={config.totalDuration || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, totalDuration: parseInt(e.target.value) || 0 }))}
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    min="1"
                    max="60"
                    placeholder="Enter duration in minutes"
                  />
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleBack}
                  className="flex-1 p-3 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  {config.type === 'amrap_round' ? 'Review' : 'Next'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Configure Sets (Circuit and Stations only) */}
          {step === 3 && (config.type === 'circuit_round' || config.type === 'stations_round') && (
            <div className="space-y-6">
              {/* Number of sets */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Number of sets
                  </label>
                </div>
                <div className="space-y-3">
                  {/* Primary set options */}
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((num) => (
                      <button
                        key={num}
                        onClick={() => setConfig(prev => ({ ...prev, sets: num }))}
                        className={cn(
                          "p-3 rounded-lg border text-center font-medium transition-all duration-200",
                          config.sets === num
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 ring-2 ring-purple-200 dark:ring-purple-800"
                            : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rest between sets - only show when sets > 1 */}
              {(config.sets && config.sets > 1) && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Rest between sets
                    </label>
                    {/* Show selected value if it's not in primary options */}
                    {!(config.restBetweenSets && [30, 60, 90, 120].includes(config.restBetweenSets)) && (
                      <button
                        onClick={() => setShowMoreRestOptions(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium"
                        aria-label="Change rest duration"
                      >
                        <span className="text-base font-semibold">
                          {config.restBetweenSets && config.restBetweenSets >= 60 
                            ? `${Math.floor(config.restBetweenSets / 60)}m${config.restBetweenSets % 60 ? ` ${config.restBetweenSets % 60}s` : ''}`
                            : `${config.restBetweenSets}s`
                          }
                        </span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {/* Primary rest options */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { seconds: 30, label: '30s' },
                        { seconds: 60, label: '1m' },
                        { seconds: 90, label: '1.5m' },
                        { seconds: 120, label: '2m' }
                      ].map((option) => (
                        <button
                          key={option.seconds}
                          onClick={() => {
                            setConfig(prev => ({ ...prev, restBetweenSets: option.seconds }));
                            setShowMoreRestOptions(false); // Close expanded options when selecting primary
                          }}
                          className={cn(
                            "p-3 rounded-lg border text-center font-medium transition-all duration-200",
                            config.restBetweenSets === option.seconds
                              ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 ring-2 ring-purple-200 dark:ring-purple-800"
                              : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {/* Custom rest options */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowMoreRestOptions(!showMoreRestOptions)}
                        className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <span>Custom rest time</span>
                        <ChevronRightIcon 
                          className={cn(
                            "w-4 h-4 transition-transform duration-200",
                            showMoreRestOptions && "rotate-90"
                          )} 
                        />
                      </button>
                      
                      {showMoreRestOptions && (
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div>
                            <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1 text-center">
                              Rest Duration (seconds)
                            </label>
                            <input
                              type="number"
                              value={config.restBetweenSets || ''}
                              onChange={(e) => setConfig(prev => ({ ...prev, restBetweenSets: parseInt(e.target.value) || 0 }))}
                              className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-center font-medium"
                              min="0"
                              max="600"
                              placeholder="60"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleBack}
                  className="flex-1 p-3 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => handleStepChange(4)}
                  className="flex-1 p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  Review
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400">
                    {ROUND_TYPES.find(rt => rt.id === config.type)?.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                      {ROUND_TYPES.find(rt => rt.id === config.type)?.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {config.exercisesPerRound} exercises
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {(config.type === 'circuit_round' || config.type === 'stations_round') && (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Work</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {config.workDuration}s
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Rest</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {config.restDuration}s
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Sets</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {config.sets}
                        </p>
                      </div>
                      {(config.sets && config.sets > 1) && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Rest between sets</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {config.restBetweenSets && config.restBetweenSets >= 60 
                              ? `${Math.floor(config.restBetweenSets / 60)}m${config.restBetweenSets % 60 ? ` ${config.restBetweenSets % 60}s` : ''}`
                              : `${config.restBetweenSets}s`
                            }
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {config.type === 'amrap_round' && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {config.totalDuration} min
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 p-3 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleAdd}
                  disabled={isAdding}
                  className="flex-1 p-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isAdding && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Add Round
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}