import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { musicService, MusicTrack, MusicSegment, EnergyLevel } from '../services/MusicService';
import { musicDownloadService, SyncResult } from '../services/MusicDownloadService';
import { api } from './TRPCProvider';
import { musicTriggerController } from '../music';

const DOWNLOADED_FILENAMES_KEY = '@music_downloaded_filenames';

const TRACKS_CACHE_KEY = '@music_tracks_cache';

// Playable energy levels (excludes 'outro')
type PlayableEnergy = 'low' | 'medium' | 'high';

// Pre-selected rise track info (for random buildup tracks)
interface PreSelectedRiseTrack {
  track: MusicTrack;
  riseDuration: number; // high.timestamp - medium.timestamp
}

// Pending high countdown trigger (stored while countdown runs)
interface PendingHighTrigger {
  energy: PlayableEnergy;
  trackId?: string;
}

// Pending trigger for queue-based natural ending transitions
interface PendingTrigger {
  energy: PlayableEnergy;
  useBuildup?: boolean;
  trackId?: string;
  naturalEnding?: boolean;
  roundEndTime?: number;
}

// Configurable render latency offset (time from transition trigger to screen visible)
// Adjust per device if needed
const RENDER_LATENCY_MS = 150;

// High countdown duration: 1.5s GET READY + 3s countdown = 4.5s total
const HIGH_COUNTDOWN_DURATION_MS = 4500;

