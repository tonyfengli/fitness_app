import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Pressable, TVFocusGuideView, Modal } from 'react-native';

// TVEventHandler might be in a different location for react-native-tvos
let TVEventHandler: any;
try {
  const RN = require('react-native');
  TVEventHandler = RN.TVEventHandler;
} catch (e) {
  // TVEventHandler might not be available
  console.log('[MainScreen] TVEventHandler not available');
}
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useBusiness } from '../providers/BusinessProvider';
import { useAuth } from '../providers/AuthProvider';
// import { supabase } from '../lib/supabase'; // Commented out - realtime disabled
import { useNavigation } from '../App';
import { api } from '../providers/TRPCProvider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// import { useRealtimeTrainingSessions } from '../hooks/useRealtimeTrainingSessions'; // Commented out - realtime disabled
import { musicDownloadService, SyncResult } from '../services/MusicDownloadService';
import { useMusic } from '../providers/MusicProvider';

// Program label mapping for coach names
const PROGRAM_LABELS: Record<string, string> = {
  'h4h_5am': 'Coach Will',
  'h4h_5pm': 'Coach Tony',
  'saturday_cg': 'Saturday CG',
  'monday_cg': 'Monday CG',
  'coach_frank': 'Coach Frank',
  'coach_steph': 'Coach Steph',
  'coach_kyle': 'Coach Kyle',
  'unassigned': 'Unassigned'
};

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
  businessId: string;
  templateType: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled' | 'draft';
  scheduledAt: Date | null;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  trainerId: string | null;
  program?: string | null;
  trainer?: {
    id: string;
    name: string;
    email: string;
  };
}

