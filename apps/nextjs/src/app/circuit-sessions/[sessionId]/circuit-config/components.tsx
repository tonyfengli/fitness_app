"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Loader2Icon as Loader2, ChevronRightIcon as ChevronRight, ChevronLeftIcon as ChevronLeft } from "@acme/ui-shared";
import { cn } from "@acme/ui-shared";
import type { CircuitConfig, RoundConfig } from "@acme/db";
import { useTRPC } from "~/trpc/react";

interface WorkoutTypeStepProps {
  onSelect: (type: 'custom' | 'template') => void;
}

interface CategorySelectionStepProps {
  onSelectCategory: (category: string) => void;
}

interface TemplateSelectionStepProps {
  category: string;
  onSelectTemplate: (template: any) => void;
}

// Hardcoded business ID for now
const BUSINESS_ID = 'd33b41e2-f700-4a08-9489-cb6e3daa7f20';

// World-class Duration Input Component
interface DurationInputProps {
  value: number; // Duration in seconds
  onChange: (seconds: number) => void;
  label?: string;
  presets?: { label: string; value: number; description?: string }[];
  allowCustom?: boolean;
  className?: string;
  disabled?: boolean;
}

function DurationInput({ 
  value, 
  onChange, 
  label,
  presets,
  allowCustom = true,
  className,
  disabled = false
}: DurationInputProps) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(Math.floor(value / 60));
  const [customSeconds, setCustomSeconds] = useState(value % 60);

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (secs === 0) return `${mins}m`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle preset selection
  const handlePresetSelect = (presetValue: number) => {
    onChange(presetValue);
    setIsCustomMode(false);
    setCustomMinutes(Math.floor(presetValue / 60));
    setCustomSeconds(presetValue % 60);
  };

  // Handle custom time changes
  const handleCustomChange = (minutes: number, seconds: number) => {
    const clampedMinutes = Math.max(0, Math.min(59, minutes));
    const clampedSeconds = Math.max(0, Math.min(59, seconds));
    
    setCustomMinutes(clampedMinutes);
    setCustomSeconds(clampedSeconds);
    
    const totalSeconds = clampedMinutes * 60 + clampedSeconds;
    onChange(totalSeconds);
  };

  // Check if current value matches any preset
  const matchingPreset = presets?.find(p => p.value === value);
  const isPresetValue = !!matchingPreset && !isCustomMode;

  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {label}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {formatDuration(value)}
          </span>
        </div>
      )}
      
      {/* Preset Options */}
      {presets && presets.length > 0 && (
        <div className="grid grid-cols-5 gap-1.5">
          {presets.map((preset) => {
            const isSelected = value === preset.value && !isCustomMode;
            return (
              <Button
                key={preset.value}
                variant={isSelected ? "default" : "outline"}
                className={cn(
                  "relative h-9 min-w-0 text-xs transition-all duration-200",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  isSelected && "ring-2 ring-offset-1 ring-primary shadow-lg",
                  !isSelected && "hover:border-primary/50",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => handlePresetSelect(preset.value)}
                disabled={disabled}
                size="sm"
                title={preset.description}
              >
                <span className={cn(
                  "transition-all duration-200",
                  isSelected && "font-bold scale-105"
                )}>
                  {preset.label}
                </span>
                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
                )}
              </Button>
            );
          })}
        </div>
      )}

      {/* Custom Time Input */}
      {allowCustom && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Custom Time
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setIsCustomMode(!isCustomMode)}
              disabled={disabled}
            >
              {isCustomMode ? "Hide" : "Show"}
            </Button>
          </div>
          
          {isCustomMode && (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={customMinutes}
                  onChange={(e) => handleCustomChange(parseInt(e.target.value) || 0, customSeconds)}
                  className={cn(
                    "w-12 text-center text-sm font-mono bg-white dark:bg-gray-700",
                    "border rounded px-1 py-1 focus:ring-2 focus:ring-primary focus:border-transparent",
                    "transition-all duration-200"
                  )}
                  min="0"
                  max="59"
                  disabled={disabled}
                />
                <span className="text-xs text-gray-500 font-medium">m</span>
              </div>
              
              <div className="text-gray-400 font-bold">:</div>
              
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={customSeconds}
                  onChange={(e) => handleCustomChange(customMinutes, parseInt(e.target.value) || 0)}
                  className={cn(
                    "w-12 text-center text-sm font-mono bg-white dark:bg-gray-700",
                    "border rounded px-1 py-1 focus:ring-2 focus:ring-primary focus:border-transparent",
                    "transition-all duration-200"
                  )}
                  min="0"
                  max="59"
                  disabled={disabled}
                />
                <span className="text-xs text-gray-500 font-medium">s</span>
              </div>
              
              {(customMinutes > 0 || customSeconds > 0) && (
                <div className="ml-auto">
                  <div className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                    = {formatDuration(customMinutes * 60 + customSeconds)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Smart Suggestions */}
      {!isPresetValue && value > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
          <span>Custom: {formatDuration(value)}</span>
        </div>
      )}
    </div>
  );
}

const CATEGORIES = [
  { id: 'morning_sessions', label: 'Morning Sessions' },
  { id: 'evening_sessions', label: 'Evening Sessions' },
  { id: 'mens_fitness_connect', label: "Men's Fitness Connect" },
  { id: 'other', label: 'Other' }
];

export function CategorySelectionStep({ onSelectCategory }: CategorySelectionStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Choose a Template Category</h3>
        
        <div className="space-y-4">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className="w-full p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-left"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                  {category.label}
                </h4>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TemplateSelectionStep({ category, onSelectTemplate }: TemplateSelectionStepProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
  
  // Fetch favorites for selected category - WITHOUT templateConfig for better performance
  const { data: favorites, isLoading } = useQuery({
    ...trpc.trainingSession.getFavoritesByCategory.queryOptions({
      businessId: BUSINESS_ID,
      category: category,
      includeTemplateConfig: false, // Don't fetch heavy templateConfig during listing
    }),
  });

  const handleTemplateSelect = async (favoriteId: string, sessionName: string) => {
    setLoadingTemplateId(favoriteId);
    try {
      // Use fetchQuery to fetch data on-demand
      const data = await queryClient.fetchQuery(
        trpc.trainingSession.getFavoriteTemplateWithExercises.queryOptions({
          favoriteId: favoriteId,
        })
      );
      
      if (data && data.templateConfig) {
        const templateConfig = data.templateConfig as CircuitConfig;
        
        console.log('[TemplateSelectionStep] Template data received:', {
          sessionId: data.session.id,
          sessionName: data.session.name,
          templateConfig: templateConfig,
          roundsCount: data.rounds.length,
          rounds: data.rounds,
          exercisesCount: data.exercises.length,
          workoutId: data.workoutId,
        });
        
        onSelectTemplate({
          id: data.session.id,
          name: data.session.name,
          config: templateConfig?.config || {},
          rounds: data.rounds, // Pass the rounds with exercises for preview
          exercises: data.exercises,
          workoutId: data.workoutId, // Pass the workout ID for template creation
        });
      }
    } catch (error) {
      console.error('Failed to fetch template config:', error);
    } finally {
      setLoadingTemplateId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const categoryLabel = CATEGORIES.find(c => c.id === category)?.label || '';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
          {categoryLabel}
        </h3>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : favorites && favorites.length > 0 ? (
          <div className="space-y-4">
            {favorites.map((favorite) => (
              <button
                key={favorite.id}
                onClick={() => handleTemplateSelect(favorite.id, favorite.trainingSession.name)}
                disabled={loadingTemplateId !== null}
                className="w-full p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                      {favorite.trainingSession.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Created {formatDate(favorite.trainingSession.createdAt)}
                    </p>
                  </div>
                  {loadingTemplateId === favorite.id && (
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No templates available in this category
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkoutTypeStep({ onSelect }: WorkoutTypeStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Choose Your Workout Type</h3>
        
        <div className="space-y-4">
          <button
            onClick={() => onSelect('custom')}
            className="w-full p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-left"
          >
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                  Build Custom Workout
                </h4>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </div>
          </button>
          
          <button
            onClick={() => onSelect('template')}
            className="w-full p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-left"
          >
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                  Use Workout Template
                </h4>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

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
  isSaving: boolean;
}

export function RoundTypesStep({
  rounds,
  roundTemplates,
  onRoundTemplatesChange,
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
  isSaving: boolean;
}

export function PerRoundConfigStep({
  rounds,
  roundTemplates,
  onRoundTemplatesChange,
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

  const handleTimingChange = (roundNumber: number, field: 'workDuration' | 'restDuration' | 'totalDuration' | 'repeatTimes' | 'restBetweenSets', value: number) => {
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

  // Dynamic exercise options based on round type
  const getExerciseOptions = (roundType: string) => {
    switch (roundType) {
      case 'circuit_round':
      case 'amrap_round':
        return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // Allow 1 exercise for circuit and AMRAP rounds
      case 'stations_round':
        return [2, 3, 4, 5, 6, 7, 8, 9, 10]; // Stations require at least 2 exercises
      default:
        return [2, 3, 4, 5, 6, 7, 8, 9, 10];
    }
  };
  // World-class preset configurations with descriptions for better UX
  const workPresets = [
    { label: '20s', value: 20, description: 'Quick bursts - High intensity' },
    { label: '30s', value: 30, description: 'Standard cardio intervals' },
    { label: '40s', value: 40, description: 'Strength-cardio balance' },
    { label: '45s', value: 45, description: 'Most popular choice' },
    { label: '60s', value: 60, description: 'Traditional strength training' },
    { label: '90s', value: 90, description: 'Endurance focus' },
    { label: '2m', value: 120, description: 'Extended work capacity' },
    { label: '3m', value: 180, description: 'Aerobic conditioning' },
    { label: '4m', value: 240, description: 'Long endurance sets' },
  ];

  const restPresets = [
    { label: 'None', value: 0, description: 'Continuous movement' },
    { label: '10s', value: 10, description: 'Active recovery' },
    { label: '15s', value: 15, description: 'Standard circuit rest' },
    { label: '20s', value: 20, description: 'Moderate recovery' },
    { label: '30s', value: 30, description: 'Extended recovery' },
    { label: '45s', value: 45, description: 'Strength training rest' },
    { label: '60s', value: 60, description: 'Full recovery' },
  ];

  const setRestPresets = [
    { label: '15s', value: 15, description: 'Quick transition' },
    { label: '30s', value: 30, description: 'Standard set break' },
    { label: '45s', value: 45, description: 'Moderate recovery' },
    { label: '1m', value: 60, description: 'Standard rest' },
    { label: '90s', value: 90, description: 'Extended recovery' },
    { label: '2m', value: 120, description: 'Full recovery' },
  ];

  const amrapPresets = [
    { label: '2m', value: 120, description: 'Sprint rounds' },
    { label: '3m', value: 180, description: 'Quick AMRAP' },
    { label: '4m', value: 240, description: 'Standard duration' },
    { label: '5m', value: 300, description: 'Classic AMRAP' },
    { label: '6m', value: 360, description: 'Extended challenge' },
  ];
  
  // Recommended values based on fitness science and round type
  const getRecommendedExercises = (roundType: string) => {
    switch (roundType) {
      case 'circuit_round':
        return 6; // Traditional circuit recommendation
      case 'amrap_round':
        return 3; // Fewer exercises for AMRAP to allow for more rounds
      case 'stations_round':
        return 6; // Multiple stations work well
      default:
        return 6;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1 text-foreground">Round Configuration</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure exercises and timing for each round
        </p>
      </div>


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
                <div className="grid grid-cols-5 gap-1">
                  {getExerciseOptions(round.template.type).map((option) => {
                    const isSelected = round.template.exercisesPerRound === option;
                    const isRecommended = option === getRecommendedExercises(round.template.type);
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

              {/* World-Class Timing Configuration */}
              {(isCircuit || isStations) && (
                <div className="space-y-5">
                  {/* Work Duration */}
                  <DurationInput
                    label="WORK TIME"
                    value={(round.template as any).workDuration}
                    onChange={(value) => handleTimingChange(round.roundNumber, 'workDuration', value)}
                    presets={workPresets}
                    disabled={isSaving}
                  />
                  
                  {/* Rest Duration */}
                  <DurationInput
                    label="REST TIME"
                    value={(round.template as any).restDuration}
                    onChange={(value) => handleTimingChange(round.roundNumber, 'restDuration', value)}
                    presets={restPresets}
                    disabled={isSaving}
                  />
                  
                  {/* Repeat Times - Keep as button grid for simplicity */}
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">REPEAT</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((option) => {
                        const isSelected = (round.template as any).repeatTimes === option || (!round.template.repeatTimes && option === 1);
                        return (
                          <Button
                            key={option}
                            variant={isSelected ? "default" : "outline"}
                            className={cn(
                              "relative h-9 min-w-0 text-xs transition-all duration-200",
                              "hover:scale-[1.02] active:scale-[0.98]",
                              isSelected && "ring-2 ring-offset-1 ring-primary shadow-lg",
                              !isSelected && "hover:border-primary/50",
                              isSaving && "opacity-50 cursor-not-allowed"
                            )}
                            onClick={() => handleTimingChange(round.roundNumber, 'repeatTimes', option)}
                            disabled={isSaving}
                            size="sm"
                          >
                            <span className={cn(
                              "transition-all duration-200",
                              isSelected && "font-bold scale-105"
                            )}>
                              {option}x
                            </span>
                            {isSelected && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Rest Between Sets - Only show if repeatTimes > 1 */}
                  {((round.template as any).repeatTimes || 1) > 1 && (
                    <DurationInput
                      label="REST BETWEEN SETS"
                      value={(round.template as any).restBetweenSets || 30}
                      onChange={(value) => handleTimingChange(round.roundNumber, 'restBetweenSets', value)}
                      presets={setRestPresets}
                      disabled={isSaving}
                    />
                  )}
                </div>
              )}
              
              {/* AMRAP Total Duration */}
              {isAMRAP && (
                <DurationInput
                  label="TOTAL TIME"
                  value={(round.template as any).totalDuration}
                  onChange={(value) => handleTimingChange(round.roundNumber, 'totalDuration', value)}
                  presets={amrapPresets}
                  disabled={isSaving}
                />
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
  templateData?: {
    rounds: any[];
    exercises: any[];
  } | null;
}

export function ReviewStep({ config, repeatRounds, templateData }: ReviewStepProps) {
  
  // Add comprehensive logging for template data
  console.log('[ReviewStep] Component rendered with data:', {
    config: config.config,
    repeatRounds,
    templateData,
    sourceWorkoutId: config.config.sourceWorkoutId,
    roundTemplates: config.config.roundTemplates,
  });

  // Log detailed template data if available
  if (templateData) {
    console.log('[ReviewStep] Template Data Details:', {
      roundsCount: templateData.rounds?.length || 0,
      exercisesCount: templateData.exercises?.length || 0,
      rounds: templateData.rounds?.map((round, idx) => ({
        index: idx,
        roundName: round.roundName,
        roundType: round.roundType,
        exercisesInRound: round.exercises?.length || 0,
        exercises: round.exercises?.map((ex: any) => ({
          name: ex.exerciseName,
          orderIndex: ex.orderIndex,
          stationIndex: ex.stationIndex,
          exerciseId: ex.exerciseId,
        }))
      })),
      allExercises: templateData.exercises?.map((ex: any) => ({
        id: ex.id,
        name: ex.exerciseName,
        orderIndex: ex.orderIndex,
        stationIndex: ex.stationIndex,
        roundName: ex.roundName || ex.groupName,
      }))
    });
  }
  
  // Calculate total workout time by summing all rounds + rest between rounds
  let totalTime = 0;
  let totalRounds = 0;
  
  if (config.config.roundTemplates && config.config.roundTemplates.length > 0) {
    // For custom workflows, generate preview data
    const previewRounds = templateData?.rounds || config.config.roundTemplates?.map((rt) => ({
      roundName: `Round ${rt.roundNumber}`,
      roundType: rt.template.type,
      exercises: Array.from({ length: rt.template.exercisesPerRound }, (_, i) => ({
        exerciseName: `Exercise ${i + 1}`,
        orderIndex: i + 1,
      })),
    })) || [];
    
    // Calculate time for each round
    config.config.roundTemplates.forEach((rt, index) => {
      const roundTemplate = rt.template;
      const round = previewRounds[index];
      
      if (roundTemplate.type === 'amrap_round') {
        // AMRAP rounds use fixed duration
        totalTime += (roundTemplate as any).totalDuration || 300;
        totalRounds += 1;
      } else if (roundTemplate.type === 'circuit_round' || roundTemplate.type === 'stations_round') {
        // Calculate units (exercises for circuit, unique stations for stations)
        let unitsCount = roundTemplate.exercisesPerRound;
        
        if (roundTemplate.type === 'stations_round' && round && round.exercises) {
          console.log(`[ReviewStep] Round ${index + 1} - TOTAL TIME CALC - Station analysis START:`, {
            roundType: roundTemplate.type,
            roundIndex: index,
            templateExercisesPerRound: roundTemplate.exercisesPerRound,
            actualExercises: round.exercises.length,
            exerciseData: round.exercises.map((ex: any, idx: number) => ({
              index: idx,
              name: ex.exerciseName,
              orderIndex: ex.orderIndex,
              stationIndex: ex.stationIndex,
              fallbackUsed: ex.stationIndex || ex.orderIndex
            }))
          });
          
          // FIX: Count unique stations by orderIndex (each orderIndex = one station)
          const uniqueStations = new Set(round.exercises.map((ex: any) => ex.orderIndex));
          unitsCount = uniqueStations.size || roundTemplate.exercisesPerRound;
          
          // Alternative counting methods for comparison
          const uniqueByOrderIndex = new Set(round.exercises.map((ex: any) => ex.orderIndex));
          const uniqueByStationIndex = new Set(round.exercises.map((ex: any) => ex.stationIndex));
          
          console.log(`[ReviewStep] Round ${index + 1} - TOTAL TIME CALC - Station counting results:`, {
            currentLogic_result: unitsCount,
            currentLogic_uniqueStations: Array.from(uniqueStations).sort(),
            currentLogic_beforeFallback: uniqueStations.size,
            fallbackToTemplate: uniqueStations.size === 0 ? roundTemplate.exercisesPerRound : 'not used',
            alternativeA_orderIndex: Array.from(uniqueByOrderIndex).sort(),
            alternativeA_count: uniqueByOrderIndex.size,
            alternativeB_stationIndex: Array.from(uniqueByStationIndex).sort(),
            alternativeB_count: uniqueByStationIndex.size,
            recommendedLogic: 'Use uniqueByOrderIndex.size for stations'
          });
        }
        
        const workTime = (roundTemplate as any).workDuration || 0;
        const restTime = (roundTemplate as any).restDuration || 0;
        const sets = (roundTemplate as any).repeatTimes || 1;
        const restBetweenSets = (roundTemplate as any).restBetweenSets || 0;
        
        // Time for one set: (units * work) + (rest between units)
        const timePerSet = (unitsCount * workTime) + ((unitsCount - 1) * restTime);
        // Total time for this round: (timePerSet * sets) + (restBetweenSets * (sets - 1))
        const roundTime = (timePerSet * sets) + (restBetweenSets * (sets - 1));
        
        totalTime += roundTime;
        totalRounds += sets;
      }
      
      // Add rest between rounds (except after last round)
      if (index < config.config.roundTemplates.length - 1 && config.config.restBetweenRounds > 0) {
        totalTime += config.config.restBetweenRounds;
      }
    });
  } else {
    // Fallback for legacy configs
    totalRounds = repeatRounds ? config.config.rounds * 2 : config.config.rounds;
    const totalExercises = totalRounds * config.config.exercisesPerRound;
    const totalWorkTime = totalExercises * config.config.workDuration;
    const totalRestTime = 
      (totalExercises - totalRounds) * config.config.restDuration + 
      (totalRounds - 1) * config.config.restBetweenRounds;
    totalTime = totalWorkTime + totalRestTime;
  }
  
  console.log('[ReviewStep] Total time calculation:', {
    totalTime,
    totalRounds,
    totalMinutes: Math.floor(totalTime / 60),
  });

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


      {/* Unified Template Preview - Card-based design */}
      {/* Generate preview data for custom workflows if no templateData */}
      {(templateData || config.config.roundTemplates) && (() => {
        // For custom workflows, generate rounds from config
        const previewData = templateData || {
          rounds: config.config.roundTemplates?.map((rt, index) => ({
            roundName: `Round ${rt.roundNumber}`,
            roundType: rt.template.type,
            exercises: Array.from({ length: rt.template.exercisesPerRound }, (_, i) => ({
              exerciseName: `Exercise ${i + 1}`,
              orderIndex: i + 1,
            })),
          })) || [],
          exercises: [],
        };
        
        return previewData.rounds.length > 0 && (
        <div className="space-y-4">
          {/* Workout Overview Header */}
          <div className="text-center space-y-1 pb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Workout Overview</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {totalRounds} {totalRounds === 1 ? 'Round' : 'Rounds'} • {formatTime(totalTime)} Total
            </p>
          </div>

          {/* Round Cards */}
          <div className="space-y-4">
            {previewData.rounds.map((round, roundIndex) => {
              
              // Find the round template config for this round
              // Round name is like "Round 1", so we extract the number
              const roundNumber = parseInt(round.roundName.replace('Round ', ''), 10);
              const roundConfig = config.config.roundTemplates?.find(
                (rt) => rt.roundNumber === roundNumber
              );
              
              
              const roundTemplate = roundConfig?.template;
              const isCircuit = round.roundType === 'circuit_round';
              const isStations = round.roundType === 'stations_round';
              const isAMRAP = round.roundType === 'amrap_round';
              
              return (
                <div 
                  key={roundIndex} 
                  className={cn(
                    "rounded-2xl border-2 overflow-hidden shadow-sm transition-all",
                    isCircuit && "border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20",
                    isStations && "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20",
                    isAMRAP && "border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/20"
                  )}
                >
                  {/* Card Header */}
                  <div className={cn(
                    "px-5 py-4 border-b",
                    isCircuit && "bg-blue-100/50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
                    isStations && "bg-green-100/50 dark:bg-green-900/30 border-green-200 dark:border-green-800",
                    isAMRAP && "bg-purple-100/50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Round Number Badge */}
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg",
                          isCircuit && "bg-blue-600 text-white",
                          isStations && "bg-green-600 text-white",
                          isAMRAP && "bg-purple-600 text-white"
                        )}>
                          {roundIndex + 1}
                        </div>
                        
                        <div>
                          <h4 className="font-semibold text-base text-gray-900 dark:text-white">
                            {round.roundName}
                          </h4>
                          
                          {/* Timing Info */}
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full",
                              isCircuit && "bg-blue-200 text-blue-800 dark:bg-blue-800/50 dark:text-blue-200",
                              isStations && "bg-green-200 text-green-800 dark:bg-green-800/50 dark:text-green-200",
                              isAMRAP && "bg-purple-200 text-purple-800 dark:bg-purple-800/50 dark:text-purple-200"
                            )}>
                              {isCircuit && 'Circuit'}
                              {isStations && 'Stations'}
                              {isAMRAP && 'AMRAP'}
                            </span>
                            
                            {/* Round total time */}
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {(() => {
                                if (isAMRAP && roundTemplate) {
                                  return formatTime((roundTemplate as any).totalDuration || 300);
                                } else if ((isCircuit || isStations) && roundTemplate) {
                                  let unitsCount = round.exercises.length;
                                  
                                  // For stations, count unique stations instead of total exercises
                                  if (isStations) {
                                    console.log(`[ReviewStep] Round ${roundIndex + 1} - TIMING CALC - Station analysis START:`, {
                                      roundName: round.roundName,
                                      totalExercises: round.exercises.length,
                                      rawExercises: round.exercises.map((ex: any, idx: number) => ({
                                        index: idx,
                                        exerciseName: ex.exerciseName,
                                        orderIndex: ex.orderIndex,
                                        stationIndex: ex.stationIndex,
                                        fallbackValue: ex.stationIndex || ex.orderIndex,
                                        usedForGrouping: ex.stationIndex || ex.orderIndex
                                      }))
                                    });
                                    
                                    // FIX: Count unique stations by orderIndex (each orderIndex = one station)
                                    const uniqueStations = new Set(round.exercises.map((ex: any) => ex.orderIndex));
                                    unitsCount = uniqueStations.size;
                                    
                                    // Alternative counting methods for comparison
                                    const uniqueByOrderIndex = new Set(round.exercises.map((ex: any) => ex.orderIndex));
                                    const uniqueByStationIndex = new Set(round.exercises.map((ex: any) => ex.stationIndex));
                                    
                                    console.log(`[ReviewStep] Round ${roundIndex + 1} - TIMING CALC - Station counting comparison:`, {
                                      currentLogic_stationOrOrder: Array.from(uniqueStations).sort(),
                                      currentLogic_count: unitsCount,
                                      alternativeA_orderIndex: Array.from(uniqueByOrderIndex).sort(),
                                      alternativeA_count: uniqueByOrderIndex.size,
                                      alternativeB_stationIndex: Array.from(uniqueByStationIndex).sort(),
                                      alternativeB_count: uniqueByStationIndex.size,
                                      templateExercisesPerRound: roundTemplate?.exercisesPerRound,
                                      exerciseGrouping: round.exercises.reduce((acc: any, ex: any) => {
                                        const key = `orderIndex_${ex.orderIndex}`;
                                        if (!acc[key]) acc[key] = [];
                                        acc[key].push({
                                          name: ex.exerciseName,
                                          stationIndex: ex.stationIndex
                                        });
                                        return acc;
                                      }, {})
                                    });
                                  }
                                  
                                  const workTime = (roundTemplate as any).workDuration || 0;
                                  const restTime = (roundTemplate as any).restDuration || 0;
                                  const sets = (roundTemplate as any).repeatTimes || 1;
                                  const restBetweenSets = (roundTemplate as any).restBetweenSets || 0;
                                  
                                  // Time for one set: units * (work + rest) - last rest
                                  const timePerSet = unitsCount * (workTime + restTime) - restTime;
                                  // Total time: (timePerSet * sets) + (restBetweenSets * (sets - 1))
                                  const totalRoundTime = (timePerSet * sets) + (restBetweenSets * (sets - 1));
                                  
                                  console.log(`[ReviewStep] Round ${roundIndex + 1} - TIMING CALC - Final calculation:`, {
                                    roundType: isStations ? 'stations' : 'circuit',
                                    totalExercises: round.exercises.length,
                                    calculatedUnitsCount: unitsCount,
                                    workTime,
                                    restTime,
                                    sets,
                                    restBetweenSets,
                                    formula: `(${unitsCount} * (${workTime} + ${restTime}) - ${restTime}) * ${sets} + (${restBetweenSets} * (${sets} - 1))`,
                                    timePerSet,
                                    totalRoundTime,
                                    formattedTime: formatTime(totalRoundTime),
                                    stationCountingMethod: isStations ? 'stationIndex || orderIndex' : 'N/A'
                                  });
                                  
                                  return formatTime(totalRoundTime);
                                }
                                return '';
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Repeat Indicator */}
                      {roundTemplate && ((roundTemplate as any).repeatTimes || 1) > 1 && (
                        <div className={cn(
                          "px-3 py-1.5 rounded-lg font-bold text-sm",
                          isCircuit && "bg-blue-200 text-blue-800 dark:bg-blue-800/50 dark:text-blue-200",
                          isStations && "bg-green-200 text-green-800 dark:bg-green-800/50 dark:text-green-200",
                          isAMRAP && "bg-purple-200 text-purple-800 dark:bg-purple-800/50 dark:text-purple-200"
                        )}>
                          {(roundTemplate as any).repeatTimes}×
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Exercises Section */}
                  <div className="p-5 space-y-3">
                    {/* Timing Summary Box */}
                    {(roundTemplate || config.config.workDuration) && (
                      <div className={cn(
                        "rounded-lg p-3 mb-3 border",
                        isCircuit && "bg-blue-50/50 dark:bg-blue-950/30 border-blue-200/50 dark:border-blue-800/50",
                        isStations && "bg-green-50/50 dark:bg-green-950/30 border-green-200/50 dark:border-green-800/50",
                        isAMRAP && "bg-purple-50/50 dark:bg-purple-950/30 border-purple-200/50 dark:border-purple-800/50"
                      )}>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-4">
                            {(isCircuit || isStations) && (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {roundTemplate ? (roundTemplate as any).workDuration : config.config.workDuration}s work
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {roundTemplate ? (roundTemplate as any).restDuration : config.config.restDuration}s rest
                                  </span>
                                </div>
                              </>
                            )}
                            {isAMRAP && roundTemplate && (
                              <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                  {formatTime((roundTemplate as any).totalDuration || 300)} total
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {isStations ? (
                      // Station-based layout
                      <div className="space-y-3">
                        {round.exercises
                          .filter((exercise: any, index: number) => {
                            // Only show first exercise of each station
                            return index === 0 || round.exercises[index - 1].orderIndex !== exercise.orderIndex;
                          })
                          .map((exercise: any, stationIndex: number) => {
                            // Get all exercises at this station
                            const stationExercises = round.exercises.filter(
                              (ex: any) => ex.orderIndex === exercise.orderIndex
                            );
                            
                            return (
                              <div key={stationIndex} className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 dark:bg-green-500/30 rounded-full flex items-center justify-center">
                                    <span className="text-sm font-bold text-green-700 dark:text-green-400">
                                      S{stationIndex + 1}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <div className="space-y-1">
                                      {stationExercises.map((ex: any, exIndex: number) => (
                                        <div key={exIndex} className="flex items-center justify-between gap-2">
                                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1">
                                            {ex.exerciseName}
                                          </p>
                                          {ex.repsPlanned && (
                                            <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-xs font-medium text-green-700 dark:text-green-400">
                                              {ex.repsPlanned} {ex.repsPlanned === 1 ? 'rep' : 'reps'}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      // Regular exercise layout (Circuit/AMRAP)
                      <div className="grid gap-2">
                        {round.exercises.map((exercise: any, exIndex: number) => (
                          <div 
                            key={exIndex} 
                            className="flex items-center gap-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-gray-200/50 dark:border-gray-700/50"
                          >
                            <div className={cn(
                              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
                              isCircuit && "bg-blue-100 text-blue-700 dark:bg-blue-800/50 dark:text-blue-300",
                              isAMRAP && "bg-purple-100 text-purple-700 dark:bg-purple-800/50 dark:text-purple-300"
                            )}>
                              {exIndex + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                {exercise.exerciseName}
                              </p>
                            </div>
                            {exercise.repsPlanned && (
                              <div className="flex-shrink-0 ml-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
                                  {exercise.repsPlanned} {exercise.repsPlanned === 1 ? 'rep' : 'reps'}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Rest between sets/rounds info */}
                    {roundTemplate && ((roundTemplate as any).repeatTimes || 1) > 1 && (
                      <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                          Rest {(roundTemplate as any).restBetweenSets}s between sets
                        </p>
                      </div>
                    )}
                    {roundIndex < previewData.rounds.length - 1 && config.config.restBetweenRounds > 0 && (
                      <div className={cn(
                        "pt-3",
                        roundTemplate && ((roundTemplate as any).repeatTimes || 1) > 1 ? "" : "mt-4 border-t border-gray-200/50 dark:border-gray-700/50"
                      )}>
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                          Rest {config.config.restBetweenRounds}s before next round
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

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