import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { musicService, MusicTrack, MusicSegment, EnergyLevel } from '../services/MusicService';
import { musicDownloadService, SyncResult } from '../services/MusicDownloadService';
import { api } from './TRPCProvider';
// Note: Music trigger state is now managed by the workout machine context.
// Trigger resets should be done via RESET_MUSIC_TRIGGERS event to the machine.

const DOWNLOADED_FILENAMES_KEY = '@music_downloaded_filenames';

const TRACKS_CACHE_KEY = '@music_tracks_cache';

// Playable energy levels (excludes 'outro' and deprecated 'medium')
type PlayableEnergy = 'low' | 'high';

// Pre-selected rise track info (for random buildup tracks)
interface PreSelectedRiseTrack {
  track: MusicTrack;
  riseDuration: number; // fixed duration for Rise countdown
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

/**
 * Minimum duration (seconds) a track should play before the next trigger fires.
 * Used to prevent very short plays (e.g., 10 seconds) before a transition.
 * This is a soft filter - if no tracks meet the criteria, any track is allowed.
 */
const MIN_PLAY_DURATION_SEC = 30;

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
  playOrResume: () => Promise<void>;
  toggle: () => void;
  skipNext: () => Promise<void>;
  skipBack: () => void;
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
    /** Specific segment timestamp to play (for tracks with multiple high segments) */
    segmentTimestamp?: number;
  }) => Promise<void>;

  // High countdown methods
  startHighCountdown: (options: { energy: PlayableEnergy; trackId?: string; durationMs?: number }) => void;
  prepareHighAudio: () => Promise<void>;
  completeHighCountdown: () => Promise<void>;
  cancelHighCountdown: () => void;

  // Rise from Rest - music plays during rest, drop hits when exercise starts
  playRiseFromRest: (options: { trackId?: string; restDurationSec: number; segmentTimestamp?: number }) => Promise<void>;

  // Rise countdown methods (for screen-level overlay)
  setRiseCountdownActive: (active: boolean) => void;
  seekToHighSegment: () => void; // Seek current track to high energy segment (for skip)

  // Clear natural ending state (call when entering a new round)
  clearNaturalEnding: () => void;

  // Set auto-progress energy for track progressions based on phase type
  // - 'low' for previews
  // - 'high' for exercise/rest/setBreak
  setAutoProgressEnergy: (energy: PlayableEnergy) => void;

  // Set next trigger time for 30-second minimum play duration rule
  // Called by useWorkoutMusic when calculating the next trigger point
  setNextTriggerTime: (time: number | undefined) => void;

  // TODO: TEMPORARY - Remove once segment timestamps are finalized
  // Refresh tracks from API to get updated segment timestamps for testing
  refreshTracks: () => Promise<void>;
}

const MusicContext = createContext<MusicContextValue | null>(null);

/**
 * Delay before the high beat hits (in seconds).
 * When seeking to a high segment, we seek to (timestamp - HIGH_BEAT_DELAY_SEC)
 * so the beat hits this many seconds after playback starts.
 */
const HIGH_BEAT_DELAY_SEC = 2.5;

/**
 * Fixed duration for Rise countdown (in seconds).
 * Music seeks to (highSegment.timestamp - RISE_COUNTDOWN_DURATION_SEC)
 * so the drop hits exactly when the countdown ends.
 */
const RISE_COUNTDOWN_DURATION_SEC = 5;

/**
 * Helper to check if a track has a segment with the given energy
 */
function hasEnergySegment(track: MusicTrack, energy: PlayableEnergy): boolean {
  return track.segments?.some(s => s.energy === energy) ?? false;
}

/**
 * Helper to check if a track is valid for Rise countdown.
 * Track must have a high segment at >= RISE_COUNTDOWN_DURATION_SEC.
 */
function isValidForRiseCountdown(track: MusicTrack): boolean {
  return track.segments?.some(
    s => s.energy === 'high' && s.timestamp >= RISE_COUNTDOWN_DURATION_SEC
  ) ?? false;
}

/**
 * Helper to get valid high segments for Rise countdown (timestamp >= 5s).
 */
function getValidRiseHighSegments(segments: MusicSegment[]): MusicSegment[] {
  return segments.filter(
    s => s.energy === 'high' && s.timestamp >= RISE_COUNTDOWN_DURATION_SEC
  );
}

/**
 * Helper to get a random segment with the given energy from a track
 */
function getRandomSegmentByEnergy(segments: MusicSegment[], energy: PlayableEnergy): MusicSegment | null {
  const matching = segments.filter(s => s.energy === energy);
  if (matching.length === 0) return null;
  return matching[Math.floor(Math.random() * matching.length)] ?? null;
}

/**
 * Apply high beat delay to a segment timestamp.
 * For high energy segments, we want the beat to hit 1 second after playback starts.
 */
