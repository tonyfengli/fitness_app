import RNFS from 'react-native-fs';
import { MusicTrack } from './MusicService';

// Local storage path for downloaded music
const MUSIC_DIR = `${RNFS.DocumentDirectoryPath}/music`;

export interface DownloadProgress {
  trackId: string;
  filename: string;
  bytesWritten: number;
  contentLength: number;
  percent: number;
}

export interface SyncResult {
  total: number;
  downloaded: number;
  skipped: number;
  failed: string[];
}

/**
 * MusicDownloadService handles downloading music files from cloud storage
 * to the app's local document directory.
 */
class MusicDownloadService {
  private downloadInProgress = false;
  private progressCallbacks: Set<(progress: DownloadProgress) => void> = new Set();

  constructor() {
    // Singleton pattern
    if ((MusicDownloadService as any).instance) {
      return (MusicDownloadService as any).instance;
    }
    (MusicDownloadService as any).instance = this;
  }

  /**
   * Get the local file path for a track
   */
  getLocalPath(filename: string): string {
    return `${MUSIC_DIR}/${filename}.mp3`;
  }

  /**
   * Check if a track exists locally
   */
  async existsLocally(filename: string): Promise<boolean> {
    const path = this.getLocalPath(filename);
    return RNFS.exists(path);
  }

  /**
   * Ensure the music directory exists
   */
  async ensureMusicDir(): Promise<void> {
    const exists = await RNFS.exists(MUSIC_DIR);
    if (!exists) {
      console.log('[MusicDownload] Creating music directory:', MUSIC_DIR);
      await RNFS.mkdir(MUSIC_DIR);
    }
  }

  /**
   * Subscribe to download progress updates
   */
  onProgress(callback: (progress: DownloadProgress) => void): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  private emitProgress(progress: DownloadProgress): void {
    this.progressCallbacks.forEach(cb => cb(progress));
  }

  /**
   * Download a single track
   */
  async downloadTrack(track: MusicTrack): Promise<boolean> {
    if (!track.downloadUrl) {
      console.warn('[MusicDownload] No downloadUrl for track:', track.filename);
      return false;
    }

    const localPath = this.getLocalPath(track.filename);

    // Check if already exists
    const exists = await RNFS.exists(localPath);
    if (exists) {
      console.log('[MusicDownload] Already exists:', track.filename);
      return true;
    }

    console.log('[MusicDownload] Downloading:', track.filename);
    console.log('[MusicDownload] From:', track.downloadUrl);
    console.log('[MusicDownload] To:', localPath);

    try {
      const downloadResult = await RNFS.downloadFile({
        fromUrl: track.downloadUrl,
        toFile: localPath,
        progress: (res) => {
          const percent = Math.round((res.bytesWritten / res.contentLength) * 100);
          this.emitProgress({
            trackId: track.id,
            filename: track.filename,
            bytesWritten: res.bytesWritten,
            contentLength: res.contentLength,
            percent,
          });
        },
        progressDivider: 10, // Emit progress every 10%
      }).promise;

      if (downloadResult.statusCode === 200) {
        const stats = await RNFS.stat(localPath);
        console.log('[MusicDownload] Downloaded:', track.filename, `(${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
      } else {
        console.error('[MusicDownload] Failed with status:', downloadResult.statusCode);
        // Clean up failed download
        await RNFS.unlink(localPath).catch(() => {});
        return false;
      }
    } catch (error) {
      console.error('[MusicDownload] Error downloading:', track.filename, error);
      // Clean up failed download
      await RNFS.unlink(localPath).catch(() => {});
      return false;
    }
  }

  /**
   * Sync all tracks - download any that are missing locally
   */
  async syncTracks(tracks: MusicTrack[]): Promise<SyncResult> {
    if (this.downloadInProgress) {
      console.warn('[MusicDownload] Sync already in progress');
      return { total: 0, downloaded: 0, skipped: 0, failed: [] };
    }

    this.downloadInProgress = true;
    console.log('[MusicDownload] Starting sync for', tracks.length, 'tracks');

    const result: SyncResult = {
      total: tracks.length,
      downloaded: 0,
      skipped: 0,
      failed: [],
    };

    try {
      await this.ensureMusicDir();

      // Filter tracks that have downloadUrl
      const tracksWithUrl = tracks.filter(t => t.downloadUrl);
      console.log('[MusicDownload] Tracks with downloadUrl:', tracksWithUrl.length);

      // Check which tracks need downloading
      const toDownload: MusicTrack[] = [];
      for (const track of tracksWithUrl) {
        const exists = await this.existsLocally(track.filename);
        if (exists) {
          result.skipped++;
        } else {
          toDownload.push(track);
        }
      }

      console.log('[MusicDownload] Need to download:', toDownload.length);
      console.log('[MusicDownload] Already have:', result.skipped);

      // Download missing tracks
      for (const track of toDownload) {
        const success = await this.downloadTrack(track);
        if (success) {
          result.downloaded++;
        } else {
          result.failed.push(track.filename);
        }
      }

      console.log('[MusicDownload] Sync complete:', {
        downloaded: result.downloaded,
        skipped: result.skipped,
        failed: result.failed.length,
      });

      return result;
    } finally {
      this.downloadInProgress = false;
    }
  }

  /**
   * List all locally downloaded tracks
   */
  async listLocalTracks(): Promise<string[]> {
    try {
      const exists = await RNFS.exists(MUSIC_DIR);
      if (!exists) {
        return [];
      }
      const files = await RNFS.readDir(MUSIC_DIR);
      return files
        .filter(f => f.name.endsWith('.mp3'))
        .map(f => f.name.replace('.mp3', ''));
    } catch (error) {
      console.error('[MusicDownload] Error listing local tracks:', error);
      return [];
    }
  }

  /**
   * Delete all locally downloaded tracks
   */
  async clearLocalTracks(): Promise<void> {
    try {
      const exists = await RNFS.exists(MUSIC_DIR);
      if (exists) {
        await RNFS.unlink(MUSIC_DIR);
        console.log('[MusicDownload] Cleared all local tracks');
      }
    } catch (error) {
      console.error('[MusicDownload] Error clearing local tracks:', error);
    }
  }

  /**
   * Get total size of downloaded music
   */
  async getLocalStorageSize(): Promise<number> {
    try {
      const exists = await RNFS.exists(MUSIC_DIR);
      if (!exists) {
        return 0;
      }
      const files = await RNFS.readDir(MUSIC_DIR);
      return files.reduce((total, file) => total + (file.size || 0), 0);
    } catch (error) {
      console.error('[MusicDownload] Error getting storage size:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const musicDownloadService = new MusicDownloadService();

// Export the local music directory path for MusicService
export const MUSIC_LOCAL_DIR = MUSIC_DIR;
