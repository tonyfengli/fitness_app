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
import { RoundsStep, ExercisesStep, TimingStep, ReviewStep, SpotifyStep } from "./components";

const TOTAL_STEPS = 5;

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
      setConfig(initialConfig);
      setRepeatRounds(initialConfig.config.repeatRounds || false);
      setIsLoading(false);
    }
  }, [initialConfig]);

  // Helper function to update config and save
  const updateConfig = async (updates: Partial<CircuitConfig['config']>) => {
    if (!config) return;

    console.log('[CircuitConfig] updateConfig called with:', updates);

    setIsSaving(true);
    const newConfig = { ...config, config: { ...config.config, ...updates } };
    
    // Optimistic update
    setConfig(newConfig);

    try {
      const mutationPayload = {
        sessionId,
        config: updates,
      };
      console.log('[CircuitConfig] Mutation payload:', mutationPayload);
      
      const result = await updateConfigMutation.mutateAsync(mutationPayload);
      console.log('[CircuitConfig] Mutation result:', result);
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
    <div className="min-h-screen bg-background">
      {/* Fixed Header with Navigation */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="mx-auto max-w-md">
          {/* Top Navigation Row */}
          <div className="flex items-center justify-between p-4 pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </Button>
            
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Step {currentStep} of {TOTAL_STEPS}</p>
              <h1 className="text-sm font-medium">
                {currentStep === 1 && "Rounds"}
                {currentStep === 2 && "Exercises"}
                {currentStep === 3 && "Timing"}
                {currentStep === 4 && "Review"}
                {currentStep === 5 && "Music"}
              </h1>
            </div>
            
            {currentStep < TOTAL_STEPS ? (
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

          {/* Progress indicator */}
          <div className="px-4 pb-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-all duration-300",
                    step <= currentStep 
                      ? "bg-primary" 
                      : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content with top padding for fixed header */}
      <div className="pt-24 p-4 pb-8">
        <div className="mx-auto max-w-md">

        {/* Step content */}
        <Card className="p-0 shadow-sm">
          <div className="p-6 space-y-6">
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

            {/* Step 5: Spotify Connection */}
            {currentStep === 5 && (
              <>
                {console.log('[CircuitConfig] Step 5 - Current Spotify state:', { spotifyDeviceId, spotifyDeviceName })}
                <SpotifyStep
                  deviceId={spotifyDeviceId}
                  deviceName={spotifyDeviceName}
                  onDeviceSelect={async (id, name) => {
                    console.log('[CircuitConfig] Spotify device selected:', { id, name });
                    setSpotifyDeviceId(id);
                    setSpotifyDeviceName(name);
                    
                    // Save immediately like other settings
                    await updateConfig({
                      spotifyDeviceId: id || undefined,
                      spotifyDeviceName: name || undefined
                    });
                  }}
                />
              </>
            )}
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}