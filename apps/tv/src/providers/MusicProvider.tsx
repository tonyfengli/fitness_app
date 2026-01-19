import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { musicService, MusicTrack } from '../services/MusicService';
import { musicDownloadService, SyncResult } from '../services/MusicDownloadService';
import { api } from './TRPCProvider';

const TRACKS_CACHE_KEY = '@music_tracks_cache';

interface MusicContextValue {
  // State
  isPlaying: boolean;
  isEnabled: boolean;
  isPaused: boolean;
  currentTrack: MusicTrack | null;
  currentEnergy: 'high' | 'low' | null;
  error: string | null;
  isSyncing: boolean;
  syncResult: SyncResult | null;
  tracks: MusicTrack[];

  // Actions
  start: () => Promise<void>;
  stop: () => Promise<void>;
  enable: () => void;  // Enable without playing (lets triggers handle playback)
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  skipNext: () => Promise<void>;
  skipBack: () => Promise<void>;
  syncMusic: () => Promise<void>;

  // Trigger-based playback
  playWithTrigger: (options: {
    energy: 'high' | 'low';
    useStartTimestamp?: boolean;
    trackId?: string;
  }) => Promise<void>;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export function MusicProvider({ children }: { children: React.ReactNode }) {
  // Core playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [currentEnergy, setCurrentEnergy] = useState<'high' | 'low' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Track history for skip back (persists across screen transitions)
  const playedTracksHistory = useRef<MusicTrack[]>([]);
  const isStartingRef = useRef(false);
  // Track when we're switching tracks (to ignore 'stopped' events during switch)
  const isSwitchingTrackRef = useRef(false);
  const pendingStart = useRef(false);

  // Cached tracks from AsyncStorage
  const [cachedTracks, setCachedTracks] = useState<MusicTrack[] | null>(null);
  const cacheLoaded = useRef(false);

  // Load cached tracks on mount
  useEffect(() => {
    if (cacheLoaded.current) return;
    cacheLoaded.current = true;

    AsyncStorage.getItem(TRACKS_CACHE_KEY)
      .then((data) => {
        if (data) {
          const parsed = JSON.parse(data) as MusicTrack[];
          setCachedTracks(parsed);
        }
      })
      .catch(() => {
        // Silently fail - cache is optional
      });
  }, []);

  // Fetch tracks from API
  const { data: apiTracksData, isLoading, error: queryError } = useQuery({
    ...api.music.list.queryOptions({}),
  });
  const apiTracks = apiTracksData as MusicTrack[] | undefined;

  // Cache tracks when API succeeds
  useEffect(() => {
    if (apiTracks && apiTracks.length > 0) {
      AsyncStorage.setItem(TRACKS_CACHE_KEY, JSON.stringify(apiTracks))
        .then(() => setCachedTracks(apiTracks))
        .catch(() => {});
    }
  }, [apiTracks]);

  // Determine track source: API > Cache
  const tracks = useMemo((): MusicTrack[] => {
    if (apiTracks && apiTracks.length > 0) {
      return apiTracks;
    }
    if (queryError || (!isLoading && (!apiTracks || apiTracks.length === 0))) {
      if (cachedTracks && cachedTracks.length > 0) {
        return cachedTracks;
      }
    }
    return [];
  }, [apiTracks, isLoading, queryError, cachedTracks]);

  // Play next random track (optionally filtered by energy)
  const playNextTrack = useCallback(async (options?: {
    energy?: 'high' | 'low';
    useStartTimestamp?: boolean;
  }) => {
    console.log(`[MusicProvider] playNextTrack called:`, { options, totalTracks: tracks.length });

    // Guard against concurrent play calls
    if (isStartingRef.current) {
      console.log(`[MusicProvider] Skipping playNextTrack - already starting a track`);
      return;
    }

    if (!tracks || tracks.length === 0) {
      console.log(`[MusicProvider] No tracks available!`);
      setError('No music tracks available');
      return;
    }

    // Mark as starting to prevent concurrent calls
    isStartingRef.current = true;

    const targetEnergy = options?.energy;
    const useStartTimestamp = options?.useStartTimestamp ?? false;

    // Filter by energy if specified
    let trackPool = targetEnergy
      ? tracks.filter(t => t.energy === targetEnergy)
      : tracks;

    console.log(`[MusicProvider] Energy filter: ${targetEnergy || 'none'}, pool size: ${trackPool.length}`);

    // Fallback to all tracks if no tracks match the energy
    if (trackPool.length === 0) {
      console.log(`[MusicProvider] No ${targetEnergy} energy tracks, falling back to all tracks`);
      trackPool = tracks;
    }

    // Get IDs of recently played tracks
    const recentlyPlayedIds = new Set(
      playedTracksHistory.current.slice(-Math.max(0, trackPool.length - 1)).map(t => t.id)
    );

    let availableTracks = trackPool.filter(t => !recentlyPlayedIds.has(t.id));

    if (availableTracks.length === 0) {
      playedTracksHistory.current = [];
      availableTracks = trackPool;
    }

    const randomIndex = Math.floor(Math.random() * availableTracks.length);
    const track = availableTracks[randomIndex];

    if (track) {
      console.log(`[MusicProvider] 🎶 Selected track: "${track.name}" (${track.energy} energy), useStartTimestamp: ${useStartTimestamp}`);
      try {
        playedTracksHistory.current.push(track);
        setIsPaused(false);
        setCurrentEnergy(track.energy);
        // Mark that we're switching tracks so 'stopped' event is ignored
        isSwitchingTrackRef.current = true;
        await musicService.play(track, useStartTimestamp);
        setError(null);
      } catch (err) {
        console.error(`[MusicProvider] Error playing track:`, err);
        setError(err instanceof Error ? err.message : 'Failed to play track');
        // Clear the switching flag on error
        isSwitchingTrackRef.current = false;
      } finally {
        // Clear the starting flag so next play can proceed
        isStartingRef.current = false;
      }
    } else {
      console.log(`[MusicProvider] No track selected from pool of ${availableTracks.length}`);
      isStartingRef.current = false;
    }
  }, [tracks]);

  // Play a specific track by ID or random track with energy filter
  const playWithTrigger = useCallback(async (options: {
    energy: 'high' | 'low';
    useStartTimestamp?: boolean;
    trackId?: string;
  }) => {
    const { energy, useStartTimestamp = false, trackId } = options;

    console.log(`[MusicProvider] 🎵 playWithTrigger called:`, { energy, useStartTimestamp, trackId, availableTracks: tracks.length });

    // Guard against concurrent play calls
    if (isStartingRef.current) {
      console.log(`[MusicProvider] Skipping playWithTrigger - already starting a track`);
      return;
    }

    // If a specific track is requested, try to find and play it
    if (trackId) {
      const specificTrack = tracks.find(t => t.id === trackId);
      if (specificTrack) {
        isStartingRef.current = true;
        try {
          console.log(`[MusicProvider] Playing specific track:`, specificTrack.name);
          playedTracksHistory.current.push(specificTrack);
          setIsPaused(false);
          setCurrentEnergy(specificTrack.energy);
          setIsEnabled(true);
          // Mark that we're switching tracks so 'stopped' event is ignored
          isSwitchingTrackRef.current = true;
          await musicService.play(specificTrack, useStartTimestamp);
          setError(null);
          return;
        } catch (err) {
          console.warn(`[MusicProvider] Failed to play specific track ${trackId}, falling back to energy-based selection`);
          // Clear the switching flag on error before falling back
          isSwitchingTrackRef.current = false;
        } finally {
          isStartingRef.current = false;
        }
      } else {
        console.warn(`[MusicProvider] Track ${trackId} not found, falling back to energy-based selection`);
      }
    }

    // Play random track with energy filter
    console.log(`[MusicProvider] Playing random ${energy} energy track`);
    setIsEnabled(true);
    await playNextTrack({ energy, useStartTimestamp });
  }, [tracks, playNextTrack]);

  // Subscribe to MusicService events (single subscription at provider level)
  useEffect(() => {
    const unsubscribe = musicService.addEventListener((event) => {
      switch (event.type) {
        case 'trackStart':
          // Clear the switching flag now that new track has started
          isSwitchingTrackRef.current = false;
          setIsPlaying(true);
          setCurrentTrack(event.track || null);
          if (event.track?.energy) {
            setCurrentEnergy(event.track.energy);
          }
          break;
        case 'trackEnd':
          setCurrentTrack(null);
          // Auto-play next track if enabled, maintaining current energy level
          if (isEnabled) {
            playNextTrack({ energy: currentEnergy ?? undefined });
          } else {
            setIsPlaying(false);
          }
          break;
        case 'stopped':
          // Ignore 'stopped' events during track switching (internal stop before new track)
          if (isSwitchingTrackRef.current) {
            console.log(`[MusicProvider] Ignoring 'stopped' event during track switch`);
            break;
          }
          // Handle external stop calls (e.g., from navigation)
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentTrack(null);
          setCurrentEnergy(null);
          setIsEnabled(false);
          break;
        case 'error':
          setError(event.error?.message || 'Music playback error');
          setIsPlaying(false);
          break;
      }
    });

    return unsubscribe;
  }, [isEnabled, playNextTrack, currentEnergy]);

  // Start music
  const start = useCallback(async () => {
    // Guard handled by playNextTrack, but also check isPlaying
    if (isStartingRef.current || isPlaying) return;

    if (tracks.length === 0) {
      pendingStart.current = true;
      setIsEnabled(true);
      return;
    }

    pendingStart.current = false;
    setIsEnabled(true);
    setError(null);

    await playNextTrack();
  }, [tracks.length, isPlaying, playNextTrack]);

  // Auto-start when tracks become available
  useEffect(() => {
    if (pendingStart.current && tracks.length > 0 && !isPlaying && !isStartingRef.current) {
      pendingStart.current = false;
      start();
    }
  }, [tracks.length, isPlaying, start]);

  // Stop music
  const stop = useCallback(async () => {
    setIsEnabled(false);
    setIsPaused(false);
    await musicService.stop();
    setIsPlaying(false);
    setCurrentTrack(null);
  }, []);

  // Enable music without playing (lets useWorkoutMusic triggers handle playback)
  const enable = useCallback(() => {
    setIsEnabled(true);
    setError(null);
  }, []);

  // Pause music
  const pause = useCallback(() => {
    if (isPlaying && !isPaused) {
      musicService.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  }, [isPlaying, isPaused]);

  // Resume music
  const resume = useCallback(() => {
    if (isPaused && currentTrack) {
      musicService.resume();
      setIsPaused(false);
      setIsPlaying(true);
    }
  }, [isPaused, currentTrack]);

  // Toggle music
  const toggle = useCallback(() => {
    if (isEnabled) {
      stop();
    } else {
      start();
    }
  }, [isEnabled, start, stop]);

  // Skip to next track
  const skipNext = useCallback(async () => {
    setIsPaused(false);
    await playNextTrack();
  }, [playNextTrack]);

  // Skip back
  const skipBack = useCallback(async () => {
    const currentTime = await musicService.getCurrentTime();

    if (currentTime > 5 && currentTrack) {
      musicService.seekTo(0);
      return;
    }

    if (playedTracksHistory.current.length >= 2) {
      playedTracksHistory.current.pop();
      const previousTrack = playedTracksHistory.current.pop();

      if (previousTrack) {
        try {
          playedTracksHistory.current.push(previousTrack);
          setIsPaused(false);
          await musicService.play(previousTrack, false);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to play previous track');
        }
      }
    } else if (currentTrack) {
      musicService.seekTo(0);
    }
  }, [currentTrack]);

  // Sync music files
  const syncMusic = useCallback(async () => {
    if (!tracks || tracks.length === 0 || isSyncing) return;

    setIsSyncing(true);
    setError(null);

    try {
      const result = await musicDownloadService.syncTracks(tracks);
      setSyncResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync music');
    } finally {
      setIsSyncing(false);
    }
  }, [tracks, isSyncing]);

  const value: MusicContextValue = {
    isPlaying,
    isEnabled,
    isPaused,
    currentTrack,
    currentEnergy,
    error,
    isSyncing,
    syncResult,
    tracks,
    start,
    stop,
    enable,
    pause,
    resume,
    toggle,
    skipNext,
    skipBack,
    syncMusic,
    playWithTrigger,
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic(): MusicContextValue {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
}
