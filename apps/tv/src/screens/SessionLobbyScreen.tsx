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
  const { businessId, isLoading: isBusinessLoading } = useBusiness();
  const sessionId = navigation.getParam('sessionId');
  const [clients, setClients] = useState<CheckedInClient[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [isStartingSession, setIsStartingSession] = useState(false);

  // Fetch initial checked-in clients using TRPC
  const { data: initialClients, isLoading, error: fetchError } = useQuery(
    sessionId ? api.trainingSession.getCheckedInClients.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ['disabled'],
      queryFn: () => Promise.resolve([])
    }
  );

  // Debug logging
  useEffect(() => {
    console.log('[TV SessionLobby] Data state:', {
      sessionId,
      isLoading,
      fetchError,
      initialClients,
      clientsCount: clients.length
    });
  }, [sessionId, isLoading, fetchError, initialClients, clients]);

  // Clear clients when sessionId changes
  useEffect(() => {
    console.log('[TV SessionLobby] Session changed, clearing clients. New sessionId:', sessionId);
    setClients([]);
  }, [sessionId]);

  // Set initial clients when data loads
  useEffect(() => {
    if (initialClients && initialClients.length > 0) {
      console.log('[TV SessionLobby] Setting clients from initial data:', initialClients);
      setClients(initialClients.map((client: any) => ({
        ...client,
        preferences: client.preferences
      })));
    }
  }, [initialClients]);

  // Handle new check-ins from real-time
  const handleCheckIn = useCallback((event: { userId: string; name: string; checkedInAt: string }) => {
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

  const handleCloseSession = async () => {
    if (!sessionId) return;
    
    Alert.alert(
      'Close Session',
      'Are you sure you want to close this session? This will cancel the session and return to the welcome screen.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Close Session',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('training_session')
                .update({ status: 'cancelled' })
                .eq('id', sessionId)
                .eq('business_id', businessId!)
                .eq('status', 'open');
              
              if (error) {
                throw error;
              }
              
              navigation.navigate('Main');
            } catch (error) {
              console.error('[SessionLobby] Error cancelling session:', error);
              Alert.alert('Error', 'Failed to close the session. Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: TOKENS.color.bg, padding: 24 }}>
      {/* Header */}
      <View className="mb-6">
        <View className="flex-row justify-between items-center">
          <Pressable
            onPress={handleCloseSession}
            focusable
          >
            {({ focused }) => (
              <MattePanel 
                focused={focused}
                style={{ 
                  paddingHorizontal: 32,
                  paddingVertical: 12,
                }}
              >
                {/* Focus ring */}
                {focused && (
                  <View pointerEvents="none" style={{
                    position: 'absolute', 
                    inset: -1,
                    borderRadius: TOKENS.radius.card,
                    borderWidth: 2, 
                    borderColor: TOKENS.color.focusRing,
                  }}/>
                )}
                <Text style={{ color: TOKENS.color.text, fontWeight: '700', fontSize: 18 }}>Close</Text>
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
                  }}
                >
                  {/* Optional focus ring */}
                  {focused && !isDisabled && (
                    <View pointerEvents="none" style={{
                      position: 'absolute', 
                      inset: -1,
                      borderRadius: TOKENS.radius.card,
                      borderWidth: 2, 
                      borderColor: TOKENS.color.focusRing,
                    }}/>
                  )}
                  
                  {isStartingSession ? (
                    <View className="flex-row items-center">
                      <ActivityIndicator size="small" color={TOKENS.color.text} style={{ marginRight: 8 }} />
                      <Text style={{ color: TOKENS.color.text, fontWeight: '700', fontSize: 18 }}>Starting...</Text>
                    </View>
                  ) : (
                    <Text style={{ 
                      color: isDisabled ? TOKENS.color.muted : TOKENS.color.text, 
                      fontWeight: '700', 
                      fontSize: 18 
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
              <Text style={{ color: '#ef4444' }}>Error loading clients</Text>
              <Text style={{ color: TOKENS.color.muted, fontSize: 14, marginTop: 8 }}>{fetchError.message || 'Unknown error'}</Text>
            </View>
          ) : isLoading ? (
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
                connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
              }`} 
            />
            <Text style={{ fontSize: 16, color: TOKENS.color.text }}>
              {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
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