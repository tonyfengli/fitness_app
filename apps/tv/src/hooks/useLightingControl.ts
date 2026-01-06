import { useCallback, useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { API_URL, EXPO_PUBLIC_HUE_BRIDGE_IP, EXPO_PUBLIC_HUE_APP_KEY, EXPO_PUBLIC_HUE_GROUP_ID } from '../env.generated';
import { hueDirectService } from '../services/HueDirectService';

interface UseLightingControlProps {
  sessionId?: string | null;
}

/**
 * Hybrid lighting control hook
 * - Uses direct local control when on same network as Hue Bridge
 * - Shows clear error when not on gym network
 * - No fallback to cloud control (by design)
 */
export function useLightingControl({ sessionId }: UseLightingControlProps) {
  const [isLightingOn, setIsLightingOn] = useState(false);
  const [bridgeAvailable, setBridgeAvailable] = useState<boolean | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const activeSceneRef = useRef<string | null>(null);
  
  // Check bridge connection on mount and periodically
  useEffect(() => {
    const checkBridge = async () => {
      const available = await hueDirectService.checkConnection();
      setBridgeAvailable(available);
      
      const status = hueDirectService.getStatus();
      setConnectionError(available ? null : status.error || 'Not on gym network');
      
      if (available) {
        console.log('[LightingControl] Hue Bridge available for direct control');
      } else {
        console.log('[LightingControl] Hue Bridge not available:', status.error);
      }
    };
    
    // Initial check
    checkBridge();
    
    // Recheck every 30 seconds
    const interval = setInterval(checkBridge, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Debug: Log environment on mount
  useEffect(() => {
    console.log('[LightingControl] Environment check:', {
      API_URL: API_URL || 'NOT SET',
      HUE_BRIDGE_IP: EXPO_PUBLIC_HUE_BRIDGE_IP || 'NOT SET',
      HUE_APP_KEY: EXPO_PUBLIC_HUE_APP_KEY ? 'SET' : 'NOT SET',
      HUE_GROUP_ID: EXPO_PUBLIC_HUE_GROUP_ID || 'NOT SET',
      sessionId
    });
  }, [sessionId]);
  
  // Fetch lighting configuration from API (for consistency)
  const { data: lightingConfig } = useQuery(
    sessionId ? api.lightingConfig.get.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ['disabled-lighting-config'],
      queryFn: () => Promise.resolve(null)
    }
  );
  
  // Turn lights on with optional scene
  const turnOn = useCallback(async (sceneId?: string) => {
    console.log('[LightingControl] turnOn called:', { 
      sceneId, 
      hasConfig: !!lightingConfig,
      bridgeAvailable,
      connectionError
    });
    
    // Check if bridge is available
    if (!bridgeAvailable) {
      const error = connectionError || 'Lighting unavailable - not on gym network';
      console.error('[LightingControl] Cannot control lights:', error);
      throw new Error(error);
    }
    
    try {
      if (sceneId && lightingConfig) {
        // Activate specific scene using direct control
        console.log('[LightingControl] Activating scene via direct control...');
        await hueDirectService.activateScene(sceneId, lightingConfig.targetGroup || '0');
        console.log('[LightingControl] Scene activated successfully');
        activeSceneRef.current = sceneId;
      } else {
        // Just turn on with default brightness
        console.log('[LightingControl] Turning on with default brightness via direct control...');
        await hueDirectService.setState({
          on: true,
          bri: 254,
          transitiontime: 10
        });
        console.log('[LightingControl] Lights turned on successfully');
      }
      setIsLightingOn(true);
    } catch (error: any) {
      console.error('[LightingControl] Failed to turn on lights:', error);
      // If bridge became unreachable, update status
      if (error.message?.includes('not available')) {
        setBridgeAvailable(false);
        setConnectionError(error.message);
      }
      throw error;
    }
  }, [lightingConfig, bridgeAvailable, connectionError]);
  
  // Turn lights completely off
  const turnOff = useCallback(async () => {
    console.log('[LightingControl] turnOff called');
    
    // Check if bridge is available
    if (!bridgeAvailable) {
      const error = connectionError || 'Lighting unavailable - not on gym network';
      console.error('[LightingControl] Cannot control lights:', error);
      throw new Error(error);
    }
    
    try {
      await hueDirectService.setState({
        on: false,
        transitiontime: 10
      });
      console.log('[LightingControl] Lights turned off successfully');
      setIsLightingOn(false);
      activeSceneRef.current = null;
    } catch (error: any) {
      console.error('[LightingControl] Failed to turn off lights:', error);
      // If bridge became unreachable, update status
      if (error.message?.includes('not available')) {
        setBridgeAvailable(false);
        setConnectionError(error.message);
      }
      throw error;
    }
  }, [bridgeAvailable, connectionError]);
  
  // Activate a specific scene (lights must be on)
  const activateScene = useCallback(async (sceneId: string) => {
    if (!isLightingOn || !lightingConfig) {
      return;
    }
    
    // Check if bridge is available
    if (!bridgeAvailable) {
      const error = connectionError || 'Lighting unavailable - not on gym network';
      console.error('[LightingControl] Cannot control lights:', error);
      throw new Error(error);
    }
    
    // Don't re-activate same scene
    if (activeSceneRef.current === sceneId) {
      return;
    }
    
    try {
      await hueDirectService.activateScene(sceneId, lightingConfig.targetGroup || '0');
      activeSceneRef.current = sceneId;
    } catch (error: any) {
      console.error('[LightingControl] Failed to activate scene:', error);
      // If bridge became unreachable, update status
      if (error.message?.includes('not available')) {
        setBridgeAvailable(false);
        setConnectionError(error.message);
      }
      throw error;
    }
  }, [isLightingOn, lightingConfig, bridgeAvailable, connectionError]);
  
  // Get scene for a specific phase (keep using config from API)
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
  
  // Refresh bridge connection manually
  const refreshConnection = useCallback(async () => {
    console.log('[LightingControl] Manually refreshing connection...');
    const available = await hueDirectService.refreshConnection();
    setBridgeAvailable(available);
    
    const status = hueDirectService.getStatus();
    setConnectionError(available ? null : status.error || 'Not on gym network');
    
    return available;
  }, []);
  
  return {
    // State
    isLightingOn,
    lightingConfig,
    activeScene: activeSceneRef.current,
    bridgeAvailable,
    connectionError,
    
    // Actions
    turnOn,
    turnOff,
    activateScene,
    getSceneForPhase,
    refreshConnection,
  };
}