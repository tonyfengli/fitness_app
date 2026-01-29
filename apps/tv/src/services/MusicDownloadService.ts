import RNFS from 'react-native-fs';
import { MusicTrack } from './MusicService';

// Local storage path for downloaded music
const MUSIC_DIR = `${RNFS.DocumentDirectoryPath}/music`;

// Supported audio extensions
const SUPPORTED_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav'];
const DEFAULT_EXTENSION = '.mp3';

/**
 * Extract file extension from a URL or filename
 */
function getExtensionFromUrl(url: string): string {
  try {
    // Remove query params and get the path
    const urlPath = url.split('?')[0] || url;
    const lastSegment = urlPath.split('/').pop() || '';

    for (const ext of SUPPORTED_EXTENSIONS) {
      if (lastSegment.toLowerCase().endsWith(ext)) {
        return ext;
      }
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_EXTENSION;
}

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
  getLocalPath(filename: string, extension: string = DEFAULT_EXTENSION): string {
    return `${MUSIC_DIR}/${filename}${extension}`;
  }

  /**
   * Check if a track exists locally (checks all supported extensions)
   */
  async existsLocally(filename: string): Promise<boolean> {
    for (const ext of SUPPORTED_EXTENSIONS) {
      const path = this.getLocalPath(filename, ext);
      const exists = await RNFS.exists(path);
      if (exists) return true;
    }
    return false;
  }

  /**
   * Find the local path for a track (checks all supported extensions)
   */
  async findLocalPath(filename: string): Promise<string | null> {
    for (const ext of SUPPORTED_EXTENSIONS) {
      const path = this.getLocalPath(filename, ext);
      const exists = await RNFS.exists(path);
      if (exists) return path;
    }
    return null;
  }

  /**
   * Ensure the music directory exists
   */
  async ensureMusicDir(): Promise<void> {
    const exists = await RNFS.exists(MUSIC_DIR);
    if (!exists) {
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
    if (!track.downloadUrl) return false;

    const extension = getExtensionFromUrl(track.downloadUrl);
    const localPath = this.getLocalPath(track.filename, extension);

    // Check if already exists
    const existingPath = await this.findLocalPath(track.filename);
    if (existingPath) return true;

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
        progressDivider: 10,
      }).promise;

      if (downloadResult.statusCode === 200) {
        return true;
      } else {
        console.error(
          `[MusicDownloadService] Download failed for "${track.filename}":`,
          `HTTP ${downloadResult.statusCode}`,
          `URL: ${track.downloadUrl}`
        );
        await RNFS.unlink(localPath).catch(() => {});
        return false;
      }
    } catch (error) {
      console.error(
        `[MusicDownloadService] Download error for "${track.filename}":`,
        error instanceof Error ? error.message : error,
        `URL: ${track.downloadUrl}`
      );
      await RNFS.unlink(localPath).catch(() => {});
      return false;
    }
  }

  /**
   * Sync all tracks - download any that are missing locally
   */
  async syncTracks(tracks: MusicTrack[]): Promise<SyncResult> {
    if (this.downloadInProgress) {
      return { total: 0, downloaded: 0, skipped: 0, failed: [] };
    }

    this.downloadInProgress = true;

    const result: SyncResult = {
      total: tracks.length,
      downloaded: 0,
      skipped: 0,
      failed: [],
    };

    try {
      await this.ensureMusicDir();

      const tracksWithUrl = tracks.filter(t => t.downloadUrl);
      const toDownload: MusicTrack[] = [];

      for (const track of tracksWithUrl) {
        const exists = await this.existsLocally(track.filename);
        if (exists) {
          result.skipped++;
        } else {
          toDownload.push(track);
        }
      }

      for (const track of toDownload) {
        const success = await this.downloadTrack(track);
        if (success) {
          result.downloaded++;
        } else {
          result.failed.push(track.filename);
        }
      }

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
      if (!exists) return [];

      const files = await RNFS.readDir(MUSIC_DIR);
      return files
        .filter(f => SUPPORTED_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext)))
        .map(f => {
          const ext = SUPPORTED_EXTENSIONS.find(e => f.name.toLowerCase().endsWith(e)) || '';
          return f.name.slice(0, -ext.length);
        });
    } catch (error) {
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
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get total size of downloaded music
   */
  async getLocalStorageSize(): Promise<number> {
    try {
      const exists = await RNFS.exists(MUSIC_DIR);
      if (!exists) return 0;
      const files = await RNFS.readDir(MUSIC_DIR);
      return files.reduce((total, file) => total + (file.size || 0), 0);
    } catch (error) {
      return 0;
    }
  }
}

// Export singleton instance
export const musicDownloadService = new MusicDownloadService();

// Export the local music directory path for MusicService
export const MUSIC_LOCAL_DIR = MUSIC_DIR;
