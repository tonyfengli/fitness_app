import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Pressable } from 'react-native';
import { useBusiness } from '../providers/BusinessProvider';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';
import { useNavigation } from '../App';
import { api } from '../providers/TRPCProvider';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
    focusRing: 'rgba(124,255,181,0.6)',
  },
  radius: {
    card: 16,
    button: 14,
    chip: 999,
  },
};

// Matte panel helper component - matching SessionLobby screen
function MattePanel({
  children,
  style,
  focused = false,
  radius = TOKENS.radius.card,
}: {
  children: React.ReactNode;
  style?: any;
  focused?: boolean;
  radius?: number;
}) {
  const BASE_SHADOW = {
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.40,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
  };
  const FOCUS_SHADOW = {
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.36,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 12 },
  };

  return (
    <View
      style={[
        {
          backgroundColor: TOKENS.color.card,
          borderColor: TOKENS.color.borderGlass,
          borderWidth: 1,
          borderRadius: radius,
        },
        focused ? FOCUS_SHADOW : BASE_SHADOW,
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface TrainingSession {
  id: string;
  business_id: string;
  template_type: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  trainer_id: string | null;
  trainer?: {
    id: string;
    name: string;
    email: string;
  };
}

export function MainScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();
  const { user, isLoading: isAuthLoading, isAuthenticated, error: authError, retry, switchAccount, currentEnvironment, signOut } = useAuth();
  const [openSessions, setOpenSessions] = useState<TrainingSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<{ id: string; message: string } | null>(null);
  const firstTemplateRef = useRef<any>(null);

  // Template options matching the webapp
  const templates = [
    { id: 'standard', name: 'Strength', description: 'Client-pooled organization' },
    { id: 'circuit', name: 'Circuit', description: 'Time-based circuit training' },
  ];

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    ...api.trainingSession.deleteSession.mutationOptions(),
    onSuccess: () => {
      console.log('[MainScreen] ✅ Session deleted successfully');
      // Refresh the sessions list
      fetchOpenSessions();
    },
    onError: (error: any) => {
      console.error('[MainScreen] ❌ Failed to delete session:', error);
      Alert.alert(
        'Delete Session Failed',
        error.message || 'Failed to delete session. Please try again.',
        [{ text: 'OK' }]
      );
    },
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    ...api.trainingSession.create.mutationOptions(),
    onSuccess: (newSession) => {
      console.log('[MainScreen] ✅ Session created:', newSession.id);
      console.log('[MainScreen] Template type:', newSession.templateType);
      
      // Hide template selector
      setShowTemplates(false);
      
      // Refresh the sessions list
      fetchOpenSessions();
      
      // Navigate to the new session with isNewSession flag
      navigation.navigate('SessionLobby', { 
        sessionId: newSession.id,
        isNewSession: true 
      });
    },
    onError: (error: any) => {
      // Enhanced error logging
      console.error('[MainScreen] ❌ Failed to create session:', {
        error: error,
        errorType: error.constructor.name,
        message: error.message,
        code: error.code || error.data?.code,
        httpStatus: error.data?.httpStatus,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      // Hide template selector
      setShowTemplates(false);
      
      // Check if it's a conflict error (session already exists)
      if (error.data?.code === 'CONFLICT') {
        Alert.alert(
          'Session Already Active',
          'There is already an open session. Please close the current session before creating a new one.',
          [
            { 
              text: 'OK',
              style: 'default'
            }
          ],
          { 
            cancelable: true,
            onDismiss: () => console.log('[MainScreen] Alert dismissed')
          }
        );
      } 
      // Network/Connection errors
      else if (
        error.message?.toLowerCase().includes('fetch failed') || 
        error.message?.toLowerCase().includes('network') ||
        error.message?.toLowerCase().includes('failed to fetch') ||
        error.code === 'ERR_NETWORK'
      ) {
        Alert.alert(
          'No Internet Connection',
          'Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      }
      // Timeout errors
      else if (
        error.code === 'TIMEOUT' || 
        error.message?.toLowerCase().includes('timeout')
      ) {
        Alert.alert(
          'Request Timed Out',
          'The request took too long. This might be due to a slow connection.',
          [{ text: 'OK' }]
        );
      }
      // Server errors
      else if (error.data?.httpStatus >= 500) {
        Alert.alert(
          'Server Unavailable',
          'Our servers are temporarily unavailable. Please try again in a few moments.',
          [{ text: 'OK' }]
        );
      }
      // Authentication errors
      else if (
        error.code === 'UNAUTHORIZED' || 
        error.code === 'FORBIDDEN' ||
        error.data?.code === 'UNAUTHORIZED'
      ) {
        Alert.alert(
          'Authentication Required',
          'Your session has expired. Please restart the app to sign in again.',
          [{ text: 'OK' }]
        );
      }
      // Generic error fallback
      else {
        Alert.alert(
          'Unable to Create Session',
          error.message || 'Something went wrong while creating the session. Please try again.',
          [{ text: 'OK' }]
        );
      }
    },
  });

  // Log businessId when component mounts or businessId changes
  React.useEffect(() => {
    console.log('[MainScreen] 🏢 BusinessId in component:', businessId);
    console.log('[MainScreen] 👤 Current user:', user?.email, 'BusinessId from user:', user?.businessId);
  }, [businessId, user]);

  // Handle close session
  const handleCloseSession = (sessionId: string) => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Delete Session', 
          style: 'destructive',
          onPress: () => {
            console.log('[MainScreen] Deleting session:', sessionId);
            deleteSessionMutation.mutate({ sessionId } as any);
          }
        }
      ]
    );
  };

  // Handle create session
  const handleCreateSession = async (templateType: string) => {
    if (!businessId || !user) {
      console.error('[MainScreen] No businessId or user available');
      return;
    }

    console.log('[MainScreen] Creating session with template:', templateType);
    console.log('[MainScreen] User ID (trainerId):', user.id);
    
    createSessionMutation.mutate({
      businessId,
      trainerId: user.id, // Add trainer ID from current user
      name: `Training Session - ${new Date().toLocaleDateString()}`,
      templateType,
      scheduledAt: new Date(), // Pass as Date object, not string
      durationMinutes: 60, // Default 1 hour like webapp
      maxParticipants: undefined, // Optional field
    });
  };

  // Extract fetchOpenSessions to be reusable
  const fetchOpenSessions = async () => {
    if (!businessId) {
      console.log('[MainScreen] No businessId yet, skipping session fetch');
      return;
    }

    console.log('[MainScreen] 🔍 Fetching open sessions for business:', businessId);
    console.log('[MainScreen] Current user businessId:', user?.businessId);
    setIsLoadingSessions(true);
    
    try {
      const { data, error } = await supabase
        .from('training_session')
        .select(`
          *,
          trainer:user!trainer_id (
            id,
            name,
            email
          )
        `)
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

    fetchOpenSessions();
  }, [businessId, user, isSwitching]);

  // Handle environment toggle
  const handleEnvironmentChange = async (newEnv: 'gym' | 'developer') => {
    if (isSwitching) return;
    
    // If clicking the same environment button, force a re-login
    if (newEnv === currentEnvironment) {
      console.log('[MainScreen] 🔄 Re-logging into same environment:', newEnv);
      setIsSwitching(true);
      
      // Clear sessions
      console.log('[MainScreen] 🧹 Clearing sessions for re-login');
      setOpenSessions([]);
      setIsLoadingSessions(true);
      
      try {
        // Sign out and sign back in to the same environment
        await signOut();
        // signOut already triggers auto-login in AuthProvider
        console.log('[MainScreen] ✅ Re-login complete');
      } catch (error) {
        console.error('[MainScreen] ❌ Re-login failed:', error);
      } finally {
        setIsSwitching(false);
      }
    } else {
      // Different environment - switch accounts
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
    }
  };

  const handleSessionClick = async (session: TrainingSession) => {
    console.log('[MainScreen] 📱 Opening session:', session.id);
    console.log('[MainScreen] Session details:', {
      id: session.id,
      business_id: session.business_id,
      status: session.status,
      currentBusinessId: businessId,
      currentUser: user?.email,
      currentUserBusinessId: user?.businessId
    });
    
    // Clear any previous errors
    setSessionError(null);
    
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
    
    // Set loading state
    setLoadingSessionId(session.id);
    
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), 30000);
      });
      
      // Fetch session details and checked-in clients in parallel
      const fetchPromise = Promise.all([
        queryClient.fetchQuery(api.trainingSession.getById.queryOptions({ id: session.id })),
        queryClient.fetchQuery(api.trainingSession.getCheckedInClients.queryOptions({ sessionId: session.id }))
      ]);
      
      // Race between fetch and timeout
      const [sessionData, checkedInClients] = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]) as [any, any];
      
      console.log('[MainScreen] ✅ Data fetched successfully:', {
        sessionId: session.id,
        hasSessionData: !!sessionData,
        clientCount: checkedInClients?.length || 0
      });
      
      // Navigate with pre-fetched data
      navigation.navigate('SessionLobby', { 
        sessionId: session.id,
        prefetchedData: {
          session: sessionData,
          checkedInClients: checkedInClients || []
        }
      });
      
    } catch (error: any) {
      console.error('[MainScreen] ❌ Failed to open session:', error);
      
      // Set error state
      setSessionError({
        id: session.id,
        message: error.message || 'Failed to open session. Please try again.'
      });
      
      // Show alert
      Alert.alert(
        'Unable to Open Session',
        error.message || 'Failed to open session. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoadingSessionId(null);
    }
  };

  const formatSessionTime = (dateString: string | null) => {
    if (!dateString) return 'Now';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Show loading state during initial auth or when switching AND sessions haven't loaded yet
  if (isAuthLoading || (isSwitching && isLoadingSessions)) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={TOKENS.color.accent} />
        <Text style={[styles.loadingText, { marginTop: 16 }]}>
          {isSwitching ? 'Switching accounts...' : 'Loading...'}
        </Text>
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
        <Pressable onPress={() => retry()} focusable>
          {({ focused }) => (
            <MattePanel 
              focused={focused}
              style={{ 
                paddingHorizontal: 24,
                paddingVertical: 12,
              }}
            >
              {focused && (
                <View pointerEvents="none" style={{
                  position: 'absolute', 
                  inset: -1,
                  borderRadius: TOKENS.radius.card,
                  borderWidth: 2, 
                  borderColor: TOKENS.color.danger,
                }}/>
              )}
              <Text style={{ color: TOKENS.color.text, fontWeight: '600', fontSize: 18 }}>Retry</Text>
            </MattePanel>
          )}
        </Pressable>
      </View>
    );
  }

  // Normal view - authenticated
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {!showTemplates ? (
          <Pressable
            onPress={() => {
              console.log('[MainScreen] 🎯 Create Session button pressed');
              setShowTemplates(true);
              console.log('[MainScreen] 📋 Templates shown, hasTVPreferredFocus should handle focus');
            }}
            disabled={isAuthLoading || createSessionMutation.isPending || openSessions.length > 0}
            focusable
          >
            {({ focused }) => (
              <MattePanel 
                focused={focused}
                style={{ 
                  paddingHorizontal: 32,
                  paddingVertical: 12,
                  opacity: (isAuthLoading || createSessionMutation.isPending || openSessions.length > 0) ? 0.5 : 1,
                  backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                  borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                  borderWidth: focused ? 1 : 1,
                  transform: focused ? [{ translateY: -1 }] : [],
                }}
              >
                <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>
                  {createSessionMutation.isPending ? 'Creating...' : 'Create Session'}
                </Text>
              </MattePanel>
            )}
          </Pressable>
        ) : (
          <View style={[styles.templateSelector, { opacity: showTemplates ? 1 : 0 }]}>
            {console.log('[MainScreen] 🎨 Template selector rendered with', templates.length, 'templates')}
            {createSessionMutation.isPending ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={TOKENS.color.accent} />
                <Text style={styles.loadingText}>Creating session...</Text>
              </View>
            ) : (
              <>
                {templates.map((template, index) => (
              <Pressable
                key={template.id}
                ref={index === 0 ? firstTemplateRef : undefined}
                hasTVPreferredFocus={showTemplates && index === 0}
                onPress={() => {
                  handleCreateSession(template.id);
                }}
                onFocus={() => {
                  console.log(`[MainScreen] 🎯 Template "${template.name}" (index ${index}) received focus`);
                }}
                onBlur={() => {
                  console.log(`[MainScreen] 🔸 Template "${template.name}" (index ${index}) lost focus`);
                }}
                focusable
              >
                {({ focused }) => (
                  <MattePanel
                    focused={focused}
                    style={{
                      paddingHorizontal: 24,
                      paddingVertical: 20,
                      width: 180,
                      alignItems: 'center',
                      backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                      borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                      borderWidth: focused ? 1 : 1,
                      transform: focused ? [{ translateY: -1 }] : [],
                    }}
                  >
                    <Text style={{
                      fontSize: 18,
                      letterSpacing: 0.2,
                      color: TOKENS.color.text,
                      textAlign: 'center',
                    }}>
                      {template.name}
                    </Text>
                  </MattePanel>
                )}
              </Pressable>
                ))}
                <Pressable
                  onPress={() => {
                    setShowTemplates(false);
                  }}
                  focusable
                >
              {({ focused }) => (
                <MattePanel
                  focused={focused}
                  style={{
                    width: 48,
                    height: 48,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                    borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                    borderWidth: focused ? 1 : 1,
                    transform: focused ? [{ translateY: -1 }] : [],
                  }}
                  radius={24}
                >
                  <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>✕</Text>
                  </MattePanel>
                )}
              </Pressable>
              </>
            )}
          </View>
        )}
        
        {/* Account Buttons */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {/* Refresh (Gym) Button - Top Right */}
          <Pressable
            onPress={() => handleEnvironmentChange('gym')}
            disabled={isSwitching || showTemplates}
            focusable={!showTemplates}
          >
            {({ focused }) => (
              <MattePanel 
                focused={focused}
                style={{ 
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  opacity: (isSwitching || showTemplates) ? 0.5 : 1,
                  backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                  borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                  borderWidth: 1,
                  transform: focused ? [{ translateY: -1 }] : [],
                }}
              >
                <Text style={{ 
                  color: TOKENS.color.text, 
                  fontSize: 16, 
                  letterSpacing: 0.2
                }}>
                  Refresh
                </Text>
              </MattePanel>
            )}
          </Pressable>
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
            {isSwitching && (
              <View style={styles.switchingOverlay}>
                <ActivityIndicator size="small" color={TOKENS.color.accent} />
                <Text style={styles.switchingText}>Switching accounts...</Text>
              </View>
            )}
            {openSessions.map((session) => (
              <View
                key={session.id}
                style={[styles.sessionCard, (isSwitching || isLoadingSessions) && styles.disabledCard]}
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
                    <Text style={styles.sessionLabel}>USER</Text>
                    <Text style={[styles.sessionValue, styles.sessionId]}>
                      {session.trainer?.name || 'Unknown'}
                    </Text>
                  </View>
                </View>
                
                {/* Action buttons for the session */}
                <View style={styles.sessionActions}>
                  <Pressable
                    onPress={() => handleSessionClick(session)}
                    focusable
                    disabled={loadingSessionId === session.id}
                    style={{ flex: 1 }}
                  >
                    {({ focused }) => (
                      <MattePanel
                        focused={focused}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 20,
                          alignItems: 'center',
                          backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                          borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                          borderWidth: focused ? 1 : 1,
                          transform: focused ? [{ translateY: -1 }] : [],
                          opacity: loadingSessionId === session.id ? 0.7 : 1,
                        }}
                      >
                        {loadingSessionId === session.id ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <ActivityIndicator size="small" color={TOKENS.color.accent} style={{ marginRight: 8 }} />
                            <Text style={{ 
                              color: TOKENS.color.accent, 
                              fontSize: 18, 
                              letterSpacing: 0.2 
                            }}>
                              Opening...
                            </Text>
                          </View>
                        ) : (
                          <Text style={{ 
                            color: TOKENS.color.text, 
                            fontSize: 18, 
                            letterSpacing: 0.2 
                          }}>
                            Open Session
                          </Text>
                        )}
                      </MattePanel>
                    )}
                  </Pressable>
                  
                  <Pressable
                    onPress={() => handleCloseSession(session.id)}
                    focusable
                    style={{ flex: 1 }}
                  >
                    {({ focused }) => (
                      <MattePanel
                        focused={focused}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 20,
                          alignItems: 'center',
                          backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                          borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                          borderWidth: focused ? 1 : 1,
                          transform: focused ? [{ translateY: -1 }] : [],
                        }}
                      >
                        <Text style={{ 
                          color: TOKENS.color.text, 
                          fontSize: 18, 
                          letterSpacing: 0.2 
                        }}>
                          Delete Session
                        </Text>
                      </MattePanel>
                    )}
                  </Pressable>
                </View>
                
                {/* Error message if this session had an error */}
                {sessionError?.id === session.id && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>
                      {sessionError.message}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No active sessions</Text>
              <Text style={[styles.emptyStateText, styles.emptySubtext]}>
                Logged in as: {currentEnvironment === 'gym' ? 'Gym' : 'Developer'}
              </Text>
              <Text style={[styles.emptyStateText, styles.emptySubtext, { marginTop: 8 }]}>
                {user?.email}
              </Text>
            </View>
          </View>
        )}
      </View>
      
      {/* Developer Button - Bottom Right */}
      <View style={{ position: 'absolute', bottom: 32, right: 32 }}>
        <Pressable
          onPress={() => handleEnvironmentChange('developer')}
          disabled={isSwitching || showTemplates}
          focusable={!showTemplates}
        >
          {({ focused }) => (
            <MattePanel 
              focused={focused}
              style={{ 
                paddingHorizontal: 24,
                paddingVertical: 12,
                opacity: (isSwitching || showTemplates) ? 0.5 : 1,
                backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                borderWidth: 1,
                transform: focused ? [{ translateY: -1 }] : [],
              }}
            >
              <Text style={{ 
                color: TOKENS.color.text, 
                fontSize: 16, 
                letterSpacing: 0.2
              }}>
                Developer
              </Text>
            </MattePanel>
          )}
        </Pressable>
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
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
    backgroundColor: 'transparent',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingBottom: 12,
  },
  segmentText: {
    fontSize: 18,
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.4)', // Grayed out for inactive
  },
  segmentTextActive: {
    color: TOKENS.color.text, // White for active
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
  disabledCard: {
    opacity: 0.5,
  },
  switchingOverlay: {
    backgroundColor: TOKENS.color.card,
    borderColor: TOKENS.color.accent,
    borderWidth: 1,
    borderRadius: TOKENS.radius.card,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchingText: {
    color: TOKENS.color.accent,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  templateSelector: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  templateDescription: {
    fontSize: 14,
    color: TOKENS.color.muted,
    textAlign: 'center',
  },
  templateDescriptionSelected: {
    color: TOKENS.color.text,
  },
  defaultBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: TOKENS.color.accent2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: TOKENS.color.bg,
    letterSpacing: 0.5,
  },
  sessionActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
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
  errorContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: TOKENS.color.danger,
    fontSize: 14,
    textAlign: 'center',
  },
});