import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export interface UseGroupWorkoutBlueprintOptions {
  sessionId: string | null;
  useCache?: boolean;
  includeDiagnostics?: boolean;
  enabled?: boolean;
}

export function useGroupWorkoutBlueprint(options: UseGroupWorkoutBlueprintOptions) {
  const trpc = useTRPC();
  const { 
    sessionId, 
    useCache = true, 
    includeDiagnostics = false,
    enabled = true
  } = options;

  const query = useQuery(
    sessionId && enabled
      ? trpc.trainingSession.generateGroupWorkoutBlueprint.queryOptions({
          sessionId,
          options: { useCache, includeDiagnostics }
        })
      : {
          enabled: false,
          queryKey: ["disabled"],
          queryFn: () => Promise.resolve(null)
        }
  );

  return {
    blueprint: query.data?.blueprint,
    groupContext: query.data?.groupContext,
    summary: query.data?.summary,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching
  };
}