import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeContextType {
  isConnected: boolean;
  activeChannels: Map<string, RealtimeChannel>;
  subscribeToChannel: (channelName: string) => RealtimeChannel;
  unsubscribeFromChannel: (channelName: string) => void;
  cleanupAllChannels: () => void;
}

const RealtimeContext = createContext<RealtimeContextType | null>(null);

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return context;
};

interface RealtimeProviderProps {
  children: React.ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const activeChannelsRef = useRef(new Map<string, RealtimeChannel>());
  const [appState, setAppState] = useState(AppState.currentState);
  const [, forceUpdate] = useState({});

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // console.log('[RealtimeProvider] App came to foreground, reconnecting channels');
        // Reconnect all channels when app comes to foreground
        activeChannelsRef.current.forEach((channel) => {
          channel.subscribe();
        });
      } else if (nextAppState.match(/inactive|background/)) {
        // console.log('[RealtimeProvider] App went to background');
        // Optionally pause subscriptions when app goes to background
        // to save battery on TV devices
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState]);

  // Monitor connection status by checking active channels
  useEffect(() => {
    const checkConnection = () => {
      // In Supabase v2, check if we have any joined channels
      const channels = supabase.getChannels();
      const hasActiveChannels = channels.some(channel => channel.state === 'joined');
      setIsConnected(hasActiveChannels);
    };

    // Check initial connection
    checkConnection();

    // Monitor connection changes
    const interval = setInterval(checkConnection, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const subscribeToChannel = (channelName: string): RealtimeChannel => {
    // Return existing channel if already subscribed
    if (activeChannelsRef.current.has(channelName)) {
      return activeChannelsRef.current.get(channelName)!;
    }

    // Create new channel
    const channel = supabase.channel(channelName);
    activeChannelsRef.current.set(channelName, channel);

    // console.log(`[RealtimeProvider] Subscribing to channel: ${channelName}`);

    return channel;
  };

  const unsubscribeFromChannel = (channelName: string) => {
    const channel = activeChannelsRef.current.get(channelName);
    if (channel) {
      console.log(`[RealtimeProvider] 🔌 Unsubscribing from channel: ${channelName}`);
      channel.unsubscribe();
      activeChannelsRef.current.delete(channelName);
    }
  };

  const cleanupAllChannels = () => {
    console.log('[RealtimeProvider] 🧹 Cleaning up all channels for account switch');
    console.log('[RealtimeProvider] Active channels:', Array.from(activeChannelsRef.current.keys()));
    
    activeChannelsRef.current.forEach((channel, name) => {
      console.log(`[RealtimeProvider] 🔌 Cleaning up channel: ${name}`);
      channel.unsubscribe();
    });
    
    activeChannelsRef.current.clear();
    
    // Force re-render to update the context
    forceUpdate({});
    
    console.log('[RealtimeProvider] ✅ All channels cleaned up');
  };

  // Cleanup all channels on unmount
  useEffect(() => {
    return () => {
      activeChannelsRef.current.forEach((channel) => {
        // console.log(`[RealtimeProvider] Cleaning up channel: ${name}`);
        channel.unsubscribe();
      });
      activeChannelsRef.current.clear();
    };
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        activeChannels: activeChannelsRef.current,
        subscribeToChannel,
        unsubscribeFromChannel,
        cleanupAllChannels,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}