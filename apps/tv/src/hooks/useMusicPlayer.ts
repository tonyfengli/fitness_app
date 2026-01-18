import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { musicService, MusicTrack } from '../services/MusicService';
import { musicDownloadService, SyncResult } from '../services/MusicDownloadService';
import { api } from '../providers/TRPCProvider';

const TRACKS_CACHE_KEY = '@music_tracks_cache';

interface UseMusicPlayerReturn {
  /** Whether music is currently playing */
  isPlaying: boolean;
  /** Whether music is enabled (user preference) */
  isEnabled: boolean;
  /** Current track being played */
  currentTrack: MusicTrack | null;
  /** Error message if any */
  error: string | null;
  /** Whether music files are being synced/downloaded */
  isSyncing: boolean;
  /** Last sync result */
  syncResult: SyncResult | null;
  /** Toggle music on/off - single button control */
  toggle: () => void;
  /** Explicitly start music */
  start: () => Promise<void>;
  /** Explicitly stop music */
  stop: () => Promise<void>;
  /** Pause current playback (keeps track position) */
  pause: () => void;
  /** Resume paused playback */
  resume: () => void;
  /** Skip to next random track */
  skipNext: () => Promise<void>;
  /** Skip back - restart if >5s into song, previous track if <5s */
  skipBack: () => Promise<void>;
  /** Manually trigger sync */
  syncMusic: () => Promise<void>;
}

/**
 * Hook for managing music playback during workouts.
 * Plays continuous high energy tracks in shuffle mode.
 * Use toggle() for single-button on/off control.
 */