// Volume level when ducking for high countdown (40% of normal)
const DUCKED_VOLUME_RATIO = 0.4;

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
  buildupCountdown: number | null; // Seconds remaining in buildup, null if not in buildup (JS timer fallback)
  dropTime: number | null; // Absolute timestamp (ms) when the drop should hit (audio-sync precision)
  preSelectedRiseTrack: PreSelectedRiseTrack | null; // Pre-selected track for random buildup
  isHighCountdownActive: boolean; // Whether high countdown overlay is active
  isRiseCountdownActive: boolean; // Whether rise countdown overlay is active
  isNaturalEndingActive: boolean; // Whether a natural ending track is currently playing

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
    /** Absolute timestamp (ms) when round/set ends - for precision natural ending */
    roundEndTime?: number;
  }) => Promise<void>;

  // High countdown methods
  startHighCountdown: (options: { energy: PlayableEnergy; trackId?: string; durationMs?: number }) => void;
  prepareHighAudio: () => Promise<void>;
  completeHighCountdown: () => Promise<void>;
  cancelHighCountdown: () => void;

  // Rise countdown methods (for screen-level overlay)
  setRiseCountdownActive: (active: boolean) => void;
  seekToHighSegment: () => void; // Seek current track to high energy segment (for skip)
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
  const [dropTime, setDropTime] = useState<number | null>(null); // Audio-sync: absolute timestamp when drop hits

  // Trigger tracking (shared across screens to prevent duplicate triggers)
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Pre-selected rise track for random buildup
  const [preSelectedRiseTrack, setPreSelectedRiseTrack] = useState<PreSelectedRiseTrack | null>(null);

  // High countdown state
  const [isHighCountdownActive, setIsHighCountdownActive] = useState(false);
  const [pendingHighTrigger, setPendingHighTrigger] = useState<PendingHighTrigger | null>(null);
  const originalVolumeRef = useRef<number>(0.8); // Store original volume during ducking
  const isHighAudioPreparedRef = useRef(false); // Track if audio was prepared early (skip playWithTrigger in complete)

  // Rise countdown state (for screen-level overlay)
  const [isRiseCountdownActive, setIsRiseCountdownActive] = useState(false);

  // Natural ending state (exposed for skip optimization in useWorkoutMusic)
  const [isNaturalEndingActive, setIsNaturalEndingActive] = useState(false);

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

  // Queue for triggers that arrive while natural ending is playing
  // Only the latest trigger is kept (replaces previous)
  const pendingTriggerRef = useRef<PendingTrigger | null>(null);
  const pendingTriggerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // Audio-sync: Calculate exact timestamp when drop should hit
    // This is the source of truth for precision timing
    const now = Date.now();
    const calculatedDropTime = now + (durationSeconds * 1000);
    setDropTime(calculatedDropTime);
    console.log('[MusicProvider] Audio-sync: dropTime set to', calculatedDropTime, 'duration:', durationSeconds, 'now:', now);

    // Clear any existing interval
    if (buildupIntervalRef.current) {
      clearInterval(buildupIntervalRef.current);
    }

    // Count down every second (fallback display, not used for transition timing)
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
    setDropTime(null); // Clear audio-sync timing
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

  // Play next random track (optionally filtered by energy)
  const playNextTrack = useCallback(async (options?: {
    energy?: PlayableEnergy;
    useBuildup?: boolean;
    naturalEnding?: boolean;
    /** Absolute timestamp (ms) when round/set ends - for precision natural ending */
    roundEndTime?: number;
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
    const naturalEnding = options?.naturalEnding ?? false;
    const roundEndTime = options?.roundEndTime;

    // Filter downloaded tracks that have segments with the target energy
    let trackPool = targetEnergy
      ? downloadedTracks.filter(t => hasEnergySegment(t, targetEnergy))
      : downloadedTracks;

    // For natural ending, also filter by tracks that have duration metadata
    if (naturalEnding && roundEndTime) {
      const tracksWithDuration = trackPool.filter(t => t.durationMs && t.durationMs > 0);
      if (tracksWithDuration.length > 0) {
        trackPool = tracksWithDuration;
      }
    }

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
      let segment = targetEnergy
        ? getRandomSegmentByEnergy(track.segments || [], targetEnergy)
        : track.segments?.[0] || null;

      // Handle natural ending - calculate seek point using precision timing
      // Note: roundEndTime already includes smart drift buffer from useWorkoutMusic,
      // so we don't add additional overshoot here. Music ends exactly at roundEndTime.
      let seekTimestamp: number | undefined;
      if (naturalEnding && roundEndTime && track.durationMs) {
        const trackDurationSec = track.durationMs / 1000;
        // Calculate remaining time from NOW (accounts for all latency up to this point)
        const remainingMs = roundEndTime - Date.now();
        const remainingSec = remainingMs / 1000;
        // No additional overshoot - smart buffer already compensates for drift
        seekTimestamp = trackDurationSec - remainingSec;
        if (seekTimestamp < 0) seekTimestamp = 0;

        console.log('[MusicProvider] playNextTrack natural ending precision calc:', {
          trackDurationSec,
          roundEndTime,
          now: Date.now(),
          remainingSec,
          seekTimestamp,
        });

        // Find which segment the seek point falls into
        segment = findSegmentAtTimestamp(track.segments || [], seekTimestamp);
      }

      try {
        playedTracksHistory.current.push({ track, segment });
        setIsPaused(false);
        setCurrentEnergy(segment?.energy || null);
        isSwitchingTrackRef.current = true;
        naturalEndingActiveRef.current = naturalEnding;
        setIsNaturalEndingActive(naturalEnding);

        // Handle buildup for Rise (medium to high transition) - NOT for natural ending
        let playSegment = segment;
        if (useBuildup && !naturalEnding) {
          const segments = track.segments || [];
          const mediumSegment = segments.find(s => s.energy === 'medium');
          const highSegment = segments.find(s => s.energy === 'high');

          if (mediumSegment && highSegment) {
            const riseDuration = highSegment.timestamp - mediumSegment.timestamp;
            if (riseDuration > 0) {
              console.log('[MusicProvider] playNextTrack - Rise duration calculated:', riseDuration);
              startBuildupCountdown(riseDuration);
              playSegment = mediumSegment; // Start at medium segment
            }
          } else if (segment?.buildupDuration && segment.buildupDuration > 0) {
            // Fallback to segment's buildupDuration if no medium/high segments found
            startBuildupCountdown(segment.buildupDuration);
          }
        }

        // For natural ending, use calculated seek position
        if (seekTimestamp !== undefined && playSegment) {
          playSegment = { ...playSegment, timestamp: seekTimestamp };
        }

        await musicService.play(track, { segment: playSegment, useBuildup: false });
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
  }, [downloadedTracks, tracks, startBuildupCountdown, clearBuildupCountdown, findSegmentAtTimestamp]);

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

  // Clear pending trigger timeout (cleanup helper)
  const clearPendingTriggerTimeout = useCallback(() => {
    if (pendingTriggerTimeoutRef.current) {
      clearTimeout(pendingTriggerTimeoutRef.current);
      pendingTriggerTimeoutRef.current = null;
    }
  }, []);

  // Cleanup pending trigger timeout on unmount
  useEffect(() => {
    return () => clearPendingTriggerTimeout();
  }, [clearPendingTriggerTimeout]);

  // Play with trigger (specific track or energy-based selection)
  // Handles queueing for natural ending transitions
  const playWithTrigger = useCallback(async (options: {
    energy: PlayableEnergy;
    useBuildup?: boolean;
    trackId?: string;
    naturalEnding?: boolean;
    /** Absolute timestamp (ms) when round/set ends - for precision natural ending */
    roundEndTime?: number;
    /** Internal: retry count to prevent infinite loops */
    _retryCount?: number;
  }) => {
    const { energy, useBuildup = false, trackId, naturalEnding = false, roundEndTime, _retryCount = 0 } = options;

    // Prevent infinite retry loops (max 2 retries = 200ms total)
    const MAX_RETRIES = 2;
    if (_retryCount >= MAX_RETRIES) {
      console.error('[MusicProvider] playWithTrigger MAX_RETRIES exceeded, giving up');
      return;
    }

    console.log('[MusicProvider] playWithTrigger called:', {
      energy,
      useBuildup,
      trackId,
      naturalEnding,
      isStarting: isStartingRef.current,
      naturalEndingActive: naturalEndingActiveRef.current,
    });

    // If a natural ending track is currently playing and this is NOT a natural ending trigger,
    // queue this trigger to play after the natural ending finishes
    if (naturalEndingActiveRef.current && !naturalEnding) {
      console.log('[MusicProvider] Natural ending active - queueing trigger');

      // Clear any existing timeout
      clearPendingTriggerTimeout();

      // Queue the trigger (replaces any previous queued trigger - only keep latest)
      pendingTriggerRef.current = { energy, useBuildup, trackId, naturalEnding, roundEndTime };

      // Safety net: if trackEnd never fires, process queue after timeout
      const SAFETY_NET_TIMEOUT_MS = 10000; // 10 seconds should be more than enough
      pendingTriggerTimeoutRef.current = setTimeout(() => {
        if (pendingTriggerRef.current) {
          console.warn('[MusicProvider] Safety net: processing queued trigger via timeout');
          naturalEndingActiveRef.current = false;
          setIsNaturalEndingActive(false);
          const pending = pendingTriggerRef.current;
          pendingTriggerRef.current = null;
          clearPendingTriggerTimeout();
          // Recursive call - now naturalEndingActiveRef is false, so it will play
          playWithTrigger(pending);
        }
      }, SAFETY_NET_TIMEOUT_MS);

      return;
    }

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
        // Schedule retry instead of silently failing
        // This handles race conditions where isStartingRef is temporarily true
        console.log('[MusicProvider] playWithTrigger BLOCKED - scheduling retry in 100ms (attempt', _retryCount + 1, ')');
        setTimeout(() => {
          playWithTrigger({ ...options, _retryCount: _retryCount + 1 });
        }, 100);
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
          // Uses absolute roundEndTime for precision timing
          // Note: roundEndTime already includes smart drift buffer + 3s overshoot from useWorkoutMusic
          if (naturalEnding && roundEndTime && specificTrack.durationMs) {
            const trackDurationSec = specificTrack.durationMs / 1000;
            // Calculate remaining time from NOW (accounts for all latency up to this point)
            const remainingMs = roundEndTime - Date.now();
            const remainingSec = remainingMs / 1000;
            seekTimestamp = trackDurationSec - remainingSec;
            if (seekTimestamp < 0) seekTimestamp = 0;

            console.log('[MusicProvider] Natural ending precision calc:', {
              trackDurationSec,
              roundEndTime,
              now: Date.now(),
              remainingSec,
              seekTimestamp,
            });

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
          setIsNaturalEndingActive(naturalEnding);

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
          setIsNaturalEndingActive(false);

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

    // Play random track with energy filter (includes natural ending support)
    setIsEnabled(true);
    await playNextTrack({ energy, useBuildup, naturalEnding, roundEndTime });
  }, [tracks, downloadedFilenames, playNextTrack, startBuildupCountdown, clearBuildupCountdown, clearPendingTriggerTimeout, findSegmentAtTimestamp, preSelectedRiseTrack]);

  // Start high countdown - ducks volume and prepares for high energy drop
  const startHighCountdown = useCallback((options: { energy: PlayableEnergy; trackId?: string; durationMs?: number }) => {
    console.log('[MusicProvider] startHighCountdown called:', options);

    // Reset audio prepared flag (audio will be prepared early via prepareHighAudio)
    isHighAudioPreparedRef.current = false;

    // Store current volume and duck to 40%
    originalVolumeRef.current = 0.8; // Default volume
    const duckedVolume = originalVolumeRef.current * DUCKED_VOLUME_RATIO;
    musicService.setVolume(duckedVolume);
    console.log('[MusicProvider] Volume ducked to:', duckedVolume);

    // Store the pending trigger
    setPendingHighTrigger({
      energy: options.energy,
      trackId: options.trackId,
    });

    // Set dropTime for countdown overlay timing
    // Use custom duration if provided, otherwise default to 4.5s
    const countdownDuration = options.durationMs ?? HIGH_COUNTDOWN_DURATION_MS;
    const calculatedDropTime = Date.now() + countdownDuration;
    setDropTime(calculatedDropTime);
    console.log('[MusicProvider] High countdown dropTime set to:', calculatedDropTime, 'duration:', countdownDuration);

    // Activate high countdown
    setIsHighCountdownActive(true);
  }, []);

  // Prepare high audio early (called ~1s before countdown completes to account for loading latency)
  const prepareHighAudio = useCallback(async () => {
    console.log('[MusicProvider] prepareHighAudio called, pendingHighTrigger:', pendingHighTrigger);

    if (!pendingHighTrigger) {
      console.log('[MusicProvider] No pending high trigger for audio prepare');
      return;
    }

    if (isHighAudioPreparedRef.current) {
      console.log('[MusicProvider] Audio already prepared, skipping');
      return;
    }

    // Mark as prepared BEFORE async operation to prevent double-triggering
    isHighAudioPreparedRef.current = true;

    // Restore volume to normal (needed for the new track)
    musicService.setVolume(originalVolumeRef.current);
    console.log('[MusicProvider] Volume restored for audio prepare to:', originalVolumeRef.current);

    // Start playing the track now (async) - this accounts for loading latency
    await playWithTrigger({
      energy: pendingHighTrigger.energy,
      trackId: pendingHighTrigger.trackId,
      useBuildup: false, // No buildup - we want immediate HIGH
    });

    console.log('[MusicProvider] Audio prepared and playing');
  }, [pendingHighTrigger, playWithTrigger]);

  // Complete high countdown - clears state and plays if not already prepared
  const completeHighCountdown = useCallback(async () => {
    console.log('[MusicProvider] completeHighCountdown called, pendingHighTrigger:', pendingHighTrigger, 'isAudioPrepared:', isHighAudioPreparedRef.current);

    // IMPORTANT: Clear countdown state FIRST, before any async operations
    // This ensures the visual state transitions to 'exercise' immediately
    const triggerToPlay = pendingHighTrigger;
    setPendingHighTrigger(null);
    setIsHighCountdownActive(false);
    setDropTime(null);

    // If audio was already prepared (started playing early), we're done
    if (isHighAudioPreparedRef.current) {
      console.log('[MusicProvider] Audio was prepared early, skipping playWithTrigger');
      isHighAudioPreparedRef.current = false; // Reset for next countdown
      return;
    }

    // Fallback: if audio wasn't prepared early, play now (will have ~1s latency)
    if (!triggerToPlay) {
      console.log('[MusicProvider] No pending high trigger, aborting');
      return;
    }

    // Restore volume to normal
    musicService.setVolume(originalVolumeRef.current);
    console.log('[MusicProvider] Volume restored to:', originalVolumeRef.current);

    // Play the new track at HIGH energy (async, but state already cleared)
    await playWithTrigger({
      energy: triggerToPlay.energy,
      trackId: triggerToPlay.trackId,
      useBuildup: false, // No buildup - we want immediate HIGH
    });
  }, [pendingHighTrigger, playWithTrigger]);

  // Cancel high countdown (e.g., if user pauses or navigates away)
  const cancelHighCountdown = useCallback(() => {
    console.log('[MusicProvider] cancelHighCountdown called');

    // Restore volume if ducked
    if (isHighCountdownActive) {
      musicService.setVolume(originalVolumeRef.current);
      console.log('[MusicProvider] Volume restored on cancel to:', originalVolumeRef.current);
    }

    // Clear state
    setPendingHighTrigger(null);
    setIsHighCountdownActive(false);
    setDropTime(null);
  }, [isHighCountdownActive]);

  // Seek current track to high energy segment (for skip during Rise countdown)
  const seekToHighSegment = useCallback(() => {
    if (!currentTrack) {
      console.log('[MusicProvider] seekToHighSegment - no current track');
      return;
    }

    const segments = currentTrack.segments || [];
    const highSegment = segments.find(s => s.energy === 'high');

    if (highSegment) {
      console.log('[MusicProvider] seekToHighSegment - seeking to:', highSegment.timestamp);
      musicService.seekTo(highSegment.timestamp);
      setCurrentSegment(highSegment);
      setCurrentEnergy('high');
      clearBuildupCountdown(); // Clear any buildup state
    } else {
      console.log('[MusicProvider] seekToHighSegment - no high segment found');
    }
  }, [currentTrack, clearBuildupCountdown]);

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
          // Handle natural ending tracks - check for queued triggers
          if (naturalEndingActiveRef.current) {
            naturalEndingActiveRef.current = false;
            setIsNaturalEndingActive(false);
            // Clear safety net timeout
            clearPendingTriggerTimeout();
            // Check for queued trigger
            if (pendingTriggerRef.current) {
              console.log('[MusicProvider] Natural ending complete - processing queued trigger');
              const pending = pendingTriggerRef.current;
              pendingTriggerRef.current = null;
              // Play the queued trigger
              playWithTrigger(pending);
            } else {
              setIsPlaying(false);
            }
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
          setIsNaturalEndingActive(false);
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
  }, [isEnabled, playNextTrack, playWithTrigger, currentEnergy, clearBuildupCountdown, clearPendingTriggerTimeout]);

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

  // Stop music - full reset, allows countdowns to fire again
  const stop = useCallback(async () => {
    console.log('[MusicProvider] stop() called - full reset');

    // 1. Cancel any active countdowns
    if (isHighCountdownActive) {
      // Restore volume if ducked
      musicService.setVolume(originalVolumeRef.current);
      setPendingHighTrigger(null);
      setIsHighCountdownActive(false);
    }
    setIsRiseCountdownActive(false);

    // 2. Clear all state
    setIsEnabled(false);
    setIsPaused(false);
    clearBuildupCountdown();
    naturalEndingActiveRef.current = false;
    setIsNaturalEndingActive(false);

    // 3. Clear pending triggers
    pendingTriggerRef.current = null;
    clearPendingTriggerTimeout();

    // 4. Reset trigger controller (allows countdowns to fire again on same round)
    musicTriggerController.reset();
    console.log('[MusicProvider] Trigger controller reset');

    // 5. Stop audio
    await musicService.stop();
    setIsPlaying(false);
    setCurrentTrack(null);
    setCurrentSegment(null);
  }, [clearBuildupCountdown, clearPendingTriggerTimeout, isHighCountdownActive]);

  // Enable music without playing
  const enable = useCallback(() => {
    setIsEnabled(true);
    setError(null);
  }, []);

  // Pause music (does NOT change isEnabled - that controls trigger firing)
  // Cancels active countdowns but preserves consumed state (won't re-trigger on resume)
  const pause = useCallback(() => {
    console.log('[MusicProvider] pause() called');

    // Cancel active countdowns (preserve consumed state - won't re-trigger on resume)
    if (isHighCountdownActive) {
      console.log('[MusicProvider] Cancelling high countdown on pause');
      // Restore volume if ducked
      musicService.setVolume(originalVolumeRef.current);
      setPendingHighTrigger(null);
      setIsHighCountdownActive(false);
      setDropTime(null);
    }
    if (isRiseCountdownActive) {
      console.log('[MusicProvider] Cancelling rise countdown on pause');
      setIsRiseCountdownActive(false);
      clearBuildupCountdown();
    }

    // Pause audio
    if (isPlaying && !isPaused) {
      musicService.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  }, [isPlaying, isPaused, isHighCountdownActive, isRiseCountdownActive, clearBuildupCountdown]);

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
    dropTime,
    preSelectedRiseTrack,
    isHighCountdownActive,
    isRiseCountdownActive,
    isNaturalEndingActive,
    setRiseCountdownActive: setIsRiseCountdownActive,
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
    startHighCountdown,
    prepareHighAudio,
    completeHighCountdown,
    cancelHighCountdown,
    seekToHighSegment,
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
