import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useBusiness } from '../providers/BusinessProvider';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';
import { useNavigation } from '../App';

// Design tokens - matching TV app theme
const TOKENS = {
  color: {
    bg: '#070b18',
    card: '#111928',
    card2: '#0e1620',
    text: '#ffffff',
    muted: '#9cb0ff',
    accent: '#7cffb5',
    accent2: '#5de1ff',
    danger: '#ef4444',
    borderGlass: 'rgba(255,255,255,0.08)',
    cardGlass: 'rgba(255,255,255,0.04)',
  },
  radius: {
    card: 16,
    button: 14,
    chip: 999,
  },
};

interface TrainingSession {
  id: string;
  business_id: string;
  template_type: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  trainer_id: string | null;
}

export function MainScreen() {
  const navigation = useNavigation();
  const { businessId } = useBusiness();
  const { user, isLoading: isAuthLoading, isAuthenticated, error: authError, retry, switchAccount, currentEnvironment } = useAuth();
  const [openSessions, setOpenSessions] = useState<TrainingSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // Log businessId when component mounts or businessId changes
  React.useEffect(() => {
    console.log('[MainScreen] 🏢 BusinessId in component:', businessId);
    console.log('[MainScreen] 👤 Current user:', user?.email, 'BusinessId from user:', user?.businessId);
  }, [businessId, user]);

  // Fetch open sessions when businessId changes
  useEffect(() => {
    // Skip fetch if switching accounts
    if (isSwitching) {
      console.log('[MainScreen] 🚫 Skipping fetch during account switch');
      return;
    }
    
    if (!businessId) {
      console.log('[MainScreen] No businessId yet, skipping session fetch');
      // Clear any stale sessions when businessId is null
      setOpenSessions([]);
      return;
    }

    // Verify businessId matches current user before fetching
    if (user && user.businessId !== businessId) {
      console.log('[MainScreen] ⚠️ BusinessId mismatch - user:', user.businessId, 'context:', businessId);
      // Clear sessions on mismatch
      setOpenSessions([]);
      return;
    }

    const fetchOpenSessions = async () => {
      console.log('[MainScreen] 🔍 Fetching open sessions for business:', businessId);
      console.log('[MainScreen] Current user businessId:', user?.businessId);
      setIsLoadingSessions(true);
      
      try {
        const { data, error } = await supabase
          .from('training_session')
          .select('*')
          .eq('business_id', businessId)
          .eq('status', 'open')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[MainScreen] ❌ Error fetching sessions:', error);
        } else {
          console.log('[MainScreen] ✅ Found open sessions:', data?.length || 0);
          // Double-check sessions belong to current business
          const validSessions = data?.filter(s => s.business_id === businessId) || [];
          if (validSessions.length !== data?.length) {
            console.warn('[MainScreen] ⚠️ Filtered out sessions from wrong business');
          }
          setOpenSessions(validSessions);
        }
      } catch (error) {
        console.error('[MainScreen] ❌ Exception fetching sessions:', error);
      } finally {
        setIsLoadingSessions(false);
      }
    };

    fetchOpenSessions();
  }, [businessId, user, isSwitching]);

  // Handle environment toggle
  const handleEnvironmentChange = async (newEnv: 'gym' | 'developer') => {
    if (newEnv === currentEnvironment || isSwitching) return;
    
    console.log('[MainScreen] 🔄 Environment toggle:', currentEnvironment, '->', newEnv);
    setIsSwitching(true);
    
    // Clear sessions immediately when switching accounts
    console.log('[MainScreen] 🧹 Clearing sessions for account switch');
    setOpenSessions([]);
    setIsLoadingSessions(true); // Show loading state
    
    try {
      await switchAccount(newEnv);
      console.log('[MainScreen] ✅ Environment switch complete');
      // Sessions will be refetched by the useEffect when businessId updates
    } catch (error) {
      console.error('[MainScreen] ❌ Environment switch failed:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleSessionClick = (session: TrainingSession) => {
    console.log('[MainScreen] 📱 Navigating to session:', session.id);
    console.log('[MainScreen] Session details:', {
      id: session.id,
      business_id: session.business_id,
      status: session.status,
      currentBusinessId: businessId,
      currentUser: user?.email,
      currentUserBusinessId: user?.businessId
    });
    
    // Verify session belongs to current business
    if (session.business_id !== businessId) {
      console.error('[MainScreen] ⚠️ WARNING: Session business_id mismatch!');
      console.error('[MainScreen] Session belongs to:', session.business_id);
      console.error('[MainScreen] Current business:', businessId);
      Alert.alert(
        'Session Unavailable',
        'This session belongs to a different account. Please refresh the session list.',
        [{ text: 'OK' }]
      );
      return; // Don't navigate!
    }
    
    navigation.navigate('SessionLobby', { sessionId: session.id });
  };

  const formatSessionTime = (dateString: string | null) => {
    if (!dateString) return 'Now';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Show loading state
  if (isAuthLoading || isSwitching) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>{isSwitching ? 'Switching accounts...' : 'Loading...'}</Text>
      </View>
    );
  }

  // Show error state
  if (authError || !isAuthenticated) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorTitle}>Authentication Error</Text>
        <Text style={styles.errorMessage}>
          {authError?.message || 'Failed to authenticate. Please check your connection.'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => retry()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Normal view - authenticated
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {currentEnvironment === 'gym' ? 'Gym Sessions' : 'Developer Sessions'}
        </Text>
        
        {/* Environment Toggle */}
        <View style={[styles.segmented, isSwitching && styles.disabledSegmented]}>
          <TouchableOpacity 
            style={[styles.segmentOption, currentEnvironment === 'developer' && styles.segmentActive]}
            onPress={() => handleEnvironmentChange('developer')}
            disabled={isSwitching}
          >
            <Text style={[styles.segmentText, currentEnvironment === 'developer' && styles.segmentTextActive]}>Developer</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.segmentOption, currentEnvironment === 'gym' && styles.segmentActive]}
            onPress={() => handleEnvironmentChange('gym')}
            disabled={isSwitching}
          >
            <Text style={[styles.segmentText, currentEnvironment === 'gym' && styles.segmentTextActive]}>Gym</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {isLoadingSessions ? (
          <View style={[styles.card, styles.centerContent]}>
            <ActivityIndicator size="large" color={TOKENS.color.accent} />
            <Text style={[styles.loadingText, { marginTop: 16 }]}>Loading sessions...</Text>
          </View>
        ) : openSessions.length > 0 ? (
          <View>
            {openSessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                onPress={() => handleSessionClick(session)}
              >
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionTitle}>
                    {session.template_type || 'Training Session'}
                  </Text>
                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>Open</Text>
                  </View>
                </View>
                <View style={styles.sessionDetails}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionLabel}>Started</Text>
                    <Text style={styles.sessionValue}>
                      {formatSessionTime(session.created_at)}
                    </Text>
                  </View>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionLabel}>Session ID</Text>
                    <Text style={[styles.sessionValue, styles.sessionId]}>
                      {session.id.slice(0, 8)}...
                    </Text>
                  </View>
                </View>
                <Text style={styles.tapText}>Tap to enter session →</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No active sessions</Text>
              <Text style={[styles.emptyStateText, styles.emptySubtext]}>
                Start a new session from the web app
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.color.bg,
    padding: 32,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 24,
    color: TOKENS.color.text,
  },
  errorTitle: {
    fontSize: 32,
    color: TOKENS.color.text,
    marginBottom: 16,
    fontWeight: '600',
  },
  errorMessage: {
    fontSize: 18,
    color: TOKENS.color.muted,
    textAlign: 'center',
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: TOKENS.color.danger,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: TOKENS.radius.button,
  },
  retryButtonText: {
    color: TOKENS.color.text,
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  createButton: {
    backgroundColor: TOKENS.color.accent,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: TOKENS.radius.button,
    shadowColor: TOKENS.color.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 8,
  },
  createButtonText: {
    color: '#051015',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dangerButton: {
    backgroundColor: TOKENS.color.danger,
    shadowColor: TOKENS.color.danger,
  },
  segmented: {
    backgroundColor: TOKENS.color.card,
    borderColor: '#1b2734',
    borderWidth: 1,
    borderRadius: TOKENS.radius.chip,
    padding: 6,
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 8,
  },
  segmentOption: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: TOKENS.radius.chip,
  },
  segmentActive: {
    backgroundColor: 'rgba(124,255,181,0.16)',
    borderColor: 'rgba(124,255,181,0.45)',
    borderWidth: 1,
    transform: [{ translateY: -1 }],
  },
  segmentText: {
    fontSize: 18,
    letterSpacing: 0.2,
    color: TOKENS.color.muted,
  },
  segmentTextActive: {
    color: TOKENS.color.text,
  },
  mainContent: {
    flex: 1,
  },
  card: {
    backgroundColor: TOKENS.color.card,
    borderColor: '#1b2734',
    borderWidth: 1,
    borderRadius: TOKENS.radius.card,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 8,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  kv: {
    backgroundColor: '#0c131b',
    borderColor: '#1b2734',
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    minHeight: 64,
    width: '24%',
  },
  kvLabel: {
    fontSize: 12,
    color: TOKENS.color.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  kvValue: {
    fontSize: 22,
    fontWeight: '600',
    color: TOKENS.color.text,
  },
  emptyState: {
    textAlign: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    borderColor: '#284054',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: '#0b121a',
  },
  emptyStateText: {
    color: TOKENS.color.muted,
    fontSize: 20,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledSegmented: {
    opacity: 0.5,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: TOKENS.color.text,
  },
  sessionCard: {
    backgroundColor: TOKENS.color.card,
    borderColor: '#1b2734',
    borderWidth: 1,
    borderRadius: TOKENS.radius.card,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 8,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sessionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: TOKENS.color.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124,255,181,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: TOKENS.radius.chip,
    borderWidth: 1,
    borderColor: 'rgba(124,255,181,0.3)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: TOKENS.color.accent,
    marginRight: 8,
  },
  statusText: {
    color: TOKENS.color.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  sessionDetails: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionLabel: {
    fontSize: 14,
    color: TOKENS.color.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionValue: {
    fontSize: 18,
    color: TOKENS.color.text,
    fontWeight: '500',
  },
  sessionId: {
    fontFamily: 'monospace',
  },
  tapText: {
    fontSize: 16,
    color: TOKENS.color.muted,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  emptySubtext: {
    fontSize: 16,
    marginTop: 8,
    opacity: 0.7,
  },
});