import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, Alert, View, Text, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../App';
import { useBusiness } from '../providers/BusinessProvider';
import { supabase } from '../lib/supabase';
import { useQuery } from '@tanstack/react-query';
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
  const { businessId } = useBusiness();
  const sessionId = navigation.getParam('sessionId');
  const [clients, setClients] = useState<CheckedInClient[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');

  // Fetch initial checked-in clients using TRPC
  const { data: initialClients, isLoading } = useQuery(
    sessionId ? api.trainingSession.getCheckedInClients.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ['disabled'],
      queryFn: () => Promise.resolve([])
    }
  );

  // Set initial clients when data loads
  useEffect(() => {
    if (initialClients) {
      setClients(initialClients.map(client => ({
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

  const handleStartSession = () => {
    navigation.navigate('GlobalPreferences', { sessionId });
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
                .eq('business_id', businessId)
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
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white shadow-sm">
        <View className="px-6 py-4">
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={handleCloseSession}
                className="flex-row items-center"
                activeOpacity={0.7}
              >
                <Icon name="close" size={24} color="#6b7280" />
                <Text className="ml-2 text-lg font-medium text-black">
                  Close Session
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={handleStartSession}
              className="bg-sky-600 px-6 py-2.5 rounded-lg"
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold">Start Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <View className="flex-1 px-6 pt-6">
        {/* Clients Area */}
        <View className="bg-white rounded-xl shadow-lg flex-1">
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-gray-600">Loading clients...</Text>
            </View>
          ) : clients.length === 0 ? (
            <View className="flex-1 items-center justify-center p-12">
              {/* Icon placeholder - smaller size */}
              <View className="bg-gray-100 rounded-full w-20 h-20 items-center justify-center mb-4">
                <Icon name="group-off" size={40} color="#9ca3af" />
              </View>
              
              <Text className="text-base text-gray-500 text-center">
                No one is checked in yet
              </Text>
            </View>
          ) : (
            <ScrollView className="flex-1">
              {clients.map((client) => (
                <View 
                  key={client.userId} 
                  className={`px-6 py-4 border-b border-gray-200 ${
                    client.isNew ? 'bg-green-50' : ''
                  }`}
                >
                  <View className="flex-row items-center">
                    {/* DiceBear Avatar - using PNG format */}
                    <Image
                      source={{ uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${client.userId}&size=40` }}
                      style={{ width: 40, height: 40, borderRadius: 20, marginRight: 16 }}
                    />
                    
                    {/* Name only - extract first name */}
                    <View className="flex-1">
                      <Text className="text-base font-medium text-gray-900">
                        {client.userName ? client.userName.split(' ')[0] : 'Unknown'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Footer */}
      <View className="px-6 py-6">
        <View className="bg-white rounded-xl shadow p-6">
          <View className="flex-row items-center justify-between">
            {/* Connection status */}
            <View className="flex-row items-center">
              <View 
                className={`w-3 h-3 rounded-full mr-2 ${
                  connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                }`} 
              />
              <Text className="text-sm text-gray-600">
                {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
            
            {/* Check-in instructions - always show on the right */}
            <View className="flex-row items-center">
              <Text className="text-sm text-gray-700">
                Text <Text className="font-semibold text-sky-600">'here'</Text> to{' '}
                <Text className="font-semibold text-sky-600">562-608-1666</Text>
              </Text>
              <Text className="text-base ml-2">🎉</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}