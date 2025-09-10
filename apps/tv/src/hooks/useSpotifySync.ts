import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';

type SpotifyConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

export function useSpotifySync(sessionId: string) {
  const [connectionState, setConnectionState] = useState<SpotifyConnectionState>('disconnected');
  const [currentDevice, setCurrentDevice] = useState<SpotifyDevice | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Track the current volume level to restore after phase changes
  const lastVolumeRef = useRef<number>(85);
  const deviceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  console.log('[Spotify] Hook initialized with sessionId:', sessionId);

  // Get devices query
  const devicesQuery = useQuery({
    ...api.spotify.getDevices.queryOptions(),
    enabled: !!sessionId,
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Handle query results with useEffect
  useEffect(() => {
    if (devicesQuery.data && !devicesQuery.isLoading) {
      console.log('[Spotify] Processing devices data:', {
        devices: devicesQuery.data.devices,
        deviceCount: devicesQuery.data.devices?.length || 0,
        activeDevice: devicesQuery.data.activeDevice
      });
      
      const data = devicesQuery.data;
      // Look for Android TV device
      const tvDevice = data.devices.find(
        (d: SpotifyDevice) => d.type === 'TV' || d.name.toLowerCase().includes('tv')
      );
      
      console.log('[Spotify] TV device search result:', tvDevice);
      
      if (tvDevice) {
        console.log('[Spotify] Found TV device:', tvDevice.name, tvDevice.id);
        setCurrentDevice(tvDevice);
        setConnectionState('connected');
        setError(null);
      } else if (data.devices.length > 0) {
        // Use first available device if no TV found
        console.log('[Spotify] No TV found, using first device:', data.devices[0]);
        setCurrentDevice(data.devices[0]);
        setConnectionState('connected');
        setError('No TV device found, using first available device');
      } else {
        console.log('[Spotify] No devices found at all');
        setConnectionState('disconnected');
        setError('No Spotify devices available');
      }
    } else if (devicesQuery.error) {
      console.error('[Spotify] Failed to get devices:', {
        error: devicesQuery.error,
        message: (devicesQuery.error as any)?.message,
      });
      setConnectionState('error');
      setError('Failed to connect to Spotify');
    }
  }, [devicesQuery.data, devicesQuery.isLoading, devicesQuery.error]);

  // Log query state
  useEffect(() => {
    console.log('[Spotify] Query state:', {
      isLoading: devicesQuery.isLoading,
      isError: devicesQuery.isError,
      isFetching: devicesQuery.isFetching,
      data: devicesQuery.data,
      error: devicesQuery.error
    });
  }, [devicesQuery.isLoading, devicesQuery.isError, devicesQuery.data]);

  // Control mutations
  const controlMutation = useMutation({
    ...api.spotify.control.mutationOptions(),
    onError: (err) => {
      console.error('[Spotify] Control error:', err);
      setError(err.message);
    },
  });

  // Initialize session mutation
  const initSessionMutation = useMutation({
    ...api.spotify.initializeMusicSession.mutationOptions(),
    onSuccess: () => {
      console.log('[Spotify] Music session initialized');
    },
    onError: (err) => {
      console.error('[Spotify] Failed to initialize session:', err);
    },
  });

  // Initialize music session when device is available
  useEffect(() => {
    if (currentDevice && sessionId && connectionState === 'connected') {
      initSessionMutation.mutate({
        sessionId,
        deviceId: currentDevice.id,
      });
    }
  }, [currentDevice?.id, sessionId, connectionState]);

  // Play hype music for round start - NO-OP for MVP
  const playHypeMusic = useCallback(async (roundIndex: number) => {
    console.log('[Spotify] playHypeMusic called (disabled) for round:', roundIndex);
    // Intentionally do nothing - just maintain connection
  }, []);

  // Set volume based on workout phase - NO-OP for MVP
  const setVolume = useCallback(async (phase: 'work' | 'rest' | 'cooldown' | 'warmup') => {
    console.log('[Spotify] setVolume called (disabled) for phase:', phase);
    // Intentionally do nothing - just maintain connection
  }, []);

  // Pause music - NO-OP for MVP
  const pauseMusic = useCallback(async () => {
    console.log('[Spotify] pauseMusic called (disabled)');
    // Intentionally do nothing - just maintain connection
  }, []);

  // Resume music - NO-OP for MVP
  const resumeMusic = useCallback(async () => {
    console.log('[Spotify] resumeMusic called (disabled)');
    // Intentionally do nothing - just maintain connection
  }, []);

  // Handle phase changes - NO-OP for MVP
  const handlePhaseChange = useCallback(async (phase: 'warmup' | 'work' | 'rest' | 'cooldown') => {
    console.log('[Spotify] handlePhaseChange called (disabled) for phase:', phase);
    // Intentionally do nothing - just maintain connection
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (deviceCheckIntervalRef.current) {
        clearInterval(deviceCheckIntervalRef.current);
      }
    };
  }, []);

  return {
    // State
    isConnected: connectionState === 'connected',
    connectionState,
    currentDevice,
    error,
    
    // Actions
    playHypeMusic,
    pauseMusic,
    resumeMusic,
    setVolume,
    handlePhaseChange,
    
    // Queries
    refetchDevices: devicesQuery.refetch,
  };
}