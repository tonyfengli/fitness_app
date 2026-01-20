import Sound from 'react-native-sound';
import RNFS from 'react-native-fs';

// Enable playback in silence mode
Sound.setCategory('Playback');

// Supported audio extensions (same as MusicDownloadService)
const SUPPORTED_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav'];

/**
 * Music segment within a track - marks a point with a specific energy level
 */
export interface MusicSegment {
  timestamp: number; // seconds - where this segment starts
  energy: 'low' | 'medium' | 'high' | 'outro';
  buildupDuration?: number; // seconds before timestamp where buildup starts
}

export type EnergyLevel = 'low' | 'medium' | 'high' | 'outro';

export interface MusicTrack {
  id: string;
  filename: string;
  name: string;
  artist: string;
  durationMs: number;
  genre?: string | null;
  downloadUrl?: string | null;
  segments: MusicSegment[];
}

interface MusicConfig {
  volume: number;
  enabled: boolean;
}

type MusicEventType = 'trackStart' | 'trackEnd' | 'stopped' | 'error' | 'buildupComplete';
type MusicEventCallback = (event: {
  type: MusicEventType;
  track?: MusicTrack;
  segment?: MusicSegment;
  error?: Error;
}) => void;

// Music files are downloaded to the app's document directory
// Sound effects use bundled resources (see AudioService.ts)
const MUSIC_STORAGE_PATH = `${RNFS.DocumentDirectoryPath}/music`;

/**
 * MusicService handles music playback for workouts.
 * Plays from downloaded files in the document directory.
 */
