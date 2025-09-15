import { NativeModules } from 'react-native';

// Get the native module
const { CountdownSound } = NativeModules;

// Default volume (0.0 to 1.0)
let currentVolume = 0.7;

export function setCountdownVolume(volume: number) {
  currentVolume = Math.max(0, Math.min(1, volume));
  if (CountdownSound) {
    CountdownSound.setVolume(currentVolume).catch((error: any) => {
      console.error('[CountdownSound] Failed to set volume:', error);
    });
  }
}

export function loadCountdownSound(): Promise<void> {
  // The native module loads the sound on initialization
  return Promise.resolve();
}

export function playCountdownSound(): Promise<void> {
  if (!CountdownSound) {
    console.error('[CountdownSound] Native module not available');
    return Promise.reject(new Error('CountdownSound native module not available'));
  }

  console.log('[CountdownSound] Playing 3-2-1 countdown at volume:', currentVolume);
  
  return CountdownSound.play().catch((error: any) => {
    console.error('[CountdownSound] Failed to play sound:', error);
    throw error;
  });
}

export function stopCountdownSound() {
  if (CountdownSound) {
    CountdownSound.stop().catch((error: any) => {
      console.error('[CountdownSound] Failed to stop sound:', error);
    });
  }
}

export function releaseCountdownSound() {
  // Native module handles cleanup automatically
}

// Initialize volume on module load
if (CountdownSound) {
  CountdownSound.setVolume(currentVolume).catch((error: any) => {
    console.error('[CountdownSound] Failed to set initial volume:', error);
  });
} else {
  console.warn('[CountdownSound] Native module not available - sound playback will not work');
}