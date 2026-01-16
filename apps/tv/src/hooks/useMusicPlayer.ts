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

  // Track played track IDs to avoid immediate repetition
  const playedTrackIds = useRef<Set<string>>(new Set());
  const isStartingRef = useRef(false);
  // Track if start was requested while loading - will auto-start when tracks available
  const pendingStart = useRef(false);

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
          console.log('[MusicPlayer] Loaded cached tracks:', parsed.length);
          setCachedTracks(parsed);
        }
      })
      .catch((err) => {
        console.warn('[MusicPlayer] Failed to load cached tracks:', err);
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
          console.log('[MusicPlayer] Cached', apiTracks.length, 'tracks');
          setCachedTracks(apiTracks);
        })
        .catch((err) => {
          console.warn('[MusicPlayer] Failed to cache tracks:', err);
        });
    }
  }, [apiTracks]);

  // Determine track source: API > Cache
  const { tracks, trackSource } = useMemo(() => {
    // 1. Prefer API tracks if available
    if (apiTracks && apiTracks.length > 0) {
      return { tracks: apiTracks, trackSource: 'api' as const };
    }

    // 2. If API failed or empty, try cached tracks
    if (queryError || (!isLoading && (!apiTracks || apiTracks.length === 0))) {
      if (cachedTracks && cachedTracks.length > 0) {
        console.log('[MusicPlayer] Using cached tracks');
        return { tracks: cachedTracks, trackSource: 'cache' as const };
      }
      // No cache available
      console.log('[MusicPlayer] No tracks available (no cache)');
      return { tracks: [], trackSource: 'none' as const };
    }

    return { tracks: [], trackSource: 'none' as const };
  }, [apiTracks, isLoading, queryError, cachedTracks]);

  // DEBUG: Log query state
  useEffect(() => {
    console.log('[MusicPlayer] Query state:', {
      isLoading,
      trackCount: tracks?.length ?? 0,
      trackSource,
      queryError: queryError?.message ?? null,
    });
  }, [isLoading, tracks, trackSource, queryError]);

  /**
   * Sync music files from cloud to local storage
   */
  const syncMusic = useCallback(async () => {
    if (!tracks || tracks.length === 0 || isSyncing) {
      return;
    }

    console.log('[MusicPlayer] Starting music sync...');
    setIsSyncing(true);
    setError(null);

    try {
      const result = await musicDownloadService.syncTracks(tracks);
      setSyncResult(result);

      if (result.failed.length > 0) {
        console.warn('[MusicPlayer] Some tracks failed to download:', result.failed);
      }

      console.log('[MusicPlayer] Sync complete:', result);
    } catch (err) {
      console.error('[MusicPlayer] Sync error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync music');
    } finally {
      setIsSyncing(false);
    }
  }, [tracks, isSyncing]);

  /**
   * Play a random high energy track
   */
  const playNextTrack = useCallback(async () => {
    console.log('[MusicPlayer] playNextTrack called', { trackCount: tracks?.length ?? 0 });

    if (!tracks || tracks.length === 0) {
      console.warn('[MusicPlayer] No high energy tracks available');
      setError('No music tracks available');
      return;
    }

    // Filter out recently played tracks
    let availableTracks = tracks.filter(t => !playedTrackIds.current.has(t.id));

    // If all tracks have been played, reset and allow repeats
    if (availableTracks.length === 0) {
      playedTrackIds.current.clear();
      availableTracks = tracks;
    }

    // Pick a random track
    const randomIndex = Math.floor(Math.random() * availableTracks.length);
    const track = availableTracks[randomIndex];

    if (track) {
      console.log('[MusicPlayer] Playing track:', { id: track.id, name: track.name, filename: track.filename });
      try {
        playedTrackIds.current.add(track.id);
        await musicService.play(track, false); // Always play from start
        setError(null);
      } catch (err) {
        console.error('[MusicPlayer] Error playing track:', err);
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
      console.log('[MusicPlayer] Start requested but no tracks yet, marking as pending');
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
      console.log('[MusicPlayer] Tracks now available, executing pending start');
      pendingStart.current = false;
      start();
    }
  }, [tracks.length, isPlaying, start]);

  /**
   * Stop playing music
   */
  const stop = useCallback(async () => {
    setIsEnabled(false);
    await musicService.stop();
    setIsPlaying(false);
    setCurrentTrack(null);
  }, []);

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
    syncMusic,
  };
}