function applyHighBeatDelay(segment: MusicSegment | null, energy: PlayableEnergy): number {
  if (!segment) return 0;
  if (energy === 'high') {
    // Seek 1 second before the high segment so beat hits after delay
    return Math.max(0, segment.timestamp - HIGH_BEAT_DELAY_SEC);
  }
  return segment.timestamp;
}

/**
 * Type for per-energy track history
 */
type EnergyHistoryMap = {
  low: MusicTrack[];
  high: MusicTrack[];
};

/**
 * Checks if a track has sufficient play duration for the 30-second rule.
 *
 * A track is valid if:
 * 1. Track plays long enough to fill all time until next trigger, OR
 * 2. Track ends with at least MIN_PLAY_DURATION_SEC (30s) before next trigger
 *
 * @param track - The track to check
 * @param energy - Target energy level (used to estimate seek position)
 * @param nextTriggerTime - Absolute timestamp (ms) when next trigger fires
 * @param estimatedSeekSec - Optional estimated seek position in seconds
 * @returns true if track meets the 30-second rule
 */
function meetsMinPlayDuration(
  track: MusicTrack,
  energy: PlayableEnergy,
  nextTriggerTime: number | undefined,
  estimatedSeekSec?: number
): boolean {
  // If no next trigger time, all tracks are valid
  if (!nextTriggerTime) return true;

  // If track has no duration metadata, be conservative and include it
  if (!track.durationMs || track.durationMs <= 0) return true;

  const trackDurationSec = track.durationMs / 1000;
  const timeUntilNextTriggerMs = nextTriggerTime - Date.now();
  const timeUntilNextTriggerSec = timeUntilNextTriggerMs / 1000;

  // If next trigger is imminent or in the past, all tracks are valid
  if (timeUntilNextTriggerSec <= 0) return true;

  // Estimate seek position if not provided
  let seekSec = estimatedSeekSec ?? 0;
  if (seekSec === 0 && energy === 'high') {
    // For high energy, we typically seek to near the first high segment
    // Use the first high segment timestamp as an estimate
    const highSegment = track.segments?.find(s => s.energy === 'high');
    if (highSegment) {
      // Account for HIGH_BEAT_DELAY_SEC (2.5s) that we seek before the segment
      seekSec = Math.max(0, highSegment.timestamp - 2.5);
    }
  }

  // Calculate how long the track will play
  const trackPlayDurationSec = trackDurationSec - seekSec;

  // Calculate how much time remains after track ends
  const remainingAfterTrackSec = timeUntilNextTriggerSec - trackPlayDurationSec;

  // Track is valid if:
  // 1. Track fills all time until next trigger (remainingAfterTrack <= 0), OR
  // 2. Track ends with at least 30 seconds before next trigger
  const isValid = remainingAfterTrackSec <= 0 || remainingAfterTrackSec >= MIN_PLAY_DURATION_SEC;

  return isValid;
}

/**
 * Select a track from the pool using per-energy history.
 * - Exhaust all tracks for an energy level before allowing repeats
 * - When exhausted, pick least-recently-played (first in history that's still in pool)
 *
 * @param trackPool - Available tracks to select from
 * @param energy - Energy level being selected for
 * @param historyByEnergy - Per-energy history map (mutated to add selected track)
 * @param addToHistory - Whether to add selected track to history (false for explicit trackId)
 * @returns Selected track or null if pool is empty
 */
