import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, Alert, View, Text, TouchableOpacity, Image, ActivityIndicator, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../App';
import { useBusiness } from '../providers/BusinessProvider';
import { supabase } from '../lib/supabase';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimeCheckIns } from '../hooks/useRealtimeCheckIns';

// Design tokens - matching WorkoutLive screen
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

// Matte panel helper component - matching WorkoutLive screen
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

// Helper function to format time in 12-hour format with AM/PM
function formatTime12Hour(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  
  return `${hours12}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
}

export function SessionLobbyScreen() {
  const navigation = useNavigation();
  const { businessId, isLoading: isBusinessLoading } = useBusiness();
  const sessionId = navigation.getParam('sessionId');
  const [clients, setClients] = useState<CheckedInClient[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<Date | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');

  // Set up polling for checked-in clients (3 second interval)
  const queryOptions = sessionId 
    ? api.trainingSession.getCheckedInClients.queryOptions({ sessionId })
    : null;

  const { data: polledClients, isLoading, error: fetchError } = useQuery({
    ...queryOptions,
    enabled: !!sessionId && !!queryOptions,
    refetchInterval: 10000, // Poll every 10 seconds
    refetchIntervalInBackground: true, // Keep polling even when tab is not focused
  });

  // Debug logging
  useEffect(() => {
    console.log('[TV SessionLobby] Data state:', {
      sessionId,
      isLoading,
      fetchError,
      polledClients,
      clientsCount: clients.length
    });
    
    if (fetchError) {
      console.error('[TV SessionLobby] ❌ Fetch error details:');
      console.error('[TV SessionLobby] Error message:', fetchError.message);
      console.error('[TV SessionLobby] Error stack:', fetchError.stack);
      console.error('[TV SessionLobby] Full error:', fetchError);
    }
  }, [sessionId, isLoading, fetchError, polledClients, clients]);

  // Clear clients when sessionId changes
  useEffect(() => {
    console.log('[TV SessionLobby] Session changed, clearing clients. New sessionId:', sessionId);
    setClients([]);
    setHasLoadedInitialData(false);
  }, [sessionId]);

  // Update clients from polling data
  useEffect(() => {
    if (!isLoading && polledClients !== undefined) {
      console.log('[TV SessionLobby] Updating clients from polled data:', polledClients?.length || 0, 'clients');
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
      console.log('[TV SessionLobby] Fetch error detected:', fetchError);
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
    onError: (err) => console.error('[TV SessionLobby] Realtime error:', err)
  });

  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
  }, [isConnected]);

  // Send session start messages mutation
  const sendStartMessagesMutation = useMutation({
    ...api.trainingSession.sendSessionStartMessages.mutationOptions(),
    onSuccess: (data) => {
      console.log('[TV SessionLobby] SMS send result:', data);
      // Navigate to preferences after successful SMS send
      navigation.navigate('GlobalPreferences', { sessionId });
    },
    onError: (error: any) => {
      console.error('[TV SessionLobby] Failed to send start messages:', error);
      setIsStartingSession(false);
      Alert.alert(
        'Error',
        'Failed to send start messages. Would you like to continue anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => navigation.navigate('GlobalPreferences', { sessionId })
          }
        ]
      );
    },
    onSettled: () => {
      setIsStartingSession(false);
    }
  });

  const handleStartSession = async () => {
    if (!sessionId) return;
    
    setIsStartingSession(true);
    
    // Send start messages (SMS) to checked-in clients
    sendStartMessagesMutation.mutate({ sessionId });
  };

  const handleBack = () => {
    console.log('[SessionLobby] Navigating back to MainScreen');
    navigation.goBack();
  };

  return (
    <View className="flex-1" style={{ backgroundColor: TOKENS.color.bg, padding: 24 }}>
      {/* Header */}
      <View className="mb-6">
        <View className="flex-row justify-between items-center">
          <Pressable
            onPress={handleBack}
            focusable
          >
            {({ focused }) => (
              <MattePanel 
                focused={focused}
                style={{ 
                  paddingHorizontal: 32,
                  paddingVertical: 12,
                  backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                  borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                  borderWidth: focused ? 1 : 1,
                  transform: focused ? [{ translateY: -1 }] : [],
                }}
              >
                <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>Back</Text>
              </MattePanel>
            )}
          </Pressable>
          <Pressable
            onPress={handleStartSession}
            focusable
            disabled={isStartingSession || clients.length === 0}
          >
            {({ focused }) => {
              const isDisabled = isStartingSession || clients.length === 0;
              return (
                <MattePanel 
                  focused={focused}
                  style={{ 
                    paddingHorizontal: 32,
                    paddingVertical: 12,
                    opacity: isDisabled ? 0.5 : 1,
                    backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                    borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                    borderWidth: focused ? 1 : 1,
                    transform: focused ? [{ translateY: -1 }] : [],
                  }}
                >
                  {isStartingSession ? (
                    <View className="flex-row items-center">
                      <ActivityIndicator size="small" color={TOKENS.color.text} style={{ marginRight: 8 }} />
                      <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>Starting...</Text>
                    </View>
                  ) : (
                    <Text style={{ 
                      color: TOKENS.color.text, 
                      fontSize: 18,
                      letterSpacing: 0.2 
                    }}>
                      Start Session
                    </Text>
                  )}
                </MattePanel>
              );
            }}
          </Pressable>
        </View>
      </View>

      {/* Main Content */}
      <View className="flex-1">
        {/* Clients Area */}
        <MattePanel style={{ flex: 1, padding: 16 }}>
          {fetchError ? (
            <View className="flex-1 items-center justify-center p-12">
              {/* Error icon */}
              <View className="bg-gray-800 rounded-full w-20 h-20 items-center justify-center mb-4">
                <Icon 
                  name={
                    fetchError.message?.toLowerCase().includes('network') || 
                    fetchError.message?.toLowerCase().includes('fetch failed') ||
                    fetchError.message?.toLowerCase().includes('failed to fetch')
                      ? "wifi-off" 
                      : "error-outline"
                  } 
                  size={40} 
                  color="#ef4444" 
                />
              </View>
              
              <Text style={{ fontSize: 20, color: '#ef4444', fontWeight: '600', marginBottom: 8 }}>
                {fetchError.message?.toLowerCase().includes('network') || 
                 fetchError.message?.toLowerCase().includes('fetch failed') ||
                 fetchError.message?.toLowerCase().includes('failed to fetch')
                  ? 'No Internet Connection'
                  : fetchError.message?.toLowerCase().includes('timeout')
                  ? 'Connection Timed Out'
                  : 'Unable to Load Clients'}
              </Text>
              <Text style={{ color: TOKENS.color.muted, fontSize: 16, textAlign: 'center', paddingHorizontal: 24 }}>
                {fetchError.message?.toLowerCase().includes('network') || 
                 fetchError.message?.toLowerCase().includes('fetch failed') ||
                 fetchError.message?.toLowerCase().includes('failed to fetch')
                  ? 'Please check your internet connection'
                  : fetchError.message?.toLowerCase().includes('timeout')
                  ? 'The request took too long. Please check your connection.'
                  : fetchError.message || 'Something went wrong while loading clients'}
              </Text>
            </View>
          ) : isLoading || !hasLoadedInitialData ? (
            <View className="flex-1 items-center justify-center">
              <Text style={{ color: TOKENS.color.muted }}>Loading clients...</Text>
            </View>
          ) : clients.length === 0 ? (
            <View className="flex-1 items-center justify-center p-12">
              {/* Icon placeholder - smaller size */}
              <View className="bg-gray-800 rounded-full w-20 h-20 items-center justify-center mb-4">
                <Icon name="group-off" size={40} color={TOKENS.color.muted} />
              </View>
              
              <Text style={{ fontSize: 16, color: TOKENS.color.muted, textAlign: 'center' }}>
                No one is checked in yet
              </Text>
            </View>
          ) : (
            <ScrollView className="flex-1">
              {console.log('[TV SessionLobby] Rendering clients:', clients.length, 'total')}
              {console.log('[TV SessionLobby] Client statuses:', clients.map(c => ({ 
                userName: c.userName, 
                status: (c as any).status,
                hasStatus: 'status' in c
              })))}
              {clients.map((client) => (
                <View 
                  key={client.userId} 
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: TOKENS.color.borderGlass,
                    backgroundColor: client.isNew ? 'rgba(124, 255, 181, 0.1)' : 'transparent',
                    marginHorizontal: -16,
                    paddingHorizontal: 40,
                  }}
                >
                  <View className="flex-row items-center">
                    {/* DiceBear Avatar - using PNG format */}
                    <Image
                      source={{ uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${client.userId}&size=128` }}
                      style={{ width: 32, height: 32, borderRadius: 16, marginRight: 12, alignSelf: 'center' }}
                    />
                    
                    {/* Name only - extract first name */}
                    <View className="flex-1">
                      <Text style={{ fontSize: 16, fontWeight: '600', color: TOKENS.color.text }}>
                        {client.userName ? client.userName.split(' ')[0] : 'Unknown'}
                      </Text>
                    </View>
                    
                    {/* Checked in status */}
                    <View className="flex-row items-center">
                      <View className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                      <Text style={{ fontSize: 14, color: TOKENS.color.text }}>Checked in</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </MattePanel>
      </View>

      {/* Footer text without container */}
      <View className="mt-6 px-4">
        <View className="flex-row items-center justify-between">
          {/* Connection status */}
          <View className="flex-row items-center">
            <View 
              className={`w-3 h-3 rounded-full mr-2 ${
                connectionState === 'connecting' ? 'bg-gray-400' :
                connectionState === 'connected' ? 'bg-green-400' : 'bg-red-400'
              }`} 
            />
            <Text style={{ fontSize: 16, color: TOKENS.color.text }}>
              {connectionState === 'connecting' ? 'Connecting...' :
               connectionState === 'connected' ? `Live - ${lastSuccessfulFetch ? formatTime12Hour(lastSuccessfulFetch) : 'connecting'}` :
               `Last connected: ${lastSuccessfulFetch ? formatTime12Hour(lastSuccessfulFetch) : 'never'}`}
            </Text>
          </View>
          
          {/* Check-in instructions */}
          <View className="flex-row items-center">
            <Text style={{ fontSize: 16, color: TOKENS.color.text }}>
              Text <Text style={{ fontWeight: '600', color: TOKENS.color.text }}>'here'</Text> to{' '}
              <Text style={{ fontWeight: '600', color: TOKENS.color.text }}>562-608-1666</Text>
            </Text>
            <Text className="text-base ml-2">🎉</Text>
          </View>
        </View>
      </View>

    </View>
  );
}