// Helper to format template type for display
function formatTemplateType(type: string): string {
  switch(type) {
    case 'standard':
      return 'Strength';
    case 'circuit':
      return 'Circuit';
    case 'full_body_bmf':
      return 'BMF';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

// Removed hardcoded sessions - now using real data from API

export function MainScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();
  const { user, isLoading: isAuthLoading, isAuthenticated, error: authError, retry, switchAccount, currentEnvironment, signOut } = useAuth();
  // Removed openSessions state - no longer needed since we allow multiple open sessions
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<{ id: string; message: string } | null>(null);
  const firstTemplateRef = useRef<any>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [shouldRefocusCard, setShouldRefocusCard] = useState(false);
  const [activeOperation, setActiveOperation] = useState<'open' | 'complete' | 'delete' | null>(null);
  const [closingSessionsMessage, setClosingSessionsMessage] = useState<string | null>(null);
  const actionButtonsRef = useRef<View>(null);
  const [hasActionButtonFocus, setHasActionButtonFocus] = useState(false);
  const [sessionOffset, setSessionOffset] = useState(0);
  const [focusHint, setFocusHint] = useState<'left' | 'right' | null>(null);

  // TODO: TEMPORARY - Remove once segment timestamps are finalized
  // Used to refresh track segments from API when starting a workout
  const { refreshTracks } = useMusic();

  // Music download modal state
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [localSongsCount, setLocalSongsCount] = useState<number | null>(null);
  const [newSongsCount, setNewSongsCount] = useState<number | null>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [downloadResult, setDownloadResult] = useState<SyncResult | null>(null);
  
  // Session order tracking removed - no longer needed with polling
  
  // Refs for session cards to handle arrow navigation focus
  const sessionCardRefs = useRef<{ [key: string]: any }>({});
  const leftArrowRef = useRef<any>(null);
  const rightArrowRef = useRef<any>(null);

  // Query to fetch recent sessions (polling every 8 seconds)
  const { data: recentSessions, isLoading: isLoadingRecentSessions } = useQuery({
    ...api.trainingSession.list.queryOptions({
      limit: 6,
      offset: 0
    }),
    enabled: !!businessId && !isAuthLoading,
    refetchInterval: 8000, // Poll every 8 seconds
    refetchIntervalInBackground: true,
  });

  // Query for music tracks (for checking new songs)
  const { data: musicTracks, refetch: refetchMusicTracks } = useQuery({
    ...api.music.list.queryOptions({}),
    enabled: false, // Only fetch when modal opens
  });

  // Open music modal and load local count
  const openMusicModal = useCallback(async () => {
    setShowMusicModal(true);
    setNewSongsCount(null);
    setDownloadResult(null);

    try {
      const localTracks = await musicDownloadService.listLocalTracks();
      setLocalSongsCount(localTracks.length);
    } catch (error) {
      console.error('[MainScreen] Error getting local tracks:', error);
      setLocalSongsCount(0);
    }
  }, []);

  // Check for new songs available to download
  const checkForUpdates = useCallback(async () => {
    console.log('[MusicModal] === CHECK FOR UPDATES START ===');
    setIsCheckingForUpdates(true);
    setDownloadResult(null);

    try {
      // Fetch latest tracks from server
      console.log('[MusicModal] Calling refetchMusicTracks...');
      const result = await refetchMusicTracks();
      console.log('[MusicModal] Refetch result status:', result.status);
      console.log('[MusicModal] Refetch result isSuccess:', result.isSuccess);
      console.log('[MusicModal] Refetch result isError:', result.isError);
      console.log('[MusicModal] Refetch result error:', result.error);
      console.log('[MusicModal] Refetch result data type:', typeof result.data);
      console.log('[MusicModal] Refetch result data:', result.data);

      const serverTracks = result.data || [];

      console.log('[MusicModal] Server tracks count:', serverTracks.length);
      console.log('[MusicModal] Server tracks:', serverTracks.map((t: any) => ({
        filename: t.filename,
        hasDownloadUrl: !!t.downloadUrl,
        downloadUrl: t.downloadUrl?.substring(0, 50) + '...',
      })));

      // Get local tracks
      console.log('[MusicModal] Calling listLocalTracks...');
      const localTracks = await musicDownloadService.listLocalTracks();
      const localSet = new Set(localTracks);

      console.log('[MusicModal] Local tracks count:', localTracks.length);
      console.log('[MusicModal] Local tracks:', localTracks);

      // Count tracks with download URLs that aren't local
      const newTracks = serverTracks.filter(
        (t: any) => t.downloadUrl && !localSet.has(t.filename)
      );

      console.log('[MusicModal] New tracks to download:', newTracks.length);
      console.log('[MusicModal] New tracks:', newTracks.map((t: any) => t.filename));

      // Also log tracks WITHOUT download URLs
      const tracksWithoutUrl = serverTracks.filter((t: any) => !t.downloadUrl);
      console.log('[MusicModal] Tracks WITHOUT downloadUrl:', tracksWithoutUrl.length);
      console.log('[MusicModal] Missing URLs:', tracksWithoutUrl.map((t: any) => t.filename));

      console.log('[MusicModal] Setting newSongsCount to:', newTracks.length);
      console.log('[MusicModal] Setting localSongsCount to:', localTracks.length);
      setNewSongsCount(newTracks.length);
      setLocalSongsCount(localTracks.length);
      console.log('[MusicModal] === CHECK FOR UPDATES END ===');
    } catch (error) {
      console.error('[MainScreen] Error checking for updates:', error);
      Alert.alert('Error', 'Failed to check for updates');
    } finally {
      setIsCheckingForUpdates(false);
    }
  }, [refetchMusicTracks]);

  // Download new songs
  const downloadNewSongs = useCallback(async () => {
    setIsDownloading(true);
    console.log('[MusicModal] Starting download...');

    try {
      // Fetch latest tracks from server
      const result = await refetchMusicTracks();
      const serverTracks = result.data || [];

      console.log('[MusicModal] Syncing', serverTracks.length, 'tracks');

      // Sync tracks
      const syncResult = await musicDownloadService.syncTracks(serverTracks);
      console.log('[MusicModal] Sync result:', syncResult);
      setDownloadResult(syncResult);

      // Update local count
      const localTracks = await musicDownloadService.listLocalTracks();
      console.log('[MusicModal] Local tracks after sync:', localTracks);
      setLocalSongsCount(localTracks.length);
      setNewSongsCount(0);
    } catch (error) {
      console.error('[MainScreen] Error downloading songs:', error);
      Alert.alert('Error', 'Failed to download songs');
    } finally {
      setIsDownloading(false);
    }
  }, [refetchMusicTracks]);

  // Clear all downloaded songs
  const clearAllDownloaded = useCallback(async () => {
    console.log('[MusicModal] === CLEAR ALL START ===');
    console.log('[MusicModal] Current localSongsCount:', localSongsCount);
    setIsClearing(true);
    setDownloadResult(null);

    try {
      console.log('[MusicModal] Calling clearLocalTracks...');
      await musicDownloadService.clearLocalTracks();
      console.log('[MusicModal] clearLocalTracks completed');

      // Verify deletion by listing tracks
      const remaining = await musicDownloadService.listLocalTracks();
      console.log('[MusicModal] Remaining tracks after clear:', remaining);

      setLocalSongsCount(0);
      setNewSongsCount(null);
      console.log('[MusicModal] === CLEAR ALL END ===');
    } catch (error) {
      console.error('[MainScreen] Error clearing tracks:', error);
      Alert.alert('Error', 'Failed to clear downloaded songs');
    } finally {
      setIsClearing(false);
    }
  }, [localSongsCount]);

  // Real-time training sessions subscription (DISABLED - using polling instead)
  // Commented out due to Supabase Realtime connection issues
  // const { isConnected: realtimeConnected, error: realtimeError } = useRealtimeTrainingSessions({
  //   businessId: businessId || '',
  //   supabase,
  //   onUpdate: (session, event) => {
  //     console.log('[MainScreen] 🔥 REAL-TIME:', event, session.name);
  //     // Invalidate query to refetch - polling will handle the rest
  //     queryClient.invalidateQueries({
  //       queryKey: api.trainingSession.list.queryOptions({ limit: 6, offset: 0 }).queryKey
  //     });
  //   },
  //   onError: (error) => {
  //     console.error('[MainScreen] Real-time training sessions error:', error);
  //   }
  // });
  
  
  // Sessions are fetched via polling - no sorting needed

  // Template options matching the webapp
  const templates = [
    { id: 'standard', name: 'Strength', description: 'Client-pooled organization' },
    { id: 'circuit', name: 'Circuit', description: 'Time-based circuit training' },
  ];

  // Debug selectedSessionId changes
  useEffect(() => {
  }, [selectedSessionId]);

  // Clear selection when focus leaves action buttons
  useEffect(() => {
    if (!hasActionButtonFocus && selectedSessionId && !activeOperation) {
      // Small delay to ensure focus has actually moved
      const timeout = setTimeout(() => {
        // Double-check that focus hasn't returned to action buttons
        if (!hasActionButtonFocus) {
          setSelectedSessionId(null);
        }
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, [hasActionButtonFocus, selectedSessionId, activeOperation]);

  // Set up TV event handler for detecting up navigation when action buttons are focused
  useEffect(() => {
    let tvEventHandler: any = null;
    
    if (selectedSessionId && hasActionButtonFocus && !activeOperation && TVEventHandler && typeof TVEventHandler === 'function') {
      try {
        tvEventHandler = new TVEventHandler();
        
        const handleTVEvent = (evt: any) => {
          if (evt && evt.eventType === 'up') {
            // User pressed up while action buttons have focus
            // Since focus is trapped, this won't move focus but we can detect it
            console.log('[MainScreen] Up navigation detected while action buttons focused - canceling selection');
            setShouldRefocusCard(true);
            setTimeout(() => {
              setSelectedSessionId(null);
            }, 50);
          }
        };
        
        tvEventHandler.enable(undefined, handleTVEvent);
      } catch (error) {
        console.log('[MainScreen] TV event handler setup failed:', error);
      }
    }
    
    return () => {
      if (tvEventHandler && tvEventHandler.disable) {
        tvEventHandler.disable();
      }
    };
  }, [selectedSessionId, hasActionButtonFocus, activeOperation]);

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    ...api.trainingSession.deleteSession.mutationOptions(),
    onMutate: () => {
      setActiveOperation('delete');
    },
    onSuccess: () => {
      // Invalidate the training session list query to refresh the UI
      queryClient.invalidateQueries({ 
        queryKey: api.trainingSession.list.queryOptions({ limit: 6, offset: 0 }).queryKey 
      });
      setSelectedSessionId(null);
    },
    onError: (error: any) => {
      console.error('[MainScreen] ❌ Failed to delete session:', error);
      Alert.alert(
        'Delete Session Failed',
        error.message || 'Failed to delete session. Please try again.',
        [{ text: 'OK' }]
      );
    },
    onSettled: () => {
      setActiveOperation(null);
    },
  });

  // Update session status mutation
  const updateSessionStatusMutation = useMutation({
    ...api.trainingSession.updateSessionStatus.mutationOptions(),
    onSuccess: (data) => {
      console.log('[MainScreen] ✅ Session status updated:', data.status);
      // Invalidate the specific query for the recent sessions list
      queryClient.invalidateQueries({ 
        queryKey: api.trainingSession.list.queryOptions({ limit: 6, offset: 0 }).queryKey 
      });
    },
    onError: (error: any) => {
      console.error('[MainScreen] ❌ Failed to update session status:', error);
      // Don't show alert for status updates - handle silently
    },
  });

  // Complete session mutation
  const completeSessionMutation = useMutation({
    ...api.trainingSession.completeSession.mutationOptions(),
    onMutate: () => {
      setActiveOperation('complete');
    },
    onSuccess: () => {
      console.log('[MainScreen] ✅ Session completed successfully');
      // Invalidate the training session list query to refresh the UI
      queryClient.invalidateQueries({ 
        queryKey: api.trainingSession.list.queryOptions({ limit: 6, offset: 0 }).queryKey 
      });
      setSelectedSessionId(null);
    },
    onError: (error: any) => {
      console.error('[MainScreen] ❌ Failed to complete session:', error);
      Alert.alert(
        'Failed to Complete Session',
        error.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    },
    onSettled: () => {
      setActiveOperation(null);
    },
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    ...api.trainingSession.create.mutationOptions(),
    onSuccess: async (newSession) => {
      console.log('[MainScreen] ✅ Session created:', newSession.id);
      console.log('[MainScreen] Template type:', newSession.templateType);
      
      // Hide template selector
      setShowTemplates(false);
      
      // Invalidate the training session list query to show the new session
      queryClient.invalidateQueries({ 
        queryKey: api.trainingSession.list.queryOptions({ limit: 6, offset: 0 }).queryKey 
      });
      
      // Check if there's an in-progress session to close
      const inProgressFromCurrent = recentSessions?.find((s: any) => 
        s.status === 'in_progress'
      );
      
      let sessionToClose = inProgressFromCurrent;
      
      // Only fetch if we don't have recentSessions loaded yet (edge case)
      if (!recentSessions && !sessionToClose) {
        const recentSessionsData = await queryClient.fetchQuery(
          api.trainingSession.list.queryOptions({ limit: 6, offset: 0 })
        );
        
        const inProgressSession = recentSessionsData.find((s: any) => 
          s.status === 'in_progress'
        );
        
        if (inProgressSession) {
          sessionToClose = inProgressSession;
        }
      }
      
      // Only close if there's actually a session to close
      if (sessionToClose) {
        console.log('[MainScreen] 🔄 Found in-progress session to close:', sessionToClose.id);
        setClosingSessionsMessage('Setting up session...');
        
        try {
          await updateSessionStatusMutation.mutateAsync({
            sessionId: sessionToClose.id,
            status: 'open' as const
          });
          console.log('[MainScreen] ✅ Closed session:', sessionToClose.id);
          setClosingSessionsMessage(null);
        } catch (closeError: any) {
          console.error('[MainScreen] ❌ Failed to close session:', sessionToClose.id, closeError);
          setClosingSessionsMessage(null);
          Alert.alert(
            'Failed to Close Previous Session',
            closeError.message || 'Could not close the previous session. Please try again.',
            [{ text: 'OK' }]
          );
          // Still navigate to the new session but it will remain in 'open' status
          if (newSession.templateType === 'circuit') {
            // TODO: TEMPORARY - refresh tracks for updated segments
            await refreshTracks();
            // For circuit sessions, go directly to workout overview
            navigation.navigate('CircuitWorkoutOverview', {
              sessionId: newSession.id
            });
          } else {
            // For strength sessions, use the lobby
            navigation.navigate('SessionLobby', { 
              sessionId: newSession.id,
              isNewSession: true,
              prefetchedData: {
                session: newSession, // Pass the complete session object immediately
                checkedInClients: [] // New sessions start with no checked-in clients
              }
            });
          }
          return;
        }
      } else {
        console.log('[MainScreen] No in-progress sessions found - proceeding normally');
      }
      
      // Update session status to in_progress
      console.log('[MainScreen] 🔄 Updating new session status to in_progress');
      try {
        await updateSessionStatusMutation.mutateAsync({
          sessionId: newSession.id,
          status: 'in_progress' as const
        });
        console.log('[MainScreen] ✅ New session status updated to in_progress');
      } catch (statusError: any) {
        console.error('[MainScreen] ❌ Failed to update status for new session:', statusError);
        Alert.alert(
          'Failed to Activate Session',
          statusError.message || 'Could not set session as active. Please try again.',
          [{ text: 'OK' }]
        );
      }
      
      // Navigate based on session type
      if (newSession.templateType === 'circuit') {
        // TODO: TEMPORARY - refresh tracks for updated segments
        await refreshTracks();
        // For circuit sessions, go directly to workout overview
        navigation.navigate('CircuitWorkoutOverview', {
          sessionId: newSession.id
        });
      } else {
        // For strength sessions, use the lobby
        navigation.navigate('SessionLobby', { 
          sessionId: newSession.id,
          isNewSession: true,
          prefetchedData: {
            session: newSession, // Pass the complete session object immediately
            checkedInClients: [] // New sessions start with no checked-in clients
          }
        });
      }
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

  // Realtime logging removed - using polling instead

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

  // Removed fetchOpenSessions - using React Query for all session data

  // Sessions are now managed entirely through React Query

  // Handle environment toggle
  const handleEnvironmentChange = async (newEnv: 'gym' | 'developer') => {
    if (isSwitching) return;

    // If clicking the same environment button, force a re-login
    if (newEnv === currentEnvironment) {
      console.log('[MainScreen] 🔄 Re-logging into same environment:', newEnv);
      setIsSwitching(true);
      
      // Sessions will be refreshed automatically via React Query
      console.log('[MainScreen] 🧹 Sessions will refresh after re-login');
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
      
      // Sessions will be refreshed automatically via React Query
      console.log('[MainScreen] 🧹 Sessions will refresh after account switch');
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
      businessId: session.businessId,
      status: session.status,
      currentBusinessId: businessId,
      currentUser: user?.email,
      currentUserBusinessId: user?.businessId
    });
    
    // Clear any previous errors
    setSessionError(null);
    
    // Verify session belongs to current business
    if (session.businessId !== businessId) {
      console.error('[MainScreen] ⚠️ WARNING: Session businessId mismatch!');
      console.error('[MainScreen] Session belongs to:', session.businessId);
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
    setActiveOperation('open');
    
    try {
      // First check if there's an in-progress session to close
      const inProgressFromCurrent = recentSessions?.find((s: any) => 
        s.status === 'in_progress' && s.id !== session.id
      );
      
      let sessionToClose = inProgressFromCurrent;
      
      // Only fetch if we don't have recentSessions loaded yet (edge case)
      if (!recentSessions && !sessionToClose) {
        const recentSessionsData = await queryClient.fetchQuery(
          api.trainingSession.list.queryOptions({ limit: 6, offset: 0 })
        );
        
        const inProgressSession = recentSessionsData.find((s: any) => 
          s.status === 'in_progress' && s.id !== session.id
        );
        
        if (inProgressSession) {
          sessionToClose = inProgressSession;
        }
      }
      
      // Only show message and close if there's actually a session to close
      if (sessionToClose) {
        console.log('[MainScreen] 🔄 Found in-progress session to close:', sessionToClose.id);
        setClosingSessionsMessage('Closing previous session...');
        
        try {
          await updateSessionStatusMutation.mutateAsync({
            sessionId: sessionToClose.id,
            status: 'open' as const
          });
          console.log('[MainScreen] ✅ Closed session:', sessionToClose.id);
          setClosingSessionsMessage(null);
        } catch (closeError: any) {
          console.error('[MainScreen] ❌ Failed to close session:', sessionToClose.id, closeError);
          setClosingSessionsMessage(null);
          Alert.alert(
            'Failed to Close Previous Session',
            closeError.message || 'Could not close the previous session. Please try again.',
            [{ text: 'OK' }]
          );
          throw closeError;
        }
      } else {
        console.log('[MainScreen] No in-progress sessions found - proceeding normally');
      }
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), 30000);
      });
      
      // Fetch only checked-in clients (session data already available from list)
      const fetchPromise = queryClient.fetchQuery(api.trainingSession.getCheckedInClients.queryOptions({ sessionId: session.id }));
      
      // Race between fetch and timeout
      const checkedInClients = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]) as any;
      
      console.log('[MainScreen] ✅ Data fetched successfully:', {
        sessionId: session.id,
        clientCount: checkedInClients?.length || 0
      });
      
      // Update session status to in_progress
      console.log('[MainScreen] 🔄 Updating session status to in_progress');
      try {
        await updateSessionStatusMutation.mutateAsync({
          sessionId: session.id,
          status: 'in_progress' as const
        });
        console.log('[MainScreen] ✅ Session status updated to in_progress');
      } catch (statusError: any) {
        console.error('[MainScreen] ❌ Failed to update status:', statusError);
        Alert.alert(
          'Failed to Open Session',
          statusError.message || 'Could not set session as active. Please try again.',
          [{ text: 'OK' }]
        );
        throw statusError;
      }
      
      // Navigate based on session type
      if (session.templateType === 'circuit') {
        // TODO: TEMPORARY - refresh tracks for updated segments
        await refreshTracks();
        // For circuit sessions, go directly to workout overview
        navigation.navigate('CircuitWorkoutOverview', {
          sessionId: session.id
        });
      } else {
        // For strength sessions, use the lobby
        navigation.navigate('SessionLobby', { 
          sessionId: session.id,
          prefetchedData: {
            session: session, // Use the session object we already have
            checkedInClients: checkedInClients || []
          }
        });
      }
      
    } catch (error: any) {
      console.error('[MainScreen] ❌ Failed to open session:', error);
      
      // Set error state
      setSessionError({
        id: session.id,
        message: error.message || 'Failed to open session. Please try again.'
      });
    } finally {
      setLoadingSessionId(null);
      setActiveOperation(null);
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
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable
            onPress={() => {
              console.log('[MainScreen] 🎯 Create Session button pressed');
              setShowTemplates(true);
              console.log('[MainScreen] 📋 Templates shown, hasTVPreferredFocus should handle focus');
            }}
            disabled={isAuthLoading || createSessionMutation.isPending || !!selectedSessionId}
            focusable={!selectedSessionId}
          >
            {({ focused }) => (
              <MattePanel 
                focused={focused}
                style={{ 
                  paddingHorizontal: 32,
                  paddingVertical: 12,
                  opacity: (isAuthLoading || createSessionMutation.isPending) ? 0.5 : 1,
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
          </View>
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
                hasTVPreferredFocus={showTemplates && index === 0 && !selectedSessionId}
                onPress={() => {
                  handleCreateSession(template.id);
                }}
                onFocus={() => {
                  console.log(`[MainScreen] 🎯 Template "${template.name}" (index ${index}) received focus`);
                }}
                onBlur={() => {
                  console.log(`[MainScreen] 🔸 Template "${template.name}" (index ${index}) lost focus`);
                }}
                focusable={!selectedSessionId}
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
                  focusable={!selectedSessionId}
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
            disabled={isSwitching || showTemplates || !!selectedSessionId}
            focusable={!showTemplates && !selectedSessionId}
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
        <View style={styles.sessionsContainer}>
          <View style={styles.sessionsRowWrapper}>
            {/* Left Arrow */}
            {recentSessions && recentSessions.length > 3 && sessionOffset > 0 && (
              <Pressable
                ref={leftArrowRef}
                focusable={!selectedSessionId}
                onPress={() => {
                  const newOffset = Math.max(0, sessionOffset - 1);
                  setSessionOffset(newOffset);
                  if (newOffset === 0) {
                    // Arrow will disappear, hint to focus left card
                    setFocusHint('left');
                  }
                }}
                style={{ position: 'absolute', left: -20, top: '50%', transform: [{ translateY: -24 }] }}
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
                      borderWidth: 1,
                      transform: focused ? [{ translateY: -1 }] : [],
                    }}
                    radius={24}
                  >
                    <Icon name="chevron-left" size={24} color={TOKENS.color.text} />
                  </MattePanel>
                )}
              </Pressable>
            )}
            
            {/* Right Arrow */}
            {recentSessions && recentSessions.length > 3 && sessionOffset < recentSessions.length - 3 && (
              <Pressable
                ref={rightArrowRef}
                focusable={!selectedSessionId}
                onPress={() => {
                  const newOffset = Math.min(recentSessions.length - 3, sessionOffset + 1);
                  setSessionOffset(newOffset);
                  if (newOffset === recentSessions.length - 3) {
                    // Arrow will disappear, hint to focus right card
                    setFocusHint('right');
                  }
                }}
                style={{ position: 'absolute', right: -20, top: '50%', transform: [{ translateY: -24 }] }}
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
                      borderWidth: 1,
                      transform: focused ? [{ translateY: -1 }] : [],
                    }}
                    radius={24}
                  >
                    <Icon name="chevron-right" size={24} color={TOKENS.color.text} />
                  </MattePanel>
                )}
              </Pressable>
            )}
            
            <View style={styles.sessionsRow}>
            {isLoadingRecentSessions && !recentSessions ? (
              <View style={[styles.sessionCardWrapper, { justifyContent: 'center', alignItems: 'center', width: '100%' }]}>
                <ActivityIndicator size="large" color={TOKENS.color.accent} />
                <Text style={{ color: TOKENS.color.muted, marginTop: 16 }}>Loading sessions...</Text>
              </View>
            ) : !recentSessions || recentSessions.length === 0 ? (
              <View style={[styles.sessionCardWrapper, { justifyContent: 'center', alignItems: 'center', width: '100%' }]}>
                <Icon name="inbox" size={48} color={TOKENS.color.muted} />
                <Text style={{ color: TOKENS.color.muted, marginTop: 16, fontSize: 16 }}>No sessions available</Text>
                <Text style={{ color: TOKENS.color.muted, marginTop: 8, fontSize: 14 }}>Create a session to get started</Text>
              </View>
            ) : recentSessions.slice(sessionOffset, sessionOffset + 3).map((session, index) => (
              <Pressable
                key={session.id}
                ref={(ref) => {
                  if (ref) {
                    sessionCardRefs.current[session.id] = ref;
                  }
                }}
                focusable={!selectedSessionId}
                hasTVPreferredFocus={(shouldRefocusCard && selectedSessionId === session.id) || 
                  (focusHint === 'left' && index === 0) || 
                  (focusHint === 'right' && index === 2)}
                style={styles.sessionCardWrapper}
                onPress={() => {
                  setSelectedSessionId(selectedSessionId === session.id ? null : session.id);
                  setShouldRefocusCard(false);
                }}
                onFocus={() => {
                  if (shouldRefocusCard && selectedSessionId === session.id) {
                    setShouldRefocusCard(false);
                  }
                  // Clear focus hint once a card is focused
                  if (focusHint) {
                    setFocusHint(null);
                  }
                }}
              >
                {({ focused }) => (
                  <View style={[
                    styles.simpleSessionCard,
                    focused && styles.simpleSessionCardFocused,
                    selectedSessionId === session.id && styles.simpleSessionCardSelected
                  ]}>
                    <View style={[
                      styles.simpleStatusBadge,
                      session.status === 'open' && styles.openBadge,
                      session.status === 'completed' && styles.completeBadge,
                      (session.status === 'cancelled' || session.status === 'draft') && styles.incompleteBadge,
                      session.status === 'in_progress' && styles.openBadge,
                    ]}>
                      <Text style={[
                        styles.simpleStatusText,
                        session.status === 'open' && styles.openText,
                        session.status === 'completed' && styles.completeText,
                        (session.status === 'cancelled' || session.status === 'draft') && styles.incompleteText,
                        session.status === 'in_progress' && styles.openText,
                      ]}>
                        {session.status === 'in_progress' ? 'IN PROGRESS' : 
                         session.status === 'draft' ? 'DRAFT' : 
                         session.status.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.simpleSessionName} numberOfLines={2} ellipsizeMode="tail">
                        {(session.program && session.program.toLowerCase() !== 'unassigned') ? (PROGRAM_LABELS[session.program] || session.program) : (session.name || `Session ${session.id.split('-')[0].slice(0, 6)}`)}
                      </Text>
                      <Text style={styles.simpleSessionType}>
                        {formatTemplateType(session.templateType)}
                      </Text>
                      <Text style={styles.simpleSessionDate}>
                        {session.scheduledAt ? new Date(session.scheduledAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        }) : 'Not scheduled'}
                      </Text>
                      <Text style={styles.simpleSessionDate}>
                        {session.scheduledAt ? (() => {
                          const date = new Date(session.scheduledAt);
                          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          return days[date.getDay()];
                        })() : ''}
                      </Text>
                    </View>
                  </View>
                )}
              </Pressable>
            ))}
            </View>
          </View>
          
          {/* Action Buttons */}
          {(() => {
            const selectedSession = recentSessions?.find(s => s.id === selectedSessionId);
            const isCompleted = selectedSession?.status === 'completed';
            
            return (
              <TVFocusGuideView 
                style={[styles.actionButtonsContainer, { opacity: selectedSessionId ? 1 : 0 }]}
                trapFocusUp={false}
                trapFocusDown={!!selectedSessionId}
                trapFocusLeft={!!selectedSessionId}
                trapFocusRight={!!selectedSessionId}
              >
                {!isCompleted ? (
                  <>
                    <Pressable
                      focusable={!!selectedSessionId && !activeOperation}
                      hasTVPreferredFocus={!!selectedSessionId && !activeOperation}
                      disabled={!!activeOperation}
                      onFocus={() => setHasActionButtonFocus(true)}
                      onBlur={() => setHasActionButtonFocus(false)}
                      onPress={async () => {
                        const session = recentSessions?.find(s => s.id === selectedSessionId);
                        if (session && !activeOperation) {
                          setSelectedSessionId(null);
                          await handleSessionClick(session);
                        }
                      }}
                      style={[styles.actionButtonWrapper, { opacity: activeOperation ? 0.5 : 1 }]}
                    >
                      {({ focused }) => (
                        <View style={[
                          styles.actionButton,
                          focused && styles.actionButtonFocused
                        ]}>
                          <Icon name="play-arrow" size={20} color={TOKENS.color.text} />
                          <Text style={styles.actionButtonText}>Open</Text>
                        </View>
                      )}
                    </Pressable>
                    
                    <Pressable
                      focusable={!!selectedSessionId && !activeOperation}
                      disabled={!!activeOperation}
                      onFocus={() => setHasActionButtonFocus(true)}
                      onBlur={() => setHasActionButtonFocus(false)}
                      onPress={() => {
                        if (selectedSessionId && !activeOperation) {
                          Alert.alert(
                            'Complete Session',
                            'Are you sure you want to mark this session as complete?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { 
                                text: 'Complete', 
                                onPress: () => {
                                  if (selectedSessionId) {
                                    completeSessionMutation.mutate({ sessionId: selectedSessionId });
                                  }
                                }
                              }
                            ]
                          );
                        }
                      }}
                      style={[styles.actionButtonWrapper, { opacity: activeOperation ? 0.5 : 1 }]}
                    >
                      {({ focused }) => (
                        <View style={[
                          styles.actionButton,
                          focused && styles.actionButtonFocused
                        ]}>
                          <Icon name="check-circle" size={20} color={TOKENS.color.text} />
                          <Text style={styles.actionButtonText}>Complete</Text>
                        </View>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    focusable={!!selectedSessionId && !activeOperation}
                    hasTVPreferredFocus={!!selectedSessionId && !activeOperation}
                    disabled={!!activeOperation}
                    onFocus={() => setHasActionButtonFocus(true)}
                    onBlur={() => setHasActionButtonFocus(false)}
                    onPress={() => {
                      if (selectedSessionId && !activeOperation) {
                        Alert.alert(
                          'Reopen Session',
                          'Are you sure you want to reopen this completed session?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Reopen', 
                              onPress: async () => {
                                if (selectedSessionId) {
                                  setActiveOperation('open');
                                  try {
                                    await updateSessionStatusMutation.mutateAsync({
                                      sessionId: selectedSessionId,
                                      status: 'open' as const
                                    });
                                    setSelectedSessionId(null);
                                  } catch (error) {
                                    console.error('[MainScreen] Failed to reopen session:', error);
                                  } finally {
                                    setActiveOperation(null);
                                  }
                                }
                              }
                            }
                          ]
                        );
                      }
                    }}
                    style={[styles.actionButtonWrapper, { opacity: activeOperation ? 0.5 : 1 }]}
                  >
                    {({ focused }) => (
                      <View style={[
                        styles.actionButton,
                        focused && styles.actionButtonFocused
                      ]}>
                        <Icon name="refresh" size={20} color={TOKENS.color.text} />
                        <Text style={styles.actionButtonText}>Reopen</Text>
                      </View>
                    )}
                  </Pressable>
                )}
                
                <Pressable
                  focusable={!!selectedSessionId && !activeOperation}
                  hasTVPreferredFocus={false}
                  disabled={!!activeOperation}
                  onFocus={() => setHasActionButtonFocus(true)}
                  onBlur={() => setHasActionButtonFocus(false)}
                onPress={() => {
                  if (selectedSessionId && !activeOperation) {
                    handleCloseSession(selectedSessionId);
                    setSelectedSessionId(null);
                  }
                }}
                style={[styles.actionButtonWrapper, { opacity: activeOperation ? 0.5 : 1 }]}
              >
                {({ focused }) => (
                  <View style={[
                    styles.actionButton,
                    focused && styles.actionButtonFocused
                  ]}>
                    <Icon name="delete" size={20} color={TOKENS.color.text} />
                    <Text style={styles.actionButtonText}>Delete</Text>
                  </View>
                )}
              </Pressable>
              
              <Pressable
                focusable={!!selectedSessionId}
                onFocus={() => {
                  setHasActionButtonFocus(true);
                }}
                onBlur={() => setHasActionButtonFocus(false)}
                onPress={() => {
                  setShouldRefocusCard(true);
                  // Small delay to allow state to update before clearing selection
                  setTimeout(() => {
                    setSelectedSessionId(null);
                  }, 50);
                }}
                style={styles.cancelButtonWrapper}
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
                      borderWidth: 1,
                      transform: focused ? [{ translateY: -1 }] : [],
                    }}
                    radius={24}
                  >
                    <Icon name="close" size={20} color={TOKENS.color.text} />
                  </MattePanel>
                )}
              </Pressable>
            </TVFocusGuideView>
            );
          })()}
        </View>
      </View>
      
      {/* Bottom Right Buttons */}
      <View style={{ position: 'absolute', bottom: 32, right: 32, flexDirection: 'row', gap: 12 }}>
        {/* Download Music Button */}
        <Pressable
          onPress={() => {
            console.log('[MainScreen] Download Music button pressed');
            openMusicModal();
          }}
          disabled={isSwitching || showTemplates || !!selectedSessionId}
          focusable={!showTemplates && !selectedSessionId && !showMusicModal}
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
                Download Music
              </Text>
            </MattePanel>
          )}
        </Pressable>

        {/* Developer Button */}
        <Pressable
          onPress={() => handleEnvironmentChange('developer')}
          disabled={isSwitching || showTemplates || !!selectedSessionId}
          focusable={!showTemplates && !selectedSessionId}
          onFocus={() => console.log('[MainScreen] Developer button focused. selectedSessionId:', selectedSessionId)}
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

      {/* Subtle Loading Indicator */}
      {(activeOperation || closingSessionsMessage) && (
        <View style={{
          position: 'absolute',
          bottom: 120,
          left: 0,
          right: 0,
          alignItems: 'center',
          pointerEvents: 'none',
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: TOKENS.color.card,
            borderColor: TOKENS.color.borderGlass,
            borderWidth: 1,
            borderRadius: TOKENS.radius.chip,
            paddingVertical: 8,
            paddingHorizontal: 16,
            gap: 8,
          }}>
            <ActivityIndicator size="small" color={TOKENS.color.accent} />
            <Text style={{
              color: TOKENS.color.muted,
              fontSize: 14,
            }}>
              {closingSessionsMessage || (
                activeOperation === 'open' && 'Opening...'
              ) || (
                activeOperation === 'complete' && 'Completing...'
              ) || (
                activeOperation === 'delete' && 'Deleting...'
              )}
            </Text>
          </View>
        </View>
      )}

      {/* Music Download Modal */}
      <Modal
        visible={showMusicModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMusicModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Music Library</Text>
              <Pressable
                onPress={() => setShowMusicModal(false)}
                focusable
              >
                {({ focused }) => (
                  <View style={[
                    styles.modalCloseButton,
                    focused && styles.modalButtonFocused
                  ]}>
                    <Icon name="close" size={20} color={TOKENS.color.text} />
                  </View>
                )}
              </Pressable>
            </View>

            {/* Local songs count */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Downloaded Songs</Text>
              <Text style={styles.modalValue}>
                {localSongsCount === null ? '...' : localSongsCount}
              </Text>
            </View>

            {/* Download result message */}
            {downloadResult && (
              <View style={styles.modalResultSection}>
                <Text style={styles.modalResultText}>
                  {downloadResult.downloaded > 0
                    ? `Downloaded ${downloadResult.downloaded} new song${downloadResult.downloaded !== 1 ? 's' : ''}`
                    : 'All songs up to date'}
                </Text>
                {downloadResult.failed.length > 0 && (
                  <Text style={[styles.modalResultText, { color: TOKENS.color.danger }]}>
                    {downloadResult.failed.length} failed
                  </Text>
                )}
              </View>
            )}

            {/* New songs available */}
            {newSongsCount !== null && newSongsCount > 0 && !downloadResult && (
              <View style={styles.modalSection}>
                <Text style={[styles.modalLabel, { color: TOKENS.color.accent }]}>
                  {newSongsCount} new song{newSongsCount !== 1 ? 's' : ''} available
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.modalActions}>
              {/* Check for Updates */}
              <Pressable
                onPress={checkForUpdates}
                disabled={isCheckingForUpdates || isDownloading}
                focusable={!isCheckingForUpdates && !isDownloading}
                hasTVPreferredFocus
              >
                {({ focused }) => (
                  <View style={[
                    styles.modalButton,
                    focused && styles.modalButtonFocused,
                    (isCheckingForUpdates || isDownloading) && styles.modalButtonDisabled
                  ]}>
                    {isCheckingForUpdates ? (
                      <ActivityIndicator size="small" color={TOKENS.color.text} />
                    ) : (
                      <>
                        <Icon name="refresh" size={18} color={TOKENS.color.text} />
                        <Text style={styles.modalButtonText}>Check for Updates</Text>
                      </>
                    )}
                  </View>
                )}
              </Pressable>

              {/* Download button - only show if new songs available */}
              {newSongsCount !== null && newSongsCount > 0 && !downloadResult && (
                <Pressable
                  onPress={downloadNewSongs}
                  disabled={isDownloading}
                  focusable={!isDownloading}
                >
                  {({ focused }) => (
                    <View style={[
                      styles.modalButton,
                      styles.modalButtonPrimary,
                      focused && styles.modalButtonFocused,
                      isDownloading && styles.modalButtonDisabled
                    ]}>
                      {isDownloading ? (
                        <ActivityIndicator size="small" color={TOKENS.color.bg} />
                      ) : (
                        <>
                          <Icon name="download" size={18} color={TOKENS.color.bg} />
                          <Text style={[styles.modalButtonText, { color: TOKENS.color.bg }]}>
                            Download {newSongsCount} Song{newSongsCount !== 1 ? 's' : ''}
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                </Pressable>
              )}

              {/* Clear All button - only show if there are local songs */}
              {localSongsCount !== null && localSongsCount > 0 && (
                <Pressable
                  onPress={clearAllDownloaded}
                  disabled={isClearing || isDownloading}
                  focusable={!isClearing && !isDownloading}
                >
                  {({ focused }) => (
                    <View style={[
                      styles.modalButton,
                      styles.modalButtonDanger,
                      focused && styles.modalButtonFocused,
                      (isClearing || isDownloading) && styles.modalButtonDisabled
                    ]}>
                      {isClearing ? (
                        <ActivityIndicator size="small" color={TOKENS.color.danger} />
                      ) : (
                        <>
                          <Icon name="delete" size={18} color={TOKENS.color.danger} />
                          <Text style={[styles.modalButtonText, { color: TOKENS.color.danger }]}>
                            Clear All Downloaded
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 20, // Reduced since we're shifting down
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
  sessionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    gap: 24,
  },
  sessionCardWrapper: {
    flex: 1,
    maxWidth: 240, // Reduced by 20% from 300
  },
  simpleSessionCard: {
    backgroundColor: TOKENS.color.card,
    borderColor: TOKENS.color.borderGlass,
    borderWidth: 1,
    borderRadius: TOKENS.radius.card,
    padding: 24,
    height: 230,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 22,
    elevation: 8,
  },
  simpleSessionCardFocused: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    transform: [{ translateY: -1 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.36,
    shadowRadius: 40,
    elevation: 12,
  },
  sessionInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simpleSessionName: {
    fontSize: 24,
    fontWeight: '700',
    color: TOKENS.color.text,
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
    numberOfLines: 2,
    lineHeight: 30,
    minHeight: 60,
  },
  simpleSessionType: {
    fontSize: 18,
    color: TOKENS.color.muted,
    textAlign: 'center',
  },
  simpleSessionDate: {
    fontSize: 14,
    color: TOKENS.color.muted,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.7,
  },
  simpleStatusBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: TOKENS.radius.chip,
    borderWidth: 1,
  },
  simpleStatusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  openBadge: {
    backgroundColor: 'rgba(124,255,181,0.1)',
    borderColor: 'rgba(124,255,181,0.3)',
  },
  openText: {
    color: TOKENS.color.accent,
  },
  completeBadge: {
    backgroundColor: 'rgba(156,176,255,0.1)',
    borderColor: 'rgba(156,176,255,0.3)',
  },
  completeText: {
    color: TOKENS.color.muted,
  },
  incompleteBadge: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  incompleteText: {
    color: TOKENS.color.danger,
  },
  sessionsContainer: {
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  sessionsRowWrapper: {
    alignItems: 'center',
  },
  simpleSessionCardSelected: {
    borderColor: 'rgba(255,255,255,0.8)',
    borderWidth: 2,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    height: 60,
    marginTop: 130,
  },
  actionButtonWrapper: {
    minWidth: 120,
  },
  cancelButtonWrapper: {
    marginLeft: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: TOKENS.radius.button,
    borderWidth: 1,
    backgroundColor: TOKENS.color.card,
    borderColor: TOKENS.color.borderGlass,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 6,
  },
  actionButtonFocused: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.45)',
    transform: [{ translateY: -1 }],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
    elevation: 10,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: TOKENS.color.text,
  },
  // Music Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: TOKENS.color.card,
    borderColor: TOKENS.color.borderGlass,
    borderWidth: 1,
    borderRadius: TOKENS.radius.card,
    padding: 32,
    minWidth: 400,
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: TOKENS.color.text,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TOKENS.color.cardGlass,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: TOKENS.color.borderGlass,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    color: TOKENS.color.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalValue: {
    fontSize: 48,
    fontWeight: '700',
    color: TOKENS.color.text,
  },
  modalResultSection: {
    backgroundColor: TOKENS.color.cardGlass,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalResultText: {
    fontSize: 16,
    color: TOKENS.color.accent,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: TOKENS.radius.button,
    backgroundColor: TOKENS.color.cardGlass,
    borderWidth: 1,
    borderColor: TOKENS.color.borderGlass,
    minWidth: 160,
  },
  modalButtonPrimary: {
    backgroundColor: TOKENS.color.accent,
    borderColor: TOKENS.color.accent,
  },
  modalButtonDanger: {
    backgroundColor: 'transparent',
    borderColor: TOKENS.color.danger,
  },
  modalButtonFocused: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.5)',
    transform: [{ scale: 1.02 }],
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: TOKENS.color.text,
  },
});