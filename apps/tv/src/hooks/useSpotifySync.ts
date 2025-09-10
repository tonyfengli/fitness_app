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

export function useSpotifySync(sessionId: string, preSelectedDeviceId?: string | null) {
  // If we have a pre-selected device, start in connecting state
  const [connectionState, setConnectionState] = useState<SpotifyConnectionState>(
    preSelectedDeviceId ? 'connecting' : 'disconnected'
  );
  const [currentDevice, setCurrentDevice] = useState<SpotifyDevice | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we've attempted to find the pre-selected device yet
  const [hasSearchedForDevice, setHasSearchedForDevice] = useState(false);
  
  // Reset search state when device ID changes
  useEffect(() => {
    console.log('[Spotify] Pre-selected device ID changed:', {
      old: currentDevice?.id,
      new: preSelectedDeviceId,
      timestamp: new Date().toISOString()
    });
    if (preSelectedDeviceId && currentDevice?.id !== preSelectedDeviceId) {
      setHasSearchedForDevice(false);
      setError(null);
    }
  }, [preSelectedDeviceId]);
  
  // Track the current volume level to restore after phase changes
  const lastVolumeRef = useRef<number>(85);
  const deviceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  console.log('[Spotify] Hook initialized with:', {
    sessionId,
    preSelectedDeviceId,
    timestamp: new Date().toISOString()
  });

  // Get devices query
  const devicesQuery = useQuery({
    ...api.spotify.getDevices.queryOptions(),
    enabled: !!sessionId,
    refetchInterval: 5000, // Check every 5 seconds for faster connection
    onSuccess: (data) => {
      console.log('[Spotify] Device query success:', {
        deviceCount: data?.devices?.length || 0,
        timestamp: new Date().toISOString()
      });
    },
    onError: (error) => {
      console.log('[Spotify] Device query error:', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
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
      
      // First, try to find pre-selected device
      if (preSelectedDeviceId) {
        console.log('[Spotify] Looking for pre-selected device:', {
          preSelectedDeviceId,
          availableDevices: data.devices.map((d: SpotifyDevice) => ({ id: d.id, name: d.name })),
          timestamp: new Date().toISOString()
        });
        
        if (!hasSearchedForDevice) {
          setHasSearchedForDevice(true);
          setConnectionState('connecting');
        }
        
        const preSelectedDevice = data.devices.find(
          (d: SpotifyDevice) => d.id === preSelectedDeviceId
        );
        
        if (preSelectedDevice) {
          console.log('[Spotify] ✅ Found pre-selected device:', {
            device: preSelectedDevice,
            timestamp: new Date().toISOString()
          });
          setCurrentDevice(preSelectedDevice);
          setConnectionState('connected');
          setError(null); // Clear any previous errors
          return;
        } else {
          console.log('[Spotify] ❌ Pre-selected device not found in available devices:', {
            preSelectedDeviceId,
            availableDeviceIds: data.devices.map((d: SpotifyDevice) => d.id),
            timestamp: new Date().toISOString()
          });
          // Keep in connecting state if we haven't searched for long
          if (!hasSearchedForDevice) {
            setConnectionState('connecting');
          } else {
            setConnectionState('disconnected');
            setError(`Device not available`);
          }
        }
      }
      
      // Only use fallback logic if no pre-selected device was provided
      if (!preSelectedDeviceId) {
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
      }
    } else if (devicesQuery.error) {
      console.error('[Spotify] Failed to get devices:', {
        error: devicesQuery.error,
        message: (devicesQuery.error as any)?.message,
        timestamp: new Date().toISOString()
      });
      setConnectionState('error');
      setError('Failed to connect to Spotify');
    } else if (devicesQuery.isLoading) {
      console.log('[Spotify] Devices query is loading...', {
        timestamp: new Date().toISOString()
      });
    }
  }, [devicesQuery.data, devicesQuery.isLoading, devicesQuery.error, preSelectedDeviceId]);

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
    onError: (err: any) => {
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

  // Track if we've already started playing music
  const hasStartedPlaybackRef = useRef(false);
  
  // Get music config query
  const musicConfigQuery = useQuery({
    ...api.spotify.getMusicConfig.queryOptions(),
    enabled: !!sessionId,
  });
  
  // Initialize music session and start playback when device is available
  useEffect(() => {
    console.log('[Spotify] Music session init check:', {
      hasDevice: !!currentDevice,
      deviceId: currentDevice?.id,
      sessionId,
      connectionState,
      shouldInit: currentDevice && sessionId && connectionState === 'connected',
      hasConfig: !!musicConfigQuery.data,
      hasStartedPlayback: hasStartedPlaybackRef.current,
      timestamp: new Date().toISOString()
    });
    
    if (currentDevice && sessionId && connectionState === 'connected' && musicConfigQuery.data && !hasStartedPlaybackRef.current) {
      console.log('[Spotify] 🎵 Initializing music session and starting playback');
      hasStartedPlaybackRef.current = true;
      
      // Initialize session
      initSessionMutation.mutate({
        sessionId,
        deviceId: currentDevice.id,
      });
      
      // Pick a random track from the workout tracks
      const workoutTracks = musicConfigQuery.data.tracks.workout;
      const randomTrack = workoutTracks[Math.floor(Math.random() * workoutTracks.length)];
      
      console.log('[Spotify] 🎵 Starting playback with random track:', {
        trackUri: randomTrack.spotifyId,
        deviceId: currentDevice.id,
        timestamp: new Date().toISOString()
      });
      
      // Start playing music
      controlMutation.mutate({
        action: 'play',
        deviceId: currentDevice.id,
        trackUri: randomTrack.spotifyId,
        positionMs: 0,
      }, {
        onSuccess: () => {
          console.log('[Spotify] ✅ Successfully started playback');
          // Set initial volume
          controlMutation.mutate({
            action: 'volume',
            deviceId: currentDevice.id,
            volumePercent: musicConfigQuery.data.volume.warmup,
          });
        },
        onError: (error: any) => {
          console.error('[Spotify] ❌ Failed to start playback:', error);
          setError(`Failed to start music: ${error.message}`);
          hasStartedPlaybackRef.current = false; // Reset so we can retry
        }
      });
    }
  }, [currentDevice?.id, sessionId, connectionState, musicConfigQuery.data]);

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

  // Cleanup interval on unmount and reset playback flag when disconnected
  useEffect(() => {
    if (connectionState === 'disconnected' || connectionState === 'error') {
      hasStartedPlaybackRef.current = false;
    }
    
    return () => {
      if (deviceCheckIntervalRef.current) {
        clearInterval(deviceCheckIntervalRef.current);
      }
    };
  }, [connectionState]);

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