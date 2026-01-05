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
    onError: (error) => {
      console.error('[Lighting] Failed to activate scene:', error);
    },
  });
  
  // State control mutation (on/off)
  const setStateMutation = useMutation({
    ...api.lighting.setState.mutationOptions(),
    onError: (error) => {
      console.error('[Lighting] Failed to set state:', error);
    },
  });
  
  // Turn lights on with optional scene
  const turnOn = useCallback(async (sceneId?: string) => {
    if (sceneId && lightingConfig) {
      // Activate specific scene
      await activateSceneMutation.mutateAsync({
        sceneId,
        groupId: lightingConfig.targetGroup || '0',
      });
      activeSceneRef.current = sceneId;
    } else {
      // Just turn on with default brightness
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
    await setStateMutation.mutateAsync({
      state: {
        on: false,
        transitiontime: 10
      }
    });
    setIsLightingOn(false);
    activeSceneRef.current = null;
  }, [setStateMutation]);
  
  // Activate a specific scene (lights must be on)
  const activateScene = useCallback(async (sceneId: string) => {
    if (!isLightingOn || !lightingConfig) {
      return;
    }
    
    // Don't re-activate same scene
    if (activeSceneRef.current === sceneId) {
      return;
    }
    
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
      const sceneId = lightingConfig.roundOverrides[roundKey][phaseType].sceneId;
      return sceneId;
    }
    
    // Check global defaults
    const globalDefaults = lightingConfig.globalDefaults as any;
    if (globalDefaults?.[phaseType]) {
      const sceneId = globalDefaults[phaseType].sceneId;
      return sceneId;
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