export function useMusicPlayer(): UseMusicPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true); // Default ON for testing
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Track played tracks as array to remember order for skip back
  const playedTracksHistory = useRef<MusicTrack[]>([]);
  const isStartingRef = useRef(false);
  // Track if start was requested while loading - will auto-start when tracks available
  const pendingStart = useRef(false);
  // Track if playback is paused (vs stopped)
  const [isPaused, setIsPaused] = useState(false);

  // Cached tracks from AsyncStorage (loaded on mount)
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

  // Fetch all music tracks from API
  const { data: apiTracks, isLoading, error: queryError } = useQuery({
    ...api.music.list.queryOptions({}),
  });

  // Cache tracks when API succeeds
  useEffect(() => {
    if (apiTracks && apiTracks.length > 0) {
      AsyncStorage.setItem(TRACKS_CACHE_KEY, JSON.stringify(apiTracks))
        .then(() => {
          setCachedTracks(apiTracks);
        })
        .catch(() => {
          // Silently fail - cache is optional
        });
    }
  }, [apiTracks]);

  // Determine track source: API > Cache
  const tracks = useMemo(() => {
    // 1. Prefer API tracks if available
    if (apiTracks && apiTracks.length > 0) {
      return apiTracks;
    }

    // 2. If API failed or empty, try cached tracks
    if (queryError || (!isLoading && (!apiTracks || apiTracks.length === 0))) {
      if (cachedTracks && cachedTracks.length > 0) {
        return cachedTracks;
      }
      return [];
    }

    return [];
  }, [apiTracks, isLoading, queryError, cachedTracks]);

  /**
   * Sync music files from cloud to local storage
   */
  const syncMusic = useCallback(async () => {
    if (!tracks || tracks.length === 0 || isSyncing) {
      return;
    }

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

  /**
   * Play a random high energy track
   */
  const playNextTrack = useCallback(async () => {
    if (!tracks || tracks.length === 0) {
      setError('No music tracks available');
      return;
    }

    // Get IDs of recently played tracks (last N tracks where N = tracks.length - 1)
    // This ensures we don't repeat until all tracks have been played
    const recentlyPlayedIds = new Set(
      playedTracksHistory.current.slice(-Math.max(0, tracks.length - 1)).map(t => t.id)
    );

    // Filter out recently played tracks
    let availableTracks = tracks.filter(t => !recentlyPlayedIds.has(t.id));

    // If all tracks have been played, reset and allow repeats
    if (availableTracks.length === 0) {
      playedTracksHistory.current = [];
      availableTracks = tracks;
    }

    // Pick a random track
    const randomIndex = Math.floor(Math.random() * availableTracks.length);
    const track = availableTracks[randomIndex];

    if (track) {
      try {
        playedTracksHistory.current.push(track);
        setIsPaused(false);
        await musicService.play(track, false); // Always play from start
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to play track');
      }
    }
  }, [tracks]);

  // Subscribe to music service events
  useEffect(() => {
    const unsubscribe = musicService.addEventListener((event) => {
      switch (event.type) {
        case 'trackStart':
          setIsPlaying(true);
          setCurrentTrack(event.track || null);
          break;
        case 'trackEnd':
          setCurrentTrack(null);
          // Auto-play next track if still enabled
          if (isEnabled) {
            playNextTrack();
          } else {
            setIsPlaying(false);
          }
          break;
        case 'error':
          setError(event.error?.message || 'Music playback error');
          setIsPlaying(false);
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isEnabled, playNextTrack]);

  /**
   * Start playing music (only if not already playing)
   */
  const start = useCallback(async () => {
    // Don't restart if already playing or in the process of starting
    if (isStartingRef.current || isPlaying) return;

    // If still loading tracks, mark as pending and wait
    if (tracks.length === 0) {
      pendingStart.current = true;
      setIsEnabled(true);
      return;
    }

    isStartingRef.current = true;
    pendingStart.current = false;
    setIsEnabled(true);
    setError(null);

    try {
      await playNextTrack();
    } finally {
      isStartingRef.current = false;
    }
  }, [tracks.length, isPlaying, playNextTrack]);

  // Auto-start when tracks become available if start was pending
  useEffect(() => {
    if (pendingStart.current && tracks.length > 0 && !isPlaying && !isStartingRef.current) {
      pendingStart.current = false;
      start();
    }
  }, [tracks.length, isPlaying, start]);

  /**
   * Stop playing music
   */
  const stop = useCallback(async () => {
    setIsEnabled(false);
    setIsPaused(false);
    await musicService.stop();
    setIsPlaying(false);
    setCurrentTrack(null);
  }, []);

  /**
   * Pause current playback (keeps track position)
   */
  const pause = useCallback(() => {
    if (isPlaying && !isPaused) {
      musicService.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  }, [isPlaying, isPaused]);

  /**
   * Resume paused playback
   */
  const resume = useCallback(() => {
    if (isPaused && currentTrack) {
      musicService.resume();
      setIsPaused(false);
      setIsPlaying(true);
    }
  }, [isPaused, currentTrack]);

  /**
   * Skip to next random track
   */
  const skipNext = useCallback(async () => {
    setIsPaused(false);
    await playNextTrack();
  }, [playNextTrack]);

  /**
   * Skip back - restart if >5s into song, previous track if <5s
   */
  const skipBack = useCallback(async () => {
    const currentTime = await musicService.getCurrentTime();

    // If more than 5 seconds in, restart current track
    if (currentTime > 5 && currentTrack) {
      musicService.seekTo(0);
      return;
    }

    // Otherwise, go to previous track
    // Remove current track from history and get the previous one
    if (playedTracksHistory.current.length >= 2) {
      // Pop current track
      playedTracksHistory.current.pop();
      // Get and pop previous track (we'll re-add it when we play)
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
      // No previous track, just restart current
      musicService.seekTo(0);
    }
  }, [currentTrack]);

  /**
   * Toggle music on/off - single button control
   */
  const toggle = useCallback(() => {
    if (isEnabled) {
      stop();
    } else {
      start();
    }
  }, [isEnabled, start, stop]);

  // Playback works with locally downloaded files.
  // Call syncMusic() manually to download new tracks added to the database.

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      musicService.stop();
    };
  }, []);

  return {
    isPlaying,
    isEnabled,
    currentTrack,
    error,
    isSyncing,
    syncResult,
    toggle,
    start,
    stop,
    pause,
    resume,
    skipNext,
    skipBack,
    syncMusic,
  };
}
