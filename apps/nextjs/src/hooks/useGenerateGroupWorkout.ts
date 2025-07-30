import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { toast } from "sonner";

export interface UseGenerateGroupWorkoutOptions {
  sessionId: string;
  navigateOnSuccess?: boolean;
  navigationTarget?: string;
  includeDiagnostics?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  showToasts?: boolean;
}

export function useGenerateGroupWorkout(options: UseGenerateGroupWorkoutOptions) {
  const router = useRouter();
  const trpc = useTRPC();
  const { 
    sessionId, 
    navigateOnSuccess = false, 
    navigationTarget,
    includeDiagnostics = false,
    onSuccess,
    onError,
    showToasts = true
  } = options;

  const mutation = useMutation(
    trpc.trainingSession.generateAndCreateGroupWorkouts.mutationOptions({
      onSuccess: (data) => {
        // Show success toast if enabled
        if (showToasts) {
          toast.success('Workouts generated successfully!');
        }
        
        // Call custom success handler
        onSuccess?.(data);
        
        // Handle navigation if requested
        if (navigateOnSuccess && data.workoutIds?.length > 0) {
          const target = navigationTarget || `/workout-overview?sessionId=${sessionId}`;
          // Use setTimeout to allow any UI updates to complete first
          setTimeout(() => {
            router.push(target);
          }, 500);
        }
      },
      onError: (error) => {
        // Show error toast if enabled
        if (showToasts) {
          const message = error.message || 'Failed to generate workouts';
          toast.error(message);
        }
        
        // Call custom error handler
        onError?.(error);
      }
    })
  );

  const generateWorkout = useCallback(() => {
    if (!sessionId) {
      if (showToasts) {
        toast.error('Session ID is required');
      }
      return;
    }

    mutation.mutate({
      sessionId,
      options: {
        skipBlueprintCache: false,
        dryRun: false,
        includeDiagnostics
      }
    });
  }, [sessionId, includeDiagnostics, mutation]);

  return {
    generateWorkout,
    isGenerating: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset
  };
}