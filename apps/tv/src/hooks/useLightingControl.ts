import { useCallback, useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';

interface UseLightingControlProps {
  sessionId?: string | null;
}

/**
 * Simple, explicit lighting control hook
 * - No automatic triggers
 * - Clear on/off/scene control
 * - State persists across re-renders
 */
export function useLightingControl({ sessionId }: UseLightingControlProps) {
  const [isLightingOn, setIsLightingOn] = useState(false);
  const activeSceneRef = useRef<string | null>(null);
  
  // Fetch lighting configuration
  const { data: lightingConfig } = useQuery(
    sessionId ? api.lightingConfig.get.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ['disabled-lighting-config'],
      queryFn: () => Promise.resolve(null)
    }
  );
  
  // Scene activation mutation
  const activateSceneMutation = useMutation({
    ...api.lighting.activateScene.mutationOptions(),
    onMutate: (vars) => {
      console.log('[LightingControl] API Call - activateScene:', vars);
    },
    onSuccess: (data, vars) => {
      console.log('[LightingControl] API Success - activateScene:', vars);
    },
    onError: (error) => {
      console.error('[Lighting] Failed to activate scene:', error);
    },
  });
  
  // State control mutation (on/off)
  const setStateMutation = useMutation({
    ...api.lighting.setState.mutationOptions(),
    onMutate: (vars) => {
      console.log('[LightingControl] API Call - setState:', vars);
    },
    onSuccess: (data, vars) => {
      console.log('[LightingControl] API Success - setState:', vars);
    },
    onError: (error) => {
      console.error('[Lighting] Failed to set state:', error);
    },
  });
  
  // Turn lights on with optional scene
  const turnOn = useCallback(async (sceneId?: string) => {
    console.log('[LightingControl] turnOn called:', { sceneId, hasConfig: !!lightingConfig });
    
    if (sceneId && lightingConfig) {
      // Activate specific scene
      console.log('[LightingControl] Activating scene:', sceneId);
      await activateSceneMutation.mutateAsync({
        sceneId,
        groupId: lightingConfig.targetGroup || '0',
      });
      activeSceneRef.current = sceneId;
    } else {
      // Just turn on with default brightness
      console.log('[LightingControl] Turning on with default brightness');
      await setStateMutation.mutateAsync({
        state: {
          on: true,
          bri: 254,
          transitiontime: 10
        }
      });
    }
    setIsLightingOn(true);
  }, [lightingConfig, activateSceneMutation, setStateMutation]);
  
  // Turn lights completely off
  const turnOff = useCallback(async () => {
    console.log('[LightingControl] turnOff called');
    
    await setStateMutation.mutateAsync({
      state: {
        on: false,
        transitiontime: 10
      }
    });
    setIsLightingOn(false);
    activeSceneRef.current = null;
    
    console.log('[LightingControl] turnOff completed');
  }, [setStateMutation]);
  
  // Activate a specific scene (lights must be on)
  const activateScene = useCallback(async (sceneId: string) => {
    if (!isLightingOn || !lightingConfig) {
      console.log('[LightingControl] Skipping scene activation:', { isLightingOn, hasConfig: !!lightingConfig });
      return;
    }
    
    // Don't re-activate same scene
    if (activeSceneRef.current === sceneId) {
      console.log('[LightingControl] Scene already active:', sceneId);
      return;
    }
    
    console.log('[LightingControl] Activating new scene:', sceneId);
    await activateSceneMutation.mutateAsync({
      sceneId,
      groupId: lightingConfig.targetGroup || '0',
    });
    activeSceneRef.current = sceneId;
  }, [isLightingOn, lightingConfig, activateSceneMutation]);
  
  // Get scene for a specific phase
  const getSceneForPhase = useCallback((roundIndex: number, phaseType: string): string | null => {
    if (!lightingConfig) return null;
    
    const roundKey = `round-${roundIndex + 1}`;
    
    // Check round override first
    if (lightingConfig.roundOverrides?.[roundKey]?.[phaseType]) {
      return lightingConfig.roundOverrides[roundKey][phaseType].sceneId;
    }
    
    // Check global defaults
    const globalDefaults = lightingConfig.globalDefaults as any;
    if (globalDefaults?.[phaseType]) {
      return globalDefaults[phaseType].sceneId;
    }
    
    return null;
  }, [lightingConfig]);
  
  return {
    // State
    isLightingOn,
    lightingConfig,
    activeScene: activeSceneRef.current,
    
    // Actions
    turnOn,
    turnOff,
    activateScene,
    getSceneForPhase,
  };
}