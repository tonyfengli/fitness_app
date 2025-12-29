import { useEffect, useRef, useCallback } from 'react';
import { api } from '../providers/TRPCProvider';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { LightingConfig, LightingScene } from '@acme/db';

interface UseWorkoutLightingProps {
  sessionId?: string | null;
  isEnabled?: boolean;
}

interface PhaseInfo {
  roundIndex: number;
  phaseType: string;
  detailedPhaseType?: string;
}

export function useWorkoutLighting({ sessionId, isEnabled = true }: UseWorkoutLightingProps) {
  const lightingConfigRef = useRef<LightingConfig | null>(null);
  const currentPhaseRef = useRef<string | null>(null);
  const lastSceneIdRef = useRef<string | null>(null);
  const manualControlRef = useRef<'on' | 'off' | null>(null);
  
  // Fetch lighting configuration - using useQuery from React Query directly
  const queryOptions = sessionId ? api.lightingConfig.get.queryOptions({ sessionId }) : null;
  
  const { data: lightingConfig, isLoading, error } = useQuery({
    ...(queryOptions || {}),
    enabled: !!sessionId && isEnabled && !!queryOptions,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Update ref when config changes
  useEffect(() => {
    if (lightingConfig) {
      lightingConfigRef.current = lightingConfig;
    }
  }, [lightingConfig]);
  
  // Mutation for activating scenes - using proper TRPC pattern
  const activateSceneMutation = useMutation({
    ...api.lighting.activateScene.mutationOptions(),
    onError: (error) => {
      console.error('[TV-Lighting] Failed to activate scene:', error);
    },
  });
  
  // Mutation for setting light state (on/off)
  const setStateMutation = useMutation({
    ...api.lighting.setState.mutationOptions(),
    onError: (error) => {
      console.error('[TV-Lighting] Failed to set light state:', error);
    },
  });
  
  // Helper to get effective scene based on hierarchy
  const getEffectiveScene = useCallback((
    roundIndex: number,
    phaseType: string,
    detailedPhaseType?: string
  ): LightingScene | null => {
    const config = lightingConfigRef.current;
    if (!config || !config.enabled) return null;
    
    const roundKey = `round-${roundIndex + 1}`; // Convert 0-based to 1-based
    
    // 1. Check for detailed override first (e.g., work-station-0)
    if (detailedPhaseType && config.roundOverrides?.[roundKey]?.[detailedPhaseType]) {
      return config.roundOverrides[roundKey][detailedPhaseType];
    }
    
    // 2. Check for round master override (e.g., work)
    if (config.roundOverrides?.[roundKey]?.[phaseType]) {
      return config.roundOverrides[roundKey][phaseType];
    }
    
    // 3. Fallback to global default
    const globalScene = config.globalDefaults[phaseType as keyof typeof config.globalDefaults];
    if (globalScene) {
      return globalScene;
    }
    
    return null;
  }, []);
  
  // Apply lighting for a specific phase
  const applyLightingForPhase = useCallback(async (phaseInfo: PhaseInfo) => {
    if (!isEnabled || !lightingConfigRef.current?.enabled) {
      return;
    }
    
    // Skip if manually turned off
    if (manualControlRef.current === 'off') {
      return;
    }
    
    const { roundIndex, phaseType, detailedPhaseType } = phaseInfo;
    const phaseKey = detailedPhaseType || phaseType;
    
    // Avoid re-applying the same phase
    if (currentPhaseRef.current === phaseKey) {
      return;
    }
    
    currentPhaseRef.current = phaseKey;
    
    // Get the appropriate scene
    const scene = getEffectiveScene(roundIndex, phaseType, detailedPhaseType);
    
    if (!scene) {
      return;
    }
    
    // Avoid re-applying the same scene
    if (lastSceneIdRef.current === scene.sceneId) {
      return;
    }
    
    
    lastSceneIdRef.current = scene.sceneId;
    
    
    // Try LAN first, then fallback to remote
    try {
      // TODO: Implement actual LAN connection when we have bridge access
      // For now, simulate LAN failure to test fallback
      throw new Error('LAN not implemented yet');
    } catch (lanError) {
      // Use the mutation which is properly configured with TRPC
      await activateSceneMutation.mutateAsync({
        sceneId: scene.sceneId,
        groupId: lightingConfigRef.current.targetGroup || '0',
      });
    }
  }, [isEnabled, getEffectiveScene, activateSceneMutation]);
  
  // Reset phase tracking
  const resetPhase = useCallback(() => {
    currentPhaseRef.current = null;
    lastSceneIdRef.current = null;
    manualControlRef.current = null; // Reset manual control
  }, []);
  
  // Turn lights on with appropriate preset
  const turnLightsOn = useCallback(async (roundIndex: number = 0) => {
    manualControlRef.current = 'on';
    currentPhaseRef.current = null; // Clear phase to allow re-activation
    
    if (!lightingConfigRef.current) return;
    
    // Try to get preview scene for the specified round
    const scene = getEffectiveScene(roundIndex, 'preview');
    
    if (scene) {
      lastSceneIdRef.current = scene.sceneId; // Update last scene
      await activateSceneMutation.mutateAsync({
        sceneId: scene.sceneId,
        groupId: lightingConfigRef.current.targetGroup || '0',
      });
    } else {
      // No preview scene, just turn lights on with default brightness
      await setStateMutation.mutateAsync({
        state: {
          on: true,
          bri: 254, // Max brightness
          transitiontime: 10 // 1 second transition
        }
      });
    }
  }, [getEffectiveScene, activateSceneMutation, setStateMutation]);
  
  // Turn lights completely off
  const turnLightsOff = useCallback(async () => {
    manualControlRef.current = 'off';
    lastSceneIdRef.current = null; // Clear last scene
    currentPhaseRef.current = null; // Clear phase tracking
    await setStateMutation.mutateAsync({
      state: {
        on: false,
        transitiontime: 10 // 1 second transition
      }
    });
  }, [setStateMutation]);
  
  return {
    applyLightingForPhase,
    resetPhase,
    turnLightsOn,
    turnLightsOff,
    isLightingEnabled: lightingConfig?.enabled || false,
    lightingConfig,
  };
}