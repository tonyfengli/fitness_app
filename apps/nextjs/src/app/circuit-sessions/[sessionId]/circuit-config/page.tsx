"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, Button, Loader2Icon as Loader2, ChevronLeftIcon as ChevronLeft, ChevronRightIcon as ChevronRight } from "@acme/ui-shared";
import { toast } from "sonner";
import { useTRPC } from "~/trpc/react";
import { CircuitHeader } from "~/components/CircuitHeader";
import { supabase } from "~/lib/supabase/client";
import { useRealtimeCircuitConfig } from "@acme/ui-shared";
import type { CircuitConfig } from "@acme/db";
import { cn } from "@acme/ui-shared";
import { WorkoutTypeStep, CategorySelectionStep, TemplateSelectionStep, SessionSetupStep, RoundsStep, RoundTypesStep, PerRoundConfigStep, ExercisesStep, TimingStep, ReviewStep } from "./components";

// TOTAL_STEPS is now dynamic based on workflow type

export default function CircuitConfigPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params?.sessionId as string;
  
  // Check if we're coming from the new session flow
  const fromNew = searchParams.get('fromNew') === 'true';
  const initialWorkoutType = searchParams.get('workoutType') as 'custom' | 'template' | null;
  
  // If coming from new flow with workout type, start at appropriate step
  const getInitialStep = () => {
    if (fromNew && initialWorkoutType) {
      return initialWorkoutType === 'template' ? 2 : 2; // Skip workout type selection for both workflows
    }
    return 1;
  };
  
  const [currentStep, setCurrentStep] = useState(getInitialStep());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Local state for circuit configuration
  const [config, setConfig] = useState<CircuitConfig | null>(null);
  const [repeatRounds, setRepeatRounds] = useState(false);
  const [workoutType, setWorkoutType] = useState<'custom' | 'template' | null>(initialWorkoutType);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [templateData, setTemplateData] = useState<{ rounds: any[], exercises: any[], name?: string, id?: string, workoutId?: string, originalTemplate?: any } | null>(null);
  
  // Session details state
  const [sessionDetails, setSessionDetails] = useState({
    name: '',
    program: 'unassigned' as 'h4h_5am' | 'h4h_5pm' | 'saturday_cg' | 'monday_cg' | 'coach_frank' | 'coach_steph' | 'coach_kyle' | 'unassigned',
    scheduledAt: new Date()
  });

  // Get TRPC client
  const trpc = useTRPC();
  
  // Check if workout already exists
  const { data: hasWorkout } = useQuery({
    ...trpc.trainingSession.hasWorkoutForSession.queryOptions({ sessionId }),
    enabled: !!sessionId,
  });

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
    
    // Handle template flow navigation
    if (currentWorkoutType === 'template') {
      if (currentStep === 1) {
        setCurrentStep(2); // Go to category selection
      } else if (currentStep === 2) {
        setCurrentStep(3); // Go to template selection
      } else if (currentStep === 3) {
        setCurrentStep(4); // Go to review
      } else if (currentStep === 4) {
        setCurrentStep(5); // Go to session setup (final step)
      }
    } else {
      // Simplified custom workflow: Step 1 → Step 2 (session setup)
      if (currentStep === 1) {
        setCurrentStep(2); // Go directly to session setup
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
      } else if (currentStep === 4) {
        setCurrentStep(3); // Back to template selection
      } else if (currentStep === 5) {
        setCurrentStep(4); // Back to review
      }
    } else {
      // Simplified custom workflow back navigation
      if (currentStep === 2) {
        setCurrentStep(1); // Back to workout type selection
      }
    }
  };

  // Add mutation for generating circuit workout
  const generateWorkoutMutation = useMutation(
    trpc.trainingSession.generateCircuitWorkoutPublic.mutationOptions({
      onSuccess: (data) => {
        toast.success("Session details saved and workout generated successfully!");
        router.push(`/circuit-workout-overview?sessionId=${sessionId}`);
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to save session details and generate workout");
      },
    })
  );

  const handleComplete = async () => {
    if (!sessionId) return;
    
    // Save any pending configuration changes
    if (isSaving) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // If workout already exists, just navigate
    if (hasWorkout) {
      router.push(`/circuit-workout-overview?sessionId=${sessionId}`);
      return;
    }
    
    // Validate sessionId exists before calling mutation
    if (!sessionId || sessionId.length !== 36) {
      toast.error("Invalid session ID");
      return;
    }
    
    // Check if we have initial config data (means session exists in circuit config)
    if (!initialConfig) {
      toast.error("Session configuration not found");
      return;
    }
    
    const sessionDetailsToSave = {
      name: sessionDetails.name.trim() || undefined,
      scheduledAt: sessionDetails.scheduledAt,
      program: sessionDetails.program
    };
    
    // Generate workout for both custom and template workflows
    generateWorkoutMutation.mutate({ 
      sessionId,
      sessionDetails: sessionDetailsToSave
    });
  };

  if (isLoading || isLoadingConfig) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <CircuitHeader
          onBack={() => router.push(`/circuit-sessions/${sessionId}`)}
          backText="Session"
          title="Configure Session"
          subtitle="Loading configuration..."
        />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <CircuitHeader
          onBack={() => router.push(`/circuit-sessions/${sessionId}`)}
          backText="Session"
          title="Configure Session"
          subtitle="Configuration not found"
        />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <p>No configuration found</p>
        </div>
      </div>
    );
  }

  // Get step info for header
  const getStepInfo = () => {
    const stepProgress = (() => {
      if (workoutType === 'template') {
        if (currentStep === 2) return "Step 1 of 4";
        if (currentStep === 3) return "Step 2 of 4";
        if (currentStep === 4) return "Step 3 of 4";
        if (currentStep === 5) return "Step 4 of 4";
      } else if (workoutType === 'custom') {
        // Simplified custom workflow: only 2 steps
        if (currentStep === 2) return "Step 2 of 2";
      }
      return "";
    })();

    const stepTitle = (() => {
      if (currentStep === 1) return "Choose Your Workout Type";
      if (currentStep === 2 && workoutType === 'template') return "Category";
      if (currentStep === 2 && workoutType === 'custom') return "Session Setup";
      if (currentStep === 3) return "Templates";
      if (currentStep === 4) return "Review";
      if (currentStep === 5) return "Session Setup";
      return "Configure Session";
    })();

    return { stepProgress, stepTitle };
  };

  const { stepProgress, stepTitle } = getStepInfo();

  // Get right action for header
  const getRightAction = () => {
    // No right action for step 1 or template steps 2 and 3
    if (currentStep === 1 || (currentStep === 2 && workoutType === 'template') || (currentStep === 3 && workoutType === 'template')) {
      return null;
    }
    
    // Show Continue button for template review step
    if (workoutType === 'template' && currentStep === 4) {
      return (
        <Button
          size="sm"
          onClick={() => handleNext()}
          className="flex items-center gap-1"
        >
          <span className="text-sm">Continue</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      );
    }

    // Show Generate Workout button for final steps
    if ((workoutType === 'template' && currentStep === 5) || (workoutType === 'custom' && currentStep === 2)) {
      return (
        <Button
          size="sm"
          onClick={handleComplete}
          disabled={generateWorkoutMutation.isPending || !sessionDetails.name.trim()}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
        >
          {generateWorkoutMutation.isPending 
            ? "Generating..." 
            : hasWorkout 
              ? "View Workout" 
              : "Generate Workout"}
        </Button>
      );
    }
    
    // Show Next button for template steps that aren't final
    if (workoutType === 'template' && currentStep < 4) {
      return (
        <Button
          size="sm"
          onClick={() => handleNext()}
          className="flex items-center gap-1"
        >
          <span className="text-sm">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      );
    }
    
    return null;
  };

  return (
    <div className="h-screen bg-white dark:bg-gray-900 flex flex-col">
      <CircuitHeader
        onBack={currentStep > 1 ? handleBack : () => router.push(`/circuit-sessions/${sessionId}`)}
        backText={currentStep > 1 ? "Back" : "Session"}
        title={stepTitle}
        subtitle={stepProgress}
        rightAction={getRightAction()}
      />

      {/* Progress indicator - only show after workout type is selected */}
      {workoutType && (
        <div className="px-4 pb-3 bg-gradient-to-r from-slate-900 to-purple-900">
          <div className="flex gap-1 max-w-md mx-auto">
            {[1, 2, 3, 4, 5].map((step) => {
              let isActive = false;
              
              if (workoutType === 'template') {
                // Template flow: 2, 3, 4, 5 (4 steps total)
                if (step === 1 && currentStep >= 2) isActive = true;
                if (step === 2 && currentStep >= 3) isActive = true;
                if (step === 3 && currentStep >= 4) isActive = true;
                if (step === 4 && currentStep >= 5) isActive = true;
                // Hide step 5 for template workflow (only 4 steps now)
                if (step === 5) return null;
              } else if (workoutType === 'custom') {
                // Simplified custom flow: just step 2 (1 step total after workout type)
                if (step === 1 && currentStep >= 2) isActive = true;
                // Hide steps 2-5 for simplified custom workflow (only 1 step shown)
                if (step >= 2) return null;
              }
              
              return (
                <div
                  key={step}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-all duration-300",
                    isActive ? "bg-white/80" : "bg-white/20"
                  )}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-8">
        <div className="mx-auto max-w-md">

        {/* Step content */}
        <Card className="p-0 shadow-sm bg-white dark:bg-gray-800 overflow-visible">
          <div className="p-6 space-y-6 overflow-visible">
            
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
              <>
                <CategorySelectionStep
                  onSelectCategory={(program) => {
                    setSelectedProgram(program);
                    handleNext();
                  }}
                />
              </>
            )}

            {/* Step 3: Template Selection (only for template) */}
            {currentStep === 3 && workoutType === 'template' && selectedProgram && (
              <>
                <TemplateSelectionStep
                  program={selectedProgram}
                  onSelectTemplate={(template) => {
                    console.log('[CircuitConfig] Template selected - FULL DETAILS:', {
                      templateId: template.id,
                      workoutId: template.workoutId,
                      hasWorkoutId: !!template.workoutId,
                      sourceToStore: template.workoutId || template.id,
                      config: template.config,
                      roundTemplates: template.config.roundTemplates,
                      // Look for all possible name properties
                      templateName: template.name,
                      sessionName: template.sessionName,
                      workoutName: template.workoutName,
                      title: template.title,
                      label: template.label,
                      description: template.description,
                      allTemplateProps: Object.keys(template),
                      rounds: template.rounds?.map((round: any, idx: number) => ({
                        index: idx,
                        roundName: round.roundName,
                        roundType: round.roundType,
                        exerciseCount: round.exercises?.length || 0,
                        exercises: round.exercises?.map((ex: any) => ({
                          name: ex.exerciseName,
                          orderIndex: ex.orderIndex,
                          stationIndex: ex.stationIndex,
                          exerciseId: ex.exerciseId,
                        }))
                      })),
                      allExercises: template.exercises?.map((ex: any) => ({
                        id: ex.id,
                        name: ex.exerciseName,
                        orderIndex: ex.orderIndex,
                        stationIndex: ex.stationIndex,
                        roundName: ex.roundName || ex.groupName,
                        selectionId: ex.selectionId,
                      })),
                      exerciseCount: template.exercises?.length || 0,
                    });
                    
                    // Apply template configuration and store source workout ID
                    updateConfig({
                      ...template.config,
                      roundTemplates: template.config.roundTemplates,
                      sourceWorkoutId: template.workoutId || template.id, // Store the source workout ID
                    });
                    // Store template data for review
                    const templateName = template.name || template.sessionName || template.workoutName || template.title || template.label || template.description || 'Template Session';
                    setTemplateData({
                      rounds: template.rounds || [],
                      exercises: template.exercises || [],
                      name: templateName,
                      id: template.id,
                      workoutId: template.workoutId,
                      originalTemplate: template // Store full template for debugging
                    });
                    handleNext();
                  }}
                />
              </>
            )}

            {/* Step 4: Review (for template workflow) */}
            {currentStep === 4 && workoutType === 'template' && (
              <>
                <ReviewStep
                  config={config}
                  repeatRounds={repeatRounds}
                  templateData={templateData}
                />
              </>
            )}

            {/* Step 2: Session Setup (for custom workflow) */}
            {currentStep === 2 && workoutType === 'custom' && (
              <>
                <SessionSetupStep
                  sessionDetails={sessionDetails}
                  onUpdateSessionDetails={setSessionDetails}
                  templateData={null}
                  onConfirm={handleComplete}
                />
              </>
            )}

            {/* Step 5: Session Setup (final step for template workflow) */}
            {currentStep === 5 && workoutType === 'template' && (
              <>
                <SessionSetupStep
                  sessionDetails={sessionDetails}
                  onUpdateSessionDetails={setSessionDetails}
                  templateData={templateData}
                  onConfirm={handleComplete}
                />
              </>
            )}

            {/* FALLBACK: Show if no step is matched */}
            {!((currentStep === 1) || 
               (currentStep === 2 && workoutType === 'template') || 
               (currentStep === 2 && workoutType === 'custom') ||
               (currentStep === 3 && workoutType === 'template' && selectedProgram) ||
               (currentStep === 4 && workoutType === 'template') ||
               (currentStep === 5 && workoutType === 'template')) && (
              <>
                <div className="text-center py-8">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Configuration Error
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    No matching step found for current state
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Step: {currentStep}, Type: {workoutType || 'none'}
                  </p>
                  <button 
                    onClick={() => {
                      setCurrentStep(1);
                      setWorkoutType(null);
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
                  >
                    Reset to Start
                  </button>
                </div>
              </>
            )}

          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}