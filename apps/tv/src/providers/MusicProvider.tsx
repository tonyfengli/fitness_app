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
  error: string | null;
  isSyncing: boolean;
  syncResult: SyncResult | null;

  // Actions
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  skipNext: () => Promise<void>;
  skipBack: () => Promise<void>;
  syncMusic: () => Promise<void>;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export function MusicProvider({ children }: { children: React.ReactNode }) {
  // Core playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Track history for skip back (persists across screen transitions)
  const playedTracksHistory = useRef<MusicTrack[]>([]);
  const isStartingRef = useRef(false);
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

  // Play next random track
  const playNextTrack = useCallback(async () => {
    if (!tracks || tracks.length === 0) {
      setError('No music tracks available');
      return;
    }

    // Get IDs of recently played tracks
    const recentlyPlayedIds = new Set(
      playedTracksHistory.current.slice(-Math.max(0, tracks.length - 1)).map(t => t.id)
    );

    let availableTracks = tracks.filter(t => !recentlyPlayedIds.has(t.id));

    if (availableTracks.length === 0) {
      playedTracksHistory.current = [];
      availableTracks = tracks;
    }

    const randomIndex = Math.floor(Math.random() * availableTracks.length);
    const track = availableTracks[randomIndex];

    if (track) {
      try {
        playedTracksHistory.current.push(track);
        setIsPaused(false);
        await musicService.play(track, false);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to play track');
      }
    }
  }, [tracks]);

  // Subscribe to MusicService events (single subscription at provider level)
  useEffect(() => {
    const unsubscribe = musicService.addEventListener((event) => {
      switch (event.type) {
        case 'trackStart':
          setIsPlaying(true);
          setCurrentTrack(event.track || null);
          break;
        case 'trackEnd':
          setCurrentTrack(null);
          // Auto-play next track if enabled
          if (isEnabled) {
            playNextTrack();
          } else {
            setIsPlaying(false);
          }
          break;
        case 'stopped':
          // Handle external stop calls (e.g., from navigation)
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentTrack(null);
          setIsEnabled(false);
          break;
        case 'error':
          setError(event.error?.message || 'Music playback error');
          setIsPlaying(false);
          break;
      }
    });

    return unsubscribe;
  }, [isEnabled, playNextTrack]);

  // Start music
  const start = useCallback(async () => {
    if (isStartingRef.current || isPlaying) return;

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
    error,
    isSyncing,
    syncResult,
    start,
    stop,
    pause,
    resume,
    toggle,
    skipNext,
    skipBack,
    syncMusic,
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
