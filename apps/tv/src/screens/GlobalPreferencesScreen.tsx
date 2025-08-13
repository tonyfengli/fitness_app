import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useNavigation } from '../App';
import { useQuery } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimePreferences } from '../hooks/useRealtimePreferences';

interface ClientPreference {
  userId: string;
  userName: string | null;
  userEmail: string;
  preferences: {
    intensity?: string | null;
    muscleTargets?: string[] | null;
    muscleLessens?: string[] | null;
    sessionGoal?: string | null;
    includeFinisher?: boolean | null;
  } | null;
  isReady: boolean;
  notes?: string | null;
}

export function GlobalPreferencesScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const [clients, setClients] = useState<ClientPreference[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting'>('connecting');

  // Fetch initial preferences - using checked-in clients data
  const { data: clientsData, isLoading } = useQuery(
    sessionId ? api.trainingSession.getCheckedInClients.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ['disabled'],
      queryFn: () => Promise.resolve([])
    }
  );

  // Set up real-time updates
  const { isConnected } = useRealtimePreferences({
    sessionId: sessionId || '',
    onPreferenceUpdate: (event) => {
      console.log('[TV GlobalPreferences] Preference update:', event);
      setClients(prev => prev.map(client => 
        client.userId === event.userId 
          ? { ...client, preferences: event.preferences, isReady: event.isReady }
          : client
      ));
    },
    onError: (err) => console.error('[TV GlobalPreferences] Realtime error:', err)
  });

  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'connecting');
  }, [isConnected]);

  useEffect(() => {
    if (clientsData) {
      console.log('[TV GlobalPreferences] Setting initial data:', clientsData);
      // Transform the checked-in clients data to match our preference structure
      const transformedData: ClientPreference[] = clientsData.map((client: any) => {
        // Parse workoutType to determine sessionGoal and includeFinisher
        const workoutType = client.preferences?.workoutType || 'full_body_with_finisher';
        const includeFinisher = workoutType.includes('with_finisher');
        const sessionGoal = workoutType.includes('targeted') ? 'targeted' : 'full-body';
        
        return {
          userId: client.userId,
          userName: client.userName,
          userEmail: client.userEmail,
          preferences: {
            ...client.preferences,
            sessionGoal,
            includeFinisher
          },
          isReady: false,
          notes: null
        };
      });
      setClients(transformedData);
    }
  }, [clientsData]);

  const getAvatarUrl = (userId: string) => {
    return `https://api.dicebear.com/7.x/avataaars/png?seed=${userId}&size=128`;
  };

  const getExerciseCount = (intensity?: string | null) => {
    switch (intensity?.toLowerCase()) {
      case 'low': return 5;
      case 'moderate': return 12;
      case 'high': return 18;
      case 'intense': return 24;
      default: return 12;
    }
  };

  const renderSectionNumber = (number: number, isReady: boolean) => (
    <View className={`w-6 h-6 rounded-full items-center justify-center ${
      isReady ? 'bg-blue-500' : 'bg-gray-300'
    }`}>
      <Text className={`text-xs font-bold ${isReady ? 'text-white' : 'text-gray-600'}`}>
        {number}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-tv-lg text-gray-600 mt-4">Loading preferences...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Connection Status */}
      <View className="absolute top-4 left-4 flex-row items-center z-10">
        <View className={`w-2 h-2 rounded-full mr-2 ${
          connectionStatus === 'connected' ? 'bg-green-500' : 'bg-gray-400'
        }`} />
        <Text className="text-sm text-gray-600">
          {connectionStatus === 'connected' ? 'Live updates active' : 'Connecting...'}
        </Text>
      </View>

      {/* Client Cards Grid */}
      <View className="flex-1 px-6 py-8">
        <View className={`flex-1 flex-row flex-wrap ${clients.length > 4 ? 'content-center' : ''}`}>
          {clients.map((client, index) => {
            // Adjust size based on number of clients
            const cardSizeClass = clients.length <= 4 ? "w-1/2 h-1/2" : "w-1/3 h-2/5";
            const isCompact = clients.length > 4;
            
            return (
            <View key={client.userId} className={`${cardSizeClass} p-2`}>
              <View className={`bg-white h-full flex ${
                client.isReady ? 'border-2 border-blue-400' : ''
              } shadow-lg`} style={{
                borderRadius: 12,
                overflow: 'hidden',
                ...(!client.isReady && {
                  borderWidth: 0.5,
                  borderColor: '#e5e7eb'
                })
              }}>
                
                {/* Ready Badge */}
                {client.isReady && (
                  <View className="absolute -top-2 -right-2 bg-blue-500 px-3 py-1 rounded-full">
                    <Text className="text-white text-xs font-medium">Ready</Text>
                  </View>
                )}

                {/* Header Section */}
                <View className={`${isCompact ? 'px-3 py-1' : 'px-4 py-2'} flex-row items-center`} style={{ 
                  backgroundColor: '#f9fafb',
                  borderBottomWidth: 0.5, 
                  borderBottomColor: '#e5e7eb',
                  borderTopLeftRadius: 12,
                  borderTopRightRadius: 12
                }}>
                  <Image 
                    source={{ uri: getAvatarUrl(client.userId) }}
                    className={isCompact ? "w-6 h-6 rounded-full" : "w-8 h-8 rounded-full"}
                  />
                  <Text className={`${isCompact ? 'text-sm' : 'text-base'} font-semibold text-gray-900 ${isCompact ? 'ml-2' : 'ml-3'}`}>
                    {client.userName || 'Unknown'}
                  </Text>
                </View>

                {/* Content Sections */}
                <View className="flex-1" style={{ overflow: 'hidden' }}>
                  {/* Section 1: Workout Type */}
                  <View className="flex-1 px-3 justify-center" style={{ borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' }}>
                    <View className="flex-row items-center">
                      <View className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full items-center justify-center ${isCompact ? 'mr-2' : 'mr-3'} ${
                        client.isReady ? 'bg-indigo-600' : 'bg-gray-50'
                      }`}>
                        <Text className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-bold ${client.isReady ? 'text-white' : 'text-gray-700'}`}>
                          1
                        </Text>
                      </View>
                      <Text className={`${isCompact ? 'text-xs' : 'text-sm'} text-gray-700`}>
                        {client.preferences?.sessionGoal === 'targeted' ? 'Targeted' : 'Full Body'} • {client.preferences?.includeFinisher ? 'With Finisher' : 'Without Finisher'}
                      </Text>
                    </View>
                  </View>

                  {/* Section 2: Muscle Targets */}
                  <View className="flex-1 px-3 justify-center" style={{ borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' }}>
                    <View className="flex-row items-center">
                      <View className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full items-center justify-center ${isCompact ? 'mr-2' : 'mr-3'} ${
                        client.isReady ? 'bg-indigo-600' : 'bg-gray-50'
                      }`}>
                        <Text className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-bold ${client.isReady ? 'text-white' : 'text-gray-700'}`}>
                          2
                        </Text>
                      </View>
                      <View className="flex-1">
                        {client.preferences?.muscleTargets && client.preferences.muscleTargets.length > 0 ? (
                          <View className="flex-row flex-wrap">
                            {client.preferences.muscleTargets.map((muscle) => (
                              <View key={muscle} className={`bg-blue-100 ${isCompact ? 'px-2 py-0.5' : 'px-3 py-1'} rounded-full mr-2 mb-2`}>
                                <Text className={`${isCompact ? 'text-xs' : 'text-sm'} text-blue-700 font-medium`}>{muscle}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text className={`${isCompact ? 'text-xs' : 'text-sm'} text-gray-700`}>No muscle targets</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Section 3: Muscle Limits */}
                  <View className="flex-1 px-3 justify-center" style={{ borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' }}>
                    <View className="flex-row items-center">
                      <View className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full items-center justify-center ${isCompact ? 'mr-2' : 'mr-3'} ${
                        client.isReady ? 'bg-indigo-600' : 'bg-gray-50'
                      }`}>
                        <Text className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-bold ${client.isReady ? 'text-white' : 'text-gray-700'}`}>
                          3
                        </Text>
                      </View>
                      <View className="flex-1">
                        {client.preferences?.muscleLessens && client.preferences.muscleLessens.length > 0 ? (
                          <View className="flex-row flex-wrap">
                            {client.preferences.muscleLessens.map((muscle) => (
                              <View key={muscle} className={`bg-red-100 ${isCompact ? 'px-2 py-0.5' : 'px-3 py-1'} rounded-full mr-2 mb-2`}>
                                <Text className={`${isCompact ? 'text-xs' : 'text-sm'} text-red-700 font-medium`}>{muscle}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text className={`${isCompact ? 'text-xs' : 'text-sm'} text-gray-700`}>No muscle limits</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Section 4: Intensity */}
                  <View className="flex-1 px-3 justify-center" style={{
                    borderBottomLeftRadius: 12,
                    borderBottomRightRadius: 12
                  }}>
                    <View className="flex-row items-center">
                      <View className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full items-center justify-center ${isCompact ? 'mr-2' : 'mr-3'} ${
                        client.isReady ? 'bg-indigo-600' : 'bg-gray-50'
                      }`}>
                        <Text className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-bold ${client.isReady ? 'text-white' : 'text-gray-700'}`}>
                          4
                        </Text>
                      </View>
                      <Text className={`${isCompact ? 'text-xs' : 'text-sm'} text-gray-700`}>
                        {(client.preferences?.intensity || 'Moderate').charAt(0).toUpperCase() + 
                         (client.preferences?.intensity || 'Moderate').slice(1)} ({getExerciseCount(client.preferences?.intensity)} exercises)
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}