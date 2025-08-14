import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../App';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimeExerciseSwaps } from '@acme/ui-shared';
import { supabase } from '../lib/supabase';

interface ExerciseSelection {
  id: string;
  sessionId: string;
  clientId: string;
  exerciseId: string;
  exerciseName: string;
  isShared: boolean;
  sharedWithClients: any;
  selectionSource: string;
}

interface GroupedSelections {
  [clientId: string]: {
    clientName: string;
    exercises: ExerciseSelection[];
  };
}

export function WorkoutOverviewScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const queryClient = useQueryClient();
  const [lastSwapTime, setLastSwapTime] = useState<Date | null>(null);

  // Use real-time exercise swap updates
  const { isConnected: swapUpdatesConnected } = useRealtimeExerciseSwaps({
    sessionId: sessionId || '',
    supabase,
    onSwapUpdate: (swap) => {
      console.log('[TV WorkoutOverview] Exercise swap detected:', swap);
      setLastSwapTime(new Date());
      
      // Force refetch of exercise selections
      queryClient.invalidateQueries({
        queryKey: [
          [
            "workoutSelections",
            "getSelections"
          ],
          {
            input: {
              sessionId: sessionId
            },
            type: "query"
          }
        ]
      });
      
      // Also invalidate the specific hook's query
      queryClient.refetchQueries({
        predicate: (query) => {
          const queryKey = query.queryKey as any[];
          return queryKey[0] && 
                 Array.isArray(queryKey[0]) && 
                 queryKey[0][0] === 'workoutSelections' && 
                 queryKey[0][1] === 'getSelections';
        }
      });
    },
    onError: (error) => {
      console.error('[TV WorkoutOverview] Real-time swap error:', error);
    }
  });

  // Fetch exercise selections using the same pattern as webapp
  const { data: selections, isLoading: selectionsLoading } = useQuery(
    sessionId ? api.workoutSelections.getSelections.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ['disabled'],
      queryFn: () => Promise.resolve([])
    }
  );

  // Fetch client information
  const { data: clients, isLoading: clientsLoading } = useQuery(
    sessionId ? api.trainingSession.getCheckedInClients.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ['disabled'],
      queryFn: () => Promise.resolve([])
    }
  );

  const getAvatarUrl = (userId: string) => {
    return `https://api.dicebear.com/7.x/avataaars/png?seed=${userId}&size=128`;
  };

  // Group selections by client
  const groupedSelections = React.useMemo(() => {
    if (!selections || !clients) return {};

    const grouped: GroupedSelections = {};
    
    // Initialize with all clients
    clients.forEach(client => {
      grouped[client.userId] = {
        clientName: client.userName || 'Unknown',
        exercises: []
      };
    });

    // Add exercises to each client
    selections.forEach(selection => {
      if (grouped[selection.clientId]) {
        grouped[selection.clientId].exercises.push(selection);
      }
    });

    return grouped;
  }, [selections, clients]);

  const isLoading = selectionsLoading || clientsLoading;

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-tv-lg text-gray-600 mt-4">Loading workout...</Text>
      </View>
    );
  }

  const clientEntries = Object.entries(groupedSelections);

  return (
    <View className="flex-1" style={{ backgroundColor: '#121212' }}>
      {/* Header */}
      <View className="px-8 py-6 flex-row justify-between items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
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
            borderColor: focused ? '#3b82f6' : 'transparent',
            backgroundColor: focused ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            transform: focused ? [{ scale: 1.05 }] : [{ scale: 1 }],
          })}
        >
          <Icon name="arrow-back" size={24} color="#E0E0E0" />
          <Text className="ml-2 text-lg text-gray-200">
            Back
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => navigation.navigate('WorkoutLive', { sessionId, round: 1 })}
          activeOpacity={0.7}
          tvParallaxProperties={{
            enabled: true,
            shiftDistanceX: 2,
            shiftDistanceY: 2,
          }}
          className="px-6 py-2.5 bg-green-600 rounded-lg"
        >
          <Text className="text-white font-semibold">Start Workout</Text>
        </TouchableOpacity>
      </View>

      {/* Client Cards Grid */}
      <View className="flex-1 px-8 pb-12">
        <View className={`flex-1 flex-row flex-wrap ${clientEntries.length > 4 ? 'items-center content-center' : 'items-start content-start'}`}>
          {clientEntries.map(([clientId, clientData]) => {
            const cardSizeClass = clientEntries.length <= 4 ? "w-1/2" : "w-1/3";
            const isCompact = clientEntries.length > 4;
            
            return (
              <View key={clientId} className={`${cardSizeClass} p-2`} style={clientEntries.length <= 4 ? { height: '55%' } : { height: '48%' }}>
                <View className="h-full flex" style={{
                  backgroundColor: '#1F2937',
                  borderRadius: 12,
                  borderWidth: 0,
                }}>
                  {/* Header Section */}
                  <View className="px-5 py-2.5 flex-row items-center">
                    <Image 
                      source={{ uri: getAvatarUrl(clientId) }}
                      className="w-8 h-8 rounded-full mr-3"
                    />
                    <Text className="text-lg font-semibold text-white">
                      {clientData.clientName}
                    </Text>
                  </View>

                  {/* Exercises List - Two Column Layout */}
                  <View className="flex-1 px-5 pt-2 pb-3">
                    {clientData.exercises.length > 0 ? (
                      <View className="flex-row flex-wrap">
                        {clientData.exercises.slice(0, 6).map((exercise, index) => {
                          // Show only first 6, or 5 if there are 7+ exercises
                          const showMax = clientData.exercises.length > 6 ? 5 : 6;
                          if (index >= showMax) return null;
                          
                          return (
                            <View key={exercise.id} className="w-1/2 pr-2 mb-2.5" style={{ flexShrink: 1, minWidth: 0 }}>
                              <Text 
                                className="text-white" 
                                style={{ 
                                  fontSize: isCompact ? 12 : 13,
                                  lineHeight: isCompact ? 16 : 18,
                                }}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {exercise.exerciseName}
                              </Text>
                            </View>
                          );
                        })}
                        {/* Show +N more indicator if there are more than 6 exercises */}
                        {clientData.exercises.length > 6 && (
                          <View className="w-1/2 pr-2 mb-2.5">
                            <View className="bg-gray-700 px-3 py-1 rounded-full self-start">
                              <Text className="text-gray-300 text-xs font-semibold">
                                +{clientData.exercises.length - 5} more
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View className="flex-1 items-center justify-center">
                        <Text className="text-gray-500 text-base">
                          No exercises selected yet
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
      
      {/* Connection Status - Bottom Left */}
      <View className="absolute bottom-6 left-8 flex-row items-center">
        <View className={`w-2 h-2 rounded-full mr-2 ${
          swapUpdatesConnected ? 'bg-green-400' : 'bg-gray-400'
        }`} />
        <Text className="text-sm text-gray-400">
          {swapUpdatesConnected ? 'Live updates active' : 'Connecting...'}
        </Text>
      </View>
    </View>
  );
}