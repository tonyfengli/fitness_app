import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRealtimeNewSessions } from '../hooks/useRealtimeNewSessions';
import { useNavigation } from '../App';

interface SessionInfo {
  id: string;
  template_type: string;
  status: string;
  scheduled_at: string;
  created_at: string;
}

// TODO: Get this from auth context when implemented
const BUSINESS_ID = 'd33b41e2-f700-4a08-9489-cb6e3daa7f20';

export function SessionMonitorScreen() {
  const navigation = useNavigation();
  const [recentSessions, setRecentSessions] = useState<SessionInfo[]>([]);
  const sessionIdsRef = useRef(new Set<string>());

  // Memoize the callback to prevent re-subscriptions
  const handleNewSession = useCallback((session: any) => {
    // console.log('[SessionMonitorScreen] New session detected:', session.id);
    
    // Check if we already have this session
    if (sessionIdsRef.current.has(session.id)) {
      // console.log('[SessionMonitorScreen] Duplicate session ignored:', session.id);
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

    // Optional: Auto-navigate to the new session
    // Uncomment this if you want automatic navigation
    // navigation.navigate('SessionLobby', { sessionId: session.id });
  }, []);

  // Listen for new sessions
  const { latestSession, isSubscribed, error } = useRealtimeNewSessions({
    businessId: BUSINESS_ID,
    supabase,
    onNewSession: handleNewSession,
  });

  // Load recent sessions on mount
  useEffect(() => {
    
    const loadRecentSessions = async () => {
      try {
        const { data, error } = await supabase
          .from('training_session')
          .select('id, template_type, status, scheduled_at, created_at')
          .eq('business_id', BUSINESS_ID)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('[SessionMonitorScreen] Error loading sessions:', error);
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
      }
    };

    loadRecentSessions();
  }, []);

  const handleSessionPress = (sessionId: string) => {
    navigation.navigate('SessionLobby', { sessionId });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6', padding: 32 }}>
      <Text style={{ fontSize: 36, fontWeight: 'bold', marginBottom: 16, color: '#000' }}>Session Monitor</Text>
      
      {/* Connection Status */}
      <View style={{ marginBottom: 24, padding: 16, backgroundColor: '#fff', borderRadius: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#000' }}>Real-time Status</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ 
            width: 12, 
            height: 12, 
            borderRadius: 6, 
            marginRight: 8, 
            backgroundColor: isSubscribed ? '#10b981' : '#ef4444' 
          }} />
          <Text style={{ fontSize: 16, color: '#000' }}>
            {isSubscribed ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
        {error && (
          <Text style={{ color: '#ef4444', marginTop: 8 }}>{error.message}</Text>
        )}
      </View>

      {/* Latest Session Alert */}
      {latestSession && (
        <View style={{ marginBottom: 24, padding: 16, backgroundColor: '#dbeafe', borderRadius: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#000' }}>🆕 New Session Created!</Text>
          <Text style={{ fontSize: 16, color: '#000' }}>Type: {latestSession.template_type}</Text>
          <Text style={{ fontSize: 16, color: '#000' }}>Status: {latestSession.status}</Text>
          <TouchableOpacity
            onPress={() => handleSessionPress(latestSession.id)}
            style={{ marginTop: 8, backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Go to Session</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recent Sessions List */}
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#000' }}>Recent Sessions</Text>
      <ScrollView style={{ flex: 1 }}>
        {recentSessions.map((session) => (
          <TouchableOpacity
            key={session.id}
            onPress={() => handleSessionPress(session.id)}
            style={{ marginBottom: 16, padding: 16, backgroundColor: '#fff', borderRadius: 8 }}
          >
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#000' }}>{session.template_type}</Text>
            <Text style={{ fontSize: 16, color: '#6b7280' }}>Status: {session.status}</Text>
            <Text style={{ fontSize: 14, color: '#9ca3af' }}>
              Created: {formatDate(session.created_at)}
            </Text>
            {session.scheduled_at && (
              <Text style={{ fontSize: 14, color: '#9ca3af' }}>
                Scheduled: {formatDate(session.scheduled_at)}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}