function selectTrackWithEnergyHistory(
  trackPool: MusicTrack[],
  energy: PlayableEnergy,
  historyByEnergy: EnergyHistoryMap,
  addToHistory: boolean = true
): MusicTrack | null {
  if (trackPool.length === 0) return null;

  const history = historyByEnergy[energy];
  const playedIds = new Set(history.map(t => t.id));

  // Try to find unplayed tracks
  const unplayedTracks = trackPool.filter(t => !playedIds.has(t.id));

  let selectedTrack: MusicTrack | null = null;

  if (unplayedTracks.length > 0) {
    // Random selection from unplayed tracks
    selectedTrack = unplayedTracks[Math.floor(Math.random() * unplayedTracks.length)]!;
    console.log(`[MusicProvider] selectTrack(${energy}): picked unplayed track, ${unplayedTracks.length} remaining unplayed`);
  } else {
    // All exhausted - pick least-recently-played (earliest in history still in pool)
    const poolIds = new Set(trackPool.map(t => t.id));
    for (const historyTrack of history) {
      if (poolIds.has(historyTrack.id)) {
        selectedTrack = historyTrack;
        console.log(`[MusicProvider] selectTrack(${energy}): all exhausted, picked LRU: ${historyTrack.name}`);
        break;
      }
    }
    // Fallback to random if somehow no match in history
    if (!selectedTrack) {
      selectedTrack = trackPool[Math.floor(Math.random() * trackPool.length)]!;
      console.log(`[MusicProvider] selectTrack(${energy}): LRU fallback failed, picked random`);
    }
  }

  // Add to history (unless bypassed for explicit trackId)
  if (selectedTrack && addToHistory) {
    historyByEnergy[energy].push(selectedTrack);
  }

  return selectedTrack;
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
  // Per-energy tracking to prevent repeats until all songs for that energy are exhausted
  const playedTracksHistoryByEnergy = useRef<{
    low: MusicTrack[];
    high: MusicTrack[];
  }>({ low: [], high: [] });
  const isStartingRef = useRef(false);
  const isSwitchingTrackRef = useRef(false);
  const pendingStart = useRef(false);
  const buildupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Track if current track was played with natural ending (suppress auto-play on end)
  const naturalEndingActiveRef = useRef(false);
  // Energy level for automatic track progressions (when track ends naturally)
  // Set by useWorkoutMusic based on phase type: 'low' for previews, 'high' for exercise/rest/setBreak
  const autoProgressEnergyRef = useRef<PlayableEnergy>('high');

  // Next trigger time (absolute timestamp in ms) for 30-second minimum play duration rule
  // Set by useWorkoutMusic when a trigger fires or phase changes
  const nextTriggerTimeRef = useRef<number | undefined>(undefined);

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
  const { data: apiTracksData, isLoading, error: queryError, refetch: refetchTracks } = useQuery({
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
  // Note: Does NOT add to history - that happens when track is actually played
  const preSelectRiseTrack = useCallback((energy: PlayableEnergy) => {
    if (!downloadedTracks || downloadedTracks.length === 0) return;

    // Filter tracks that are valid for Rise countdown (high segment at >= 5s)
    const trackPool = downloadedTracks.filter(isValidForRiseCountdown);
    if (trackPool.length === 0) return;

    // Select track using per-energy history (don't add to history yet - that's done on actual play)
    const track = selectTrackWithEnergyHistory(
      trackPool,
      'high', // Rise countdown always targets high energy
      playedTracksHistoryByEnergy.current,
      false // Don't add to history - just for UI preview
    );
    if (!track) return;

    // Rise duration is now fixed at RISE_COUNTDOWN_DURATION_SEC
    setPreSelectedRiseTrack({
      track,
      riseDuration: RISE_COUNTDOWN_DURATION_SEC,
    });
  }, [downloadedTracks]);

  // Clear pre-selected rise track
  const clearPreSelectedRiseTrack = useCallback(() => {
    setPreSelectedRiseTrack(null);
  }, []);

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

    // For Rise countdown, filter for tracks valid for Rise (high segment >= 5s)
    if (useBuildup && !naturalEnding) {
      const riseCompatibleTracks = trackPool.filter(isValidForRiseCountdown);
      if (riseCompatibleTracks.length > 0) {
        trackPool = riseCompatibleTracks;
      }
    }

    // Apply 30-second minimum play duration rule (soft filter)
    // Only apply when not using natural ending (natural ending has its own duration logic)
    if (!naturalEnding && nextTriggerTimeRef.current) {
      const minDurationTracks = trackPool.filter(t =>
        meetsMinPlayDuration(t, targetEnergy || 'high', nextTriggerTimeRef.current)
      );
      if (minDurationTracks.length > 0) {
        console.log('[MusicProvider] playNextTrack - 30s rule filter:', {
          originalPoolSize: trackPool.length,
          filteredPoolSize: minDurationTracks.length,
          nextTriggerInSec: Math.round((nextTriggerTimeRef.current - Date.now()) / 1000),
        });
        trackPool = minDurationTracks;
      } else {
        console.log('[MusicProvider] playNextTrack - 30s rule: no tracks meet criteria, using full pool');
      }
    }

    // For natural ending, apply hard requirements:
    // 1. recommendedForNaturalEnding: true
    // 2. durationMs > 0
    // 3. track duration >= remaining time in round
    if (naturalEnding && roundEndTime) {
      const remainingMs = roundEndTime - Date.now();
      const remainingSec = remainingMs / 1000;

      const naturalEndingTracks = trackPool.filter(t =>
        t.recommendedForNaturalEnding === true &&
        t.durationMs &&
        t.durationMs > 0 &&
        (t.durationMs / 1000) >= remainingSec
      );

      if (naturalEndingTracks.length === 0) {
        console.warn('[MusicProvider] playNextTrack - SKIPPING natural ending: no tracks meet requirements', {
          poolSize: trackPool.length,
          remainingSec,
          requirements: 'recommendedForNaturalEnding + durationMs > 0 + duration >= remaining',
        });
        isStartingRef.current = false;
        return;
      }

      trackPool = naturalEndingTracks;
    }

    // Fallback to all downloaded tracks if no tracks match the energy (non-natural-ending only)
    if (trackPool.length === 0) trackPool = downloadedTracks;

    // Select track using per-energy history (exhaust all before repeat, LRU fallback)
    const historyEnergy = targetEnergy || 'high'; // Default to high if no energy specified
    const track = selectTrackWithEnergyHistory(
      trackPool,
      historyEnergy,
      playedTracksHistoryByEnergy.current,
      true // Add to history
    );

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
        // History already added by selectTrackWithEnergyHistory
        setIsPaused(false);
        setCurrentEnergy(segment?.energy || null);
        isSwitchingTrackRef.current = true;
        naturalEndingActiveRef.current = naturalEnding;
        setIsNaturalEndingActive(naturalEnding);

        // Handle buildup for Rise countdown - NOT for natural ending
        // Rise: seek to (highSegment.timestamp - 5s), countdown for fixed 5 seconds
        let playSegment = segment;
        if (useBuildup && !naturalEnding) {
          const segments = track.segments || [];
          const validHighSegments = getValidRiseHighSegments(segments);

          if (validHighSegments.length > 0) {
            // Pick a random valid high segment
            const highSegment = validHighSegments[Math.floor(Math.random() * validHighSegments.length)];
            // Seek to 5 seconds before the high segment drop
            const seekPosition = highSegment.timestamp - RISE_COUNTDOWN_DURATION_SEC;
            startBuildupCountdown(RISE_COUNTDOWN_DURATION_SEC);
            playSegment = { ...highSegment, timestamp: seekPosition };
            console.log('[MusicProvider] playNextTrack Rise countdown - seeking to:', seekPosition, 'drop at:', highSegment.timestamp);
          }
        }

        // For natural ending, use calculated seek position
        if (seekTimestamp !== undefined && playSegment) {
          playSegment = { ...playSegment, timestamp: seekTimestamp };
        } else if (targetEnergy === 'high' && !useBuildup && playSegment) {
          // Apply high beat delay - seek 1 second before high segment so beat hits after delay
          const originalTimestamp = playSegment.timestamp;
          const delayedTimestamp = applyHighBeatDelay(playSegment, 'high');
          playSegment = { ...playSegment, timestamp: delayedTimestamp };
          console.log('[MusicProvider] playNextTrack - applied high beat delay:', {
            original: originalTimestamp,
            delayed: delayedTimestamp,
          });
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
    /** Specific segment timestamp to play (for tracks with multiple high segments) */
    segmentTimestamp?: number;
    /** Internal: retry count to prevent infinite loops */
    _retryCount?: number;
  }) => {
    const { energy, useBuildup = false, trackId, naturalEnding = false, roundEndTime, segmentTimestamp, _retryCount = 0 } = options;

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
        // Validate natural ending requirements for specific trackId
        if (naturalEnding && roundEndTime) {
          const remainingMs = roundEndTime - Date.now();
          const remainingSec = remainingMs / 1000;
          const trackDurationSec = (specificTrack.durationMs || 0) / 1000;

          const isValid =
            specificTrack.recommendedForNaturalEnding === true &&
            specificTrack.durationMs &&
            specificTrack.durationMs > 0 &&
            trackDurationSec >= remainingSec;

          if (!isValid) {
            console.warn('[MusicProvider] playWithTrigger - SKIPPING natural ending: specific track does not meet requirements', {
              trackId,
              trackName: specificTrack.name,
              recommendedForNaturalEnding: specificTrack.recommendedForNaturalEnding,
              durationMs: specificTrack.durationMs,
              trackDurationSec,
              remainingSec,
              requirements: 'recommendedForNaturalEnding + durationMs > 0 + duration >= remaining',
            });
            return;
          }
        }

        // Check 30-second minimum play duration rule for explicit trackId (warning only)
        if (!naturalEnding && nextTriggerTimeRef.current) {
          const meetsRule = meetsMinPlayDuration(specificTrack, energy, nextTriggerTimeRef.current);
          if (!meetsRule) {
            const timeUntilNextTriggerSec = Math.round((nextTriggerTimeRef.current - Date.now()) / 1000);
            const trackDurationSec = (specificTrack.durationMs || 0) / 1000;
            console.warn('[MusicProvider] playWithTrigger - WARNING: explicit trackId may violate 30s rule', {
              trackId,
              trackName: specificTrack.name,
              trackDurationSec,
              timeUntilNextTriggerSec,
              minPlayDurationSec: MIN_PLAY_DURATION_SEC,
              note: 'Track will still play (explicit trackId bypasses filter)',
            });
          }
        }

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
          } else if (segmentTimestamp !== undefined) {
            // Specific segment timestamp requested - find segment at that timestamp
            const targetSegment = (specificTrack.segments || []).find(
              s => s.energy === energy && s.timestamp === segmentTimestamp
            );
            if (targetSegment) {
              segment = targetSegment;
              console.log('[MusicProvider] playWithTrigger - using specific segment timestamp:', segmentTimestamp);
            } else {
              // Fallback: create segment at the requested timestamp
              segment = { timestamp: segmentTimestamp, energy } as MusicSegment;
              console.log('[MusicProvider] playWithTrigger - segment not found, using timestamp directly:', segmentTimestamp);
            }
          } else {
            // Standard behavior - try to get segment with requested energy
            segment = getRandomSegmentByEnergy(specificTrack.segments || [], energy);
            if (!segment) {
              segment = { timestamp: 0, energy } as MusicSegment;
            }
          }

          // Explicit trackId bypasses repeat prevention - don't add to history
          // This allows explicitly selected tracks to be played anytime
          setIsPaused(false);
          setCurrentEnergy(segment?.energy || energy);
          setIsEnabled(true);
          isSwitchingTrackRef.current = true;

          // Track if this is a natural ending track (suppress auto-play when it ends)
          naturalEndingActiveRef.current = naturalEnding;
          setIsNaturalEndingActive(naturalEnding);

          // Handle buildup for specific tracks (not for natural ending)
          // Rise countdown: seek to (highSegment.timestamp - 5s), countdown for fixed 5 seconds
          if (useBuildup && !naturalEnding) {
            const segments = specificTrack.segments || [];
            // Find valid high segments (timestamp >= RISE_COUNTDOWN_DURATION_SEC)
            const validHighSegments = getValidRiseHighSegments(segments);

            if (validHighSegments.length > 0) {
              // Use segmentTimestamp if provided, otherwise pick random valid high segment
              let highSegment = segmentTimestamp !== undefined
                ? validHighSegments.find(s => s.timestamp === segmentTimestamp)
                : validHighSegments[Math.floor(Math.random() * validHighSegments.length)];

              if (highSegment) {
                // Seek to 5 seconds before the high segment drop
                const seekPosition = highSegment.timestamp - RISE_COUNTDOWN_DURATION_SEC;
                startBuildupCountdown(RISE_COUNTDOWN_DURATION_SEC);
                segment = { ...highSegment, timestamp: seekPosition };
                console.log('[MusicProvider] Rise countdown - seeking to:', seekPosition, 'drop at:', highSegment.timestamp);
              }
            }
          }

          // Create a modified segment with the appropriate seek timestamp
          let playSegment: MusicSegment | null = segment;
          if (seekTimestamp !== undefined) {
            // Natural ending - use calculated seek position
            playSegment = { ...segment, timestamp: seekTimestamp } as MusicSegment;
          } else if (energy === 'high' && !useBuildup && segment) {
            // Apply high beat delay - seek 1 second before high segment so beat hits after delay
            const originalTimestamp = segment.timestamp;
            const delayedTimestamp = applyHighBeatDelay(segment, 'high');
            playSegment = { ...segment, timestamp: delayedTimestamp };
            console.log('[MusicProvider] playWithTrigger - applied high beat delay:', {
              original: originalTimestamp,
              delayed: delayedTimestamp,
            });
          }

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
      const { track: preSelectedTrack } = preSelectedRiseTrack;

      isStartingRef.current = true;
      try {
        // Find valid high segments for Rise countdown
        const validHighSegments = getValidRiseHighSegments(preSelectedTrack.segments || []);
        const highSegment = validHighSegments.length > 0
          ? validHighSegments[Math.floor(Math.random() * validHighSegments.length)]
          : null;

        if (highSegment) {
          // Seek to 5 seconds before the high segment drop
          const seekPosition = highSegment.timestamp - RISE_COUNTDOWN_DURATION_SEC;
          const playSegment = { ...highSegment, timestamp: seekPosition };

          // Add to per-energy history (Rise always uses 'high')
          playedTracksHistoryByEnergy.current.high.push(preSelectedTrack);
          setIsPaused(false);
          setCurrentEnergy('high'); // Will transition to high
          setIsEnabled(true);
          isSwitchingTrackRef.current = true;
          naturalEndingActiveRef.current = false;
          setIsNaturalEndingActive(false);

          startBuildupCountdown(RISE_COUNTDOWN_DURATION_SEC);
          console.log('[MusicProvider] Rise countdown (preselected) - seeking to:', seekPosition, 'drop at:', highSegment.timestamp);

          await musicService.play(preSelectedTrack, { segment: playSegment, useBuildup: false });
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

  // Rise from Rest - music plays during rest, drop hits 0.75s after exercise starts (syncs with rise countdown)
  // Seeks to: highSegment.timestamp - restDurationSec - DROP_DELAY_SEC
  const playRiseFromRest = useCallback(async (options: { trackId?: string; restDurationSec: number; segmentTimestamp?: number }) => {
    const { trackId, restDurationSec, segmentTimestamp } = options;
    // Drop hits 0.75s after exercise starts to sync with rise countdown timing
    const DROP_DELAY_SEC = 0.75;
    const totalDuration = restDurationSec + DROP_DELAY_SEC;

    console.log('[MusicProvider] playRiseFromRest called:', { trackId, restDurationSec, dropDelaySec: DROP_DELAY_SEC });

    if (restDurationSec <= 0) {
      console.warn('[MusicProvider] playRiseFromRest - invalid rest duration:', restDurationSec);
      return;
    }

    // Get downloaded tracks
    const downloadedTracks = (tracks || []).filter(t =>
      downloadedFilenames.has(t.filename)
    ) as MusicTrack[];

    let track: MusicTrack | undefined;

    if (trackId) {
      // Use specific track
      track = downloadedTracks.find(t => t.id === trackId);
      if (!track) {
        console.warn('[MusicProvider] playRiseFromRest - specific track not found:', trackId);
        return;
      }
      // Check 30-second rule for explicit trackId (warning only)
      if (nextTriggerTimeRef.current) {
        const meetsRule = meetsMinPlayDuration(track, 'high', nextTriggerTimeRef.current);
        if (!meetsRule) {
          const timeUntilNextTriggerSec = Math.round((nextTriggerTimeRef.current - Date.now()) / 1000);
          const trackDurationSec = (track.durationMs || 0) / 1000;
          console.warn('[MusicProvider] playRiseFromRest - WARNING: explicit trackId may violate 30s rule', {
            trackId,
            trackName: track.name,
            trackDurationSec,
            timeUntilNextTriggerSec,
            minPlayDurationSec: MIN_PLAY_DURATION_SEC,
            note: 'Track will still play (explicit trackId bypasses filter)',
          });
        }
      }
    } else {
      // Pick random track from compatible pool (needs high segment at >= totalDuration for positive seek)
      let compatibleTracks = downloadedTracks.filter(t => {
        const highSegments = t.segments?.filter(s => s.energy === 'high') || [];
        return highSegments.some(s => s.timestamp >= totalDuration);
      });

      if (compatibleTracks.length === 0) {
        console.warn('[MusicProvider] playRiseFromRest - no compatible tracks found for duration:', totalDuration);
        return;
      }

      // Apply 30-second minimum play duration rule (soft filter)
      if (nextTriggerTimeRef.current) {
        const minDurationTracks = compatibleTracks.filter(t =>
          meetsMinPlayDuration(t, 'high', nextTriggerTimeRef.current)
        );
        if (minDurationTracks.length > 0) {
          console.log('[MusicProvider] playRiseFromRest - 30s rule filter:', {
            originalPoolSize: compatibleTracks.length,
            filteredPoolSize: minDurationTracks.length,
            nextTriggerInSec: Math.round((nextTriggerTimeRef.current - Date.now()) / 1000),
          });
          compatibleTracks = minDurationTracks;
        } else {
          console.log('[MusicProvider] playRiseFromRest - 30s rule: no tracks meet criteria, using full pool');
        }
      }

      // Select track using per-energy history (exhaust all before repeat, LRU fallback)
      // Rise from Rest always targets 'high' energy
      track = selectTrackWithEnergyHistory(
        compatibleTracks,
        'high',
        playedTracksHistoryByEnergy.current,
        true // Add to history
      );
    }

    if (!track) {
      console.warn('[MusicProvider] playRiseFromRest - no track selected');
      return;
    }

    // Find the high segment to use
    let highSegment: MusicSegment | undefined;

    if (segmentTimestamp !== undefined) {
      // Specific segment timestamp requested
      highSegment = (track.segments || []).find(
        s => s.energy === 'high' && s.timestamp === segmentTimestamp
      );
      if (highSegment) {
        console.log('[MusicProvider] playRiseFromRest - using specific segment timestamp:', segmentTimestamp);
        // Validate that seek position would be positive
        if (highSegment.timestamp < totalDuration) {
          console.warn('[MusicProvider] playRiseFromRest - specified segment timestamp too early for rest duration, falling back to random');
          highSegment = undefined;
        }
      } else {
        console.warn('[MusicProvider] playRiseFromRest - specified segment not found:', segmentTimestamp);
      }
    }

    // If no specific segment or it wasn't valid, find valid high segments
    if (!highSegment) {
      const validHighSegments = (track.segments || [])
        .filter(s => s.energy === 'high' && s.timestamp >= totalDuration);

      if (validHighSegments.length === 0) {
        console.warn('[MusicProvider] playRiseFromRest - no valid high segments for track:', track.name);
        return;
      }

      // Pick random from valid high segments
      highSegment = validHighSegments[Math.floor(Math.random() * validHighSegments.length)]!;
    }

    // Calculate seek position: drop hits 1s after exercise starts
    const seekTimestamp = highSegment.timestamp - totalDuration;

    console.log('[MusicProvider] playRiseFromRest - precision calc:', {
      track: track.name,
      highSegmentTimestamp: highSegment.timestamp,
      restDurationSec,
      dropDelaySec: DROP_DELAY_SEC,
      seekTimestamp,
    });

    // Find the segment at the seek point (for energy state tracking)
    const segmentAtSeek = findSegmentAtTimestamp(track.segments || [], seekTimestamp);

    // Create segment with seek timestamp
    const playSegment: MusicSegment = {
      ...segmentAtSeek,
      timestamp: seekTimestamp,
    } as MusicSegment;

    // Enable and play
    setIsEnabled(true);
    setCurrentTrack(track);
    setCurrentSegment(playSegment);
    setCurrentEnergy(segmentAtSeek?.energy || 'high');

    // Set switching flag to prevent 'stopped' event from disabling music
    isSwitchingTrackRef.current = true;

    await musicService.play(track, { segment: playSegment, useBuildup: false });

    isSwitchingTrackRef.current = false;
    // History already added by selectTrackWithEnergyHistory for random selection
    // Explicit trackId bypasses history (not added)
    setIsPlaying(true);
    setIsPaused(false);

    console.log('[MusicProvider] playRiseFromRest - playing:', track.name, 'from', seekTimestamp, 's');
  }, [tracks, downloadedFilenames, findSegmentAtTimestamp]);

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
      // Apply high beat delay - seek 1 second before high segment so beat hits after delay
      const delayedTimestamp = applyHighBeatDelay(highSegment, 'high');
      console.log('[MusicProvider] seekToHighSegment - seeking to:', {
        original: highSegment.timestamp,
        delayed: delayedTimestamp,
      });
      musicService.seekTo(delayedTimestamp);
      setCurrentSegment({ ...highSegment, timestamp: delayedTimestamp });
      setCurrentEnergy('high');
      clearBuildupCountdown(); // Clear any buildup state
    } else {
      console.log('[MusicProvider] seekToHighSegment - no high segment found');
    }
  }, [currentTrack, clearBuildupCountdown]);

  // Clear natural ending state (call when entering a new round)
  // This allows the next round's triggers to play immediately instead of being queued
  const clearNaturalEnding = useCallback(() => {
    if (naturalEndingActiveRef.current || pendingTriggerRef.current) {
      console.log('[MusicProvider] clearNaturalEnding - clearing natural ending state');
      naturalEndingActiveRef.current = false;
      setIsNaturalEndingActive(false);
      // Clear any queued triggers - they're from the previous round
      pendingTriggerRef.current = null;
      clearPendingTriggerTimeout();
    }
  }, [clearPendingTriggerTimeout]);

  // Set auto-progress energy for track progressions
  // Called by useWorkoutMusic when a phase trigger fires
  const setAutoProgressEnergy = useCallback((energy: PlayableEnergy) => {
    console.log('[MusicProvider] setAutoProgressEnergy:', energy);
    autoProgressEnergyRef.current = energy;
  }, []);

  // Set next trigger time for 30-second minimum play duration rule
  // Called by useWorkoutMusic when calculating the next trigger point
  const setNextTriggerTime = useCallback((time: number | undefined) => {
    console.log('[MusicProvider] setNextTriggerTime:', time, time ? `(${Math.round((time - Date.now()) / 1000)}s from now)` : '');
    nextTriggerTimeRef.current = time;
  }, []);

  // TODO: TEMPORARY - Remove once segment timestamps are finalized
  // Refresh tracks from API to get updated segment timestamps for testing
  const refreshTracks = useCallback(async () => {
    console.log('[MusicProvider] refreshTracks - fetching latest tracks from API...');
    try {
      const result = await refetchTracks();
      if (result.data && result.data.length > 0) {
        const freshTracks = result.data as MusicTrack[];
        // Update cache with fresh data
        await AsyncStorage.setItem(TRACKS_CACHE_KEY, JSON.stringify(freshTracks));
        setCachedTracks(freshTracks);
        console.log('[MusicProvider] refreshTracks - updated', freshTracks.length, 'tracks');
        // Log segment info for debugging
        freshTracks.forEach(t => {
          const highSegs = t.segments?.filter(s => s.energy === 'high') || [];
          console.log(`[MusicProvider] Track "${t.name}" high segments:`, highSegs.map(s => s.timestamp));
        });
      }
    } catch (error) {
      console.error('[MusicProvider] refreshTracks - error:', error);
    }
  }, [refetchTracks]);

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
          console.log('[MusicProvider] trackEnd event', {
            naturalEndingActive: naturalEndingActiveRef.current,
            hasPendingTrigger: !!pendingTriggerRef.current,
            isEnabled,
            currentEnergy,
            autoProgressEnergy: autoProgressEnergyRef.current,
          });
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
            } else if (isEnabled) {
              // Natural ending finished but still in same round (edge case: workout paused)
              // Music is still enabled, so play a new track using autoProgressEnergy
              console.log('[MusicProvider] Natural ending complete in same round - playing new track at autoProgressEnergy:', autoProgressEnergyRef.current);
              playNextTrack({ energy: autoProgressEnergyRef.current });
            } else {
              console.log('[MusicProvider] Natural ending complete - music disabled, stopping playback');
              setIsPlaying(false);
            }
          } else if (isEnabled && currentEnergy && currentEnergy !== 'outro') {
            // Use autoProgressEnergy for automatic progressions (phase-based rule)
            // - 'low' for previews
            // - 'high' for exercise/rest/setBreak
            const progressEnergy = autoProgressEnergyRef.current;
            console.log('[MusicProvider] Track ended - playing next at autoProgressEnergy:', progressEnergy);
            playNextTrack({ energy: progressEnergy });
          } else {
            console.log('[MusicProvider] Track ended - stopping (disabled or outro energy)');
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
          // Preserve currentEnergy so play after stop uses the same energy level
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

    // 4. Note: Trigger state is now managed by the workout machine context.
    // Resetting triggers should be done by sending RESET_MUSIC_TRIGGERS event to the machine.
    // This allows atomic resets coordinated with workout state transitions.
    console.log('[MusicProvider] stop() - trigger reset should be handled by workout machine');

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

  // Pause music - sets isEnabled=false so triggers won't fire while paused
  // Triggers that would fire are NOT consumed, so they can fire when user navigates back
  const pause = useCallback(() => {
    console.log('[MusicProvider] pause() called');

    // Disable triggers while paused (phases won't be marked triggered or consumed)
    setIsEnabled(false);

    // Cancel active countdowns
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

  // Resume music - re-enables triggers
  const resume = useCallback(() => {
    if (isPaused && currentTrack) {
      setIsEnabled(true);
      musicService.resume();
      setIsPaused(false);
      setIsPlaying(true);
    }
  }, [isPaused, currentTrack]);

  // Play or Resume - smart function that resumes if paused, or enables music if stopped
  // When starting fresh, just enables music and lets the trigger system (useWorkoutMusic) handle playback
  const playOrResume = useCallback(async () => {
    console.log('[MusicProvider] playOrResume() called', {
      isPaused,
      currentTrack: currentTrack?.name ?? null,
      currentEnergy,
      isEnabled,
    });

    // Try to resume if we have a paused track
    if (isPaused && currentTrack) {
      console.log('[MusicProvider] playOrResume() - attempting to resume paused track');
      setIsEnabled(true);
      const resumeSuccess = musicService.resume();

      if (resumeSuccess) {
        console.log('[MusicProvider] playOrResume() - resume initiated successfully');
        setIsPaused(false);
        setIsPlaying(true);
        return;
      }

      // Resume failed - fall through to enable music
      console.log('[MusicProvider] playOrResume() - resume failed, enabling music for trigger system');
    }

    // Enable music and let the trigger system (useWorkoutMusic) handle playback
    // This prevents double-play when both playOrResume and the trigger system try to play
    console.log('[MusicProvider] playOrResume() - enabling music, trigger system will handle playback');
    setIsEnabled(true);
    setIsPaused(false);
  }, [isPaused, currentTrack, currentEnergy, isEnabled]);

  // Toggle music
  const toggle = useCallback(() => {
    if (isEnabled) {
      stop();
    } else {
      start();
    }
  }, [isEnabled, start, stop]);

  // Skip to next track (Forward)
  // Clears natural ending state, auto-resumes if paused
  const skipNext = useCallback(async () => {
    console.log('[MusicProvider] skipNext() - forward to next track');
    // Clear natural ending state
    naturalEndingActiveRef.current = false;
    setIsNaturalEndingActive(false);
    pendingTriggerRef.current = null;
    clearPendingTriggerTimeout();
    // Auto-resume: enable and unpause
    setIsEnabled(true);
    setIsPaused(false);
    clearBuildupCountdown();
    await playNextTrack({ energy: (currentEnergy as PlayableEnergy) || 'low' });
  }, [playNextTrack, currentEnergy, clearBuildupCountdown, clearPendingTriggerTimeout]);

  // Skip back (Back)
  // Restarts current track from beginning, clears natural ending, auto-resumes if paused
  const skipBack = useCallback(() => {
    console.log('[MusicProvider] skipBack() - restart track from beginning');
    if (!currentTrack) {
      console.log('[MusicProvider] skipBack() - no current track');
      return;
    }
    // Clear natural ending state
    naturalEndingActiveRef.current = false;
    setIsNaturalEndingActive(false);
    pendingTriggerRef.current = null;
    clearPendingTriggerTimeout();
    // Auto-resume: enable and unpause
    setIsEnabled(true);
    setIsPaused(false);
    clearBuildupCountdown();
    // Seek to beginning of track
    musicService.seekTo(0);
    // Ensure playing state is set (in case we were paused)
    if (!isPlaying) {
      musicService.resume();
      setIsPlaying(true);
    }
  }, [currentTrack, isPlaying, clearBuildupCountdown, clearPendingTriggerTimeout]);

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
    playOrResume,
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
    playRiseFromRest,
    seekToHighSegment,
    clearNaturalEnding,
    setAutoProgressEnergy,
    setNextTriggerTime,
    refreshTracks, // TODO: TEMPORARY - Remove once segment timestamps are finalized
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
