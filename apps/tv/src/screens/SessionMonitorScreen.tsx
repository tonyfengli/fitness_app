import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRealtimeNewSessions } from '../hooks/useRealtimeNewSessions';
import { useNavigation } from '../App';
import { Box, Text, Card, Button } from '../components';
import { useBusiness } from '../providers/BusinessProvider';

interface SessionInfo {
  id: string;
  template_type: string;
  status: string;
  scheduled_at: string;
  created_at: string;
}

export function SessionMonitorScreen() {
  const navigation = useNavigation();
  const { businessId } = useBusiness();
  const [recentSessions, setRecentSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sessionIdsRef = useRef(new Set<string>());

  // Memoize the callback to prevent re-subscriptions
  const handleNewSession = useCallback((session: any) => {
    // Check if we already have this session
    if (sessionIdsRef.current.has(session.id)) {
      return;
    }
    
    // Add to tracking set
    sessionIdsRef.current.add(session.id);
    
    // Add to recent sessions list
    setRecentSessions(prev => {
      // Double-check in state as well
      const exists = prev.some(s => s.id === session.id);
      if (exists) return prev;
      
      return [{
        id: session.id,
        template_type: session.template_type,
        status: session.status,
        scheduled_at: session.scheduled_at,
        created_at: session.created_at,
      }, ...prev].slice(0, 10); // Keep only last 10
    });
  }, []);

  // Listen for new sessions
  const { latestSession, isSubscribed, error } = useRealtimeNewSessions({
    businessId: businessId,
    supabase,
    onNewSession: handleNewSession,
  });

  const loadRecentSessions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    
    try {
      console.log('[SessionMonitorScreen] Starting to load sessions...');
      console.log('[SessionMonitorScreen] Supabase URL:', supabase.supabaseUrl);
      
      const { data, error } = await supabase
        .from('training_session')
        .select('id, template_type, status, scheduled_at, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[SessionMonitorScreen] Supabase error:', error);
        console.error('[SessionMonitorScreen] Error details:', JSON.stringify(error, null, 2));
        setLoadError('Failed to load sessions. Please check your connection.');
        return;
      }

      if (data) {
        // Clear and repopulate the session IDs set
        sessionIdsRef.current.clear();
        data.forEach(session => {
          sessionIdsRef.current.add(session.id);
        });
        
        setRecentSessions(data);
      }
    } catch (err) {
      console.error('[SessionMonitorScreen] Error:', err);
      setLoadError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  // Load recent sessions on mount
  useEffect(() => {
    loadRecentSessions();
  }, [loadRecentSessions]);

  const handleSessionPress = (sessionId: string) => {
    navigation.navigate('SessionLobby', { sessionId });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <Box style={{ flex: 1 }} backgroundColor="gray100" padding="xl">
      <Text variant="h1" marginBottom="m">Session Monitor</Text>
      
      {/* Connection Status */}
      <Card variant="elevated" marginBottom="l">
        <Text variant="h5" marginBottom="s">Real-time Status</Text>
        <Box flexDirection="row" alignItems="center">
          <Box 
            width={12} 
            height={12} 
            borderRadius="full" 
            backgroundColor={isSubscribed ? 'green500' : 'red500'} 
            marginRight="s" 
          />
          <Text variant="body">
            {isSubscribed ? 'Connected' : 'Disconnected'}
          </Text>
        </Box>
        {error && (
          <Text variant="bodySmall" color="red600" marginTop="s">
            {error.message}
          </Text>
        )}
      </Card>

      {/* Latest Session Alert */}
      {latestSession && (
        <Card variant="elevated" backgroundColor="blue100" marginBottom="l">
          <Text variant="h5" marginBottom="s">🆕 New Session Created!</Text>
          <Text variant="body">Type: {latestSession.template_type}</Text>
          <Text variant="body">Status: {latestSession.status}</Text>
          <Box marginTop="s">
            <Button
              onPress={() => handleSessionPress(latestSession.id)}
              variant="primary"
            >
              Go to Session
            </Button>
          </Box>
        </Card>
      )}

      {/* Recent Sessions List */}
      <Text variant="h2" marginBottom="m">Recent Sessions</Text>
      
      {isLoading ? (
        <Box style={{ flex: 1 }} justifyContent="center" alignItems="center">
          <Text variant="body" color="textMuted">Loading sessions...</Text>
        </Box>
      ) : loadError ? (
        <Box style={{ flex: 1 }} justifyContent="center" alignItems="center">
          <Text variant="body" color="red600" textAlign="center">{loadError}</Text>
          <Box marginTop="m">
            <Button variant="primary" onPress={() => {
              setRecentSessions([]);
              loadRecentSessions();
            }}>
              Retry
            </Button>
          </Box>
        </Box>
      ) : recentSessions.length === 0 ? (
        <Box style={{ flex: 1 }} justifyContent="center" alignItems="center">
          <Text variant="body" color="textMuted">No sessions found</Text>
        </Box>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {recentSessions.map((session) => (
          <TouchableOpacity
            key={session.id}
            onPress={() => handleSessionPress(session.id)}
            activeOpacity={0.7}
          >
            <Card variant="elevated" marginBottom="m">
              <Text variant="h5">{session.template_type}</Text>
              <Text variant="body" color="textSecondary">Status: {session.status}</Text>
              <Text variant="bodySmall" color="textMuted">
                Created: {formatDate(session.created_at)}
              </Text>
              {session.scheduled_at && (
                <Text variant="bodySmall" color="textMuted">
                  Scheduled: {formatDate(session.scheduled_at)}
                </Text>
              )}
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
      )}
    </Box>
  );
}