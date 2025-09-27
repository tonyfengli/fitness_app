"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button, Loader2Icon as Loader2, ChevronRightIcon as ChevronRight } from "@acme/ui-shared";
import { cn } from "@acme/ui-shared";
import type { CircuitConfig, RoundConfig } from "@acme/db";
import { useTRPC } from "~/trpc/react";

interface RoundsStepProps {
  rounds: number;
  repeatRounds: boolean;
  restBetweenRounds: number;
  onRoundsChange: (rounds: number) => void;
  onRepeatToggle: (repeat: boolean) => void;
  onRoundRestChange: (restBetweenRounds: number) => void;
  isSaving: boolean;
}

export function RoundsStep({
  rounds,
  repeatRounds,
  restBetweenRounds,
  onRoundsChange,
  onRepeatToggle,
  onRoundRestChange,
  isSaving,
}: RoundsStepProps) {
  const roundOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const totalRounds = repeatRounds ? rounds * 2 : rounds;
  const roundRestOptions = [30, 45, 60, 90, 120, 150];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1 text-gray-900 dark:text-white">How many rounds?</h3>
        <p className="text-sm text-gray-600 dark:text-white mb-4">Each round contains all exercises</p>
        <div className="grid grid-cols-5 gap-2">
          {roundOptions.map((option) => (
            <Button
              key={option}
              variant={rounds === option ? "primary" : "outline"}
              className={cn(
                "relative h-14 min-w-0 touch-manipulation text-base",
                rounds !== option && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
              )}
              onClick={() => onRoundsChange(option)}
              disabled={isSaving}
            >
              {isSaving && rounds === option && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {option}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Round Break</h3>
            <p className="text-sm text-gray-600 dark:text-white">Between rounds</p>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {restBetweenRounds}s
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {roundRestOptions.map((option) => (
            <Button
              key={option}
              variant={restBetweenRounds === option ? "primary" : "outline"}
              className={cn(
                "relative h-12 min-w-0 touch-manipulation text-sm font-medium transition-all",
                restBetweenRounds === option && "bg-green-600 text-white hover:bg-green-700",
                restBetweenRounds !== option && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
              )}
              onClick={() => onRoundRestChange(option)}
              disabled={isSaving}
            >
              {isSaving && restBetweenRounds === option ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `${option}s`
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Repeat rounds toggle - removed per request */}
      {/* <div className="flex items-center justify-between rounded-xl bg-gray-100 dark:bg-gray-700/50 p-4">
        <div className="space-y-0.5">
          <label htmlFor="repeat-rounds" className="text-base font-medium text-foreground">
            Repeat rounds
          </label>
          <p className="text-sm text-gray-600 dark:text-white">
            Double the workout intensity
          </p>
        </div>
        <button
          id="repeat-rounds"
          role="switch"
          aria-checked={repeatRounds}
          onClick={() => onRepeatToggle(!repeatRounds)}
          onTouchEnd={(e) => {
            e.preventDefault();
            if (!isSaving) onRepeatToggle(!repeatRounds);
          }}
          disabled={isSaving}
          className={cn(
            "relative inline-flex h-8 w-14 items-center rounded-full transition-colors touch-manipulation",
            repeatRounds ? "bg-primary dark:bg-primary/80" : "bg-gray-200 dark:bg-gray-600",
            isSaving && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className={cn(
            "inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm",
            repeatRounds ? "translate-x-7" : "translate-x-1"
          )} />
        </button>
      </div> */}

      {/* Total rounds display - removed per request */}
      {/* <div className="rounded-xl bg-primary/10 p-6 text-center">
        <p className="text-sm text-muted-foreground mb-1">Total rounds</p>
        <p className="text-3xl font-bold text-primary">{totalRounds}</p>
        {repeatRounds && (
          <p className="text-xs text-muted-foreground mt-1">({rounds} × 2)</p>
        )}
      </div> */}
    </div>
  );
}

interface RoundTypesStepProps {
  rounds: number;
  roundTemplates: RoundConfig[];
  onRoundTemplatesChange: (roundTemplates: RoundConfig[]) => void;
  warmupEnabled: boolean;
  onWarmupToggle: (enabled: boolean) => void;
  isSaving: boolean;
}

export function RoundTypesStep({
  rounds,
  roundTemplates,
  onRoundTemplatesChange,
  warmupEnabled,
  onWarmupToggle,
  isSaving,
}: RoundTypesStepProps) {
  // Ensure we have the correct number of round templates
  const ensuredRoundTemplates = Array.from({ length: rounds }, (_, i) => {
    const existing = roundTemplates.find(rt => rt.roundNumber === i + 1);
    if (existing) {
      // Ensure existing templates have required fields
      if (existing.template.type === 'circuit_round' || existing.template.type === 'stations_round') {
        return {
          ...existing,
          template: {
            ...existing.template,
            workDuration: (existing.template as any).workDuration ?? 45,
            restDuration: (existing.template as any).restDuration ?? 15,
          }
        };
      } else if (existing.template.type === 'amrap_round') {
        return {
          ...existing,
          template: {
            ...existing.template,
            totalDuration: (existing.template as any).totalDuration ?? 300,
          }
        };
      }
      return existing;
    }
    
    // Default to circuit_round
    return {
      roundNumber: i + 1,
      template: {
        type: 'circuit_round' as const,
        exercisesPerRound: 6,
        workDuration: 45,
        restDuration: 15,
      }
    };
  });

  const handleRoundTypeChange = (roundNumber: number, type: 'circuit_round' | 'stations_round' | 'amrap_round') => {
    const newRoundTemplates = ensuredRoundTemplates.map(rt => {
      if (rt.roundNumber === roundNumber) {
        // Reset to defaults when changing round type
        const baseConfig = {
          type,
          exercisesPerRound: 6, // Default to 6 exercises
        };
        
        if (type === 'circuit_round') {
          return {
            ...rt,
            template: {
              ...baseConfig,
              workDuration: 45,
              restDuration: 15,
            }
          };
        } else if (type === 'stations_round') {
          return {
            ...rt,
            template: {
              ...baseConfig,
              workDuration: 45,
              restDuration: 15,
            }
          };
        } else if (type === 'amrap_round') {
          return {
            ...rt,
            template: {
              ...baseConfig,
              totalDuration: 300, // Default to 5 minutes
            }
          };
        }
      }
      return rt;
    });
    
    onRoundTemplatesChange(newRoundTemplates);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1 text-foreground">Round Types</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose the type for each round
        </p>
      </div>


      <div className="space-y-3">
        {/* Warmup */}
        <div className="space-y-2">
          <span className="text-base font-medium text-gray-900 dark:text-gray-100">
            Warm-up
          </span>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={warmupEnabled ? "primary" : "outline"}
              className={cn(
                "relative h-12 min-w-0 touch-manipulation text-sm",
                !warmupEnabled && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
              )}
              onClick={() => onWarmupToggle(true)}
              disabled={isSaving}
            >
              {isSaving && warmupEnabled && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Yes
            </Button>
            
            <Button
              variant={!warmupEnabled ? "primary" : "outline"}
              className={cn(
                "relative h-12 min-w-0 touch-manipulation text-sm",
                warmupEnabled && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
              )}
              onClick={() => onWarmupToggle(false)}
              disabled={isSaving}
            >
              {isSaving && !warmupEnabled && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              No
            </Button>
          </div>
        </div>

        {/* Regular Rounds */}
        {ensuredRoundTemplates.map((roundConfig) => (
          <div 
            key={roundConfig.roundNumber}
            className="space-y-2"
          >
            <span className="text-base font-medium text-gray-900 dark:text-gray-100">
              Round {roundConfig.roundNumber}
            </span>
            
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={roundConfig.template.type === 'circuit_round' ? "primary" : "outline"}
                className={cn(
                  "relative h-12 min-w-0 touch-manipulation text-sm",
                  roundConfig.template.type !== 'circuit_round' && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
                )}
                onClick={() => handleRoundTypeChange(roundConfig.roundNumber, 'circuit_round')}
                disabled={isSaving}
              >
                {isSaving && roundConfig.template.type === 'circuit_round' && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Circuit
              </Button>
              
              <Button
                variant={roundConfig.template.type === 'stations_round' ? "primary" : "outline"}
                className={cn(
                  "relative h-12 min-w-0 touch-manipulation text-sm",
                  roundConfig.template.type !== 'stations_round' && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
                )}
                onClick={() => handleRoundTypeChange(roundConfig.roundNumber, 'stations_round')}
                disabled={isSaving}
              >
                {isSaving && roundConfig.template.type === 'stations_round' && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Stations
              </Button>
              
              <Button
                variant={roundConfig.template.type === 'amrap_round' ? "primary" : "outline"}
                className={cn(
                  "relative h-12 min-w-0 touch-manipulation text-sm",
                  roundConfig.template.type !== 'amrap_round' && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
                )}
                onClick={() => handleRoundTypeChange(roundConfig.roundNumber, 'amrap_round')}
                disabled={isSaving}
              >
                {isSaving && roundConfig.template.type === 'amrap_round' && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                AMRAP
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PerRoundConfigStepProps {
  rounds?: number;
  roundTemplates: RoundConfig[];
  onRoundTemplatesChange: (roundTemplates: RoundConfig[]) => void;
  warmupEnabled: boolean;
  warmupConfig?: {
    enabled: boolean;
    exercisesCount: number;
    duration: number;
  };
  onWarmupChange: (warmup: any) => void;
  isSaving: boolean;
}

export function PerRoundConfigStep({
  rounds,
  roundTemplates,
  onRoundTemplatesChange,
  warmupEnabled,
  warmupConfig,
  onWarmupChange,
  isSaving,
}: PerRoundConfigStepProps) {
  // If rounds is provided, ensure we have templates for all rounds
  const totalRounds = rounds || roundTemplates.length;
  
  // Create templates for all rounds
  const allRoundTemplates = Array.from({ length: totalRounds }, (_, i) => {
    const existing = roundTemplates.find(rt => rt.roundNumber === i + 1);
    if (existing) {
      return existing;
    }
    // Create default template for missing rounds
    return {
      roundNumber: i + 1,
      template: {
        type: 'circuit_round' as const,
        exercisesPerRound: 6,
        workDuration: 45,
        restDuration: 15,
      }
    };
  });
  
  // Ensure all templates have required fields with defaults
  const normalizedTemplates = allRoundTemplates.map(rt => {
    if (rt.template.type === 'circuit_round' || rt.template.type === 'stations_round') {
      return {
        ...rt,
        template: {
          ...rt.template,
          workDuration: (rt.template as any).workDuration ?? 45,
          restDuration: (rt.template as any).restDuration ?? 15,
        }
      };
    } else if (rt.template.type === 'amrap_round') {
      return {
        ...rt,
        template: {
          ...rt.template,
          totalDuration: (rt.template as any).totalDuration ?? 300,
        }
      };
    }
    return rt;
  });

  const handleExercisesChange = (roundNumber: number, exercises: number) => {
    const newRoundTemplates = normalizedTemplates.map(rt => {
      if (rt.roundNumber === roundNumber) {
        return {
          ...rt,
          template: {
            ...rt.template,
            exercisesPerRound: exercises,
          }
        };
      }
      return rt;
    });
    onRoundTemplatesChange(newRoundTemplates);
  };

  const handleTimingChange = (roundNumber: number, field: 'workDuration' | 'restDuration' | 'totalDuration' | 'repeatTimes', value: number) => {
    const newRoundTemplates = normalizedTemplates.map(rt => {
      if (rt.roundNumber === roundNumber) {
        return {
          ...rt,
          template: {
            ...rt.template,
            [field]: value,
          }
        };
      }
      return rt;
    });
    onRoundTemplatesChange(newRoundTemplates);
  };

  // Sort by round number
  const sortedRounds = [...normalizedTemplates].sort((a, b) => a.roundNumber - b.roundNumber);

  const exerciseOptions = [2, 3, 4, 5, 6, 7];
  const workOptions = [20, 30, 40, 45, 60, 90, 120, 150, 180, 210, 240];
  const restOptions = [10, 15, 20, 30];
  const amrapOptions = [120, 180, 240, 300, 360]; // 2-6 minutes
  
  // Recommended values based on fitness science
  const recommendedExercises = 6;
  const recommendedWork = 45;
  const recommendedRest = 15;
  const recommendedAMRAP = 300; // 5 minutes

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1 text-foreground">Round Configuration</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure exercises and timing for each round
        </p>
      </div>

      {/* Warm-up Section */}
      {warmupEnabled && (
        <div className="space-y-4">
          <div className={cn(
            "space-y-3 p-4 rounded-lg border transition-all",
            "bg-orange-50/30 border-orange-200/50 hover:border-orange-300 dark:bg-opacity-10"
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-medium text-gray-900 dark:text-gray-100">Warm-up</span>
              <span className={cn(
                "text-xs font-bold px-2.5 py-1 rounded-full",
                "bg-orange-500 text-white"
              )}>
                WARM-UP
              </span>
            </div>
            
            {/* Warm-up Description */}
            <div className={cn(
              "text-xs px-3 py-2 rounded-md -mx-1 mb-3",
              "bg-orange-100/50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
            )}>
              🔥 Prepare your body with dynamic movements
            </div>
            
            {/* Exercises */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-gray-600 dark:text-white">EXERCISES</span>
              <div className="grid grid-cols-4 gap-1">
                {[3, 4, 5, 6].map((option) => {
                  const isSelected = warmupConfig?.exercisesCount === option;
                  return (
                    <Button
                      key={option}
                      variant={isSelected ? "primary" : "outline"}
                      className={cn(
                        "relative h-10 min-w-0 text-xs transition-all",
                        isSelected && "ring-2 ring-offset-1 ring-primary",
                        !isSelected && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
                      )}
                      onClick={() => onWarmupChange({
                        ...warmupConfig,
                        enabled: true,
                        exercisesCount: option,
                        duration: warmupConfig?.duration || 300
                      })}
                      disabled={isSaving}
                      size="sm"
                    >
                      <span className={cn(isSelected && "font-bold")}>
                        {option}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Total Duration */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">TOTAL TIME</span>
              <div className="grid grid-cols-5 gap-1">
                {[180, 240, 300, 360, 420].map((option) => { // 3-7 minutes
                  const isSelected = warmupConfig?.duration === option;
                  return (
                    <Button
                      key={option}
                      variant={isSelected ? "primary" : "outline"}
                      className={cn(
                        "relative h-9 min-w-0 text-xs transition-all",
                        isSelected && "ring-2 ring-offset-1 ring-primary",
                        !isSelected && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
                      )}
                      onClick={() => onWarmupChange({
                        ...warmupConfig,
                        enabled: true,
                        exercisesCount: warmupConfig?.exercisesCount || 6,
                        duration: option
                      })}
                      disabled={isSaving}
                      size="sm"
                    >
                      <span className={cn(isSelected && "font-bold")}>
                        {Math.floor(option / 60)}m
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {sortedRounds.map((round) => {
          const isCircuit = round.template.type === 'circuit_round';
          const isStations = round.template.type === 'stations_round';
          const isAMRAP = round.template.type === 'amrap_round';
          
          return (
            <div key={round.roundNumber} className={cn(
              "space-y-3 p-4 rounded-lg border transition-all",
              isCircuit && "bg-blue-50/30 border-blue-200/50 hover:border-blue-300",
              isStations && "bg-green-50/30 border-green-200/50 hover:border-green-300",
              isAMRAP && "bg-purple-50/30 border-purple-200/50 hover:border-purple-300",
              "dark:bg-opacity-10"
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-medium text-gray-900 dark:text-gray-100">Round {round.roundNumber}</span>
                <span className={cn(
                  "text-xs font-bold px-2.5 py-1 rounded-full",
                  isCircuit && "bg-blue-500 text-white",
                  isStations && "bg-green-500 text-white",
                  isAMRAP && "bg-purple-500 text-white"
                )}>
                  {isCircuit && 'CIRCUIT'}
                  {isStations && 'STATIONS'}
                  {isAMRAP && 'AMRAP'}
                </span>
              </div>
              
              {/* Round Type Description */}
              <div className={cn(
                "text-xs px-3 py-2 rounded-md -mx-1 mb-3",
                isCircuit && "bg-blue-100/50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
                isStations && "bg-green-100/50 text-green-700 dark:bg-green-900/20 dark:text-green-300",
                isAMRAP && "bg-purple-100/50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
              )}>
                {isCircuit && '💫 Move through exercises with timed work/rest intervals'}
                {isStations && '🔄 Teams rotate between stations simultaneously'}
                {isAMRAP && '🔥 Complete as many rounds as possible in the time limit'}
              </div>
              
              {/* Exercises */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-gray-600 dark:text-white">
                  {isStations ? 'STATIONS' : 'EXERCISES'}
                </span>
                <div className="grid grid-cols-6 gap-1">
                  {exerciseOptions.map((option) => {
                    const isSelected = round.template.exercisesPerRound === option;
                    const isRecommended = option === recommendedExercises;
                    return (
                      <Button
                        key={option}
                        variant={isSelected ? "primary" : "outline"}
                        className={cn(
                          "relative h-10 min-w-0 text-xs transition-all",
                          isSelected && "ring-2 ring-offset-1 ring-primary",
                          !isSelected && isRecommended && "border-primary/50 hover:border-primary",
                          !isSelected && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
                        )}
                        onClick={() => handleExercisesChange(round.roundNumber, option)}
                        disabled={isSaving}
                        size="sm"
                      >
                        <span className={cn(
                          isSelected && "font-bold",
                          !isSelected && isRecommended && "font-medium"
                        )}>
                          {option}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Timing Configuration */}
              {(isCircuit || isStations) && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-white">WORK TIME</span>
                    <div className="grid grid-cols-5 gap-1">
                      {workOptions.map((option) => {
                        const isSelected = (round.template as any).workDuration === option;
                        const isRecommended = option === recommendedWork;
                        return (
                          <Button
                            key={option}
                            variant={isSelected ? "primary" : "outline"}
                            className={cn(
                              "relative h-9 min-w-0 text-xs transition-all",
                              isSelected && "ring-2 ring-offset-1 ring-primary",
                              !isSelected && isRecommended && "border-primary/50 hover:border-primary",
                              !isSelected && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
                            )}
                            onClick={() => handleTimingChange(round.roundNumber, 'workDuration', option)}
                            disabled={isSaving}
                            size="sm"
                          >
                            <span className={cn(
                              isSelected && "font-bold",
                              !isSelected && isRecommended && "font-medium"
                            )}>
                              {option >= 60 ? `${option / 60}m` : `${option}s`}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-white">REST TIME</span>
                    <div className="grid grid-cols-5 gap-1">
                      {restOptions.slice(0, 4).map((option) => {
                        const isSelected = (round.template as any).restDuration === option;
                        const isRecommended = option === recommendedRest;
                        return (
                          <Button
                            key={option}
                            variant={isSelected ? "primary" : "outline"}
                            className={cn(
                              "relative h-9 min-w-0 text-xs transition-all",
                              isSelected && "ring-2 ring-offset-1 ring-primary",
                              !isSelected && isRecommended && "border-primary/50 hover:border-primary",
                              !isSelected && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
                            )}
                            onClick={() => handleTimingChange(round.roundNumber, 'restDuration', option)}
                            disabled={isSaving}
                            size="sm"
                          >
                            <span className={cn(
                              isSelected && "font-bold",
                              !isSelected && isRecommended && "font-medium"
                            )}>
                              {option}s
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Repeat Times - For both Circuit and Stations */}
                  {(isCircuit || isStations) && (
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-white">REPEAT</span>
                      <div className="grid grid-cols-5 gap-1">
                        {[1, 2, 3, 4, 5].map((option) => {
                          const isSelected = (round.template as any).repeatTimes === option || (!round.template.repeatTimes && option === 1);
                          return (
                            <Button
                              key={option}
                              variant={isSelected ? "primary" : "outline"}
                              className={cn(
                                "relative h-9 min-w-0 text-xs transition-all",
                                isSelected && "ring-2 ring-offset-1 ring-primary",
                                !isSelected && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
                              )}
                              onClick={() => handleTimingChange(round.roundNumber, 'repeatTimes', option)}
                              disabled={isSaving}
                              size="sm"
                            >
                              <span className={cn(isSelected && "font-bold")}>
                                {option}x
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* AMRAP Total Duration */}
              {isAMRAP && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-white">TOTAL TIME</span>
                  <div className="grid grid-cols-5 gap-1">
                    {amrapOptions.map((option) => (
                      <Button
                        key={option}
                        variant={(round.template as any).totalDuration === option ? "primary" : "outline"}
                        className={cn(
                          "relative h-9 min-w-0 text-xs",
                          (round.template as any).totalDuration !== option && "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600"
                        )}
                        onClick={() => handleTimingChange(round.roundNumber, 'totalDuration', option)}
                        disabled={isSaving}
                        size="sm"
                      >
                        {Math.floor(option / 60)}m
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ExercisesStepProps {
  exercises: number;
  onExercisesChange: (exercises: number) => void;
  isSaving: boolean;
}

export function ExercisesStep({
  exercises,
  onExercisesChange,
  isSaving,
}: ExercisesStepProps) {
  const presetOptions = [2, 3, 4, 5, 6, 7];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1 text-foreground">
          Exercises per round
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          How many exercises in each round?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {presetOptions.map((option) => (
            <Button
              key={option}
              variant={exercises === option ? "primary" : "outline"}
              className="relative h-14 min-w-0 touch-manipulation text-base"
              onClick={() => onExercisesChange(option)}
              disabled={isSaving}
            >
              {isSaving && exercises === option && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {option}
            </Button>
          ))}
        </div>
      </div>

    </div>
  );
}

interface TimingStepProps {
  workDuration: number;
  restDuration: number;
  onWorkChange: (duration: number) => void;
  onRestChange: (duration: number) => void;
  isSaving: boolean;
}

export function TimingStep({
  workDuration,
  restDuration,
  onWorkChange,
  onRestChange,
  isSaving,
}: TimingStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-1 text-foreground">Set your intervals</h3>
        <p className="text-sm text-muted-foreground mb-6">Configure work and rest periods</p>
      </div>
      
      <div className="space-y-6">
        <TimingOption
          label="Work"
          description="Time for each exercise"
          value={workDuration}
          options={[20, 30, 40, 45, 60, 90, 120, 150, 180, 210, 240]}
          onChange={onWorkChange}
          isSaving={isSaving}
          color="primary"
        />

        <TimingOption
          label="Rest"
          description="Between exercises"
          value={restDuration}
          options={[10, 15, 20, 30]}
          onChange={onRestChange}
          isSaving={isSaving}
          color="secondary"
        />
      </div>
    </div>
  );
}

interface TimingOptionProps {
  label: string;
  description: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
  isSaving: boolean;
  color?: "primary" | "secondary" | "accent";
}

function TimingOption({
  label,
  description,
  value,
  options,
  onChange,
  isSaving,
  color = "primary",
}: TimingOptionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h4 className="text-base font-semibold text-foreground">{label}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className={cn(
          "text-2xl font-bold",
          color === "primary" && "text-primary",
          color === "secondary" && "text-blue-600",
          color === "accent" && "text-green-600"
        )}>
          {value >= 60 ? `${value / 60}m` : `${value}s`}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {options.map((option) => (
          <Button
            key={option}
            variant={value === option ? "primary" : "outline"}
            className={cn(
              "relative h-12 min-w-0 touch-manipulation text-sm font-medium transition-all",
              value === option && color === "primary" && "bg-primary text-primary-foreground",
              value === option && color === "secondary" && "bg-blue-600 text-white hover:bg-blue-700",
              value === option && color === "accent" && "bg-green-600 text-white hover:bg-green-700"
            )}
            onClick={() => onChange(option)}
            disabled={isSaving}
          >
            {isSaving && value === option ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              option >= 60 ? `${option / 60}m` : `${option}s`
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}

interface ReviewStepProps {
  config: CircuitConfig;
  repeatRounds: boolean;
}

export function ReviewStep({ config, repeatRounds }: ReviewStepProps) {
  // Calculate total rounds including repeats/sets
  let totalRounds = 0;
  if (config.config.roundTemplates && config.config.roundTemplates.length > 0) {
    config.config.roundTemplates.forEach((rt) => {
      if (rt.template.type === 'circuit_round' || rt.template.type === 'stations_round') {
        totalRounds += (rt.template as any).repeatTimes || 1;
      } else {
        totalRounds += 1; // AMRAP rounds don't have repeats
      }
    });
  } else {
    // Fallback for legacy configs
    totalRounds = repeatRounds ? config.config.rounds * 2 : config.config.rounds;
  }
  
  const totalExercises = totalRounds * config.config.exercisesPerRound;
  const totalWorkTime = totalExercises * config.config.workDuration;
  const totalRestTime = 
    (totalExercises - totalRounds) * config.config.restDuration + 
    (totalRounds - 1) * config.config.restBetweenRounds;
  
  // Add warmup time if enabled
  const warmupTime = config.config.warmup?.enabled
    ? config.config.warmup.duration
    : 0;
  
  const totalTime = totalWorkTime + totalRestTime + warmupTime;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-primary/10 p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Time</p>
          <p className="text-2xl font-bold text-primary">{formatTime(totalTime)}</p>
        </div>
        <div className="rounded-xl bg-green-500/10 p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Rounds</p>
          <p className="text-2xl font-bold text-green-600">{totalRounds}</p>
        </div>
      </div>

      {/* Round Types Display */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-600 dark:text-white">Round Types</h4>
        <div className="space-y-2">
          {/* Warmup */}
          {config.config.warmup?.enabled && (
            <div className="rounded-lg bg-orange-50/20 dark:bg-orange-500/10 border border-orange-200/30 dark:border-orange-500/20 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Warm-up</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-700 dark:bg-orange-500/30 dark:text-orange-300">
                  WARM-UP
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Exercises</span>
                  <span className="font-medium">{config.config.warmup.exercisesCount || 6}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Duration</span>
                  <span className="font-medium">{formatTime(config.config.warmup.duration || 300)}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Regular Rounds */}
          {config.config.roundTemplates && config.config.roundTemplates.map((rt) => {
            const isCircuit = rt.template.type === 'circuit_round';
            const isStations = rt.template.type === 'stations_round';
            const isAMRAP = rt.template.type === 'amrap_round';
            
            return (
              <div key={rt.roundNumber} className={cn(
                "rounded-lg p-3 space-y-3 border",
                isCircuit && "bg-blue-50/20 dark:bg-blue-500/10 border-blue-200/30 dark:border-blue-500/20",
                isStations && "bg-green-50/20 dark:bg-green-500/10 border-green-200/30 dark:border-green-500/20",
                isAMRAP && "bg-purple-50/20 dark:bg-purple-500/10 border-purple-200/30 dark:border-purple-500/20"
              )}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Round {rt.roundNumber}</span>
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    isCircuit && "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300",
                    isStations && "bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-300",
                    isAMRAP && "bg-purple-500/20 text-purple-700 dark:bg-purple-500/30 dark:text-purple-300"
                  )}>
                    {isCircuit && 'CIRCUIT'}
                    {isStations && 'STATIONS'}
                    {isAMRAP && 'AMRAP'}
                  </span>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>Exercises</span>
                    <span className="font-medium">{rt.template.exercisesPerRound || 6}</span>
                  </div>
                  
                  {(rt.template.type === 'circuit_round' || rt.template.type === 'stations_round') && (
                    <>
                      <div className="flex justify-between text-gray-600 dark:text-gray-300">
                        <span>Work time</span>
                        <span className="font-medium">{(rt.template as any).workDuration || 45}s</span>
                      </div>
                      <div className="flex justify-between text-gray-600 dark:text-gray-300">
                        <span>Rest time</span>
                        <span className="font-medium">{(rt.template as any).restDuration || 15}s</span>
                      </div>
                      {((rt.template as any).repeatTimes || 1) > 1 && (
                        <div className="flex justify-between text-gray-600 dark:text-gray-300">
                          <span>Sets</span>
                          <span className="font-medium">{(rt.template as any).repeatTimes}x</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {rt.template.type === 'amrap_round' && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Total time</span>
                      <span className="font-medium">{formatTime((rt.template as any).totalDuration || 300)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ready Message */}
      <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-center">
        <p className="text-sm text-green-700 font-medium">
          ✓ Configuration complete! Tap confirm to continue.
        </p>
      </div>
    </div>
  );
}

interface SpotifyStepProps {
  deviceId: string | null;
  deviceName: string | null;
  onDeviceSelect: (deviceId: string | null, deviceName: string | null) => void | Promise<void>;
}

export function SpotifyStep({ deviceId, deviceName, onDeviceSelect }: SpotifyStepProps) {
  const [devices, setDevices] = useState<Array<{ id: string; name: string; type: string; is_active: boolean }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const trpc = useTRPC();
  
  // Use TRPC query for devices (public endpoint)
  const devicesQuery = useQuery({
    ...trpc.spotify.getDevicesPublic.queryOptions(),
    enabled: false, // Manual trigger
  });

  const loadDevices = async () => {
    setError(null);
    const result = await devicesQuery.refetch();
    
    if (result.error) {
      setError('Failed to connect to Spotify. Please try again.');
    } else if (result.data) {
      if (result.data.devices.length === 0) {
        setError('No Spotify devices found. Make sure Spotify is running on your device.');
      } else {
        setDevices(result.data.devices);
        setError(null);
      }
    }
  };

  const handleDisconnect = async () => {
    setIsSaving(true);
    try {
      await onDeviceSelect(null, null);
      setDevices([]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1 text-foreground">Music Setup</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Connect Spotify to sync music with your workout
        </p>
      </div>

      {!deviceId ? (
        <>
          {/* Not Connected State */}
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium">Spotify not connected</p>
                <p className="text-sm text-muted-foreground">
                  Music will enhance your workout experience
                </p>
              </div>
            </div>

            <Button
              onClick={loadDevices}
              disabled={devicesQuery.isLoading}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white"
            >
              {devicesQuery.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finding devices...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Connect Spotify
                </>
              )}
            </Button>

            {/* Device List */}
            {!devicesQuery.isLoading && devices.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Select a device:</p>
                {devices.map((device) => (
                  <button
                    key={device.id}
                    onClick={async () => {
                      console.log('[SpotifyStep] Device selected:', { id: device.id, name: device.name });
                      setIsSaving(true);
                      try {
                        await onDeviceSelect(device.id, device.name);
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving}
                    className="w-full p-4 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{device.name}</p>
                        <p className="text-sm text-muted-foreground">{device.type}</p>
                      </div>
                      {device.is_active && (
                        <div className="flex items-center text-green-600">
                          <div className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse" />
                          <span className="text-sm">Active</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Skip Option */}
            <div className="text-center pt-2">
              <button
                onClick={() => onDeviceSelect(null, null)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Continue without music →
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Connected State */}
          <div className="space-y-4">
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-green-700 font-medium">Connected to</p>
                    <p className="font-semibold text-lg">{deviceName}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isSaving}
                  className="text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    'Disconnect'
                  )}
                </Button>
              </div>
            </div>


            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Note:</span> Music will start automatically when the workout begins. 
                The TV will control playback timing to sync with exercise intervals.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}