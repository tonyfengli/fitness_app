import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { musicService, MusicTrack, MusicSegment, EnergyLevel } from '../services/MusicService';
import { musicDownloadService, SyncResult } from '../services/MusicDownloadService';
import { api } from './TRPCProvider';

const TRACKS_CACHE_KEY = '@music_tracks_cache';

// Playable energy levels (excludes 'outro')
type PlayableEnergy = 'low' | 'medium' | 'high';

interface MusicContextValue {
  // State
  isPlaying: boolean;
  isEnabled: boolean;
  isPaused: boolean;
  currentTrack: MusicTrack | null;
  currentSegment: MusicSegment | null;
  currentEnergy: EnergyLevel | null;
  error: string | null;
  isSyncing: boolean;
  syncResult: SyncResult | null;
  tracks: MusicTrack[];
  buildupCountdown: number | null; // Seconds remaining in buildup, null if not in buildup

  // Actions
  start: () => Promise<void>;
  stop: () => Promise<void>;
  enable: () => void;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  skipNext: () => Promise<void>;
  skipBack: () => Promise<void>;
  syncMusic: () => Promise<void>;
  clearLocalTracks: () => Promise<void>;

  // Trigger-based playback
  playWithTrigger: (options: {
    energy: PlayableEnergy;
    useBuildup?: boolean;
    trackId?: string;
  }) => Promise<void>;
}

const MusicContext = createContext<MusicContextValue | null>(null);

/**
 * Helper to check if a track has a segment with the given energy
 */
function hasEnergySegment(track: MusicTrack, energy: PlayableEnergy): boolean {
  return track.segments?.some(s => s.energy === energy) ?? false;
}

/**
 * Helper to get a random segment with the given energy from a track
 */
function getRandomSegmentByEnergy(segments: MusicSegment[], energy: PlayableEnergy): MusicSegment | null {
  const matching = segments.filter(s => s.energy === energy);
  if (matching.length === 0) return null;
  return matching[Math.floor(Math.random() * matching.length)] ?? null;
}

