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
    
    if (this.isInitialized) {
      return;
    }
    
    if (this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      
      // Preload all sounds
      await Promise.all([
        this.preloadSound('countdown', 'countdown_321.mp3'),
        // We can add more sounds here later
        // this.preloadSound('beep', 'beep.mp3'),
        // this.preloadSound('workoutStart', 'workout_start.mp3'),
        // this.preloadSound('workoutEnd', 'workout_end.mp3'),
      ]);

      this.isInitialized = true;
    } catch (error) {
      console.error('[AudioService] Failed to initialize:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  private preloadSound(name: SoundName, filename: string): Promise<void> {
    
    return new Promise((resolve, reject) => {
      try {
        
        // For Android, sounds should be in the raw folder without extension
        const sound = new Sound(filename, Sound.MAIN_BUNDLE, (error) => {
          if (error) {
            console.error(`[AudioService] Failed to load sound ${name}:`, error);
            reject(error);
            return;
          }

          
          // Check if sound object is valid
          if (!sound) {
            reject(new Error('Sound object is null'));
            return;
          }
          
          // Set initial volume
          try {
            sound.setVolume(this.config.volume);
          } catch (e) {
            // Error setting volume
          }
          
          // Store for reuse
          this.sounds.set(name, sound);
          
          resolve();
        });
      } catch (error) {
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
      return;
    }

    try {
      // Play the sound directly without stopping first
      // This avoids the null reference error
      sound.setCurrentTime(0); // Reset to beginning
      sound.play((success) => {
        if (!success) {
          // Try to reload the sound if playback fails
          this.reloadSound(name);
        }
      });
    } catch (error) {
      // Error playing sound
    }
  }

  private reloadSound(name: SoundName): void {
    // Release the old sound if it exists
    const oldSound = this.sounds.get(name);
    if (oldSound) {
      try {
        oldSound.release();
      } catch (error) {
        // Error releasing sound
      }
      this.sounds.delete(name);
    }

    // Reload the sound
    if (name === 'countdown') {
      this.preloadSound('countdown', 'countdown_321.mp3').catch(() => {});
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
            // Error pausing beep
          }
        }, 800);
      }
    } catch (error) {
      // Error playing single beep
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
      // Error playing final beep
    }
  }

  // Play countdown with triple beep (deprecated - kept for reference)
  playCountdown(): void {
    const sound = this.sounds.get('countdown');
    if (!sound || !this.config.enabled) {
      return;
    }

    let beepCount = 0;
    
    const playBeep = () => {
      if (beepCount >= 3) {
        return;
      }
      
      try {
        // Set to 0 second mark to play from beginning
        sound.setCurrentTime(0);
        sound.play((success) => {
        });
        
        // Stop after 0.5 seconds to play only the first beep
        setTimeout(() => {
          try {
            sound.pause();
          } catch (error) {
            // Error pausing beep
          }
          
          beepCount++;
          
          // Play next beep after 1 second
          if (beepCount < 3) {
            setTimeout(playBeep, 1000);
          }
        }, 500); // Reduced to 0.5 seconds to isolate first beep
      } catch (error) {
        // Error playing beep
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
    
    this.sounds.forEach((sound, name) => {
      try {
        
        // Check if sound object exists and is valid
        if (!sound) {
          return;
        }
        
        // Log sound state before stopping
        try {
          const isPlaying = sound.isPlaying();
          
          // Only stop if actually playing
          if (!isPlaying) {
            return;
          }
        } catch (e) {
          // If we can't check isPlaying, try to reset the sound position instead of stopping
          try {
            sound.setCurrentTime(0);
            return;
          } catch (resetError) {
            // Error resetting sound
          }
        }
        
        // Check if sound has the stop method
        if (typeof sound.stop !== 'function') {
          return;
        }
        
        // Try stop with a callback to catch async errors
        sound.stop(() => {
          // Reset to beginning after stop
          try {
            sound.setCurrentTime(0);
          } catch (e) {
            // Could not reset time after stop
          }
        });
        
        
      } catch (error) {
        
        // As a last resort, try to pause instead of stop
        try {
          if (sound && typeof sound.pause === 'function') {
            sound.pause();
          }
        } catch (pauseError) {
          // Error pausing sound
        }
      }
    });
    
    
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