import { useEffect, useCallback } from 'react';
import { audioService } from '../services/AudioService';

export const useAudio = () => {
  useEffect(() => {
    console.log('[useAudio] Hook mounted - initializing audio service');
    
    // Initialize audio service when component mounts
    audioService.initialize()
      .then(() => {
        console.log('[useAudio] Audio service initialized successfully');
      })
      .catch((error) => {
        console.error('[useAudio] Failed to initialize audio service:', error);
      });

    // Cleanup when app unmounts
    return () => {
      console.log('[useAudio] Hook unmounting - checking if cleanup needed');
      
      // Add a small delay to allow navigation to complete
      // This helps avoid the native crash when stop() is called during navigation
      const timeoutId = setTimeout(() => {
        console.log('[useAudio] Executing delayed cleanup');
        try {
          // Don't release sounds on component unmount - keep them loaded
          // Only stop any playing sounds
          audioService.stopAll();
          console.log('[useAudio] Cleanup completed successfully');
        } catch (error) {
          console.error('[useAudio] Error during cleanup:', error);
        }
      }, 100);
      
      // Return cleanup function for the timeout
      return () => {
        console.log('[useAudio] Cancelling cleanup timeout');
        clearTimeout(timeoutId);
      };
    };
  }, []);

  const playCountdown = useCallback(() => {
    audioService.playCountdown();
  }, []);

  const setVolume = useCallback((volume: number) => {
    audioService.setVolume(volume);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    audioService.setEnabled(enabled);
  }, []);

  return {
    playCountdown,
    setVolume,
    setEnabled,
  };
};