class MusicService {
  private currentSound: Sound | null = null;
  private currentTrack: MusicTrack | null = null;
  private currentSegment: MusicSegment | null = null;
  private isPlaying = false;
  private config: MusicConfig = {
    volume: 0.8,
    enabled: true,
  };
  private eventListeners: Set<MusicEventCallback> = new Set();
  private trackEndCheckInterval: NodeJS.Timeout | null = null;
  private buildupTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Singleton pattern
    if ((MusicService as any).instance) {
      return (MusicService as any).instance;
    }
    (MusicService as any).instance = this;
  }

  /**
   * Subscribe to music events
   */
  addEventListener(callback: MusicEventCallback): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  private emit(event: { type: MusicEventType; track?: MusicTrack; error?: Error }): void {
    this.eventListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[MusicService] Event listener error:', error);
      }
    });
  }

  /**
   * Play a track from downloaded files
   * @param track - The track metadata
   * @param options - Playback options
   * @param options.segment - The segment to seek to (uses segment.timestamp)
   * @param options.useBuildup - If true and segment has buildupDuration, starts earlier for buildup
   */
  async play(track: MusicTrack, options?: { segment?: MusicSegment; useBuildup?: boolean }): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Stop current track if playing
    await this.stop();

    const segment = options?.segment;
    const useBuildup = options?.useBuildup ?? false;

    // Helper to start playback once sound is loaded
    const startPlayback = (sound: Sound): void => {
      this.currentSound = sound;
      this.currentTrack = track;
      this.currentSegment = segment || null;

      // Set volume
      sound.setVolume(this.config.volume);

      // Calculate seek position based on segment and buildup
      let seekPosition = 0;
      let buildupDuration = 0;

      if (segment) {
        seekPosition = segment.timestamp;

        // If using buildup and segment has buildupDuration, start earlier
        if (useBuildup && segment.buildupDuration && segment.buildupDuration > 0) {
          buildupDuration = segment.buildupDuration;
          seekPosition = Math.max(0, segment.timestamp - buildupDuration);
          console.log(`[MusicService] Starting with buildup: seek to ${seekPosition}s, drop at ${segment.timestamp}s`);
        }
      }

      if (seekPosition > 0) {
        sound.setCurrentTime(seekPosition);
      }

      // Start playback
      this.isPlaying = true;
      this.emit({ type: 'trackStart', track, segment });

      // Set up buildup complete timer if applicable
      if (buildupDuration > 0) {
        this.buildupTimeout = setTimeout(() => {
          console.log(`[MusicService] Buildup complete - DROP!`);
          this.emit({ type: 'buildupComplete', track, segment });
          this.buildupTimeout = null;
        }, buildupDuration * 1000);
      }

      sound.play((success) => {
        this.isPlaying = false;
        this.clearBuildupTimeout();

        if (success) {
          this.emit({ type: 'trackEnd', track, segment });
        } else {
          this.emit({ type: 'error', track, segment, error: new Error('Playback failed') });
        }

        // Clean up
        this.currentSound = null;
        this.currentTrack = null;
        this.currentSegment = null;
      });

      // Start checking for track end (backup for callback)
      this.startTrackEndCheck();
    };

    // Find the downloaded file (try all supported extensions)
    const findDownloadedFile = async (): Promise<string | null> => {
      for (const ext of SUPPORTED_EXTENSIONS) {
        const path = `${MUSIC_STORAGE_PATH}/${track.filename}${ext}`;
        const exists = await RNFS.exists(path);
        if (exists) {
          return path;
        }
      }
      return null;
    };

    const downloadedPath = await findDownloadedFile();

    if (!downloadedPath) {
      const error = new Error(`Track file not found: ${track.filename}`);
      console.error('[MusicService] Failed to find track:', track.filename);
      this.emit({ type: 'error', track, segment, error });
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sound = new Sound(downloadedPath, '', (error) => {
        if (error) {
          console.error('[MusicService] Failed to load track:', track.filename, error);
          this.emit({ type: 'error', track, segment, error });
          reject(error);
          return;
        }

        startPlayback(sound);
        resolve();
      });
    });
  }

  private clearBuildupTimeout(): void {
    if (this.buildupTimeout) {
      clearTimeout(this.buildupTimeout);
      this.buildupTimeout = null;
    }
  }

  private startTrackEndCheck(): void {
    // Clear existing interval
    if (this.trackEndCheckInterval) {
      clearInterval(this.trackEndCheckInterval);
    }

    // Check every second if track has ended
    this.trackEndCheckInterval = setInterval(() => {
      if (this.currentSound && this.currentTrack) {
        this.currentSound.getCurrentTime((_seconds, isPlaying) => {
          if (!isPlaying && this.isPlaying) {
            // Track ended
            this.isPlaying = false;
            const track = this.currentTrack;
            const segment = this.currentSegment;
            this.currentSound = null;
            this.currentTrack = null;
            this.currentSegment = null;
            this.clearBuildupTimeout();

            if (track) {
              this.emit({ type: 'trackEnd', track, segment: segment || undefined });
            }

            if (this.trackEndCheckInterval) {
              clearInterval(this.trackEndCheckInterval);
              this.trackEndCheckInterval = null;
            }
          }
        });
      }
    }, 1000);
  }

  /**
   * Stop current playback
   */
  async stop(): Promise<void> {
    if (this.trackEndCheckInterval) {
      clearInterval(this.trackEndCheckInterval);
      this.trackEndCheckInterval = null;
    }

    this.clearBuildupTimeout();

    const wasPlaying = this.isPlaying || this.currentSound !== null;

    if (!this.currentSound) {
      this.currentSegment = null;
      if (wasPlaying) {
        this.emit({ type: 'stopped' });
      }
      return;
    }

    return new Promise((resolve) => {
      try {
        if (this.currentSound) {
          this.currentSound.stop(() => {
            if (this.currentSound) {
              this.currentSound.release();
              this.currentSound = null;
            }
            this.currentTrack = null;
            this.currentSegment = null;
            this.isPlaying = false;
            this.emit({ type: 'stopped' });
            resolve();
          });
        } else {
          resolve();
        }
      } catch (error) {
        console.error('[MusicService] Error stopping:', error);
        this.currentSound = null;
        this.currentTrack = null;
        this.currentSegment = null;
        this.isPlaying = false;
        this.emit({ type: 'stopped' });
        resolve();
      }
    });
  }

  /**
   * Pause current playback
   */
  pause(): void {
    if (this.currentSound && this.isPlaying) {
      try {
        this.currentSound.pause();
        this.isPlaying = false;
      } catch (error) {
        console.error('[MusicService] Error pausing:', error);
      }
    }
  }

  /**
   * Resume paused playback
   */
  resume(): void {
    if (this.currentSound && !this.isPlaying) {
      try {
        this.isPlaying = true;
        this.currentSound.play((success) => {
          if (!success) {
            this.isPlaying = false;
          }
        });
      } catch (error) {
        console.error('[MusicService] Error resuming:', error);
        this.isPlaying = false;
      }
    }
  }

  /**
   * Seek to a specific position in seconds
   */
  seekTo(seconds: number): void {
    if (this.currentSound) {
      try {
        this.currentSound.setCurrentTime(seconds);
      } catch (error) {
        console.error('[MusicService] Error seeking:', error);
      }
    }
  }

  /**
   * Get current playback position in seconds
   */
  getCurrentTime(): Promise<number> {
    return new Promise((resolve) => {
      if (!this.currentSound) {
        resolve(0);
        return;
      }

      try {
        this.currentSound.getCurrentTime((seconds) => {
          resolve(seconds);
        });
      } catch (error) {
        resolve(0);
      }
    });
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));

    if (this.currentSound) {
      try {
        this.currentSound.setVolume(this.config.volume);
      } catch (error) {
        console.error('[MusicService] Error setting volume:', error);
      }
    }
  }

  /**
   * Enable or disable music playback
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;

    if (!enabled) {
      this.stop();
    }
  }

  /**
   * Check if music is currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get current track
   */
  getCurrentTrack(): MusicTrack | null {
    return this.currentTrack;
  }

  /**
   * Get current segment
   */
  getCurrentSegment(): MusicSegment | null {
    return this.currentSegment;
  }

  /**
   * Check if music is enabled
   */
  getIsEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Release all resources
   */
  release(): void {
    this.stop();
    this.eventListeners.clear();
  }
}

// Export singleton instance
export const musicService = new MusicService();
