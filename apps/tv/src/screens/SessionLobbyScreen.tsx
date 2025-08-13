import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, Alert, View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../App';
import { useBusiness } from '../providers/BusinessProvider';
import { supabase } from '../lib/supabase';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimeCheckIns } from '../hooks/useRealtimeCheckIns';

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
    <View className="flex-1" style={{ backgroundColor: '#121212' }}>
      {/* Header */}
      <View className="px-8 py-6">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={handleCloseSession}
              activeOpacity={0.7}
              tvParallaxProperties={{
                enabled: true,
                shiftDistanceX: 2,
                shiftDistanceY: 2,
              }}
              style={({ focused }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: focused ? '#ef4444' : 'transparent',
                backgroundColor: focused ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                transform: focused ? [{ scale: 1.05 }] : [{ scale: 1 }],
              })}
            >
              <Icon name="close" size={24} color="#E0E0E0" />
              <Text className="ml-2 text-lg text-gray-200">
                Close Session
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={handleStartSession}
            className={`px-6 py-2.5 rounded-lg ${
              isStartingSession || clients.length === 0
                ? 'bg-gray-700'
                : 'bg-sky-600'
            }`}
            activeOpacity={0.8}
            disabled={isStartingSession || clients.length === 0}
          >
            {isStartingSession ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                <Text className="text-white font-semibold">Starting...</Text>
              </View>
            ) : (
              <Text className="text-white font-semibold">Start Session</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View className="flex-1 px-8">
        {/* Clients Area */}
        <View className="rounded-xl flex-1" style={{ backgroundColor: '#1F2937' }}>
          {fetchError ? (
            <View className="flex-1 items-center justify-center p-12">
              <Text className="text-red-400">Error loading clients</Text>
              <Text className="text-gray-400 text-sm mt-2">{fetchError.message || 'Unknown error'}</Text>
            </View>
          ) : isLoading ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-gray-400">Loading clients...</Text>
            </View>
          ) : clients.length === 0 ? (
            <View className="flex-1 items-center justify-center p-12">
              {/* Icon placeholder - smaller size */}
              <View className="bg-gray-800 rounded-full w-20 h-20 items-center justify-center mb-4">
                <Icon name="group-off" size={40} color="#6b7280" />
              </View>
              
              <Text className="text-base text-gray-400 text-center">
                No one is checked in yet
              </Text>
            </View>
          ) : (
            <ScrollView className="flex-1">
              {clients.map((client) => (
                <View 
                  key={client.userId} 
                  className={`px-6 py-4 border-b border-gray-700 ${
                    client.isNew ? 'bg-green-900 bg-opacity-20' : ''
                  }`}
                >
                  <View className="flex-row items-center">
                    {/* DiceBear Avatar - using PNG format */}
                    <Image
                      source={{ uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${client.userId}&size=128` }}
                      style={{ width: 32, height: 32, borderRadius: 16, marginRight: 16, alignSelf: 'center' }}
                    />
                    
                    {/* Name only - extract first name */}
                    <View className="flex-1">
                      <Text className="text-base font-medium text-white">
                        {client.userName ? client.userName.split(' ')[0] : 'Unknown'}
                      </Text>
                    </View>
                    
                    {/* Checked in status */}
                    <View className="flex-row items-center">
                      <View className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                      <Text className="text-sm text-gray-400">Checked in</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Footer */}
      <View className="px-8 py-6">
        <View className="rounded-xl p-6" style={{ backgroundColor: '#1F2937' }}>
          <View className="flex-row items-center justify-between">
            {/* Connection status */}
            <View className="flex-row items-center">
              <View 
                className={`w-3 h-3 rounded-full mr-2 ${
                  connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
                }`} 
              />
              <Text className="text-sm text-gray-400">
                {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
            
            {/* Check-in instructions - always show on the right */}
            <View className="flex-row items-center">
              <Text className="text-sm text-gray-300">
                Text <Text className="font-semibold text-sky-400">'here'</Text> to{' '}
                <Text className="font-semibold text-sky-400">562-608-1666</Text>
              </Text>
              <Text className="text-base ml-2">🎉</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}