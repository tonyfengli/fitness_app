import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export interface UseGroupWorkoutBlueprintOptions {
  sessionId: string | null;
  includeDiagnostics?: boolean;
  enabled?: boolean;
  onSuccess?: (data: any) => void;
}

export function useGroupWorkoutBlueprint(options: UseGroupWorkoutBlueprintOptions) {
  const trpc = useTRPC();
  const { 
    sessionId, 
    includeDiagnostics = false,
    enabled = true,
    onSuccess
  } = options;

  const queryOptions = sessionId && enabled
    ? trpc.trainingSession.generateGroupWorkoutBlueprint.queryOptions({
        sessionId,
        options: { includeDiagnostics }
      })
    : {
        enabled: false,
        queryKey: ["disabled"],
        queryFn: () => Promise.resolve(null)
      };

  // Add onSuccess if provided
  if (onSuccess && 'onSuccess' in queryOptions) {
    (queryOptions as any).onSuccess = onSuccess;
  }

  const query = useQuery(queryOptions);

  return {
    blueprint: query.data?.blueprint,
    groupContext: query.data?.groupContext,
    summary: query.data?.summary,
    llmResult: query.data?.llmResult,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching
  };
}