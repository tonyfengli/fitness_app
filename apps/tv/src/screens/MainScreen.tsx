import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigation } from '../App';
import { useBusiness } from '../providers/BusinessProvider';
import { useAuth } from '../providers/AuthProvider';
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
  const { user, isLoading: isAuthLoading, isAuthenticated, error: authError, retry } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  // Log authentication status
  useEffect(() => {
    console.log('[MainScreen] ========== AUTH STATUS CHECK ==========');
    console.log('[MainScreen] Auth loading:', isAuthLoading);
    console.log('[MainScreen] Authenticated:', isAuthenticated);
    console.log('[MainScreen] Auth error:', authError);
    if (user) {
      console.log('[MainScreen] User:', {
        id: user.id,
        email: user.email,
        role: user.role,
        businessId: user.businessId,
      });
    }
    console.log('[MainScreen] Business ID from context:', businessId);
    console.log('[MainScreen] =====================================');
  }, [user, isAuthLoading, isAuthenticated, authError, businessId]);

  useEffect(() => {
    let channel: any = null;
    let mounted = true;

    const setupRealtimeSubscription = async () => {
      try {
        console.log('[MainScreen] Setting up realtime subscription...');
        console.log('[MainScreen] Auth status - Loading:', isAuthLoading, 'Authenticated:', isAuthenticated);
        
        // Wait for auth to complete
        if (isAuthLoading) {
          console.log('[MainScreen] Waiting for auth to complete...');
          return;
        }

        if (!isAuthenticated) {
          console.error('[MainScreen] ❌ NOT AUTHENTICATED - Cannot setup realtime');
          setConnectionStatus('error');
          setIsInitializing(false);
          return;
        }

        // Test database connectivity first
        console.log('[MainScreen] Testing database connectivity...');
        const { data: testData, error: testError, count } = await supabase
          .from('training_session')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId);
        
        console.log('[MainScreen] Database test results:');
        console.log('[MainScreen] - Query error:', testError);
        console.log('[MainScreen] - Total sessions count:', count);
        console.log('[MainScreen] - Can connect to DB:', !testError);
        
        if (testError) {
          console.error('[MainScreen] ❌ DATABASE CONNECTION ERROR:', testError);
          console.error('[MainScreen] Error code:', testError.code);
          console.error('[MainScreen] Error message:', testError.message);
          console.error('[MainScreen] Error details:', testError.details);
          console.error('[MainScreen] Error hint:', testError.hint);
        }

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
        } else if (error && error.code !== 'PGRST116') {
          // PGRST116 is "no rows found" which is expected if no open session
          console.error('[MainScreen] Error checking for open sessions:', error);
        }

        // Set up real-time subscription for new sessions
        console.log('[MainScreen] Setting up real-time subscription for business:', businessId);
        
        // Check Supabase auth status first
        const { data: authData, error: authError } = await supabase.auth.getSession();
        console.log('[MainScreen] Supabase auth check:');
        console.log('[MainScreen] - Has session:', !!authData?.session);
        console.log('[MainScreen] - Auth error:', authError);
        if (authData?.session) {
          console.log('[MainScreen] - Supabase user:', authData.session.user.email);
          console.log('[MainScreen] - Token expiry:', new Date(authData.session.expires_at * 1000).toISOString());
        }
        
        // First test a simple presence channel to see if realtime works at all
        console.log('[MainScreen] Testing basic realtime connectivity...');
        const testChannel = supabase.channel('test-channel');
        testChannel.subscribe((status) => {
          console.log('[MainScreen] Test channel status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('[MainScreen] ✅ Basic realtime connection works!');
            testChannel.unsubscribe();
          } else if (status === 'CHANNEL_ERROR') {
            console.log('[MainScreen] ❌ Basic realtime connection failed');
          }
        });

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
          .subscribe((status, error) => {
            console.log('[MainScreen] ========== SUBSCRIPTION STATUS UPDATE ==========');
            console.log('[MainScreen] Status:', status);
            console.log('[MainScreen] Error:', error);
            console.log('[MainScreen] Channel name:', `session-updates-${businessId}`);
            console.log('[MainScreen] Business ID:', businessId);
            
            if (status === 'CHANNEL_ERROR') {
              console.error('[MainScreen] ❌ CHANNEL ERROR DETAILS:');
              console.error('[MainScreen] - Error object:', error);
              console.error('[MainScreen] - Channel state:', channel?.state);
              console.error('[MainScreen] - Is Joined:', channel?.isJoined);
              console.error('[MainScreen] - Is Joining:', channel?.isJoining);
              console.error('[MainScreen] - Is Leaving:', channel?.isLeaving);
              console.error('[MainScreen] - Is Closed:', channel?.isClosed);
            }
            
            console.log('[MainScreen] ==============================================');
            
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
  }, [businessId, navigation, isAuthLoading, isAuthenticated]);

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

  // Show loading state
  if (isAuthLoading) {
    return (
      <Box style={{ flex: 1 }} backgroundColor="blue50" alignItems="center" justifyContent="center">
        <Text variant="h3" color="blue700">
          Loading...
        </Text>
      </Box>
    );
  }

  // Show error state
  if (authError || !isAuthenticated) {
    return (
      <Box style={{ flex: 1 }} backgroundColor="red50" padding="3xl" alignItems="center" justifyContent="center">
        <Text variant="h2" color="red900" marginBottom="m">
          Authentication Error
        </Text>
        <Text variant="body" color="red700" marginBottom="xl" textAlign="center">
          {authError?.message || 'Failed to authenticate. Please check your connection.'}
        </Text>
        <Box 
          backgroundColor="red600"
          paddingX="xl"
          paddingY="m"
          borderRadius="m"
          style={{ cursor: 'pointer' }}
          onTouchEnd={() => retry()}
        >
          <Text variant="body" color="white">
            Retry
          </Text>
        </Box>
      </Box>
    );
  }

  // Normal view - authenticated
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

        {/* Debug info */}
        {user && (
          <Box marginTop="xl" opacity={0.6}>
            <Text variant="caption" color="gray600">
              Logged in as: {user.email} ({user.role})
            </Text>
            <Text variant="caption" color="gray600">
              Business: {user.businessId || 'None'}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}