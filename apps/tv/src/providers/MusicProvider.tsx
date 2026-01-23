import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { musicService, MusicTrack, MusicSegment, EnergyLevel } from '../services/MusicService';
import { musicDownloadService, SyncResult } from '../services/MusicDownloadService';
import { api } from './TRPCProvider';

const DOWNLOADED_FILENAMES_KEY = '@music_downloaded_filenames';

const TRACKS_CACHE_KEY = '@music_tracks_cache';

// Playable energy levels (excludes 'outro')
type PlayableEnergy = 'low' | 'medium' | 'high';

// Pre-selected rise track info (for random buildup tracks)
interface PreSelectedRiseTrack {
  track: MusicTrack;
  riseDuration: number; // high.timestamp - medium.timestamp
}

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
  preSelectedRiseTrack: PreSelectedRiseTrack | null; // Pre-selected track for random buildup

  // Trigger tracking (shared across screens)
  lastTriggeredPhase: string | null;
  setLastTriggeredPhase: (phase: string | null) => void;

  // Pre-consumed triggers (for rise transition - marks triggers as already played)
  consumedTriggers: Set<string>;
  addConsumedTrigger: (phaseKey: string) => void;
  clearConsumedTriggers: () => void;

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
  preSelectRiseTrack: (energy: PlayableEnergy) => void; // Pre-select a random track for buildup
  clearPreSelectedRiseTrack: () => void;

  // Trigger-based playback
  playWithTrigger: (options: {
    energy: PlayableEnergy;
    useBuildup?: boolean;
    trackId?: string;
    naturalEnding?: boolean;
    roundDurationSec?: number;
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

  // Trigger tracking (shared across screens to prevent duplicate triggers)
  const [lastTriggeredPhase, setLastTriggeredPhase] = useState<string | null>(null);

  // Pre-consumed triggers (e.g., exercise trigger played early via rise transition)
  const [consumedTriggers, setConsumedTriggers] = useState<Set<string>>(new Set());

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Pre-selected rise track for random buildup
  const [preSelectedRiseTrack, setPreSelectedRiseTrack] = useState<PreSelectedRiseTrack | null>(null);

  // Downloaded track filenames (for filtering selection to only playable tracks)
  const [downloadedFilenames, setDownloadedFilenames] = useState<Set<string>>(new Set());
  const downloadedFilenamesLoaded = useRef(false);

  // Load downloaded filenames on mount
  useEffect(() => {
    if (downloadedFilenamesLoaded.current) return;
    downloadedFilenamesLoaded.current = true;

    musicDownloadService.listLocalTracks()
      .then((filenames) => {
        setDownloadedFilenames(new Set(filenames));
      })
      .catch(() => {});
  }, []);

  // Refresh downloaded filenames after sync completes
  useEffect(() => {
    if (syncResult && !isSyncing) {
      musicDownloadService.listLocalTracks()
        .then((filenames) => setDownloadedFilenames(new Set(filenames)))
        .catch(() => {});
    }
  }, [syncResult, isSyncing]);

  // Track history for skip back (persists across screen transitions)
  const playedTracksHistory = useRef<{ track: MusicTrack; segment: MusicSegment | null }[]>([]);
  const isStartingRef = useRef(false);
  const isSwitchingTrackRef = useRef(false);
  const pendingStart = useRef(false);
  const buildupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Track if current track was played with natural ending (suppress auto-play on end)
  const naturalEndingActiveRef = useRef(false);

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

  // Filter tracks to only those that are downloaded locally (for playback selection)
  const downloadedTracks = useMemo((): MusicTrack[] => {
    if (downloadedFilenames.size === 0) return [];
    return tracks.filter(t => downloadedFilenames.has(t.filename));
  }, [tracks, downloadedFilenames]);

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

  // Pre-select a random track for buildup (used to show rise info before trigger fires)
  const preSelectRiseTrack = useCallback((energy: PlayableEnergy) => {
    if (!downloadedTracks || downloadedTracks.length === 0) return;

    // Filter tracks that have the target energy segment (for buildup, we need 'medium' segment)
    const trackPool = downloadedTracks.filter(t => hasEnergySegment(t, 'medium') && hasEnergySegment(t, 'high'));
    if (trackPool.length === 0) return;

    // Get IDs of recently played tracks
    const recentlyPlayedIds = new Set(
      playedTracksHistory.current.slice(-Math.max(0, trackPool.length - 1)).map(h => h.track.id)
    );

    let availableTracks = trackPool.filter(t => !recentlyPlayedIds.has(t.id));
    if (availableTracks.length === 0) availableTracks = trackPool;

    // Pick a random track
    const randomIndex = Math.floor(Math.random() * availableTracks.length);
    const track = availableTracks[randomIndex];
    if (!track) return;

    // Calculate rise duration (high.timestamp - medium.timestamp)
    const segments = track.segments || [];
    const mediumSegment = segments.find(s => s.energy === 'medium');
    const highSegment = segments.find(s => s.energy === 'high');
    if (!mediumSegment || !highSegment) return;

    const riseDuration = highSegment.timestamp - mediumSegment.timestamp;

    setPreSelectedRiseTrack({
      track,
      riseDuration: Math.round(riseDuration * 10) / 10,
    });
  }, [downloadedTracks]);

  // Clear pre-selected rise track
  const clearPreSelectedRiseTrack = useCallback(() => {
    setPreSelectedRiseTrack(null);
  }, []);

  // Add a trigger to the consumed set (for rise transition)
  const addConsumedTrigger = useCallback((phaseKey: string) => {
    console.log('[MusicProvider] addConsumedTrigger:', phaseKey);
    setConsumedTriggers(prev => {
      const newSet = new Set(prev).add(phaseKey);
      console.log('[MusicProvider] consumedTriggers now:', Array.from(newSet));
      return newSet;
    });
  }, []);

  // Clear consumed triggers (e.g., when starting a new workout)
  const clearConsumedTriggers = useCallback(() => {
    setConsumedTriggers(new Set());
  }, []);

  // Play next random track (optionally filtered by energy)
  const playNextTrack = useCallback(async (options?: {
    energy?: PlayableEnergy;
    useBuildup?: boolean;
  }) => {
    // Guard against concurrent play calls
    if (isStartingRef.current) return;

    // Use downloadedTracks to ensure we only play tracks that exist locally
    if (!downloadedTracks || downloadedTracks.length === 0) {
      setError('No downloaded music tracks available');
      return;
    }

    isStartingRef.current = true;

    const targetEnergy = options?.energy;
    const useBuildup = options?.useBuildup ?? false;

    // Filter downloaded tracks that have segments with the target energy
    let trackPool = targetEnergy
      ? downloadedTracks.filter(t => hasEnergySegment(t, targetEnergy))
      : downloadedTracks;

    // Fallback to all downloaded tracks if no tracks match the energy
    if (trackPool.length === 0) trackPool = downloadedTracks;

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

      try {
        playedTracksHistory.current.push({ track, segment });
        setIsPaused(false);
        setCurrentEnergy(segment?.energy || null);
        isSwitchingTrackRef.current = true;
        naturalEndingActiveRef.current = false;

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
      isStartingRef.current = false;
    }
  }, [downloadedTracks, tracks, startBuildupCountdown, clearBuildupCountdown]);

  // Helper to find segment at a specific timestamp
  const findSegmentAtTimestamp = useCallback((segments: MusicSegment[], timestamp: number): MusicSegment | null => {
    if (!segments || segments.length === 0) return null;
    const sorted = [...segments].sort((a, b) => a.timestamp - b.timestamp);
    let result = sorted[0] || null;
    for (const segment of sorted) {
      if (segment.timestamp <= timestamp) {
        result = segment;
      } else {
        break;
      }
    }
    return result;
  }, []);

  // Play with trigger (specific track or energy-based selection)
  const playWithTrigger = useCallback(async (options: {
    energy: PlayableEnergy;
    useBuildup?: boolean;
    trackId?: string;
    naturalEnding?: boolean;
    roundDurationSec?: number;
  }) => {
    const { energy, useBuildup = false, trackId, naturalEnding = false, roundDurationSec } = options;

    console.log('[MusicProvider] playWithTrigger called:', { energy, useBuildup, trackId, naturalEnding, isStarting: isStartingRef.current });

    // Guard against concurrent play calls
    // EXCEPTION: Rise triggers (useBuildup=true) are user-initiated and have priority
    // They should interrupt any ongoing start operation
    if (isStartingRef.current) {
      if (useBuildup) {
        console.log('[MusicProvider] playWithTrigger - Rise trigger interrupting current start');
        // Stop any ongoing operation and reset the guard
        // The ongoing operation will complete but its track will be immediately stopped
        await musicService.stop(true); // Immediate stop
        isStartingRef.current = false;
      } else {
        console.log('[MusicProvider] playWithTrigger BLOCKED - already starting');
        return;
      }
    }

    // If a specific track is requested, try to find and play it
    if (trackId) {
      const specificTrack = tracks.find(t => t.id === trackId);
      if (specificTrack) {
        // Check if the track is downloaded before attempting to play
        if (!downloadedFilenames.has(specificTrack.filename)) {
          // Fall through to random selection below
        } else {
        isStartingRef.current = true;
        try {
          let segment: MusicSegment | null = null;
          let seekTimestamp: number | undefined;

          // Handle natural ending - calculate seek point so track ends when round ends
          if (naturalEnding && roundDurationSec && specificTrack.durationMs) {
            const trackDurationSec = specificTrack.durationMs / 1000;
            const OVERSHOOT_BUFFER_SEC = 2.5;
            seekTimestamp = trackDurationSec - roundDurationSec - OVERSHOOT_BUFFER_SEC;
            if (seekTimestamp < 0) seekTimestamp = 0;

            // Find which segment the seek point falls into
            segment = findSegmentAtTimestamp(specificTrack.segments || [], seekTimestamp);
          } else {
            // Standard behavior - try to get segment with requested energy
            segment = getRandomSegmentByEnergy(specificTrack.segments || [], energy);
            if (!segment) {
              segment = { timestamp: 0, energy } as MusicSegment;
            }
          }

          playedTracksHistory.current.push({ track: specificTrack, segment });
          setIsPaused(false);
          setCurrentEnergy(segment?.energy || energy);
          setIsEnabled(true);
          isSwitchingTrackRef.current = true;

          // Track if this is a natural ending track (suppress auto-play when it ends)
          naturalEndingActiveRef.current = naturalEnding;

          // Handle buildup for specific tracks (not for natural ending)
          if (useBuildup && !naturalEnding) {
            const segments = specificTrack.segments || [];
            const mediumSegment = segments.find(s => s.energy === 'medium');
            const highSegment = segments.find(s => s.energy === 'high');

            if (mediumSegment && highSegment) {
              const riseDuration = highSegment.timestamp - mediumSegment.timestamp;
              if (riseDuration > 0) {
                startBuildupCountdown(riseDuration);
                segment = mediumSegment;
              }
            } else if (segment?.buildupDuration && segment.buildupDuration > 0) {
              startBuildupCountdown(segment.buildupDuration);
            }
          }

          // Create a modified segment with the natural ending seek timestamp if needed
          const playSegment = seekTimestamp !== undefined
            ? { ...segment, timestamp: seekTimestamp } as MusicSegment
            : segment;

          // For buildup, we handle the countdown ourselves, so don't pass useBuildup to MusicService
          await musicService.play(specificTrack, { segment: playSegment || undefined, useBuildup: false });
          setError(null);
          return;
        } catch (err) {
          isSwitchingTrackRef.current = false;
          clearBuildupCountdown();
        } finally {
          isStartingRef.current = false;
        }
        } // end of "else" block for downloaded check
      }
    }

    // If useBuildup and we have a pre-selected rise track, use it
    if (useBuildup && preSelectedRiseTrack) {
      const { track: preSelectedTrack, riseDuration } = preSelectedRiseTrack;

      isStartingRef.current = true;
      try {
        const mediumSegment = getRandomSegmentByEnergy(preSelectedTrack.segments || [], 'medium');

        if (mediumSegment) {
          playedTracksHistory.current.push({ track: preSelectedTrack, segment: mediumSegment });
          setIsPaused(false);
          setCurrentEnergy(mediumSegment.energy);
          setIsEnabled(true);
          isSwitchingTrackRef.current = true;
          naturalEndingActiveRef.current = false;

          if (riseDuration && riseDuration > 0) {
            startBuildupCountdown(riseDuration);
          }

          await musicService.play(preSelectedTrack, { segment: mediumSegment, useBuildup: false });
          setError(null);
          setPreSelectedRiseTrack(null);
          return;
        }
      } catch (err) {
        isSwitchingTrackRef.current = false;
        clearBuildupCountdown();
      } finally {
        isStartingRef.current = false;
      }
    }

    // Play random track with energy filter
    setIsEnabled(true);
    await playNextTrack({ energy, useBuildup });
  }, [tracks, downloadedFilenames, playNextTrack, startBuildupCountdown, clearBuildupCountdown, findSegmentAtTimestamp, preSelectedRiseTrack]);

  // Stop music on unmount to prevent orphaned audio during hot reload
  // Use immediate=true to skip fade-out and ensure cleanup completes before JS context is destroyed
  useEffect(() => {
    return () => {
      musicService.stop(true); // Immediate stop - no fade
    };
  }, []);

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
          // Suppress auto-play for natural ending tracks
          if (naturalEndingActiveRef.current) {
            naturalEndingActiveRef.current = false;
            setIsPlaying(false);
          } else if (isEnabled && currentEnergy && currentEnergy !== 'outro') {
            playNextTrack({ energy: currentEnergy as PlayableEnergy });
          } else {
            setIsPlaying(false);
          }
          break;
        case 'stopped':
          if (isSwitchingTrackRef.current) {
            break;
          }
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentTrack(null);
          setCurrentSegment(null);
          setCurrentEnergy(null);
          setIsEnabled(false);
          clearBuildupCountdown();
          naturalEndingActiveRef.current = false;
          break;
        case 'buildupComplete':
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
    naturalEndingActiveRef.current = false;
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

  // Pause music (does NOT change isEnabled - that controls trigger firing)
  const pause = useCallback(() => {
    if (isPlaying && !isPaused) {
      musicService.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  }, [isPlaying, isPaused]);

  // Resume music (does NOT change isEnabled - that controls trigger firing)
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
    preSelectedRiseTrack,
    lastTriggeredPhase,
    setLastTriggeredPhase,
    consumedTriggers,
    addConsumedTrigger,
    clearConsumedTriggers,
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
    preSelectRiseTrack,
    clearPreSelectedRiseTrack,
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
