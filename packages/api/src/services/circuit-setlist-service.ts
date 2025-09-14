/**
 * Circuit Setlist Service
 * Generates pre-planned music setlists for circuit workouts
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@acme/db/client";
import { spotifyTracks, type SpotifyTrack } from "@acme/db/schema";
import type { CircuitConfig } from "@acme/validators/training-session";
import { 
  calculateCircuitTiming, 
  canTrackCoverRound,
  getSecondTrackTriggerPoint,
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
  track1: SetlistTrack;
  track2: SetlistTrack;
  coverageScenario: 'full-coverage' | 'bridge-needed';
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

    console.log('[SetlistService] Available tracks:', {
      hype: hypeTracks.length,
      bridge: bridgeTracks.length,
      rest: restTracks.length
    });

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
      totalTracks: rounds.length * 2,
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
    // Select track 1 (hype track)
    const track1 = this.selectTrack(hypeTracks, usedTrackIds, 'hype');
    if (!track1) {
      throw new Error('No hype tracks available for round ' + roundTiming.roundNumber);
    }

    // Check if track 1 covers the full round
    const track1Coverage = canTrackCoverRound(
      track1.durationMs,
      roundTiming,
      track1.hypeTimestamp
    );
    track1Coverage.trackId = track1.spotifyId;

    // Determine second track based on coverage
    const secondTrackTrigger = getSecondTrackTriggerPoint(
      track1Coverage,
      roundTiming,
      circuitConfig
    );

    // Select track 2 based on trigger type
    const track2Pool = secondTrackTrigger.triggerType === 'rest' ? restTracks : bridgeTracks;
    let track2 = this.selectTrack(track2Pool, usedTrackIds, secondTrackTrigger.triggerType);
    
    if (!track2) {
      // Fallback: use any available track from bridge pool if specific type is exhausted
      const fallbackTrack = this.selectTrack(bridgeTracks, usedTrackIds, 'bridge');
      if (!fallbackTrack) {
        throw new Error(`No ${secondTrackTrigger.triggerType} tracks available for round ${roundTiming.roundNumber}`);
      }
      track2 = fallbackTrack;
    }

    return {
      roundNumber: roundTiming.roundNumber,
      track1: {
        spotifyId: track1.spotifyId,
        trackName: track1.name,
        triggerTimeMs: roundTiming.countdownStartMs,
        usage: 'hype',
        durationMs: track1.durationMs,
        hypeTimestamp: track1.hypeTimestamp
      },
      track2: {
        spotifyId: track2.spotifyId,
        trackName: track2.name,
        triggerTimeMs: secondTrackTrigger.triggerTimeMs,
        usage: secondTrackTrigger.triggerType,
        durationMs: track2.durationMs,
        hypeTimestamp: track2.hypeTimestamp
      },
      coverageScenario: track1Coverage.coversFullRound ? 'full-coverage' : 'bridge-needed'
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
      usedTrackIds.add(selected.spotifyId);
      return selected;
    }

    // If all tracks are used, allow repeats
    console.log(`[SetlistService] All ${usage} tracks used, allowing repeats`);
    if (trackPool.length > 0) {
      const selected = trackPool[Math.floor(Math.random() * trackPool.length)];
      return selected;
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
        `Round ${round.roundNumber}: ${round.track1.trackName} → ${round.track2.trackName} (${round.coverageScenario})`
      );
    }

    return summaryLines.join('\n');
  }
}