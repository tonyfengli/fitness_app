import { useCallback } from 'react';
import { api } from '../providers/TRPCProvider';
import { useQuery } from '@tanstack/react-query';
// Using polling instead of real-time subscriptions as a workaround

interface LightingConfig {
  enabled: boolean;
  targetGroup?: string;
  globalDefaults: {
    preview?: { sceneId: string; sceneName: string };
    work?: { sceneId: string; sceneName: string };
    rest?: { sceneId: string; sceneName: string };
    warning?: { sceneId: string; sceneName: string };
    roundBreak?: { sceneId: string; sceneName: string };
  };
  roundOverrides?: {
    [roundKey: string]: {
      preview?: { sceneId: string; sceneName: string };
      work?: { sceneId: string; sceneName: string };
      rest?: { sceneId: string; sceneName: string };
      [key: string]: any;
    };
  };
}

interface UseLightingPreviewOptions {
  sessionId: string;
  roundNumber: number;
  enabled?: boolean;
}

export function useLightingPreview({ 
  sessionId, 
  roundNumber, 
  enabled = true 
}: UseLightingPreviewOptions) {
  
  // Get lighting configuration from TRPC
  const { data: lightingConfig, dataUpdatedAt, isFetching } = useQuery({
    ...api.lightingConfig.get.queryOptions({ sessionId }),
    enabled: !!sessionId && enabled,
    refetchInterval: 5000 // Poll every 5 seconds as a workaround
  });

  // Scene resolution logic for preview
  const getPreviewScene = useCallback((config: LightingConfig): string | null => {
    if (!config || !config.enabled) return null;
    
    const roundKey = `round-${roundNumber}`;
    
    // 1. Check round-specific preview override (HIGHEST PRIORITY)
    const roundPreview = config.roundOverrides?.[roundKey]?.preview;
    if (roundPreview) {
      console.log(`[LightingPreview] Using round-${roundNumber} override scene:`, roundPreview.sceneName);
      return roundPreview.sceneId;
    }
    
    // 2. Fallback to global default preview (LOWEST PRIORITY)
    const globalPreview = config.globalDefaults.preview;
    if (globalPreview) {
      console.log(`[LightingPreview] Using global default scene:`, globalPreview.sceneName);
      return globalPreview.sceneId;
    }
    
    console.log(`[LightingPreview] No preview scene configured for round ${roundNumber}`);
    return null;
  }, [roundNumber]);

  // Scene activation removed - preview mode only displays scene information

  // Preview mode: NO scene activation - just data resolution for display
  // Scene activation will be handled by the workout state machine during actual workouts
  // This hook is only for resolving which scene should be displayed in the UI

  return {
    lightingConfig,
    currentPreviewScene: lightingConfig ? getPreviewScene(lightingConfig) : null
  };
}