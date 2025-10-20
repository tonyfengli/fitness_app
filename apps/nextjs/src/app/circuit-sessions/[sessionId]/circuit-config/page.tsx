"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, Button, Loader2Icon as Loader2, ChevronLeftIcon as ChevronLeft, ChevronRightIcon as ChevronRight } from "@acme/ui-shared";
import { toast } from "sonner";
import { useTRPC } from "~/trpc/react";
import { supabase } from "~/lib/supabase/client";
import { useRealtimeCircuitConfig } from "@acme/ui-shared";
import type { CircuitConfig } from "@acme/db";
import { cn } from "@acme/ui-shared";
import { WorkoutTypeStep, CategorySelectionStep, TemplateSelectionStep, RoundsStep, RoundTypesStep, PerRoundConfigStep, ExercisesStep, TimingStep, ReviewStep, SpotifyStep } from "./components";

// TOTAL_STEPS is now dynamic based on workflow type

export default function CircuitConfigPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Local state for circuit configuration
  const [config, setConfig] = useState<CircuitConfig | null>(null);
  const [repeatRounds, setRepeatRounds] = useState(false);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [spotifyDeviceName, setSpotifyDeviceName] = useState<string | null>(null);
  const [workoutType, setWorkoutType] = useState<'custom' | 'template' | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [templateData, setTemplateData] = useState<{ rounds: any[], exercises: any[] } | null>(null);

  // Get TRPC client
  const trpc = useTRPC();

  // Fetch initial circuit configuration using public endpoint
  const { data: initialConfig, isLoading: isLoadingConfig } = useQuery({
    ...trpc.circuitConfig.getPublic.queryOptions({ sessionId }),
    enabled: !!sessionId,
  });

  // Update mutation using public endpoint
  const updateConfigMutation = useMutation(
    trpc.circuitConfig.updatePublic.mutationOptions({
      onSuccess: () => {
        // Remove success toast to avoid UI obstruction
        // Users get immediate visual feedback from the UI updates
      },
      onError: (error: any) => {
        toast.error("Failed to update configuration");
        console.error("Update error:", error);
      },
    })
  );

  // Real-time updates
  useRealtimeCircuitConfig({
    sessionId,
    supabase,
    onConfigUpdate: useCallback((data: any) => {
      setConfig(data.config);
    }, []),
  });

  // Initialize config from query result
  useEffect(() => {
    if (initialConfig) {
      // Ensure roundTemplates have required timing fields
      const normalizedConfig = {
        ...initialConfig,
        config: {
          ...initialConfig.config,
          roundTemplates: initialConfig.config.roundTemplates?.map(rt => {
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
          }) || []
        }
      };
      
      setConfig(normalizedConfig);
      setRepeatRounds(initialConfig.config.repeatRounds || false);
      setSpotifyDeviceId(initialConfig.config.spotifyDeviceId || null);
      setSpotifyDeviceName(initialConfig.config.spotifyDeviceName || null);
      setIsLoading(false);
    }
  }, [initialConfig]);

  // Helper function to update config and save
  const updateConfig = async (updates: Partial<CircuitConfig['config']>) => {
    if (!config) return;

    setIsSaving(true);
    const newConfig = { ...config, config: { ...config.config, ...updates } };
    
    // Optimistic update
    setConfig(newConfig);

    try {
      const mutationPayload = {
        sessionId,
        config: updates,
      };
      
      const result = await updateConfigMutation.mutateAsync(mutationPayload);
      return result;
    } catch (error) {
      console.error('[CircuitConfig] Mutation error:', error);
      // Revert on error
      setConfig(config);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = (selectedWorkoutType?: 'custom' | 'template') => {
    // Use the passed workout type or fall back to state
    const currentWorkoutType = selectedWorkoutType || workoutType;
    
    // Handle template flow navigation differently
    if (currentWorkoutType === 'template') {
      if (currentStep === 1) {
        setCurrentStep(2); // Go to category selection
      } else if (currentStep === 2) {
        setCurrentStep(3); // Go to template selection
      } else if (currentStep === 3) {
        setCurrentStep(5); // Skip to review after template selection
      } else if (currentStep === 5) {
        setCurrentStep(6); // Go to music
      }
    } else {
      // Normal flow for custom workout - skip step 2 and 3
      if (currentStep === 1) {
        setCurrentStep(4); // Skip to rounds (skip category/template steps)
      } else if (currentStep < (workoutType === 'custom' ? 8 : 6)) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    // Handle template flow back navigation
    if (workoutType === 'template') {
      if (currentStep === 2) {
        setCurrentStep(1); // Back to workout type selection
      } else if (currentStep === 3) {
        setCurrentStep(2); // Back to category selection
      } else if (currentStep === 5) {
        setCurrentStep(3); // Back to template selection
      } else if (currentStep === 6) {
        setCurrentStep(5); // Back to review
      }
    } else {
      // Normal back navigation for custom
      if (currentStep === 4) {
        setCurrentStep(1); // Back to workout type from rounds
      } else if (currentStep > 1) {
        setCurrentStep(currentStep - 1);
      }
    }
  };

  const handleComplete = () => {
    toast.success("Circuit configuration saved!");
    // Navigate to circuit workout overview
    router.push(`/circuit-workout-overview?sessionId=${sessionId}`);
  };

  if (isLoading || isLoadingConfig) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>No configuration found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Fixed Header with Navigation */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b">
        <div className="mx-auto max-w-md">
          {/* Top Navigation Row */}
          <div className="flex items-center justify-between p-4 pb-2">
            {currentStep > 1 ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded-md"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="text-sm">Back</span>
              </button>
            ) : (
              <button
                onClick={() => router.push(`/circuit-sessions/${sessionId}`)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded-md"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="text-sm">Back</span>
              </button>
            )}
            
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-white">
                {workoutType === 'template' && currentStep === 2 && "Step 1 of 4"}
                {workoutType === 'template' && currentStep === 3 && "Step 2 of 4"}
                {workoutType === 'template' && currentStep === 5 && "Step 3 of 4"}
                {workoutType === 'template' && currentStep === 6 && "Step 4 of 4"}
                {workoutType === 'custom' && currentStep === 4 && "Step 1 of 5"}
                {workoutType === 'custom' && currentStep === 5 && "Step 2 of 5"}
                {workoutType === 'custom' && currentStep === 6 && "Step 3 of 5"}
                {workoutType === 'custom' && currentStep === 7 && "Step 4 of 5"}
                {workoutType === 'custom' && currentStep === 8 && "Step 5 of 5"}
                {currentStep === 1 && ""}
              </p>
              <h1 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {currentStep === 1 && "Choose Your Workout Type"}
                {currentStep === 2 && "Category"}
                {currentStep === 3 && "Templates"}
                {currentStep === 4 && "Rounds"}
                {currentStep === 5 && (workoutType === 'custom' ? "Round Types" : "Review")}
                {currentStep === 6 && (workoutType === 'custom' ? "Per-Round Config" : "Music")}
                {currentStep === 7 && workoutType === 'custom' && "Review"}
                {currentStep === 8 && workoutType === 'custom' && "Music"}
              </h1>
            </div>
            
            {currentStep === 1 ? (
              <div className="w-20" />
            ) : currentStep < (workoutType === 'custom' ? 8 : 6) ? (
              <Button
                size="sm"
                onClick={handleNext}
                className="flex items-center gap-1"
              >
                <span className="text-sm">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleComplete}
                className="bg-green-600 hover:bg-green-700"
              >
                Confirm
              </Button>
            )}
          </div>

          {/* Progress indicator - only show after workout type is selected */}
          {workoutType && (
            <div className="px-4 pb-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((step) => {
                  let isActive = false;
                  
                  if (workoutType === 'template') {
                    // Template flow: 2, 3, 5, 6 (4 steps total)
                    if (step === 1 && currentStep >= 2) isActive = true;
                    if (step === 2 && currentStep >= 3) isActive = true;
                    if (step === 3 && currentStep >= 5) isActive = true;
                    if (step === 4 && currentStep >= 6) isActive = true;
                    // Hide step 5 for template workflow
                    if (step === 5) return null;
                  } else if (workoutType === 'custom') {
                    // Custom flow: 4, 5, 6, 7, 8 (5 steps total)
                    if (step === 1 && currentStep >= 4) isActive = true;
                    if (step === 2 && currentStep >= 5) isActive = true;
                    if (step === 3 && currentStep >= 6) isActive = true;
                    if (step === 4 && currentStep >= 7) isActive = true;
                    if (step === 5 && currentStep >= 8) isActive = true;
                  }
                  
                  return (
                    <div
                      key={step}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-all duration-300",
                        isActive ? "bg-primary" : "bg-muted"
                      )}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content with top padding for fixed header */}
      <div className="pt-24 p-4 pb-8">
        <div className="mx-auto max-w-md">

        {/* Step content */}
        <Card className="p-0 shadow-sm bg-white dark:bg-gray-800">
          <div className="p-6 space-y-6">
            {/* Step 1: Workout Type Selection */}
            {currentStep === 1 && (
              <WorkoutTypeStep
                onSelect={(type) => {
                  setWorkoutType(type);
                  handleNext(type);
                }}
              />
            )}

            {/* Step 2: Category Selection (only for template) */}
            {currentStep === 2 && workoutType === 'template' && (
              <CategorySelectionStep
                onSelectCategory={(category) => {
                  setSelectedCategory(category);
                  handleNext();
                }}
              />
            )}

            {/* Step 3: Template Selection (only for template) */}
            {currentStep === 3 && workoutType === 'template' && selectedCategory && (
              <TemplateSelectionStep
                category={selectedCategory}
                onSelectTemplate={(template) => {
                  console.log('[CircuitConfig] Template selected:', {
                    templateId: template.id,
                    workoutId: template.workoutId,
                    hasWorkoutId: !!template.workoutId,
                    sourceToStore: template.workoutId || template.id,
                  });
                  
                  // Apply template configuration and store source workout ID
                  updateConfig({
                    ...template.config,
                    roundTemplates: template.config.roundTemplates,
                    sourceWorkoutId: template.workoutId || template.id, // Store the source workout ID
                  });
                  // Store template data for review
                  setTemplateData({
                    rounds: template.rounds || [],
                    exercises: template.exercises || [],
                  });
                  handleNext();
                }}
              />
            )}

            {/* Step 4: Rounds (only for custom) */}
            {currentStep === 4 && workoutType === 'custom' && (
              <RoundsStep
                rounds={config.config.rounds}
                repeatRounds={repeatRounds}
                restBetweenRounds={config.config.restBetweenRounds}
                onRoundsChange={(rounds) => updateConfig({ rounds })}
                onRepeatToggle={(value) => {
                  setRepeatRounds(value);
                  updateConfig({ repeatRounds: value });
                }}
                onRoundRestChange={(restBetweenRounds) => updateConfig({ restBetweenRounds })}
                isSaving={isSaving}
              />
            )}

            {/* Step 5: Round Types (only for custom) */}
            {currentStep === 5 && workoutType === 'custom' && (
              <RoundTypesStep
                rounds={config.config.rounds}
                roundTemplates={config.config.roundTemplates || []}
                onRoundTemplatesChange={(roundTemplates) => updateConfig({ roundTemplates })}
                isSaving={isSaving}
              />
            )}

            {/* Step 6: Per-Round Configuration (only for custom) */}
            {currentStep === 6 && workoutType === 'custom' && (
              <PerRoundConfigStep
                rounds={config.config.rounds}
                roundTemplates={config.config.roundTemplates || []}
                onRoundTemplatesChange={(roundTemplates) => updateConfig({ roundTemplates })}
                isSaving={isSaving}
              />
            )}

            {/* Step 5: Review (for template workflow) */}
            {currentStep === 5 && workoutType === 'template' && (
              <ReviewStep
                config={config}
                repeatRounds={repeatRounds}
                templateData={templateData}
              />
            )}

            {/* Step 7: Review (for custom workflow) */}
            {currentStep === 7 && workoutType === 'custom' && (
              <ReviewStep
                config={config}
                repeatRounds={repeatRounds}
                templateData={null}
              />
            )}

            {/* Step 6: Music (template) / Step 8: Music (custom) */}
            {((currentStep === 6 && workoutType === 'template') || (currentStep === 8 && workoutType === 'custom')) && (
              <SpotifyStep
                deviceId={spotifyDeviceId}
                deviceName={spotifyDeviceName}
                onDeviceSelect={async (id, name) => {
                  setSpotifyDeviceId(id);
                  setSpotifyDeviceName(name);
                  
                  // Save immediately like other settings
                  await updateConfig({
                    spotifyDeviceId: id || undefined,
                    spotifyDeviceName: name || undefined
                  });
                }}
              />
            )}
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}