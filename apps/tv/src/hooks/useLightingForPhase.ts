import { useMemo } from 'react';
import { api } from '../providers/TRPCProvider';
import { useQuery } from '@tanstack/react-query';

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
      [key: string]: { sceneId: string; sceneName: string };
    };
  };
}

interface UseLightingForPhaseOptions {
  sessionId: string;
  roundNumber: number;
  phase: 'work' | 'rest' | 'preview' | 'warning' | 'roundBreak';
  exerciseIndex?: number;
  isStationsRound?: boolean;
  enabled?: boolean;
}

export function useLightingForPhase({ 
  sessionId, 
  roundNumber, 
  phase,
  exerciseIndex,
  isStationsRound = false,
  enabled = true 
}: UseLightingForPhaseOptions) {
  
  // Get lighting configuration from TRPC with polling
  const { data: lightingConfig } = useQuery({
    ...api.lightingConfig.get.queryOptions({ sessionId }),
    enabled: !!sessionId && enabled,
    refetchInterval: 5000 // Poll every 5 seconds
  });

  // Resolve the current scene based on 3-level hierarchy
  const currentScene = useMemo(() => {
    if (!lightingConfig || !lightingConfig.enabled) return null;
    
    const roundKey = `round-${roundNumber}`;
    const roundOverrides = lightingConfig.roundOverrides?.[roundKey];
    
    // Build the detailed override key based on phase and exercise index
    let detailedKey: string | null = null;
    if (exerciseIndex !== undefined && (phase === 'work' || phase === 'rest')) {
      if (phase === 'work') {
        // For work phase: work-station-X or work-exercise-X
        detailedKey = isStationsRound ? `work-station-${exerciseIndex}` : `work-exercise-${exerciseIndex}`;
      } else if (phase === 'rest') {
        // For rest phase: rest-after-station-X or rest-after-exercise-X
        detailedKey = isStationsRound ? `rest-after-station-${exerciseIndex}` : `rest-after-exercise-${exerciseIndex}`;
      }
    }
    
    // 3-Level Resolution:
    // Level 3 (highest priority): Detailed override for specific exercise/station
    if (detailedKey && roundOverrides?.[detailedKey]) {
      console.log(`[LightingForPhase] Using detailed override for ${detailedKey}:`, roundOverrides[detailedKey].sceneName);
      return roundOverrides[detailedKey];
    }
    
    // Level 2: Round master override
    if (roundOverrides?.[phase]) {
      console.log(`[LightingForPhase] Using round-${roundNumber} override for ${phase}:`, roundOverrides[phase].sceneName);
      return roundOverrides[phase];
    }
    
    // Level 1 (lowest priority): Global default
    const globalScene = lightingConfig.globalDefaults[phase];
    if (globalScene) {
      console.log(`[LightingForPhase] Using global default for ${phase}:`, globalScene.sceneName);
      return globalScene;
    }
    
    console.log(`[LightingForPhase] No scene configured for phase ${phase} in round ${roundNumber}`);
    return null;
  }, [lightingConfig, roundNumber, phase, exerciseIndex, isStationsRound]);

  return {
    lightingConfig,
    currentScene
  };
}