/**
 * Circuit Setlist Service
 * Generates pre-planned music setlists for circuit workouts
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@acme/db/client";
import { spotifyTracks, type SpotifyTrack } from "@acme/db/schema";
import type { CircuitConfig } from "@acme/db";
import { 
  calculateCircuitTiming,
  type RoundTiming,
  type CircuitTimingResult 
} from "../utils/circuit-timing-calculator";

export interface SetlistTrack {
  spotifyId: string;
  trackName: string;
  triggerTimeMs: number;
  usage: 'hype' | 'rest' | 'bridge';
  durationMs: number;
  hypeTimestamp?: number | null;
}

export interface RoundSetlist {
  roundNumber: number;
  track1: SetlistTrack; // Hype at countdown
  track2: SetlistTrack; // Bridge at exercise 2
  track3: SetlistTrack; // Rest at round end
}

export interface CircuitSetlist {
  rounds: RoundSetlist[];
  totalTracks: number;
  generatedAt: string;
}

export class CircuitSetlistService {
  constructor(private db: Database) {}

  /**
   * Generate a complete setlist for a circuit workout
   */
  async generateSetlist(
    circuitConfig: CircuitConfig["config"],
    totalRounds: number
  ): Promise<CircuitSetlist> {
    // Calculate timing for all rounds
    const timing = calculateCircuitTiming(circuitConfig, totalRounds);
    
    // Fetch available tracks by usage type
    const [hypeTracks, bridgeTracks, restTracks] = await Promise.all([
      this.getTracksByUsage('hype'),
      this.getTracksByUsage('bridge'),
      this.getTracksByUsage('rest')
    ]);


    // Generate setlist for each round
    const rounds: RoundSetlist[] = [];
    const usedTrackIds = new Set<string>();

    for (const roundTiming of timing.rounds) {
      const roundSetlist = await this.generateRoundSetlist(
        roundTiming,
        circuitConfig,
        hypeTracks,
        bridgeTracks,
        restTracks,
        usedTrackIds
      );
      rounds.push(roundSetlist);
    }

    return {
      rounds,
      totalTracks: rounds.length * 3,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate setlist for a single round
   */
  private async generateRoundSetlist(
    roundTiming: RoundTiming,
    circuitConfig: CircuitConfig["config"],
    hypeTracks: SpotifyTrack[],
    bridgeTracks: SpotifyTrack[],
    restTracks: SpotifyTrack[],
    usedTrackIds: Set<string>
  ): Promise<RoundSetlist> {
    // Select track 1 (hype track at countdown)
    const track1 = this.selectTrack(hypeTracks, usedTrackIds, 'hype');
    if (!track1) {
      throw new Error('No hype tracks available for round ' + roundTiming.roundNumber);
    }
    
    // Select track 2 (bridge track at exercise 2)
    const track2 = this.selectTrack(bridgeTracks, usedTrackIds, 'bridge');
    if (!track2) {
      throw new Error('No bridge tracks available for round ' + roundTiming.roundNumber);
    }
    
    // Select track 3 (rest track at round end)
    const track3 = this.selectTrack(restTracks, usedTrackIds, 'rest');
    if (!track3) {
      throw new Error('No rest tracks available for round ' + roundTiming.roundNumber);
    }

    // Calculate trigger times
    // Track 1: Hype at countdown start
    const track1TriggerMs = roundTiming.countdownStartMs;
    
    // Track 2: Bridge at start of exercise 2
    // After countdown (6s) + exercise 1 (workDuration) + rest between exercises (restDuration)
    const track2TriggerMs = roundTiming.workStartMs + 
      (circuitConfig.workDuration * 1000) + 
      (circuitConfig.restDuration * 1000);
    
    // Track 3: Rest at round end (when last exercise finishes)
    const track3TriggerMs = roundTiming.endTimeMs;


    return {
      roundNumber: roundTiming.roundNumber,
      track1: {
        spotifyId: track1.spotifyId,
        trackName: track1.name,
        triggerTimeMs: track1TriggerMs,
        usage: 'hype',
        durationMs: track1.durationMs,
        hypeTimestamp: track1.hypeTimestamp
      },
      track2: {
        spotifyId: track2.spotifyId,
        trackName: track2.name,
        triggerTimeMs: track2TriggerMs,
        usage: 'bridge',
        durationMs: track2.durationMs,
        hypeTimestamp: track2.hypeTimestamp
      },
      track3: {
        spotifyId: track3.spotifyId,
        trackName: track3.name,
        triggerTimeMs: track3TriggerMs,
        usage: 'rest',
        durationMs: track3.durationMs,
        hypeTimestamp: track3.hypeTimestamp
      }
    };
  }

  /**
   * Select a track from pool, avoiding repeats unless necessary
   */
  private selectTrack(
    trackPool: SpotifyTrack[],
    usedTrackIds: Set<string>,
    usage: string
  ): SpotifyTrack | null {
    // First try to find an unused track
    const unusedTracks = trackPool.filter(t => !usedTrackIds.has(t.spotifyId));
    
    if (unusedTracks.length > 0) {
      // Randomly select from unused tracks
      const selected = unusedTracks[Math.floor(Math.random() * unusedTracks.length)];
      if (selected) {
        usedTrackIds.add(selected.spotifyId);
        return selected;
      }
    }

    // If all tracks are used, allow repeats
    if (trackPool.length > 0) {
      const selected = trackPool[Math.floor(Math.random() * trackPool.length)];
      return selected ?? null;
    }

    return null;
  }

  /**
   * Fetch tracks by usage type
   */
  private async getTracksByUsage(usage: 'hype' | 'bridge' | 'rest'): Promise<SpotifyTrack[]> {
    const tracks = await this.db
      .select()
      .from(spotifyTracks)
      .where(
        sql`${usage} = ANY(${spotifyTracks.usage})`
      );

    return tracks;
  }

  /**
   * Validate if enough tracks exist for the workout
   */
  async validateTrackAvailability(totalRounds: number): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const [hypeTracks, bridgeTracks, restTracks] = await Promise.all([
      this.getTracksByUsage('hype'),
      this.getTracksByUsage('bridge'), 
      this.getTracksByUsage('rest')
    ]);

    const issues: string[] = [];

    // Need at least 1 hype track (will repeat if necessary)
    if (hypeTracks.length === 0) {
      issues.push('No hype tracks available');
    }

    // Need at least 1 bridge track
    if (bridgeTracks.length === 0) {
      issues.push('No bridge tracks available');
    }

    // Need at least 1 rest track
    if (restTracks.length === 0) {
      issues.push('No rest tracks available');
    }

    // Warn if not enough unique tracks
    if (hypeTracks.length < totalRounds) {
      issues.push(`Only ${hypeTracks.length} hype tracks for ${totalRounds} rounds - will repeat`);
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Get a human-readable summary of the setlist
   */
  static getSetlistSummary(setlist: CircuitSetlist): string {
    const summaryLines = [`Circuit Setlist (${setlist.rounds.length} rounds):`];
    
    for (const round of setlist.rounds) {
      summaryLines.push(
        `Round ${round.roundNumber}: ${round.track1.trackName} → ${round.track2.trackName} → ${round.track3.trackName}`
      );
    }

    return summaryLines.join('\n');
  }
}