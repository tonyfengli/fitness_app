import React, { useState, useEffect, useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation } from '../App';
import { useBusiness } from '../providers/BusinessProvider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimeCheckIns } from '../hooks/useRealtimeCheckIns';
import { StrengthLobbyComponent, CircuitLobbyComponent } from './SessionLobby';

// Design tokens
const TOKENS = {
  color: {
    bg: '#070b18',
    card: '#111928',
    text: '#ffffff',
    muted: '#9cb0ff',
    accent: '#7cffb5',
    accent2: '#5de1ff',
    focusRing: 'rgba(124,255,181,0.6)',
    borderGlass: 'rgba(255,255,255,0.08)',
    cardGlass: 'rgba(255,255,255,0.04)',
  },
  radius: {
    card: 16,
    chip: 999,
  },
};

interface CheckedInClient {
  userId: string;
  userName: string | null;
  userEmail: string;
  checkedInAt: Date | null;
  status?: string;
  preferences?: {
    intensity?: string | null;
    muscleTargets?: string[] | null;
    muscleLessens?: string[] | null;
    includeExercises?: string[] | null;
    avoidExercises?: string[] | null;
    avoidJoints?: string[] | null;
    sessionGoal?: string | null;
  } | null;
  isNew?: boolean;
}

export function SessionLobbyScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { businessId, isLoading: isBusinessLoading } = useBusiness();
  const sessionId = navigation.getParam('sessionId');
  const prefetchedData = navigation.getParam('prefetchedData');
  const isNewSession = navigation.getParam('isNewSession');
  
  const [clients, setClients] = useState<CheckedInClient[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [isStartingSession, setIsStartingSession] = useState(false);
  // Initialize hasLoadedInitialData based on whether this is a new session
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(() => {
    const initialValue = isNewSession === true;
    return initialValue;
  });
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<Date | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>(() => {
    const initialState = isNewSession ? 'connected' : 'connecting';
    return initialState;
  });

  // Query session data if not in prefetchedData
  const { data: sessionData } = useQuery({
    ...api.trainingSession.getById.queryOptions({ id: sessionId || '' }),
    enabled: !!sessionId && !prefetchedData?.session,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Use prefetched session data if available, otherwise use queried data
  const currentSession = prefetchedData?.session || sessionData;
  const templateType = currentSession?.templateType;

  // Set up polling for checked-in clients (3 second interval)
  const queryOptions = sessionId 
    ? api.trainingSession.getCheckedInClients.queryOptions({ sessionId })
    : {
        queryKey: ['disabled-getCheckedInClients'],
        queryFn: () => Promise.resolve([]),
        enabled: false
      };

  const { data: polledClients, isLoading, error: fetchError } = useQuery({
    ...queryOptions,
    enabled: !!sessionId,
    refetchInterval: 10000, // Poll every 10 seconds
    refetchIntervalInBackground: true, // Keep polling even when tab is not focused
  });

  // Log critical errors only
  useEffect(() => {
    if (fetchError) {
      console.error('[TV SessionLobby] Critical error fetching clients:', fetchError.message);
    }
  }, [fetchError]);

  // Initialize with pre-fetched data if available
  useEffect(() => {
    if (prefetchedData?.checkedInClients && !hasLoadedInitialData) {
      setClients(prefetchedData.checkedInClients);
      setHasLoadedInitialData(true);
      setConnectionState('connected');
      setLastSuccessfulFetch(new Date());
    } else if (isNewSession && !hasLoadedInitialData) {
      setClients([]);
      setHasLoadedInitialData(true);
      setConnectionState('connected');
    }
  }, [prefetchedData, isNewSession, hasLoadedInitialData]);

  // Clear clients when sessionId changes
  useEffect(() => {
    if (!prefetchedData?.checkedInClients) {
      setClients([]);
      setHasLoadedInitialData(false);
    }
  }, [sessionId, prefetchedData]);

  // Update clients from polling data
  useEffect(() => {
    if (!isLoading && polledClients !== undefined) {
      setHasLoadedInitialData(true);
      
      // Update last successful fetch timestamp on success
      if (!fetchError) {
        const now = new Date();
        setLastSuccessfulFetch(now);
        setConnectionState('connected');
      }
      
      // Update clients list from polling, preserving the isNew flag for recently added clients
      setClients(prev => {
        const newClientIds = new Set(prev.filter(c => c.isNew).map(c => c.userId));
        
        return (polledClients || []).map((client: any) => ({
          ...client,
          preferences: client.preferences,
          status: client.status,
          isNew: newClientIds.has(client.userId) // Preserve animation flag
        }));
      });
    }
  }, [polledClients, isLoading, fetchError]);
  
  // Handle fetch errors
  useEffect(() => {
    if (fetchError && !isLoading) {
      setConnectionState('error');
    }
  }, [fetchError, isLoading]);

  // Handle new check-ins from real-time
  const handleCheckIn = useCallback((event: { userId: string; name: string; checkedInAt: string; status?: string }) => {
    setClients(prev => {
      // Check if client already exists
      const exists = prev.some(client => client.userId === event.userId);
      if (exists) {
        return prev;
      }
      
      // Add new client at the beginning with animation flag
      return [{
        userId: event.userId,
        userName: event.name,
        userEmail: '', // We don't have email from the event
        checkedInAt: new Date(event.checkedInAt),
        preferences: null,
        status: event.status || 'checked_in', // Preserve status if provided
        isNew: true
      }, ...prev];
    });
    
    // Remove the "new" flag after animation completes
    setTimeout(() => {
      setClients(prev => 
        prev.map(client => ({ ...client, isNew: false }))
      );
    }, 1000);
  }, []);

  // Set up real-time subscription
  const { isConnected, error: realtimeError } = useRealtimeCheckIns({
    sessionId: sessionId || '',
    onCheckIn: handleCheckIn,
    onError: (err) => console.error('[TV SessionLobby] Critical realtime subscription error:', err)
  });

  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
  }, [isConnected]);

  // Common props for both lobby components
  const lobbyProps = {
    sessionId: sessionId || '',
    currentSession,
    clients,
    isLoading,
    fetchError,
    hasLoadedInitialData,
    isNewSession: isNewSession || false,
    connectionState,
    lastSuccessfulFetch,
    isConnected,
    isStartingSession,
    setIsStartingSession,
  };

  return templateType === 'circuit' ? (
    <CircuitLobbyComponent {...lobbyProps} />
  ) : (
    <StrengthLobbyComponent {...lobbyProps} />
  );
}