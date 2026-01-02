import Sound from 'react-native-sound';

// Enable playback in silence mode
Sound.setCategory('Playback');

export type SoundName = 'countdown' | 'beep' | 'workoutStart' | 'workoutEnd' | 'rest' | 'exercise';

interface AudioConfig {
  volume: number;
  enabled: boolean;
}

class AudioService {
  private sounds: Map<SoundName, Sound> = new Map();
  private isInitialized = false;
  private isInitializing = false;
  private config: AudioConfig = {
    volume: 1.0,
    enabled: true,
  };

  constructor() {
    // Singleton pattern
    if ((AudioService as any).instance) {
      return (AudioService as any).instance;
    }
    (AudioService as any).instance = this;
  }

  async initialize(): Promise<void> {
    console.log('[AudioService] initialize called');
    console.log('[AudioService] Already initialized:', this.isInitialized);
    console.log('[AudioService] Currently initializing:', this.isInitializing);
    
    if (this.isInitialized) {
      console.log('[AudioService] Skipping initialization - already done');
      return;
    }
    
    if (this.isInitializing) {
      console.log('[AudioService] Skipping initialization - already in progress');
      return;
    }

    this.isInitializing = true;

    try {
      console.log('[AudioService] Starting sound preloading');
      
      // Preload all sounds
      await Promise.all([
        this.preloadSound('countdown', 'countdown_321.mp3'),
        // We can add more sounds here later
        // this.preloadSound('beep', 'beep.mp3'),
        // this.preloadSound('workoutStart', 'workout_start.mp3'),
        // this.preloadSound('workoutEnd', 'workout_end.mp3'),
      ]);

      this.isInitialized = true;
      console.log('[AudioService] Initialization completed successfully');
      console.log('[AudioService] Loaded sounds:', Array.from(this.sounds.keys()));
    } catch (error) {
      console.error('[AudioService] Failed to initialize:', error);
      console.error('[AudioService] Error stack:', error.stack);
    } finally {
      this.isInitializing = false;
    }
  }

  private preloadSound(name: SoundName, filename: string): Promise<void> {
    console.log(`[AudioService] preloadSound called for ${name} with file ${filename}`);
    
    return new Promise((resolve, reject) => {
      try {
        console.log(`[AudioService] Creating Sound object for ${name}`);
        
        // For Android, sounds should be in the raw folder without extension
        const sound = new Sound(filename, Sound.MAIN_BUNDLE, (error) => {
          if (error) {
            console.error(`[AudioService] Failed to load sound ${name}:`, error);
            console.error(`[AudioService] Error details:`, JSON.stringify(error));
            reject(error);
            return;
          }

          console.log(`[AudioService] Sound ${name} loaded successfully`);
          
          // Check if sound object is valid
          if (!sound) {
            console.error(`[AudioService] Sound object is null after loading ${name}`);
            reject(new Error('Sound object is null'));
            return;
          }
          
          // Set initial volume
          try {
            sound.setVolume(this.config.volume);
            console.log(`[AudioService] Set volume for ${name} to ${this.config.volume}`);
          } catch (e) {
            console.error(`[AudioService] Error setting volume for ${name}:`, e);
          }
          
          // Store for reuse
          this.sounds.set(name, sound);
          console.log(`[AudioService] Sound ${name} stored in map`);
          
          resolve();
        });
      } catch (error) {
        console.error(`[AudioService] Error creating Sound object for ${name}:`, error);
        reject(error);
      }
    });
  }

  playSound(name: SoundName): void {
    if (!this.config.enabled) {
      return;
    }

    const sound = this.sounds.get(name);
    if (!sound) {
      console.warn(`Sound ${name} not preloaded`);
      return;
    }

    try {
      // Play the sound directly without stopping first
      // This avoids the null reference error
      sound.setCurrentTime(0); // Reset to beginning
      sound.play((success) => {
        if (!success) {
          console.error(`Sound ${name} playback failed`);
          // Try to reload the sound if playback fails
          this.reloadSound(name);
        }
      });
    } catch (error) {
      console.error(`Error playing sound ${name}:`, error);
    }
  }

  private reloadSound(name: SoundName): void {
    // Release the old sound if it exists
    const oldSound = this.sounds.get(name);
    if (oldSound) {
      try {
        oldSound.release();
      } catch (error) {
        console.error(`Error releasing sound ${name}:`, error);
      }
      this.sounds.delete(name);
    }

    // Reload the sound
    if (name === 'countdown') {
      this.preloadSound('countdown', 'countdown_321.mp3').catch(console.error);
    }
  }

