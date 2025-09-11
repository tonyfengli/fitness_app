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

export function useSpotifySync(sessionId: string, preSelectedDeviceId?: string | null, options?: { autoPlay?: boolean }) {
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
    } else if (!preSelectedDeviceId && currentDevice?.id) {
      // Device was removed (disconnected from mobile)
      console.log('[Spotify] Device disconnected, stopping music');
      controlMutation.mutate({
        action: 'pause',
        deviceId: currentDevice.id,
      }, {
        onError: (error: any) => {
          console.error('[Spotify] Failed to stop music on device removal:', error);
        }
      });
      setCurrentDevice(null);
      setConnectionState('disconnected');
    }
  }, [preSelectedDeviceId, currentDevice?.id]);
  
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
        console.log('[Spotify] No pre-selected device, staying disconnected');
        setConnectionState('disconnected');
        setCurrentDevice(null);
        // Don't set error - this is expected when no device is selected
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
    
    const shouldAutoPlay = options?.autoPlay ?? true; // Default to true for backward compatibility
    
    if (currentDevice && sessionId && connectionState === 'connected' && musicConfigQuery.data && !hasStartedPlaybackRef.current && shouldAutoPlay) {
      console.log('[Spotify] 🎵 Starting playback');
      hasStartedPlaybackRef.current = true;
      
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
        },
        onError: (error: any) => {
          console.error('[Spotify] ❌ Failed to start playback:', error);
          setError(`Failed to start music: ${error.message}`);
          hasStartedPlaybackRef.current = false; // Reset so we can retry
        }
      });
    }
  }, [currentDevice?.id, sessionId, connectionState, musicConfigQuery.data]);


  // Cleanup interval on unmount and reset playback flag when disconnected
  useEffect(() => {
    if (connectionState === 'disconnected' || connectionState === 'error') {
      hasStartedPlaybackRef.current = false;
      
      // Stop music if it was playing
      if (currentDevice?.id) {
        console.log('[Spotify] Stopping music due to disconnection');
        controlMutation.mutate({
          action: 'pause',
          deviceId: currentDevice.id,
        }, {
          onError: (error: any) => {
            console.error('[Spotify] Failed to stop music on disconnect:', error);
          }
        });
      }
    }
    
    return () => {
      if (deviceCheckIntervalRef.current) {
        clearInterval(deviceCheckIntervalRef.current);
      }
    };
  }, [connectionState, currentDevice?.id]);

  // Play a specific track at a specific position
  const playTrackAtPosition = useCallback(async (trackUri: string, positionMs: number) => {
    if (!currentDevice?.id) {
      console.error('[Spotify] Cannot play track - no device connected');
      return;
    }
    
    console.log('[Spotify] Playing track at position:', {
      trackUri,
      positionMs,
      deviceId: currentDevice.id,
      timestamp: new Date().toISOString()
    });
    
    controlMutation.mutate({
      action: 'play',
      deviceId: currentDevice.id,
      trackUri,
      positionMs,
    }, {
      onSuccess: () => {
        console.log('[Spotify] ✅ Successfully started playback at position');
      },
      onError: (error: any) => {
        console.error('[Spotify] ❌ Failed to play track at position:', error);
        setError(`Failed to play track: ${error.message}`);
      }
    });
  }, [currentDevice?.id, controlMutation]);

  return {
    // State
    isConnected: connectionState === 'connected',
    connectionState,
    currentDevice,
    error,
    
    // Actions
    playTrackAtPosition,
    
    // Queries
    refetchDevices: devicesQuery.refetch,
  };
}