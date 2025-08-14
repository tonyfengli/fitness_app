import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../App';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimePreferences } from '../hooks/useRealtimePreferences';
import { useRealtimeStatus } from '@acme/ui-shared';
import { supabase } from '../lib/supabase';
import { WorkoutGenerationLoader } from '../components/WorkoutGenerationLoader';

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
  const [statusConnectionStatus, setStatusConnectionStatus] = useState<'connected' | 'connecting'>('connecting');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Fetch initial preferences - using checked-in clients data
  const { data: clientsData, isLoading } = useQuery(
    sessionId ? api.trainingSession.getCheckedInClients.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ['disabled'],
      queryFn: () => Promise.resolve([])
    }
  );

  // Set up real-time updates for preferences
  const { isConnected } = useRealtimePreferences({
    sessionId: sessionId || '',
    onPreferenceUpdate: (event) => {
      console.log('[TV GlobalPreferences] Preference update received:', event);
      console.log('[TV GlobalPreferences] Current clients:', clients);
      console.log('[TV GlobalPreferences] Looking for user:', event.userId);
      
      setClients(prev => {
        console.log('[TV GlobalPreferences] Previous clients state:', prev);
        const updated = prev.map(client => {
          if (client.userId === event.userId) {
            console.log('[TV GlobalPreferences] Found matching client, updating:', client.userId);
            return { ...client, preferences: event.preferences, isReady: event.isReady };
          }
          return client;
        });
        console.log('[TV GlobalPreferences] Updated clients state:', updated);
        return updated;
      });
    },
    onError: (err) => console.error('[TV GlobalPreferences] Realtime error:', err)
  });

  // Set up real-time updates for user_training_session status
  const { isConnected: isStatusConnected } = useRealtimeStatus({
    sessionId: sessionId || '',
    supabase,
    onStatusUpdate: (update) => {
      console.log('[TV GlobalPreferences] Status update received:', update);
      
      setClients(prev => {
        const updated = prev.map(client => {
          if (client.userId === update.userId) {
            console.log('[TV GlobalPreferences] Updating status for user:', update.userId, 'to:', update.status);
            // Mark as ready when status is 'ready'
            return { ...client, isReady: update.status === 'ready' };
          }
          return client;
        });
        return updated;
      });
    },
    onError: (err) => console.error('[TV GlobalPreferences] Status realtime error:', err)
  });

  // Blueprint generation query - we'll trigger it manually
  const [shouldGenerateBlueprint, setShouldGenerateBlueprint] = useState(false);
  const { data: blueprintResult, isLoading: isBlueprintLoading, error: blueprintError, refetch: refetchBlueprint } = useQuery({
    ...api.trainingSession.generateGroupWorkoutBlueprint.queryOptions({
      sessionId: sessionId || '',
      options: {
        includeDiagnostics: true,
        phase1Only: true
      }
    }),
    enabled: shouldGenerateBlueprint && !!sessionId,
    retry: false
  });

  // Save visualization mutation
  const saveVisualization = useMutation({
    ...api.trainingSession.saveVisualizationData.mutationOptions(),
    onError: (error) => {
      console.error('[TV GlobalPreferences] Save visualization error:', error);
    }
  });

  const handleContinue = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setShouldGenerateBlueprint(true);
  };


  // Handle blueprint generation result
  useEffect(() => {
    let isMounted = true;
    
    const processBlueprint = async () => {
      console.log('[TV GlobalPreferences] processBlueprint called:', {
        blueprintResult: !!blueprintResult,
        isGenerating,
        shouldGenerateBlueprint,
        isMounted
      });
      
      if (blueprintResult && isGenerating && shouldGenerateBlueprint && isMounted) {
        console.log('[TV GlobalPreferences] Blueprint result structure:', blueprintResult);
        try {
          // Immediately mark as processing to prevent re-runs
          setShouldGenerateBlueprint(false);
          
          // Validate result - check what's actually in the result
          console.log('[TV GlobalPreferences] Checking llmResult:', !!blueprintResult?.llmResult);
          if (!blueprintResult?.llmResult) {
            console.warn('[TV GlobalPreferences] No llmResult found, but continuing anyway');
            // throw new Error('Failed to generate workout - no LLM result');
          }
          
          // Save visualization data
          console.log('[TV GlobalPreferences] Saving visualization data...');
          
          // Navigate immediately before the async operation
          console.log('[TV GlobalPreferences] About to navigate to WorkoutOverview with sessionId:', sessionId);
          try {
            navigation.navigate('WorkoutOverview', { sessionId });
            console.log('[TV GlobalPreferences] Navigation called successfully');
          } catch (navError) {
            console.error('[TV GlobalPreferences] Navigation error:', navError);
          }
          
          // Save visualization data after navigation
          await saveVisualization.mutateAsync({
            sessionId: sessionId!,
            visualizationData: {
              blueprint: blueprintResult.blueprint,
              groupContext: blueprintResult.groupContext,
              llmResult: blueprintResult.llmResult,
              summary: blueprintResult.summary,
              exerciseMetadata: blueprintResult.blueprint?.clientExercisePools || undefined,
              sharedExerciseIds: blueprintResult.blueprint?.sharedExercisePool?.map((e: any) => e.id) || undefined
            }
          });
        } catch (error: any) {
          console.error('[TV GlobalPreferences] Error processing workout:', error);
          if (isMounted) {
            setGenerationError(error.message || 'Failed to generate workout. Please try again.');
          }
        } finally {
          if (isMounted) {
            setIsGenerating(false);
          }
        }
      }
    };
    
    processBlueprint();
    
    return () => {
      isMounted = false;
    };
  }, [blueprintResult, isGenerating, shouldGenerateBlueprint, sessionId, navigation]);
  
  // Handle blueprint error
  useEffect(() => {
    if (blueprintError && isGenerating) {
      console.error('[TV GlobalPreferences] Blueprint error:', blueprintError);
      setGenerationError('Failed to generate workout. Please try again.');
      setIsGenerating(false);
      setShouldGenerateBlueprint(false);
    }
  }, [blueprintError, isGenerating]);

  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'connecting');
  }, [isConnected]);

  useEffect(() => {
    setStatusConnectionStatus(isStatusConnected ? 'connected' : 'connecting');
  }, [isStatusConnected]);

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
      case 'low': return 4;
      case 'moderate': return 5;
      case 'high': return 6;
      case 'intense': return 7;
      default: return 5;
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

  // Show loading screen when generating workout
  if (isGenerating) {
    return (
      <WorkoutGenerationLoader
        clientNames={clients.map(c => c.userName || 'Unknown')}
        onCancel={() => {
          setIsGenerating(false);
          setShouldGenerateBlueprint(false);
          setGenerationError(null);
        }}
      />
    );
  }

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
            Back to Lobby
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.7}
          tvParallaxProperties={{
            enabled: true,
            shiftDistanceX: 2,
            shiftDistanceY: 2,
          }}
          className="px-6 py-2.5 bg-sky-600 rounded-lg"
          disabled={isGenerating}
        >
          <Text className="text-white font-semibold">Continue</Text>
        </TouchableOpacity>
      </View>

      {/* Client Cards Grid */}
      <View className="flex-1 px-8 pb-12">
        <View className={`flex-1 flex-row flex-wrap ${clients.length > 4 ? 'items-center content-center' : 'items-start content-start'}`}>
          {clients.map((client, index) => {
            // Adjust size based on number of clients
            const cardSizeClass = clients.length <= 4 ? "w-1/2" : "w-1/3";
            const isCompact = clients.length > 4;
            
            return (
            <View key={client.userId} className={`${cardSizeClass} p-4`} style={clients.length <= 4 ? { height: '55%' } : { height: '48%' }}>
              <View className={`h-full flex ${
                client.isReady ? 'border-2 border-blue-500' : ''
              }`} style={{
                backgroundColor: '#1F2937',
                borderRadius: 12,
                ...(!client.isReady && {
                  borderWidth: 0,
                }),
              }}>
                

                {/* Header Section */}
                <View className={`${isCompact ? 'px-4 py-2' : 'px-5 py-2.5'} flex-row items-center`}>
                  <Image 
                    source={{ uri: getAvatarUrl(client.userId) }}
                    className={isCompact ? "w-6 h-6 rounded-full mr-2" : "w-8 h-8 rounded-full mr-3"}
                  />
                  <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-semibold text-white`}>
                    {client.userName || 'Unknown'}
                  </Text>
                </View>

                {/* Content Sections */}
                <ScrollView 
                  className={`flex-1`}
                  contentContainerStyle={{ 
                    paddingHorizontal: isCompact ? 16 : 20,
                    paddingBottom: isCompact ? 12 : 12,
                    flexGrow: 1
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Section 1: Workout Type */}
                  <View className="flex-row items-center mb-1.5">
                    <View className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full items-center justify-center ${isCompact ? 'mr-2' : 'mr-3'} ${
                      client.isReady ? 'bg-indigo-600' : 'bg-gray-700'
                    }`}>
                      <Text className={`${isCompact ? 'text-[10px]' : 'text-xs'} ${client.isReady ? 'text-white' : 'text-gray-300'}`}>
                        1
                      </Text>
                    </View>
                    <Text className="text-gray-200 text-xs">
                      {client.preferences?.sessionGoal === 'targeted' ? 'Targeted' : 'Full Body'} • {client.preferences?.includeFinisher ? 'With Finisher' : 'Without Finisher'}
                    </Text>
                  </View>

                  {/* Section 2: Muscle Targets */}
                  <View className="flex-row items-center mb-1.5">
                    <View className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full items-center justify-center ${isCompact ? 'mr-2' : 'mr-3'} ${
                      client.isReady ? 'bg-indigo-600' : 'bg-gray-700'
                    }`}>
                      <Text className={`${isCompact ? 'text-[10px]' : 'text-xs'} ${client.isReady ? 'text-white' : 'text-gray-300'}`}>
                        2
                      </Text>
                    </View>
                    <View className="flex-1">
                      {client.preferences?.muscleTargets && client.preferences.muscleTargets.length > 0 ? (
                        <View className="flex-row flex-wrap items-center">
                          {client.preferences.muscleTargets.map((muscle) => (
                            <View key={muscle} className={`bg-indigo-200 ${isCompact ? 'px-2 py-0' : 'px-2.5 py-0.5'} rounded-full mr-1.5`}>
                              <Text className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-indigo-800 font-semibold`}>{muscle}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text className="text-gray-400 text-xs">No muscle targets</Text>
                      )}
                    </View>
                  </View>

                  {/* Section 3: Muscle Limits */}
                  <View className="flex-row items-center mb-1.5">
                    <View className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full items-center justify-center ${isCompact ? 'mr-2' : 'mr-3'} ${
                      client.isReady ? 'bg-indigo-600' : 'bg-gray-700'
                    }`}>
                      <Text className={`${isCompact ? 'text-[10px]' : 'text-xs'} ${client.isReady ? 'text-white' : 'text-gray-300'}`}>
                        3
                      </Text>
                    </View>
                    <View className="flex-1">
                      {client.preferences?.muscleLessens && client.preferences.muscleLessens.length > 0 ? (
                        <View className="flex-row flex-wrap items-center">
                          {client.preferences.muscleLessens.map((muscle) => (
                            <View key={muscle} className={`bg-red-200 ${isCompact ? 'px-2 py-0' : 'px-2.5 py-0.5'} rounded-full mr-1.5`}>
                              <Text className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-red-800 font-semibold`}>{muscle}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text className="text-gray-400 text-xs">No muscle limits</Text>
                      )}
                    </View>
                  </View>

                  {/* Section 4: Intensity */}
                  <View className="flex-row items-center">
                    <View className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full items-center justify-center ${isCompact ? 'mr-2' : 'mr-3'} ${
                      client.isReady ? 'bg-indigo-600' : 'bg-gray-700'
                    }`}>
                      <Text className={`${isCompact ? 'text-[10px]' : 'text-xs'} ${client.isReady ? 'text-white' : 'text-gray-300'}`}>
                        4
                      </Text>
                    </View>
                    <Text className="text-gray-200 text-xs">
                      {(client.preferences?.intensity || 'Moderate').charAt(0).toUpperCase() + 
                       (client.preferences?.intensity || 'Moderate').slice(1)} ({getExerciseCount(client.preferences?.intensity)} exercises)
                    </Text>
                  </View>
                </ScrollView>
              </View>
            </View>
            );
          })}
        </View>
      </View>
      
      {/* Connection Status - Bottom Left */}
      <View className="absolute bottom-6 left-8 flex-row items-center">
        <View className={`w-2 h-2 rounded-full mr-2 ${
          connectionStatus === 'connected' && statusConnectionStatus === 'connected' ? 'bg-green-400' : 'bg-gray-400'
        }`} />
        <Text className="text-sm text-gray-400">
          {connectionStatus === 'connected' && statusConnectionStatus === 'connected' ? 'Live updates active' : 'Connecting...'}
        </Text>
      </View>
      
      {/* Error Modal */}
      {generationError && (
        <View className="absolute inset-0 bg-black bg-opacity-50 items-center justify-center px-8">
          <View className="bg-gray-800 rounded-xl p-8 max-w-lg">
            <Text className="text-red-400 text-xl font-semibold mb-4">Generation Failed</Text>
            <Text className="text-gray-300 mb-6">{generationError}</Text>
            <View className="flex-row justify-end space-x-4">
              <TouchableOpacity
                onPress={() => setGenerationError(null)}
                className="px-6 py-2.5 bg-gray-700 rounded-lg mr-4"
                activeOpacity={0.7}
                tvParallaxProperties={{
                  enabled: true,
                  shiftDistanceX: 2,
                  shiftDistanceY: 2,
                }}
              >
                <Text className="text-gray-300">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setGenerationError(null);
                  // Reset and retry
                  setShouldGenerateBlueprint(false);
                  setTimeout(() => handleContinue(), 100);
                }}
                className="px-6 py-2.5 bg-sky-600 rounded-lg"
                activeOpacity={0.7}
                tvParallaxProperties={{
                  enabled: true,
                  shiftDistanceX: 2,
                  shiftDistanceY: 2,
                }}
              >
                <Text className="text-white font-semibold">Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}