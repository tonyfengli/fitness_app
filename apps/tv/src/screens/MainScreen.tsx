import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigation } from '../App';
import { useBusiness } from '../providers/BusinessProvider';
import { Box, Text } from '../components';

interface OpenSession {
  id: string;
  template_type: string;
  status: string;
  created_at: string;
}

export function MainScreen() {
  const navigation = useNavigation();
  const { businessId } = useBusiness();
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  useEffect(() => {
    let channel: any = null;
    let mounted = true;

    const setupRealtimeSubscription = async () => {
      try {
        // First check if there's already an open session
        const { data: existingSession, error } = await supabase
          .from('training_session')
          .select('*')
          .eq('business_id', businessId)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!mounted) return;

        if (existingSession && !error) {
          console.log('[MainScreen] Found existing open session:', existingSession.id);
          navigation.navigate('SessionLobby', { sessionId: existingSession.id });
          return;
        }

        // Set up real-time subscription for new sessions
        console.log('[MainScreen] Setting up real-time subscription for business:', businessId);
        
        channel = supabase
          .channel(`session-updates-${businessId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'training_session',
              filter: `business_id=eq.${businessId}`,
            },
            (payload) => {
              console.log('[MainScreen] Received update:', payload);
              
              if (payload.new && payload.new.status === 'open') {
                console.log('[MainScreen] New open session detected:', payload.new.id);
                if (mounted) {
                  navigation.navigate('SessionLobby', { sessionId: payload.new.id });
                }
              }
            }
          )
          .subscribe((status) => {
            console.log('[MainScreen] Subscription status:', status);
            
            if (!mounted) return;
            
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              setConnectionStatus('connected');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setIsConnected(false);
              setConnectionStatus('error');
            } else if (status === 'CLOSED') {
              setIsConnected(false);
              setConnectionStatus('disconnected');
            }
          });

        setIsInitializing(false);
      } catch (error) {
        console.error('[MainScreen] Error setting up subscription:', error);
        if (mounted) {
          setConnectionStatus('error');
          setIsInitializing(false);
        }
      }
    };

    setupRealtimeSubscription();

    return () => {
      mounted = false;
      if (channel) {
        console.log('[MainScreen] Cleaning up subscription');
        channel.unsubscribe();
      }
    };
  }, [businessId, navigation]);

  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'green500';
      case 'connecting':
        return 'blue500';
      case 'disconnected':
      case 'error':
        return 'red500';
      default:
        return 'gray500';
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection Error';
      default:
        return 'Unknown';
    }
  };

  // Empty state (modified welcome screen with brighter colors)
  return (
    <Box style={{ flex: 1 }} backgroundColor="blue50" padding="3xl">
      <Box style={{ flex: 1 }} alignItems="center" justifyContent="center">
        <Text variant="h1" color="blue900" marginBottom="m" fontSize={72} lineHeight={80}>
          Fitness Session
        </Text>
        
        <Text variant="h3" color="blue700" marginBottom="3xl">
          Welcome to today's workout
        </Text>

        {/* Connection Indicator */}
        <Box 
          flexDirection="row" 
          alignItems="center" 
          backgroundColor="white"
          paddingX="l"
          paddingY="m"
          borderRadius="xl"
          style={{
            shadowColor: 'black',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Box 
            width={16} 
            height={16} 
            borderRadius="full" 
            backgroundColor={getConnectionColor()} 
            marginRight="s" 
          />
          <Text variant="body" color="gray800">
            {getConnectionText()}
          </Text>
        </Box>

        <Box marginTop="4xl">
          <Text variant="h5" color="blue600">
            Waiting for session...
          </Text>
        </Box>
      </Box>
    </Box>
  );
}