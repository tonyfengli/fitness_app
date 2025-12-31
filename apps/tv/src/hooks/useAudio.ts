import { useEffect, useCallback } from 'react';
import { audioService } from '../services/AudioService';

export const useAudio = () => {
  useEffect(() => {
    // Initialize audio service when component mounts
    audioService.initialize().catch(console.error);

    // Cleanup when app unmounts
    return () => {
      // Don't release sounds on component unmount - keep them loaded
      // Only stop any playing sounds
      audioService.stopAll();
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