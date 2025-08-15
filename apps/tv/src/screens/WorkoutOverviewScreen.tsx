import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../App';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimeExerciseSwaps } from '@acme/ui-shared';
import { supabase } from '../lib/supabase';

// Design tokens - matching other screens
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

// Matte panel helper component - matching other screens
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
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: TOKENS.color.bg }}>
        <ActivityIndicator size="large" color={TOKENS.color.accent} />
        <Text style={{ fontSize: 24, color: TOKENS.color.muted, marginTop: 16 }}>Loading workout...</Text>
      </View>
    );
  }

  const clientEntries = Object.entries(groupedSelections);

  return (
    <View className="flex-1" style={{ backgroundColor: TOKENS.color.bg, padding: 24 }}>
      {/* Header */}
      <View className="flex-row justify-between items-center mb-6">
        <Pressable
          onPress={() => navigation.goBack()}
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
              <Text style={{ color: TOKENS.color.text, fontWeight: '700', fontSize: 18 }}>Back</Text>
            </MattePanel>
          )}
        </Pressable>
        
        <Pressable
          onPress={() => navigation.navigate('WorkoutLive', { sessionId, round: 1 })}
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
              <Text style={{ color: TOKENS.color.text, fontWeight: '700', fontSize: 18 }}>Start Workout</Text>
            </MattePanel>
          )}
        </Pressable>
      </View>

      {/* Client Cards Grid */}
      <View className="flex-1">
        {clientEntries.length === 5 ? (
          // Special layout for 5 clients: 3 on top, 2 on bottom
          <View className="flex-1" style={{ gap: 12 }}>
            {/* Top row - 3 cards */}
            <View className="flex-row" style={{ flex: 1, gap: 12 }}>
              {clientEntries.slice(0, 3).map(([clientId, clientData]) => {
                const isCompact = true; // Always compact for 5-client layout
                return (
                  <View key={clientId} style={{ flex: 1 }}>
                    <MattePanel style={{ flex: 1, padding: 12 }}>
                    {/* Header Section */}
                    <View className="flex-row items-center" style={{ marginBottom: 12 }}>
                      <Image 
                        source={{ uri: getAvatarUrl(clientId) }}
                        style={{ 
                          width: 36, 
                          height: 36, 
                          borderRadius: 18, 
                          marginRight: 12 
                        }}
                      />
                      <Text style={{ fontSize: 18, fontWeight: '600', color: TOKENS.color.text }}>
                        {clientData.clientName}
                      </Text>
                    </View>

                    {/* Exercises List - Two Column Layout */}
                    <View className="flex-1">
                      {clientData.exercises.length > 0 ? (
                        <View className="flex-row flex-wrap">
                          {clientData.exercises.slice(0, 6).map((exercise, index) => {
                            // Show only first 6, or 5 if there are 7+ exercises
                            const showMax = clientData.exercises.length > 6 ? 5 : 6;
                            if (index >= showMax) return null;
                            
                            return (
                              <View key={exercise.id} className="w-1/2 pr-2 mb-2.5" style={{ flexShrink: 1, minWidth: 0 }}>
                                <Text 
                                  style={{ 
                                    fontSize: 13,
                                    lineHeight: 18,
                                    color: TOKENS.color.text,
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
                              <View style={{
                                backgroundColor: 'rgba(124, 255, 181, 0.2)',
                                paddingHorizontal: 12,
                                paddingVertical: 3,
                                borderRadius: TOKENS.radius.chip,
                                alignSelf: 'flex-start',
                              }}>
                                <Text style={{ fontSize: 12, color: TOKENS.color.accent, fontWeight: '600' }}>
                                  +{clientData.exercises.length - 5} more
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      ) : (
                        <View className="flex-1 items-center justify-center">
                          <Text style={{ fontSize: 16, color: TOKENS.color.muted }}>
                            No exercises selected yet
                          </Text>
                        </View>
                      )}
                    </View>
                  </MattePanel>
                  </View>
                );
              })}
            </View>
            {/* Bottom row - 2 cards */}
            <View className="flex-row" style={{ flex: 1, gap: 12, paddingHorizontal: '16.67%' }}>
              {clientEntries.slice(3, 5).map(([clientId, clientData]) => (
                <View key={clientId} style={{ flex: 1 }}>
                  <MattePanel style={{ flex: 1, padding: 12 }}>
                    {/* Header Section */}
                    <View className="flex-row items-center" style={{ marginBottom: 12 }}>
                      <Image 
                        source={{ uri: getAvatarUrl(clientId) }}
                        style={{ 
                          width: 36, 
                          height: 36, 
                          borderRadius: 18, 
                          marginRight: 12 
                        }}
                      />
                      <Text style={{ fontSize: 18, fontWeight: '600', color: TOKENS.color.text }}>
                        {clientData.clientName}
                      </Text>
                    </View>

                    {/* Exercises List - Two Column Layout */}
                    <View className="flex-1">
                      {clientData.exercises.length > 0 ? (
                        <View className="flex-row flex-wrap">
                          {clientData.exercises.slice(0, 6).map((exercise, index) => {
                            const showMax = clientData.exercises.length > 6 ? 5 : 6;
                            if (index >= showMax) return null;
                            
                            return (
                              <View key={exercise.id} className="w-1/2 pr-2 mb-2.5" style={{ flexShrink: 1, minWidth: 0 }}>
                                <Text 
                                  style={{ 
                                    fontSize: 13,
                                    lineHeight: 18,
                                    color: TOKENS.color.text,
                                  }}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {exercise.exerciseName}
                                </Text>
                              </View>
                            );
                          })}
                          {clientData.exercises.length > 6 && (
                            <View className="w-1/2 pr-2 mb-2.5">
                              <View style={{
                                backgroundColor: 'rgba(124, 255, 181, 0.2)',
                                paddingHorizontal: 12,
                                paddingVertical: 3,
                                borderRadius: TOKENS.radius.chip,
                                alignSelf: 'flex-start',
                              }}>
                                <Text style={{ fontSize: 12, color: TOKENS.color.accent, fontWeight: '600' }}>
                                  +{clientData.exercises.length - 5} more
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      ) : (
                        <View className="flex-1 items-center justify-center">
                          <Text style={{ fontSize: 16, color: TOKENS.color.muted }}>
                            No exercises selected yet
                          </Text>
                        </View>
                      )}
                    </View>
                  </MattePanel>
                </View>
              ))}
            </View>
          </View>
        ) : (
          // Standard grid layout
          <View className={`flex-1 flex-row flex-wrap ${clientEntries.length > 4 ? 'items-center content-center' : 'items-start content-start'}`} style={{ gap: 12 }}>
            {clientEntries.map(([clientId, clientData]) => {
              const cardSizeClass = clientEntries.length <= 4 ? "w-1/2" : "w-1/3";
              const isCompact = clientEntries.length > 4;
              
              return (
                <View key={clientId} className={cardSizeClass} style={[
                  { padding: 6 },
                  clientEntries.length <= 4 ? { height: '65%' } : { height: '55%' }
                ]}>
                  <MattePanel style={{ flex: 1, padding: isCompact ? 12 : 18 }}>
                    {/* Header Section */}
                    <View className="flex-row items-center" style={{ marginBottom: 12 }}>
                      <Image 
                        source={{ uri: getAvatarUrl(clientId) }}
                        style={{ 
                          width: isCompact ? 36 : 48, 
                          height: isCompact ? 36 : 48, 
                          borderRadius: isCompact ? 18 : 24, 
                          marginRight: 12 
                        }}
                      />
                      <Text style={{ fontSize: isCompact ? 18 : 20, fontWeight: '600', color: TOKENS.color.text }}>
                        {clientData.clientName}
                      </Text>
                    </View>

                    {/* Exercises List - Two Column Layout */}
                    <View className="flex-1">
                      {clientData.exercises.length > 0 ? (
                        <View className="flex-row flex-wrap">
                          {clientData.exercises.slice(0, 6).map((exercise, index) => {
                            const showMax = clientData.exercises.length > 6 ? 5 : 6;
                            if (index >= showMax) return null;
                            
                            return (
                              <View key={exercise.id} className="w-1/2 pr-2 mb-2.5" style={{ flexShrink: 1, minWidth: 0 }}>
                                <Text 
                                  style={{ 
                                    fontSize: isCompact ? 13 : 15,
                                    lineHeight: isCompact ? 18 : 20,
                                    color: TOKENS.color.text,
                                  }}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {exercise.exerciseName}
                                </Text>
                              </View>
                            );
                          })}
                          {clientData.exercises.length > 6 && (
                            <View className="w-1/2 pr-2 mb-2.5">
                              <View style={{
                                backgroundColor: 'rgba(124, 255, 181, 0.2)',
                                paddingHorizontal: 12,
                                paddingVertical: 3,
                                borderRadius: TOKENS.radius.chip,
                                alignSelf: 'flex-start',
                              }}>
                                <Text style={{ fontSize: isCompact ? 12 : 13, color: TOKENS.color.accent, fontWeight: '600' }}>
                                  +{clientData.exercises.length - 5} more
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      ) : (
                        <View className="flex-1 items-center justify-center">
                          <Text style={{ fontSize: 16, color: TOKENS.color.muted }}>
                            No exercises selected yet
                          </Text>
                        </View>
                      )}
                    </View>
                  </MattePanel>
                </View>
              );
            })}
          </View>
        )}
      </View>
      
      {/* Connection Status - Bottom */}
      <View className="mt-6 px-4">
        <View className="flex-row items-center">
          <View className={`w-3 h-3 rounded-full mr-2 ${
            swapUpdatesConnected ? 'bg-green-400' : 'bg-gray-400'
          }`} />
          <Text style={{ fontSize: 16, color: TOKENS.color.text }}>
            {swapUpdatesConnected ? 'Live updates active' : 'Connecting...'}
          </Text>
        </View>
      </View>
    </View>
  );
}