export function MusicProvider({ children }: { children: React.ReactNode }) {
  // Core playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [currentSegment, setCurrentSegment] = useState<MusicSegment | null>(null);
  const [currentEnergy, setCurrentEnergy] = useState<EnergyLevel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buildupCountdown, setBuildupCountdown] = useState<number | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Track history for skip back (persists across screen transitions)
  const playedTracksHistory = useRef<{ track: MusicTrack; segment: MusicSegment | null }[]>([]);
  const isStartingRef = useRef(false);
  const isSwitchingTrackRef = useRef(false);
  const pendingStart = useRef(false);
  const buildupIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Start buildup countdown
  const startBuildupCountdown = useCallback((durationSeconds: number) => {
    setBuildupCountdown(durationSeconds);

    // Clear any existing interval
    if (buildupIntervalRef.current) {
      clearInterval(buildupIntervalRef.current);
    }

    // Count down every second
    buildupIntervalRef.current = setInterval(() => {
      setBuildupCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (buildupIntervalRef.current) {
            clearInterval(buildupIntervalRef.current);
            buildupIntervalRef.current = null;
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Clear buildup countdown
  const clearBuildupCountdown = useCallback(() => {
    if (buildupIntervalRef.current) {
      clearInterval(buildupIntervalRef.current);
      buildupIntervalRef.current = null;
    }
    setBuildupCountdown(null);
  }, []);

  // Play next random track (optionally filtered by energy)
  const playNextTrack = useCallback(async (options?: {
    energy?: PlayableEnergy;
    useBuildup?: boolean;
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

    isStartingRef.current = true;

    const targetEnergy = options?.energy;
    const useBuildup = options?.useBuildup ?? false;

    // Filter tracks that have segments with the target energy
    let trackPool = targetEnergy
      ? tracks.filter(t => hasEnergySegment(t, targetEnergy))
      : tracks;

    console.log(`[MusicProvider] Energy filter: ${targetEnergy || 'none'}, pool size: ${trackPool.length}`);

    // Fallback to all tracks if no tracks match the energy
    if (trackPool.length === 0) {
      console.log(`[MusicProvider] No ${targetEnergy} energy tracks, falling back to all tracks`);
      trackPool = tracks;
    }

    // Get IDs of recently played tracks
    const recentlyPlayedIds = new Set(
      playedTracksHistory.current.slice(-Math.max(0, trackPool.length - 1)).map(h => h.track.id)
    );

    let availableTracks = trackPool.filter(t => !recentlyPlayedIds.has(t.id));

    if (availableTracks.length === 0) {
      playedTracksHistory.current = [];
      availableTracks = trackPool;
    }

    const randomIndex = Math.floor(Math.random() * availableTracks.length);
    const track = availableTracks[randomIndex];

    if (track) {
      // Select a segment with the target energy (or first segment as fallback)
      const segment = targetEnergy
        ? getRandomSegmentByEnergy(track.segments || [], targetEnergy)
        : track.segments?.[0] || null;

      console.log(`[MusicProvider] Selected track: "${track.name}", segment: ${segment?.energy} @ ${segment?.timestamp}s, useBuildup: ${useBuildup}`);

      try {
        playedTracksHistory.current.push({ track, segment });
        setIsPaused(false);
        setCurrentEnergy(segment?.energy || null);
        isSwitchingTrackRef.current = true;

        // Start buildup countdown if applicable
        if (useBuildup && segment?.buildupDuration && segment.buildupDuration > 0) {
          startBuildupCountdown(segment.buildupDuration);
        }

        await musicService.play(track, { segment, useBuildup });
        setError(null);
      } catch (err) {
        console.error(`[MusicProvider] Error playing track:`, err);
        setError(err instanceof Error ? err.message : 'Failed to play track');
        isSwitchingTrackRef.current = false;
        clearBuildupCountdown();
      } finally {
        isStartingRef.current = false;
      }
    } else {
      console.log(`[MusicProvider] No track selected from pool of ${availableTracks.length}`);
      isStartingRef.current = false;
    }
  }, [tracks, startBuildupCountdown, clearBuildupCountdown]);

  // Play with trigger (specific track or energy-based selection)
  const playWithTrigger = useCallback(async (options: {
    energy: PlayableEnergy;
    useBuildup?: boolean;
    trackId?: string;
  }) => {
    const { energy, useBuildup = false, trackId } = options;

    console.log(`[MusicProvider] playWithTrigger called:`, { energy, useBuildup, trackId, availableTracks: tracks.length });

    // Guard against concurrent play calls
    if (isStartingRef.current) {
      console.log(`[MusicProvider] Skipping playWithTrigger - already starting a track`);
      return;
    }

    // If a specific track is requested, try to find and play it
    if (trackId) {
      const specificTrack = tracks.find(t => t.id === trackId);
      if (specificTrack && hasEnergySegment(specificTrack, energy)) {
        isStartingRef.current = true;
        try {
          const segment = getRandomSegmentByEnergy(specificTrack.segments || [], energy);

          console.log(`[MusicProvider] Playing specific track: ${specificTrack.name}, segment: ${segment?.energy}`);

          playedTracksHistory.current.push({ track: specificTrack, segment });
          setIsPaused(false);
          setCurrentEnergy(segment?.energy || energy);
          setIsEnabled(true);
          isSwitchingTrackRef.current = true;

          if (useBuildup && segment?.buildupDuration && segment.buildupDuration > 0) {
            startBuildupCountdown(segment.buildupDuration);
          }

          await musicService.play(specificTrack, { segment, useBuildup });
          setError(null);
          return;
        } catch (err) {
          console.warn(`[MusicProvider] Failed to play specific track ${trackId}, falling back`);
          isSwitchingTrackRef.current = false;
          clearBuildupCountdown();
        } finally {
          isStartingRef.current = false;
        }
      } else {
        console.warn(`[MusicProvider] Track ${trackId} not found or has no ${energy} segment, falling back`);
      }
    }

    // Play random track with energy filter
    console.log(`[MusicProvider] Playing random ${energy} energy track`);
    setIsEnabled(true);
    await playNextTrack({ energy, useBuildup });
  }, [tracks, playNextTrack, startBuildupCountdown, clearBuildupCountdown]);

  // Subscribe to MusicService events
  useEffect(() => {
    const unsubscribe = musicService.addEventListener((event) => {
      switch (event.type) {
        case 'trackStart':
          isSwitchingTrackRef.current = false;
          setIsPlaying(true);
          setCurrentTrack(event.track || null);
          setCurrentSegment(event.segment || null);
          if (event.segment?.energy) {
            setCurrentEnergy(event.segment.energy);
          }
          break;
        case 'trackEnd':
          setCurrentTrack(null);
          setCurrentSegment(null);
          clearBuildupCountdown();
          // Auto-play next track if enabled
          if (isEnabled && currentEnergy && currentEnergy !== 'outro') {
            playNextTrack({ energy: currentEnergy as PlayableEnergy });
          } else {
            setIsPlaying(false);
          }
          break;
        case 'stopped':
          if (isSwitchingTrackRef.current) {
            console.log(`[MusicProvider] Ignoring 'stopped' event during track switch`);
            break;
          }
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentTrack(null);
          setCurrentSegment(null);
          setCurrentEnergy(null);
          setIsEnabled(false);
          clearBuildupCountdown();
          break;
        case 'buildupComplete':
          // Buildup finished - drop is happening now
          console.log(`[MusicProvider] Buildup complete - DROP!`);
          clearBuildupCountdown();
          break;
        case 'error':
          setError(event.error?.message || 'Music playback error');
          setIsPlaying(false);
          clearBuildupCountdown();
          break;
      }
    });

    return unsubscribe;
  }, [isEnabled, playNextTrack, currentEnergy, clearBuildupCountdown]);

  // Start music
  const start = useCallback(async () => {
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
    clearBuildupCountdown();
    await musicService.stop();
    setIsPlaying(false);
    setCurrentTrack(null);
    setCurrentSegment(null);
  }, [clearBuildupCountdown]);

  // Enable music without playing
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
    clearBuildupCountdown();
    await playNextTrack({ energy: currentEnergy as PlayableEnergy | undefined });
  }, [playNextTrack, currentEnergy, clearBuildupCountdown]);

  // Skip back
  const skipBack = useCallback(async () => {
    const currentTime = await musicService.getCurrentTime();

    if (currentTime > 5 && currentTrack) {
      // Restart current track at segment position
      const segment = currentSegment;
      if (segment) {
        musicService.seekTo(segment.timestamp);
      } else {
        musicService.seekTo(0);
      }
      return;
    }

    if (playedTracksHistory.current.length >= 2) {
      playedTracksHistory.current.pop();
      const previous = playedTracksHistory.current.pop();

      if (previous) {
        try {
          playedTracksHistory.current.push(previous);
          setIsPaused(false);
          clearBuildupCountdown();
          await musicService.play(previous.track, { segment: previous.segment || undefined });
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to play previous track');
        }
      }
    } else if (currentTrack && currentSegment) {
      musicService.seekTo(currentSegment.timestamp);
    }
  }, [currentTrack, currentSegment, clearBuildupCountdown]);

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

  // Clear local tracks
  const clearLocalTracks = useCallback(async () => {
    try {
      await musicDownloadService.clearLocalTracks();
      setSyncResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear local tracks');
    }
  }, []);

  const value: MusicContextValue = {
    isPlaying,
    isEnabled,
    isPaused,
    currentTrack,
    currentSegment,
    currentEnergy,
    error,
    isSyncing,
    syncResult,
    tracks,
    buildupCountdown,
    start,
    stop,
    enable,
    pause,
    resume,
    toggle,
    skipNext,
    skipBack,
    syncMusic,
    clearLocalTracks,
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
