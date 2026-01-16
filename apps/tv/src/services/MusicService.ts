import Sound from 'react-native-sound';
import RNFS from 'react-native-fs';

// Enable playback in silence mode
Sound.setCategory('Playback');

export interface MusicTrack {
  id: string;
  filename: string;
  name: string;
  artist: string;
  durationMs: number;
  energy: 'high' | 'low';
  genre?: string | null;
  downloadUrl?: string | null;
  startTimestamp?: number | null;
}

interface MusicConfig {
  volume: number;
  enabled: boolean;
}

type MusicEventType = 'trackStart' | 'trackEnd' | 'error';
type MusicEventCallback = (event: { type: MusicEventType; track?: MusicTrack; error?: Error }) => void;

// Music files are downloaded to the app's document directory
// Files are synced from cloud storage via MusicDownloadService
const MUSIC_STORAGE_PATH = `${RNFS.DocumentDirectoryPath}/music`;

/**
 * MusicService handles music playback for workouts.
 * Plays MP3 files from the app's document directory (downloaded via MusicDownloadService).
 */
class MusicService {
  private currentSound: Sound | null = null;
  private currentTrack: MusicTrack | null = null;
  private isPlaying = false;
  private config: MusicConfig = {
    volume: 0.8,
    enabled: true,
  };
  private eventListeners: Set<MusicEventCallback> = new Set();
  private trackEndCheckInterval: NodeJS.Timeout | null = null;

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
   * Play a track from device storage
   * @param track - The track metadata
   * @param useStartTimestamp - Whether to seek to the track's startTimestamp
   */
  async play(track: MusicTrack, useStartTimestamp = false): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Stop current track if playing
    await this.stop();

    return new Promise((resolve, reject) => {
      try {
        // Load from app's document directory (downloaded files)
        const filepath = `${MUSIC_STORAGE_PATH}/${track.filename}.mp3`;
        console.log('[MusicService] Loading file:', filepath);

        // Empty string as basePath for absolute file paths
        console.log('[MusicService] Attempting Sound constructor with:', { filepath, basePath: '(empty string)' });

        const sound = new Sound(filepath, '', (error) => {
          if (error) {
            console.error('[MusicService] Failed to load track:', {
              error,
              errorMessage: error?.message,
              errorCode: error?.code,
              filepath,
            });
            this.emit({ type: 'error', track, error });
            reject(error);
            return;
          }

          console.log('[MusicService] Sound loaded successfully:', { filepath, duration: sound.getDuration() });

          this.currentSound = sound;
          this.currentTrack = track;

          // Set volume
          sound.setVolume(this.config.volume);

          // Seek to startTimestamp if requested
          if (useStartTimestamp && track.startTimestamp && track.startTimestamp > 0) {
            sound.setCurrentTime(track.startTimestamp);
          }

          // Start playback
          this.isPlaying = true;
          this.emit({ type: 'trackStart', track });

          sound.play((success) => {
            this.isPlaying = false;

            if (success) {
              this.emit({ type: 'trackEnd', track });
            } else {
              console.error('[MusicService] Playback failed');
              this.emit({ type: 'error', track, error: new Error('Playback failed') });
            }

            // Clean up
            this.currentSound = null;
            this.currentTrack = null;
          });

          // Start checking for track end (backup for callback)
          this.startTrackEndCheck();

          resolve();
        });
      } catch (error) {
        console.error('[MusicService] Error playing track:', error);
        this.emit({ type: 'error', track, error: error as Error });
        reject(error);
      }
    });
  }

  private startTrackEndCheck(): void {
    // Clear existing interval
    if (this.trackEndCheckInterval) {
      clearInterval(this.trackEndCheckInterval);
    }

    // Check every second if track has ended
    this.trackEndCheckInterval = setInterval(() => {
      if (this.currentSound && this.currentTrack) {
        this.currentSound.getCurrentTime((seconds, isPlaying) => {
          if (!isPlaying && this.isPlaying) {
            // Track ended
            this.isPlaying = false;
            const track = this.currentTrack;
            this.currentSound = null;
            this.currentTrack = null;

            if (track) {
              this.emit({ type: 'trackEnd', track });
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

    if (!this.currentSound) {
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
            this.isPlaying = false;
            resolve();
          });
        } else {
          resolve();
        }
      } catch (error) {
        console.error('[MusicService] Error stopping:', error);
        this.currentSound = null;
        this.currentTrack = null;
        this.isPlaying = false;
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
