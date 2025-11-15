import { useCallback } from "react";
import { api } from "~/trpc/react";
import type { LightingConfig, LightingScene } from "@acme/db";

interface UseLightingConfigOptions {
  sessionId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useLightingConfig({ sessionId, onSuccess, onError }: UseLightingConfigOptions) {
  const utils = api.useUtils();
  
  // Query current lighting config
  const { data: lightingConfig, isLoading } = api.lightingConfig.get.useQuery(
    { sessionId },
    {
      enabled: !!sessionId,
    }
  );

  // Mutation to update lighting config
  const updateMutation = api.lightingConfig.update.useMutation({
    onSuccess: () => {
      // Invalidate cache to refetch
      utils.lightingConfig.get.invalidate({ sessionId });
      onSuccess?.();
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  // Save global defaults (Master view)
  const saveGlobalDefault = useCallback(
    async (phaseType: string, scene: LightingScene | null) => {
      const currentConfig: LightingConfig = lightingConfig || {
        enabled: true,
        globalDefaults: {},
        targetGroup: "0",
      };

      const updatedGlobalDefaults = { ...currentConfig.globalDefaults };
      
      if (scene) {
        updatedGlobalDefaults[phaseType as keyof typeof updatedGlobalDefaults] = scene;
      } else {
        delete updatedGlobalDefaults[phaseType as keyof typeof updatedGlobalDefaults];
      }

      await updateMutation.mutateAsync({
        sessionId,
        lighting: {
          ...currentConfig,
          globalDefaults: updatedGlobalDefaults,
        },
      });
    },
    [sessionId, lightingConfig, updateMutation]
  );

  // Save round override (Custom view)
  const saveRoundOverride = useCallback(
    async (roundId: string, phaseType: string, scene: LightingScene | null) => {
      const currentConfig: LightingConfig = lightingConfig || {
        enabled: true,
        globalDefaults: {},
        roundOverrides: {},
        targetGroup: "0",
      };

      const updatedOverrides = { ...currentConfig.roundOverrides };
      
      if (!updatedOverrides[roundId]) {
        updatedOverrides[roundId] = {};
      }
      
      if (scene) {
        updatedOverrides[roundId][phaseType] = scene;
      } else {
        delete updatedOverrides[roundId][phaseType];
        
        // Clean up empty round entries
        if (Object.keys(updatedOverrides[roundId]).length === 0) {
          delete updatedOverrides[roundId];
        }
      }

      await updateMutation.mutateAsync({
        sessionId,
        lighting: {
          ...currentConfig,
          roundOverrides: updatedOverrides,
        },
      });
    },
    [sessionId, lightingConfig, updateMutation]
  );

  // Toggle lighting enabled/disabled
  const toggleEnabled = useCallback(
    async (enabled: boolean) => {
      const currentConfig: LightingConfig = lightingConfig || {
        enabled: false,
        globalDefaults: {},
        targetGroup: "0",
      };

      await updateMutation.mutateAsync({
        sessionId,
        lighting: {
          ...currentConfig,
          enabled,
        },
      });
    },
    [sessionId, lightingConfig, updateMutation]
  );

  // Get effective scene for a round/phase (with fallback logic)
  const getEffectiveScene = useCallback(
    (roundId: string, phaseType: string): LightingScene | undefined => {
      if (!lightingConfig?.enabled) return undefined;
      
      // Check for round-specific override first
      const override = lightingConfig.roundOverrides?.[roundId]?.[phaseType];
      if (override) return override;
      
      // Fall back to global default
      return lightingConfig.globalDefaults[phaseType as keyof typeof lightingConfig.globalDefaults];
    },
    [lightingConfig]
  );

  return {
    lightingConfig,
    isLoading,
    isUpdating: updateMutation.isPending,
    saveGlobalDefault,
    saveRoundOverride,
    toggleEnabled,
    getEffectiveScene,
  };
}