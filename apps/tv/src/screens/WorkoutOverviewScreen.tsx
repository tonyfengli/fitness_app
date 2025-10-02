import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../App';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimeExerciseSwaps, useRealtimeStatus } from '@acme/ui-shared';
import { supabase } from '../lib/supabase';
import { useStartWorkout } from '../hooks/useStartWorkout';

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

// Helper function to format time in 12-hour format with AM/PM
function formatTime12Hour(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  
  return `${hours12}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
}

export function WorkoutOverviewScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  
  // Add mount/unmount logging
  useEffect(() => {
    console.log('[TV WorkoutOverview] 🟢 MOUNTED with sessionId:', sessionId);
    return () => {
      console.log('[TV WorkoutOverview] 🔴 UNMOUNTING');
    };
  }, []);
  
  const queryClient = useQueryClient();
  const [lastSwapTime, setLastSwapTime] = useState<Date | null>(null);
  const { startWorkout, isGenerating, error: startWorkoutError, setError } = useStartWorkout();
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<Date | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');
  
  // Local state for selections and clients - copying GlobalPreferencesScreen pattern
  const [localSelections, setLocalSelections] = useState<ExerciseSelection[]>([]);
  const [localClients, setLocalClients] = useState<any[]>([]);
  
  // Check if session already has workout organization
  const { data: sessionData, isLoading: sessionLoading } = useQuery(
    sessionId ? api.trainingSession.getById.queryOptions({ id: sessionId }) : {
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
      
      // Update local state directly - we'll refetch the data and update via useEffect
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

  // Use real-time status updates
  const { isConnected: statusConnected } = useRealtimeStatus({
    sessionId: sessionId || '',
    supabase,
    onStatusUpdate: (update) => {
      console.log('[TV WorkoutOverview] ========== STATUS UPDATE RECEIVED ==========');
      console.log('[TV WorkoutOverview] Update details:', {
        userId: update.userId,
        status: update.status,
        updatedAt: update.updatedAt,
        sessionId: sessionId
      });
      console.log('[TV WorkoutOverview] Current local clients before update:', localClients);
      
      // Update local state directly instead of invalidating queries
      setLocalClients(prev => {
        console.log('[TV WorkoutOverview] Previous clients state:', prev);
        const updated = prev.map(client => {
          if (client.userId === update.userId) {
            console.log('[TV WorkoutOverview] Updating status for user:', update.userId, 'to:', update.status);
            return { ...client, status: update.status };
          }
          return client;
        });
        console.log('[TV WorkoutOverview] Updated clients state:', updated);
        return updated;
      });
      
      console.log('[TV WorkoutOverview] ========== END STATUS UPDATE ==========');
    },
    onError: (error) => {
      console.error('[TV WorkoutOverview] Real-time status error:', error);
    }
  });
  
  // Log connection status
  useEffect(() => {
    console.log('[TV WorkoutOverview] Real-time connections:', {
      swapUpdatesConnected,
      statusConnected,
      sessionId
    });
  }, [swapUpdatesConnected, statusConnected, sessionId]);

  // Set up polling for exercise selections (10 second interval)
  const selectionsQueryOptions = sessionId 
    ? api.workoutSelections.getSelections.queryOptions({ sessionId })
    : null;

  const { data: selections, isLoading: selectionsLoading, error: selectionsError } = useQuery({
    ...selectionsQueryOptions,
    enabled: !!sessionId && !!selectionsQueryOptions,
    refetchInterval: 10000, // Poll every 10 seconds
    refetchIntervalInBackground: true, // Keep polling even when tab is not focused
  });
  
  // Log raw selections response
  useEffect(() => {
    if (!selectionsLoading && selections !== undefined) {
      console.log('[TV WorkoutOverview] 🔍 RAW SELECTIONS API RESPONSE:', {
        totalSelections: selections?.length || 0,
        rawData: selections,
        byClient: selections?.reduce((acc, sel) => {
          const clientId = sel.clientId;
          if (!acc[clientId]) {
            acc[clientId] = {
              count: 0,
              exercises: []
            };
          }
          acc[clientId].count++;
          acc[clientId].exercises.push({
            id: sel.id,
            exerciseName: sel.exerciseName,
            isShared: sel.isShared,
            selectionSource: sel.selectionSource
          });
          return acc;
        }, {}),
        uniqueClients: [...new Set(selections?.map(s => s.clientId) || [])]
      });
    }
  }, [selections, selectionsLoading]);

  // Set up polling for client information (10 second interval)
  const clientsQueryOptions = sessionId 
    ? api.trainingSession.getCheckedInClients.queryOptions({ sessionId })
    : null;

  const { data: clients, isLoading: clientsLoading, error: clientsError } = useQuery({
    ...clientsQueryOptions,
    enabled: !!sessionId && !!clientsQueryOptions,
    refetchInterval: 10000, // Poll every 10 seconds
    refetchIntervalInBackground: true, // Keep polling even when tab is not focused
  });
  
  // Copy query data to local state - copying GlobalPreferencesScreen pattern
  useEffect(() => {
    if (selections !== undefined && !selectionsLoading) {
      console.log('[TV WorkoutOverview] 📥 Updating local selections from polled data');
      console.log('[TV WorkoutOverview] Selections count:', selections?.length || 0);
      console.log('[TV WorkoutOverview] First 3 selections:', selections?.slice(0, 3));
      
      // Update last successful fetch timestamp on success
      if (!selectionsError && !clientsError) {
        const now = new Date();
        setLastSuccessfulFetch(now);
        setConnectionState('connected');
      }
      
      setLocalSelections(selections || []);
    }
  }, [selections, selectionsLoading, selectionsError, clientsError]);
  
  useEffect(() => {
    if (clients !== undefined && !clientsLoading) {
      console.log('[TV WorkoutOverview] 👥 Updating local clients from polled data');
      console.log('[TV WorkoutOverview] Clients count:', clients?.length || 0);
      console.log('[TV WorkoutOverview] Client IDs and names:', clients?.map(c => ({ 
        userId: c.userId, 
        userName: c.userName,
        status: c.status 
      })));
      
      // Update last successful fetch timestamp on success
      if (!selectionsError && !clientsError) {
        const now = new Date();
        setLastSuccessfulFetch(now);
        setConnectionState('connected');
      }
      
      setLocalClients(clients || []);
    }
  }, [clients, clientsLoading, selectionsError, clientsError]);
  
  // Handle fetch errors
  useEffect(() => {
    if ((selectionsError || clientsError) && !selectionsLoading && !clientsLoading) {
      console.log('[TV WorkoutOverview] Fetch error detected:', { selectionsError, clientsError });
      setConnectionState('error');
    }
  }, [selectionsError, clientsError, selectionsLoading, clientsLoading]);

  const getAvatarUrl = (userId: string) => {
    return `https://api.dicebear.com/7.x/avataaars/png?seed=${userId}&size=128`;
  };

  // Group selections by client - using local state instead of query data
  const groupedSelections = React.useMemo(() => {
    console.log('[TV WorkoutOverview] Computing groupedSelections...');
    console.log('[TV WorkoutOverview] Local clients data:', localClients);
    console.log('[TV WorkoutOverview] Local selections data:', localSelections?.length || 0, 'items');
    
    if (!localSelections || !localClients || localClients.length === 0) return {};

    const grouped: GroupedSelections = {};
    
    // Initialize with all clients from local state
    localClients.forEach(client => {
      console.log('[TV WorkoutOverview] Processing client:', {
        userId: client.userId,
        userName: client.userName,
        status: client.status
      });
      
      grouped[client.userId] = {
        clientName: client.userName || 'Unknown',
        exercises: [],
        status: client.status
      };
    });

    // Add exercises to each client from local state
    console.log('[TV WorkoutOverview] 🎯 Assigning exercises to clients...');
    const exercisesByClient = {};
    const unmatchedSelections = [];
    
    localSelections.forEach(selection => {
      if (!exercisesByClient[selection.clientId]) {
        exercisesByClient[selection.clientId] = {
          count: 0,
          exercises: []
        };
      }
      exercisesByClient[selection.clientId].count++;
      exercisesByClient[selection.clientId].exercises.push(selection.exerciseName);
      
      if (grouped[selection.clientId]) {
        grouped[selection.clientId].exercises.push(selection);
      } else {
        unmatchedSelections.push({
          clientId: selection.clientId,
          exerciseName: selection.exerciseName,
          selectionId: selection.id
        });
      }
    });
    
    console.log('[TV WorkoutOverview] 📊 Exercise distribution summary:');
    console.log('[TV WorkoutOverview] By client:', exercisesByClient);
    console.log('[TV WorkoutOverview] Clients with 0 exercises:', 
      Object.keys(grouped).filter(id => grouped[id].exercises.length === 0).map(id => ({
        clientId: id,
        clientName: grouped[id].clientName
      }))
    );
    
    if (unmatchedSelections.length > 0) {
      console.warn('[TV WorkoutOverview] ⚠️ UNMATCHED SELECTIONS:', {
        count: unmatchedSelections.length,
        selections: unmatchedSelections,
        knownClientIds: Object.keys(grouped),
        knownClientNames: Object.entries(grouped).map(([id, data]) => ({ id, name: data.clientName }))
      });
    }
    
    console.log('[TV WorkoutOverview] Final grouped selections:', grouped);

    return grouped;
  }, [localSelections, localClients]);

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
            // The startWorkout hook now handles all the logic:
            // 1. Checks if workout is already organized
            // 2. If yes, navigates directly to WorkoutLive
            // 3. If no, generates Phase 2 and then navigates
            await startWorkout(sessionId);
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
              {isGenerating ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color={TOKENS.color.text} style={{ marginRight: 8 }} />
                  <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>Preparing...</Text>
                </View>
              ) : (
                <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>Start Workout</Text>
              )}
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
                        /* Log exercises for this client */
                        console.log(`[TV WorkoutOverview] Client ${clientData.clientName} exercises:`, clientData.exercises.map(e => e.exerciseName)) ||
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
                          {console.log(`[TV WorkoutOverview] ❌ No exercises for ${clientData.clientName} (${clientId})`)}
                          <Text style={{ fontSize: 14, color: TOKENS.color.muted }}>
                            No exercises yet
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
                        /* Log exercises for this client */
                        console.log(`[TV WorkoutOverview] Client ${clientData.clientName} exercises:`, clientData.exercises.map(e => e.exerciseName)) ||
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
                        /* Log exercises for this client */
                        console.log(`[TV WorkoutOverview] Client ${clientData.clientName} exercises:`, clientData.exercises.map(e => e.exerciseName)) ||
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
                        /* Log exercises for this client */
                        console.log(`[TV WorkoutOverview] Client ${clientData.clientName} exercises:`, clientData.exercises.map(e => e.exerciseName)) ||
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
      </View>


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