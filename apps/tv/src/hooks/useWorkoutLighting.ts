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
  
  console.log('[useWorkoutLighting] Hook initialized:', {
    sessionId,
    isEnabled
  });
  
  // Fetch lighting configuration - using useQuery from React Query directly
  const queryOptions = sessionId ? api.lightingConfig.get.queryOptions({ sessionId }) : null;
  console.log('[useWorkoutLighting] Query options:', queryOptions);
  
  const { data: lightingConfig, isLoading, error } = useQuery({
    ...(queryOptions || {}),
    enabled: !!sessionId && isEnabled && !!queryOptions,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  console.log('[useWorkoutLighting] Query status:', {
    isLoading,
    hasData: !!lightingConfig,
    error,
    enabled: !!sessionId && isEnabled
  });
  
  // Update ref when config changes
  useEffect(() => {
    if (lightingConfig) {
      lightingConfigRef.current = lightingConfig;
      console.log('[useWorkoutLighting] Lighting config loaded:', {
        enabled: lightingConfig.enabled,
        globalDefaults: Object.keys(lightingConfig.globalDefaults),
        roundOverrides: Object.keys(lightingConfig.roundOverrides || {}),
      });
    }
  }, [lightingConfig]);
  
  // Mutation for activating scenes - using proper TRPC pattern
  const activateSceneMutation = useMutation({
    ...api.lighting.activateScene.mutationOptions(),
    onError: (error) => {
      console.error('[useWorkoutLighting] Failed to activate scene:', error);
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
      console.log('[useWorkoutLighting] Using detailed override:', detailedPhaseType);
      return config.roundOverrides[roundKey][detailedPhaseType];
    }
    
    // 2. Check for round master override (e.g., work)
    if (config.roundOverrides?.[roundKey]?.[phaseType]) {
      console.log('[useWorkoutLighting] Using round master override:', phaseType);
      return config.roundOverrides[roundKey][phaseType];
    }
    
    // 3. Fallback to global default
    const globalScene = config.globalDefaults[phaseType as keyof typeof config.globalDefaults];
    if (globalScene) {
      console.log('[useWorkoutLighting] Using global default:', phaseType);
      return globalScene;
    }
    
    console.log('[useWorkoutLighting] No scene found for phase:', { 
      roundIndex, 
      phaseType, 
      detailedPhaseType 
    });
    return null;
  }, []);
  
  // Apply lighting for a specific phase
  const applyLightingForPhase = useCallback(async (phaseInfo: PhaseInfo) => {
    if (!isEnabled || !lightingConfigRef.current?.enabled) {
      console.log('[useWorkoutLighting] Lighting disabled, skipping');
      return;
    }
    
    const { roundIndex, phaseType, detailedPhaseType } = phaseInfo;
    const phaseKey = detailedPhaseType || phaseType;
    
    // Avoid re-applying the same phase
    if (currentPhaseRef.current === phaseKey) {
      console.log('[useWorkoutLighting] Same phase, skipping:', phaseKey);
      return;
    }
    
    currentPhaseRef.current = phaseKey;
    
    // Get the appropriate scene
    const scene = getEffectiveScene(roundIndex, phaseType, detailedPhaseType);
    
    if (!scene) {
      console.log('[useWorkoutLighting] No scene configured for phase:', phaseKey);
      return;
    }
    
    // Avoid re-applying the same scene
    if (lastSceneIdRef.current === scene.sceneId) {
      console.log('[useWorkoutLighting] Same scene already active:', scene.sceneName);
      return;
    }
    
    console.log('[useWorkoutLighting] Applying lighting for phase:', {
      phase: phaseKey,
      scene: scene.sceneName,
      sceneId: scene.sceneId,
    });
    
    lastSceneIdRef.current = scene.sceneId;
    
    // Try LAN first, then fallback to remote
    try {
      console.log('[useWorkoutLighting] Attempting LAN connection...');
      // TODO: Implement actual LAN connection when we have bridge access
      // For now, simulate LAN failure to test fallback
      throw new Error('LAN not implemented yet');
    } catch (lanError) {
      console.log('[useWorkoutLighting] LAN failed, falling back to remote');
      
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
  }, []);
  
  return {
    applyLightingForPhase,
    resetPhase,
    isLightingEnabled: lightingConfig?.enabled || false,
    lightingConfig,
  };
}