  // Play a single beep
  playSingleBeep(): void {
    const sound = this.sounds.get('countdown');
    if (!sound || !this.config.enabled) {
      return;
    }

    try {
      // Only play if not already playing
      if (!sound.isPlaying()) {
        sound.setCurrentTime(0);
        sound.play();
        
        // Stop after 0.8 seconds to play most of one beep
        setTimeout(() => {
          try {
            sound.pause();
          } catch (error) {
            console.error('Error pausing beep:', error);
          }
        }, 800);
      }
    } catch (error) {
      console.error('Error playing single beep:', error);
    }
  }

  // Play the final beep to the end of the file
  playFinalBeep(): void {
    const sound = this.sounds.get('countdown');
    if (!sound || !this.config.enabled) {
      return;
    }

    try {
      sound.setCurrentTime(1.9); // Start at 1.9 seconds to capture full beep
      sound.play();
      // Don't stop - let it play to the end
    } catch (error) {
      console.error('Error playing final beep:', error);
    }
  }

  // Play countdown with triple beep (deprecated - kept for reference)
  playCountdown(): void {
    const sound = this.sounds.get('countdown');
    if (!sound || !this.config.enabled) {
      console.log('Countdown not playing - sound not loaded or disabled');
      return;
    }

    console.log('Starting countdown sequence');
    let beepCount = 0;
    
    const playBeep = () => {
      if (beepCount >= 3) {
        return;
      }
      
      try {
        console.log(`Playing beep ${beepCount + 1}/3`);
        // Set to 0 second mark to play from beginning
        sound.setCurrentTime(0);
        sound.play((success) => {
          console.log(`Beep ${beepCount + 1} play result:`, success);
        });
        
        // Stop after 0.5 seconds to play only the first beep
        setTimeout(() => {
          try {
            sound.pause();
            console.log(`Paused beep ${beepCount + 1}`);
          } catch (error) {
            console.error('Error pausing beep:', error);
          }
          
          beepCount++;
          
          // Play next beep after 1 second
          if (beepCount < 3) {
            setTimeout(playBeep, 1000);
          }
        }, 500); // Reduced to 0.5 seconds to isolate first beep
      } catch (error) {
        console.error('Error playing beep:', error);
      }
    };
    
    playBeep();
  }

  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));
    
    // Update volume for all loaded sounds
    this.sounds.forEach((sound) => {
      sound.setVolume(this.config.volume);
    });
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  stopAll(): void {
    console.log('[AudioService] stopAll called');
    console.log('[AudioService] Current sounds map size:', this.sounds.size);
    console.log('[AudioService] isInitialized:', this.isInitialized);
    
    this.sounds.forEach((sound, name) => {
      try {
        console.log(`[AudioService] Attempting to stop sound: ${name}`);
        
        // Check if sound object exists and is valid
        if (!sound) {
          console.warn(`[AudioService] Sound object for ${name} is null/undefined`);
          return;
        }
        
        // Log sound state before stopping
        try {
          const isPlaying = sound.isPlaying();
          console.log(`[AudioService] Sound ${name} isPlaying:`, isPlaying);
          
          // Only stop if actually playing
          if (!isPlaying) {
            console.log(`[AudioService] Sound ${name} is not playing, skipping stop`);
            return;
          }
        } catch (e) {
          console.error(`[AudioService] Error checking isPlaying for ${name}:`, e);
          // If we can't check isPlaying, try to reset the sound position instead of stopping
          try {
            sound.setCurrentTime(0);
            console.log(`[AudioService] Reset sound ${name} to position 0`);
            return;
          } catch (resetError) {
            console.error(`[AudioService] Error resetting sound ${name}:`, resetError);
          }
        }
        
        // Check if sound has the stop method
        if (typeof sound.stop !== 'function') {
          console.error(`[AudioService] Sound ${name} does not have stop method`);
          return;
        }
        
        // Try stop with a callback to catch async errors
        sound.stop(() => {
          console.log(`[AudioService] Sound ${name} stopped via callback`);
          // Reset to beginning after stop
          try {
            sound.setCurrentTime(0);
          } catch (e) {
            console.log(`[AudioService] Could not reset time after stop for ${name}`);
          }
        });
        
        console.log(`[AudioService] Stop initiated for sound: ${name}`);
      } catch (error) {
        console.error(`[AudioService] Error stopping sound ${name}:`, error);
        console.error(`[AudioService] Error stack:`, error.stack);
        
        // As a last resort, try to pause instead of stop
        try {
          if (sound && typeof sound.pause === 'function') {
            sound.pause();
            console.log(`[AudioService] Paused sound ${name} as fallback`);
          }
        } catch (pauseError) {
          console.error(`[AudioService] Error pausing sound ${name}:`, pauseError);
        }
      }
    });
    
    console.log('[AudioService] stopAll completed');
  }

  release(): void {
    this.sounds.forEach((sound) => {
      sound.release();
    });
    this.sounds.clear();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const audioService = new AudioService();