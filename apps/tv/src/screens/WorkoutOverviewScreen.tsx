import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../App';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimeExerciseSwaps } from '@acme/ui-shared';
import { supabase } from '../lib/supabase';
import { useStartWorkout } from '../hooks/useStartWorkout';
import { WorkoutGenerationLoader } from '../components/WorkoutGenerationLoader';

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
    status?: string;
  };
}

export function WorkoutOverviewScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const queryClient = useQueryClient();
  const [lastSwapTime, setLastSwapTime] = useState<Date | null>(null);
  const { startWorkout, isGenerating, error: startWorkoutError, setError } = useStartWorkout();
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [workoutOrganizationReady, setWorkoutOrganizationReady] = useState(false);
  
  // Check if session already has workout organization
  const { data: sessionData, isLoading: sessionLoading } = useQuery(
    sessionId ? api.trainingSession.getSession.queryOptions({ id: sessionId }) : {
      enabled: false,
      queryKey: ['disabled-session-overview'],
      queryFn: () => Promise.resolve(null)
    }
  );
  
  // Log session data for debugging
  useEffect(() => {
    if (!sessionLoading && sessionData) {
      console.log('[TV WorkoutOverview] Session data loaded:', {
        hasWorkoutOrganization: !!sessionData?.workoutOrganization,
        workoutOrganization: sessionData?.workoutOrganization
      });
    }
  }, [sessionData, sessionLoading]);

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
        exercises: [],
        status: client.status
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
          onPress={async () => {
            // Check if workout is already organized
            if (sessionData?.workoutOrganization) {
              console.log('[TV WorkoutOverview] Workout already organized, navigating directly');
              // Navigate directly without loading screen
              navigation.navigate('WorkoutLive', { 
                sessionId, 
                round: 1
              });
            } else {
              // Show loading screen for Phase 2 organization
              // Reset the organization ready state
              setWorkoutOrganizationReady(false);
              
              // Start polling for workout organization in background
              const pollForOrganization = async () => {
                console.log('[TV WorkoutOverview] Starting to poll for workout organization...');
                let attempts = 0;
                const maxAttempts = 60; // 30 seconds max (500ms intervals)
                
                while (attempts < maxAttempts) {
                  try {
                    const session = await queryClient.fetchQuery(
                      api.trainingSession.getSession.queryOptions({ id: sessionId })
                    );
                    
                    if (session?.workoutOrganization) {
                      console.log('[TV WorkoutOverview] ✅ Workout organization detected!');
                      setWorkoutOrganizationReady(true);
                      break;
                    }
                    
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, 500));
                  } catch (error) {
                    console.log('[TV WorkoutOverview] Error polling for organization:', error);
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }
                }
                
                if (attempts >= maxAttempts) {
                  console.log('[TV WorkoutOverview] ⚠️ Timeout waiting for workout organization');
                }
              };
              
              // Start polling and workout generation in parallel
              pollForOrganization();
              await startWorkout(sessionId);
            }
          }}
          focusable
          disabled={!sessionId || isGenerating}
        >
          {({ focused }) => (
            <MattePanel 
              focused={focused}
              style={{ 
                paddingHorizontal: 32,
                paddingVertical: 12,
                opacity: (!sessionId || isGenerating) ? 0.5 : 1,
                backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                borderWidth: focused ? 1 : 1,
                transform: focused ? [{ translateY: -1 }] : [],
              }}
            >
              <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>Start Workout</Text>
            </MattePanel>
          )}
        </Pressable>
      </View>

      {/* Client Cards Grid */}
      <View className="flex-1">
        {clientEntries.length <= 4 ? (
          // Layout for 4 or fewer clients: 2 rows, first row always has 2 cards
          <View className="flex-1" style={{ gap: 12 }}>
            {/* First row - always 2 cards */}
            <View className="flex-row" style={{ flex: 1, gap: 12 }}>
              {clientEntries.slice(0, 2).map(([clientId, clientData]) => (
                <View key={clientId} style={{ flex: 1 }}>
                  <MattePanel style={{ 
                    flex: 1, 
                    padding: 16,
                    ...(clientData.status === 'workout_ready' && {
                      borderColor: TOKENS.color.accent,
                      borderWidth: 2,
                    })
                  }}>
                    {/* Header Section - 10% smaller */}
                    <View className="flex-row items-center" style={{ marginBottom: 11 }}>
                      <Image 
                        source={{ uri: getAvatarUrl(clientId) }}
                        style={{ 
                          width: 43, 
                          height: 43, 
                          borderRadius: 22, 
                          marginRight: 11 
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
                              <View key={exercise.id} className="w-1/2 pr-2 mb-2" style={{ flexShrink: 1, minWidth: 0 }}>
                                <Text 
                                  style={{ 
                                    fontSize: 14,
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
                            <View className="w-1/2 pr-2 mb-2">
                              <View style={{
                                backgroundColor: 'rgba(124, 255, 181, 0.2)',
                                paddingHorizontal: 11,
                                paddingVertical: 3,
                                borderRadius: TOKENS.radius.chip,
                                alignSelf: 'flex-start',
                              }}>
                                <Text style={{ fontSize: 11, color: TOKENS.color.accent, fontWeight: '600' }}>
                                  +{clientData.exercises.length - 5} more
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      ) : (
                        <View className="flex-1 items-center justify-center">
                          <Text style={{ fontSize: 14, color: TOKENS.color.muted }}>
                            Loading...
                          </Text>
                        </View>
                      )}
                    </View>
                  </MattePanel>
                </View>
              ))}
            </View>
            {/* Second row - 0, 1, or 2 cards */}
            {clientEntries.length > 2 && (
              <View className="flex-row" style={{ flex: 1, gap: 12 }}>
                {clientEntries.slice(2, 4).map(([clientId, clientData]) => (
                  <View key={clientId} style={{ flex: 1 }}>
                    <MattePanel style={{ 
                      flex: 1, 
                      padding: 16,
                      ...(clientData.status === 'workout_ready' && {
                        borderColor: TOKENS.color.accent,
                        borderWidth: 2,
                      })
                    }}>
                      {/* Header Section - 10% smaller */}
                      <View className="flex-row items-center" style={{ marginBottom: 11 }}>
                        <Image 
                          source={{ uri: getAvatarUrl(clientId) }}
                          style={{ 
                            width: 43, 
                            height: 43, 
                            borderRadius: 22, 
                            marginRight: 11 
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
                                <View key={exercise.id} className="w-1/2 pr-2 mb-2" style={{ flexShrink: 1, minWidth: 0 }}>
                                  <Text 
                                    style={{ 
                                      fontSize: 14,
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
                              <View className="w-1/2 pr-2 mb-2">
                                <View style={{
                                  backgroundColor: 'rgba(124, 255, 181, 0.2)',
                                  paddingHorizontal: 11,
                                  paddingVertical: 3,
                                  borderRadius: TOKENS.radius.chip,
                                  alignSelf: 'flex-start',
                                }}>
                                  <Text style={{ fontSize: 11, color: TOKENS.color.accent, fontWeight: '600' }}>
                                    +{clientData.exercises.length - 5} more
                                  </Text>
                                </View>
                              </View>
                            )}
                          </View>
                        ) : (
                          <View className="flex-1 items-center justify-center">
                            <Text style={{ fontSize: 14, color: TOKENS.color.muted }}>
                              Loading...
                            </Text>
                          </View>
                        )}
                      </View>
                    </MattePanel>
                  </View>
                ))}
                {/* Add empty spacer if only 3 clients total */}
                {clientEntries.length === 3 && <View style={{ flex: 1 }} />}
              </View>
            )}
          </View>
        ) : clientEntries.length === 5 ? (
          // Special layout for 5 clients: 3 on top, 2 on bottom
          <View className="flex-1" style={{ gap: 12 }}>
            {/* Top row - 3 cards */}
            <View className="flex-row" style={{ flex: 1, gap: 12 }}>
              {clientEntries.slice(0, 3).map(([clientId, clientData]) => {
                const isCompact = true; // Always compact for 5-client layout
                return (
                  <View key={clientId} style={{ flex: 1 }}>
                    <MattePanel style={{ 
                      flex: 1, 
                      padding: 12,
                      ...(clientData.status === 'workout_ready' && {
                        borderColor: TOKENS.color.accent,
                        borderWidth: 2,
                      })
                    }}>
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
                            Loading...
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
                  <MattePanel style={{ 
                    flex: 1, 
                    padding: 12,
                    ...(clientData.status === 'workout_ready' && {
                      borderColor: TOKENS.color.accent,
                      borderWidth: 2,
                    })
                  }}>
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
                            Loading...
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
          // Standard grid layout for more than 5 clients
          <View className="flex-1 flex-row flex-wrap items-center content-center" style={{ gap: 12 }}>
            {clientEntries.map(([clientId, clientData]) => {
              const cardSizeClass = "w-1/3";
              const isCompact = true;
              
              return (
                <View key={clientId} className={cardSizeClass} style={[
                  { padding: 6 },
                  { height: '55%' }
                ]}>
                  <MattePanel style={{ 
                    flex: 1, 
                    padding: isCompact ? 12 : 18,
                    ...(clientData.status === 'workout_ready' && {
                      borderColor: TOKENS.color.accent,
                      borderWidth: 2,
                    })
                  }}>
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
                            Loading...
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

      {/* Loading overlay when generating workout */}
      {isGenerating && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
        }}>
          <WorkoutGenerationLoader 
            clientNames={clients?.map(c => c.userName || 'Unknown') || []} 
            durationMinutes={1.67} // 1 minute 40 seconds
            forceComplete={workoutOrganizationReady}
          />
        </View>
      )}

      {/* Error Modal */}
      {(showErrorModal || startWorkoutError) && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1001,
        }}>
          <Pressable
            onPress={() => {
              setShowErrorModal(false);
              // Clear the error from the hook
              setError(null);
            }}
            focusable
          >
            {({ focused }) => (
              <MattePanel
                focused={focused}
                style={{
                  maxWidth: 500,
                  padding: 32,
                  margin: 24,
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
                <View className="items-center">
                  <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: TOKENS.color.text, marginBottom: 8 }}>
                    Unable to Start Workout
                  </Text>
                  <Text style={{ fontSize: 18, color: TOKENS.color.muted, textAlign: 'center', marginBottom: 24 }}>
                    {startWorkoutError || 'An error occurred while organizing the workout. Please try again.'}
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: TOKENS.color.accent }}>
                    Press to dismiss
                  </Text>
                </View>
              </MattePanel>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}