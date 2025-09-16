import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    if (preSelectedDeviceId && currentDevice?.id !== preSelectedDeviceId) {
      setHasSearchedForDevice(false);
      setError(null);
    } else if (!preSelectedDeviceId && currentDevice?.id) {
      // Device was removed (disconnected from mobile)
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
  const queryClient = useQueryClient();


  // Get devices query - with optimized polling
  const devicesQuery = useQuery({
    ...api.spotify.getDevices.queryOptions(),
    enabled: !!sessionId && connectionState !== 'connected', // Stop polling when connected
    refetchInterval: connectionState === 'connecting' ? 5000 : 15000, // Fast when connecting, slow otherwise
  });

  // Handle query results with useEffect
  useEffect(() => {
    if (devicesQuery.data && !devicesQuery.isLoading) {
      const data = devicesQuery.data;
      
      // First, try to find pre-selected device
      if (preSelectedDeviceId) {
        if (!hasSearchedForDevice) {
          setHasSearchedForDevice(true);
          setConnectionState('connecting');
        }
        
        const preSelectedDevice = data.devices.find(
          (d: SpotifyDevice) => d.id === preSelectedDeviceId
        );
        
        if (preSelectedDevice) {
          if (!currentDevice || currentDevice.id !== preSelectedDevice.id) {
            console.log('[Spotify] Device connected:', preSelectedDevice.name, {
              deviceId: preSelectedDevice.id,
              wasConnected: !!currentDevice,
              previousState: connectionState,
              timestamp: new Date().toISOString()
            });
          }
          setCurrentDevice(preSelectedDevice);
          setConnectionState('connected');
          setError(null); // Clear any previous errors
          return;
        } else {
          // Device was connected but now it's gone
          if (connectionState === 'connected' && currentDevice?.id === preSelectedDeviceId) {
            console.log('[Spotify] Device disconnected during workout');
            setCurrentDevice(null);
            setConnectionState('disconnected');
            setError('Spotify device disconnected');
          } else if (!hasSearchedForDevice) {
            setConnectionState('connecting');
          } else {
            setConnectionState('disconnected');
            setError(`Device not available`);
          }
        }
      }
      
      // Only use fallback logic if no pre-selected device was provided
      if (!preSelectedDeviceId) {
        setConnectionState('disconnected');
        setCurrentDevice(null);
        // Don't set error - this is expected when no device is selected
      }
    } else if (devicesQuery.error) {
      console.error('[Spotify] Failed to get devices:', devicesQuery.error);
      setConnectionState('error');
      setError('Failed to connect to Spotify');
    }
  }, [devicesQuery.data, devicesQuery.isLoading, devicesQuery.error, preSelectedDeviceId]);
  
  // Log connection state changes
  useEffect(() => {
    console.log('[Spotify] Connection state changed:', {
      state: connectionState,
      hasDevice: !!currentDevice,
      deviceId: currentDevice?.id,
      preSelectedDeviceId,
      timestamp: new Date().toISOString()
    });
  }, [connectionState, currentDevice?.id]);
  
  // Manual device polling when connected to detect disconnections
  useEffect(() => {
    console.log('[Spotify] Polling effect triggered', {
      sessionId: !!sessionId,
      preSelectedDeviceId: !!preSelectedDeviceId,
      connectionState,
      currentDevice: !!currentDevice,
      timestamp: new Date().toISOString()
    });
    
    if (!sessionId || !preSelectedDeviceId) {
      console.log('[Spotify] Polling skipped - missing sessionId or deviceId');
      return;
    }
    
    // Only poll when we're connected or think we're connected
    if (connectionState === 'disconnected' || connectionState === 'error') {
      console.log('[Spotify] Polling skipped - not connected', { connectionState });
      return;
    }
    
    console.log('[Spotify] Starting device keep-alive polling', {
      connectionState,
      currentDevice: currentDevice?.name,
      timestamp: new Date().toISOString()
    });
    
    const checkDevice = async () => {
      console.log('[Spotify] Polling check running', { timestamp: new Date().toISOString() });
      try {
        const result = await queryClient.fetchQuery({
          ...api.spotify.getDevices.queryOptions(),
          staleTime: 0, // Always fetch fresh data
        });
        const device = result.devices.find((d: SpotifyDevice) => d.id === preSelectedDeviceId);
        
        console.log('[Spotify] Poll result:', {
          foundDevice: !!device,
          deviceCount: result.devices.length,
          currentDevice: !!currentDevice,
          timestamp: new Date().toISOString()
        });
        
        if (!device && currentDevice) {
          // Device disappeared - only log if we had a device before
          console.log('[Spotify] Device disconnected during polling check');
          setCurrentDevice(null);
          setConnectionState('disconnected');
          setError('Spotify device disconnected');
          hasStartedPlaybackRef.current = false;
        } else if (device && !currentDevice) {
          // Device reappeared
          console.log('[Spotify] Device reconnected during polling check');
          setCurrentDevice(device);
          setConnectionState('connected');
          setError(null);
        }
      } catch (error) {
        // Silent fail - don't affect UI
        console.log('[Spotify] Keep-alive poll failed (non-critical):', error);
      }
    };
    
    // Check immediately, then every 20 seconds (more frequent)
    checkDevice();
    const interval = setInterval(checkDevice, 20000);
    
    return () => {
      console.log('[Spotify] Stopping device keep-alive polling');
      clearInterval(interval);
    };
  }, [sessionId, preSelectedDeviceId, connectionState, currentDevice, queryClient]);

  // Control mutations
  const controlMutation = useMutation({
    ...api.spotify.control.mutationOptions(),
    onError: (err: any) => {
      console.error('[Spotify] Control error:', err);
      setError(err.message);
    },
  });
  
  // Volume mutation
  const volumeMutation = useMutation({
    ...api.spotify.setVolume.mutationOptions(),
    onError: (err: any) => {
      console.warn('[Spotify] Volume control error (non-critical):', err);
    },
  });


  // Track if we've already started playing music
  const hasStartedPlaybackRef = useRef(false);
  
  // Get session data with setlist
  const sessionQuery = useQuery({
    ...api.trainingSession.getSession.queryOptions({ id: sessionId || '' }),
    enabled: !!sessionId,
  });
  
  // Initialize music session and start playback when device is available
  useEffect(() => {
    // Check both possible locations for setlist (for backward compatibility)
    const templateConfig = sessionQuery.data?.templateConfig as any;
    const setlist = templateConfig?.setlist || 
                   templateConfig?.visualizationData?.llmResult?.metadata?.setlist;
    const shouldAutoPlay = options?.autoPlay ?? true;
    
    console.log('[Spotify] Auto-play check:', {
      hasDevice: !!currentDevice,
      deviceId: currentDevice?.id,
      connectionState,
      hasSetlist: !!setlist,
      hasStartedPlayback: hasStartedPlaybackRef.current,
      shouldAutoPlay,
      timestamp: new Date().toISOString()
    });
    
    if (currentDevice && sessionId && connectionState === 'connected' && setlist && !hasStartedPlaybackRef.current && shouldAutoPlay) {
      console.log('[Spotify] Starting auto-playback');
      hasStartedPlaybackRef.current = true;
      
      // Pick the first hype track from the setlist
      const firstHypeTrack = setlist.rounds?.[0]?.track1;
      if (!firstHypeTrack) {
        console.error('[Spotify] No tracks in setlist');
        return;
      }
      
      // Start playing music
      controlMutation.mutate({
        action: 'play',
        deviceId: currentDevice.id,
        trackUri: firstHypeTrack.spotifyId,
        positionMs: 0,
      }, {
        onSuccess: () => {
          // Set volume to 5% after starting playback
          volumeMutation.mutate({
            volumePercent: 5,
            deviceId: currentDevice.id,
          });
        },
        onError: (error: any) => {
          console.error('[Spotify] ❌ Failed to start playback:', error);
          setError(`Failed to start music: ${error.message}`);
          hasStartedPlaybackRef.current = false; // Reset so we can retry
          
          // Check if device is still connected - if not, trigger a refresh
          if (error.message?.includes('Device not found') || error.message?.includes('404')) {
            setConnectionState('disconnected');
            setCurrentDevice(null);
            // This will trigger the device query to restart polling
          }
        }
      });
    }
  }, [currentDevice?.id, sessionId, connectionState, sessionQuery.data]);


  // Cleanup interval on unmount and reset playback flag when disconnected
  useEffect(() => {
    if (connectionState === 'disconnected' || connectionState === 'error') {
      hasStartedPlaybackRef.current = false;
      
      // Stop music if it was playing
      if (currentDevice?.id) {
        controlMutation.mutate({
          action: 'pause',
          deviceId: currentDevice.id,
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
      console.error('[Spotify] Cannot play track - no device connected', {
        currentDevice,
        connectionState,
        preSelectedDeviceId,
        hasStartedPlayback: hasStartedPlaybackRef.current,
        trackUri,
        timestamp: new Date().toISOString()
      });
      
      // Try to refetch devices once if disconnected
      if (preSelectedDeviceId && connectionState !== 'connecting') {
        console.log('[Spotify] Attempting to refetch devices...');
        devicesQuery.refetch();
      }
      return;
    }
    
    controlMutation.mutate({
      action: 'play',
      deviceId: currentDevice.id,
      trackUri,
      positionMs,
    }, {
      onError: (error: any) => {
        console.error('[Spotify] Failed to play track:', error);
        setError(`Failed to play track: ${error.message}`);
        
        // Check if device is still connected - if not, trigger a refresh
        if (error.message?.includes('Device not found') || error.message?.includes('404')) {
          setConnectionState('disconnected');
          setCurrentDevice(null);
          // This will trigger the device query to restart polling
        }
      }
    });
  }, [currentDevice?.id, controlMutation]);

  // Prefetch all tracks in the setlist
  const prefetchSetlistTracks = useCallback(async () => {
    const templateConfig = sessionQuery.data?.templateConfig as any;
    const setlist = templateConfig?.setlist || 
                   templateConfig?.visualizationData?.llmResult?.metadata?.setlist;
    if (!setlist || !currentDevice?.id) {
      return;
    }

    const trackUris: string[] = [];
    
    // Collect all unique track URIs from the setlist
    setlist.rounds.forEach((round: any) => {
      if (round.track1?.spotifyId) trackUris.push(round.track1.spotifyId);
      if (round.track2?.spotifyId) trackUris.push(round.track2.spotifyId);
    });

    // Remove duplicates
    const uniqueTrackUris = [...new Set(trackUris)];
    
    // Note: Spotify doesn't have a direct prefetch API
    // In a production app, you might implement caching by:
    // 1. Adding tracks to queue (requires implementing queue action in backend)
    // 2. Pre-loading track metadata
    // 3. Using Spotify Web SDK's preload capabilities
  }, [sessionQuery.data, currentDevice?.id]);

  const templateConfig = sessionQuery.data?.templateConfig as any;
  const setlistData = templateConfig?.setlist || 
                     templateConfig?.visualizationData?.llmResult?.metadata?.setlist;

  return {
    // State
    isConnected: connectionState === 'connected',
    connectionState,
    currentDevice,
    error,
    setlist: setlistData,
    
    // Actions
    playTrackAtPosition,
    prefetchSetlistTracks,
    
    // Queries
    refetchDevices: devicesQuery.refetch,
  };
}