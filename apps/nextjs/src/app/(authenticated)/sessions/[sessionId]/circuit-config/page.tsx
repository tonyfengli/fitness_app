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
import { RoundsStep, ExercisesStep, TimingStep, ReviewStep } from "./components";

const TOTAL_STEPS = 4;

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

  // Get TRPC client
  const trpc = useTRPC();

  // Fetch initial circuit configuration
  const { data: initialConfig, isLoading: isLoadingConfig } = useQuery({
    ...trpc.circuitConfig.getBySession.queryOptions({ sessionId }),
    enabled: !!sessionId,
  });

  // Update mutation
  const updateConfigMutation = useMutation(
    trpc.circuitConfig.update.mutationOptions({
      onSuccess: () => {
        toast.success("Configuration updated");
      },
      onError: (error: any) => {
        toast.error("Failed to update configuration");
        console.error("Update error:", error);
      },
    })
  );

  // Reset mutation
  const resetConfigMutation = useMutation(
    trpc.circuitConfig.reset.mutationOptions({
      onSuccess: () => {
        toast.success("Configuration reset to defaults");
      },
      onError: (error: any) => {
        toast.error("Failed to reset configuration");
        console.error("Reset error:", error);
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
      setConfig(initialConfig);
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
      await updateConfigMutation.mutateAsync({
        sessionId,
        config: updates,
      });
    } catch (error) {
      // Revert on error
      setConfig(config);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    toast.success("Circuit configuration saved!");
    // Stay on the page as per requirements
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
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-md">
        {/* Header with back button */}
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">Circuit Configuration</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {/* Progress indicator */}
        <div className="mb-8 flex justify-center">
          <div className="flex space-x-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={cn(
                  "h-2 w-16 rounded-full transition-colors",
                  step <= currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <Card className="p-0">
          <div className="p-6 pb-2">
            <h2 className="text-lg font-semibold">
              {currentStep === 1 && "Rounds"}
              {currentStep === 2 && "Exercises per Round"}
              {currentStep === 3 && "Exercise Timing"}
              {currentStep === 4 && "Review Configuration"}
            </h2>
          </div>
          <div className="px-6 pb-6 space-y-6">
            {/* Step 1: Rounds */}
            {currentStep === 1 && (
              <RoundsStep
                rounds={config.config.rounds}
                repeatRounds={repeatRounds}
                onRoundsChange={(rounds) => updateConfig({ rounds })}
                onRepeatToggle={(value) => {
                  setRepeatRounds(value);
                  updateConfig({ repeatRounds: value });
                }}
                isSaving={isSaving}
              />
            )}

            {/* Step 2: Exercises */}
            {currentStep === 2 && (
              <ExercisesStep
                exercises={config.config.exercisesPerRound}
                onExercisesChange={(exercisesPerRound) => updateConfig({ exercisesPerRound })}
                isSaving={isSaving}
              />
            )}

            {/* Step 3: Timing */}
            {currentStep === 3 && (
              <TimingStep
                workDuration={config.config.workDuration}
                restDuration={config.config.restDuration}
                restBetweenRounds={config.config.restBetweenRounds}
                onWorkChange={(workDuration) => updateConfig({ workDuration })}
                onRestChange={(restDuration) => updateConfig({ restDuration })}
                onRoundRestChange={(restBetweenRounds) => updateConfig({ restBetweenRounds })}
                isSaving={isSaving}
              />
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <ReviewStep
                config={config}
                repeatRounds={repeatRounds}
              />
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                Back
              </Button>
              
              {currentStep < TOTAL_STEPS ? (
                <Button onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleComplete}>
                  Confirm
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}