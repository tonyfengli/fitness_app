import { useEffect, useRef } from 'react';
import { TVEventHandler, HWEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export function useTVNavigation() {
  const navigation = useNavigation();
  const tvEventHandler = useRef<TVEventHandler | null>(null);

  useEffect(() => {
    tvEventHandler.current = new TVEventHandler();
    
    const handleTVEvent = (evt: HWEvent) => {
      if (evt && evt.eventType === 'playPause') {
        // Handle play/pause button
        console.log('Play/Pause pressed');
      } else if (evt && evt.eventType === 'menu') {
        // Menu/Back button - go back
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }
    };

    tvEventHandler.current.enable(undefined, handleTVEvent);

    return () => {
      if (tvEventHandler.current) {
        tvEventHandler.current.disable();
      }
    };
  }, [navigation]);
}