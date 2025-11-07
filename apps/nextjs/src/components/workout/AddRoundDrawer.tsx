"use client";

import { useState } from "react";
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
  repeatTimes?: number;
  restBetweenSets?: number;
  totalDuration?: number;
}

const ROUND_TYPES = [
  {
    id: 'circuit_round' as const,
    name: 'Circuit Round',
    description: 'Complete all exercises in sequence with timed intervals',
    icon: '🔄',
    color: 'purple'
  },
  {
    id: 'stations_round' as const,
    name: 'Stations Round',
    description: 'Multiple stations with different exercises',
    icon: '🏃',
    color: 'blue'
  },
  {
    id: 'amrap_round' as const,
    name: 'AMRAP Round',
    description: 'As Many Rounds As Possible in set time',
    icon: '⚡',
    color: 'orange'
  }
];

const PRESET_DURATIONS = [
  { work: 30, rest: 10, label: '30/10' },
  { work: 45, rest: 15, label: '45/15' },
  { work: 60, rest: 20, label: '60/20' },
  { work: 90, rest: 30, label: '90/30' }
];

export function AddRoundDrawer({ isOpen, onClose, onAdd, isAdding = false }: AddRoundDrawerProps) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<RoundConfig>({
    type: 'circuit_round',
    exercisesPerRound: 6,
    workDuration: 45,
    restDuration: 15,
  });

  const handleReset = () => {
    setStep(1);
    setConfig({
      type: 'circuit_round',
      exercisesPerRound: 6,
      workDuration: 45,
      restDuration: 15,
    });
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
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
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Add New Round
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {step === 1 && "Choose the type of round"}
                {step === 2 && "Configure round settings"}
                {step === 3 && "Review your round"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Progress indicator */}
        <div className="mt-3">
          <div className="flex gap-1">
            {[1, 2, 3].map((stepNum) => (
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
                    <div className="text-2xl">{roundType.icon}</div>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Exercises per round
                </label>
                <div className="flex gap-2">
                  {[4, 6, 8, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => setConfig(prev => ({ ...prev, exercisesPerRound: num }))}
                      className={cn(
                        "flex-1 p-3 rounded-lg border text-center font-medium transition-colors",
                        config.exercisesPerRound === num
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                          : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                      )}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration settings for circuit and stations */}
              {(config.type === 'circuit_round' || config.type === 'stations_round') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Work/Rest Duration
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {PRESET_DURATIONS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => setConfig(prev => ({ 
                          ...prev, 
                          workDuration: preset.work, 
                          restDuration: preset.rest 
                        }))}
                        className={cn(
                          "p-3 rounded-lg border text-center font-medium transition-colors",
                          config.workDuration === preset.work && config.restDuration === preset.rest
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                            : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Work Duration (seconds)
                      </label>
                      <input
                        type="number"
                        value={config.workDuration || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, workDuration: parseInt(e.target.value) || 0 }))}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        min="1"
                        max="300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Rest Duration (seconds)
                      </label>
                      <input
                        type="number"
                        value={config.restDuration || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, restDuration: parseInt(e.target.value) || 0 }))}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        min="0"
                        max="300"
                      />
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
                  onClick={() => handleStepChange(3)}
                  className="flex-1 p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  Review
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
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