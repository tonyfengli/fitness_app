import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, TouchableOpacity, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../App';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimePreferences } from '../hooks/useRealtimePreferences';
import { useRealtimeStatus } from '@acme/ui-shared';
import { supabase } from '../lib/supabase';
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

  // Check for existing workout selections
  const { data: existingSelections, isLoading: selectionsLoading, error: selectionsError } = useQuery(
    sessionId ? api.workoutSelections.getSelections.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ['disabled-selections'],
      queryFn: () => Promise.resolve([])
    }
  );

  // Check session data for existing workout organization
  const { data: sessionData, isLoading: sessionLoading, error: sessionError } = useQuery(
    sessionId ? api.trainingSession.getSession.queryOptions({ id: sessionId }) : {
      enabled: false,
      queryKey: ['disabled-session'],
      queryFn: () => Promise.resolve(null)
    }
  );

  // Log query states when they change
  useEffect(() => {
    console.log('[TV GlobalPreferences] Selections query state:', {
      loading: selectionsLoading,
      error: selectionsError,
      hasData: !!existingSelections,
      dataLength: existingSelections?.length
    });
  }, [selectionsLoading, selectionsError, existingSelections]);

  useEffect(() => {
    console.log('[TV GlobalPreferences] Session query state:', {
      loading: sessionLoading,
      error: sessionError,
      hasData: !!sessionData,
      hasOrganization: !!sessionData?.workoutOrganization
    });
  }, [sessionLoading, sessionError, sessionData]);

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
    console.log('[TV GlobalPreferences] ========== CONTINUE BUTTON CLICKED ==========');
    console.log('[TV GlobalPreferences] Session ID:', sessionId);
    console.log('[TV GlobalPreferences] Current state:', {
      isGenerating,
      shouldGenerateBlueprint,
      blueprintResult: !!blueprintResult,
      isBlueprintLoading
    });
    
    // Log query data
    console.log('[TV GlobalPreferences] Existing selections:', {
      data: existingSelections,
      length: existingSelections?.length,
      isEmpty: !existingSelections || existingSelections.length === 0
    });
    
    console.log('[TV GlobalPreferences] Session data:', {
      hasData: !!sessionData,
      hasWorkoutOrganization: !!sessionData?.workoutOrganization,
      hasVisualizationData: !!sessionData?.templateConfig?.visualizationData,
      hasExerciseSelection: !!sessionData?.templateConfig?.visualizationData?.llmResult?.exerciseSelection
    });
    
    // Check if we already have workout exercises
    if (existingSelections && existingSelections.length > 0) {
      console.log('[TV GlobalPreferences] ✅ Found', existingSelections.length, 'existing exercises, navigating directly to overview');
      // Skip loading screen and navigate directly
      navigation.navigate('WorkoutOverview', { sessionId });
      return;
    }
    
    // If no selections but session has visualization data (Phase 1 completed), something is wrong - still go to overview
    if (sessionData?.templateConfig?.visualizationData?.llmResult?.exerciseSelection) {
      console.log('[TV GlobalPreferences] ⚠️ No selections but session has Phase 1 data, navigating to overview anyway');
      // Skip loading screen and navigate directly
      navigation.navigate('WorkoutOverview', { sessionId });
      return;
    }
    
    console.log('[TV GlobalPreferences] ❌ No existing exercises found, proceeding with generation');
    console.log('[TV GlobalPreferences] Setting state: isGenerating=true, shouldGenerateBlueprint=true');
    
    // No existing exercises, proceed with generation - this WILL show the loading screen
    setIsGenerating(true);
    setGenerationError(null);
    setShouldGenerateBlueprint(true);
    
    console.log('[TV GlobalPreferences] ========== END CONTINUE HANDLER ==========');
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

  const renderClientCard = (client: ClientPreference, isCompact: boolean) => (
    <MattePanel 
      style={{ 
        flex: 1,
        padding: isCompact ? 10 : 14,
        ...(client.isReady && {
          borderColor: TOKENS.color.accent,
          borderWidth: 2,
        })
      }}
    >
      {/* Header Section */}
      <View className="flex-row items-center" style={{ marginBottom: 24 }}>
        <Image 
          source={{ uri: getAvatarUrl(client.userId) }}
          style={{ 
            width: isCompact ? 29 : 38, 
            height: isCompact ? 29 : 38, 
            borderRadius: isCompact ? 14 : 19, 
            marginRight: 10 
          }}
        />
        <Text style={{ fontSize: isCompact ? 14 : 16, fontWeight: '600', color: TOKENS.color.text }}>
          {client.userName || 'Unknown'}
        </Text>
      </View>

      {/* Two Column Layout */}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {/* Left Column - Sections 1 & 2 */}
        <View style={{ flex: 1 }}>
          {/* Section 1: Workout Type */}
        <View className="flex-row items-center" style={{ marginBottom: 5 }}>
          <View style={{
            width: isCompact ? 19 : 24,
            height: isCompact ? 19 : 24,
            borderRadius: isCompact ? 10 : 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 7,
            backgroundColor: client.isReady ? TOKENS.color.accent : '#374151'
          }}>
            <Text style={{ fontSize: isCompact ? 10 : 11, color: client.isReady ? '#070b18' : TOKENS.color.muted, fontWeight: '700' }}>
              1
            </Text>
          </View>
          <Text style={{ fontSize: isCompact ? 10 : 12, color: TOKENS.color.text }} numberOfLines={1}>
            {client.preferences?.sessionGoal === 'targeted' ? 'Targeted' : 'Full Body'} • {client.preferences?.includeFinisher ? 'Finisher' : 'No Finisher'}
          </Text>
        </View>

        {/* Section 2: Muscle Targets */}
        <View className="flex-row items-start" style={{ marginBottom: 5 }}>
          <View style={{
            width: isCompact ? 19 : 24,
            height: isCompact ? 19 : 24,
            borderRadius: isCompact ? 10 : 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 7,
            backgroundColor: client.isReady ? TOKENS.color.accent : '#374151'
          }}>
            <Text style={{ fontSize: isCompact ? 10 : 11, color: client.isReady ? '#070b18' : TOKENS.color.muted, fontWeight: '700' }}>
              2
            </Text>
          </View>
          <View className="flex-1">
            {client.preferences?.muscleTargets && client.preferences.muscleTargets.length > 0 ? (
              <View className="flex-row flex-wrap">
                {client.preferences.muscleTargets.slice(0, 3).map((muscle, idx) => (
                  <View key={muscle} style={{
                    backgroundColor: 'rgba(124, 255, 181, 0.2)',
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: TOKENS.radius.chip,
                    marginRight: 5,
                    marginBottom: 2
                  }}>
                    <Text style={{ fontSize: isCompact ? 10 : 10, color: TOKENS.color.accent, fontWeight: '600' }}>
                      {muscle}
                    </Text>
                  </View>
                ))}
                {client.preferences.muscleTargets.length > 3 && (
                  <Text style={{ fontSize: isCompact ? 10 : 10, color: TOKENS.color.muted }}>
                    +{client.preferences.muscleTargets.length - 3}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={{ fontSize: isCompact ? 10 : 12, color: TOKENS.color.muted }}>No targets</Text>
            )}
          </View>
        </View>
        </View>

        {/* Right Column - Sections 3 & 4 */}
        <View style={{ flex: 1 }}>
          {/* Section 3: Muscle Limits */}
        <View className="flex-row items-start" style={{ marginBottom: 5 }}>
          <View style={{
            width: isCompact ? 19 : 24,
            height: isCompact ? 19 : 24,
            borderRadius: isCompact ? 10 : 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 7,
            backgroundColor: client.isReady ? TOKENS.color.accent : '#374151'
          }}>
            <Text style={{ fontSize: isCompact ? 10 : 11, color: client.isReady ? '#070b18' : TOKENS.color.muted, fontWeight: '700' }}>
              3
            </Text>
          </View>
          <View className="flex-1">
            {client.preferences?.muscleLessens && client.preferences.muscleLessens.length > 0 ? (
              <View className="flex-row flex-wrap">
                {client.preferences.muscleLessens.slice(0, 3).map((muscle) => (
                  <View key={muscle} style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: TOKENS.radius.chip,
                    marginRight: 5,
                    marginBottom: 2
                  }}>
                    <Text style={{ fontSize: isCompact ? 10 : 10, color: '#ef4444', fontWeight: '600' }}>
                      {muscle}
                    </Text>
                  </View>
                ))}
                {client.preferences.muscleLessens.length > 3 && (
                  <Text style={{ fontSize: isCompact ? 10 : 10, color: TOKENS.color.muted }}>
                    +{client.preferences.muscleLessens.length - 3}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={{ fontSize: isCompact ? 10 : 12, color: TOKENS.color.muted }}>No limits</Text>
            )}
          </View>
        </View>

        {/* Section 4: Intensity */}
        <View className="flex-row items-center">
          <View style={{
            width: isCompact ? 19 : 24,
            height: isCompact ? 19 : 24,
            borderRadius: isCompact ? 10 : 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 7,
            backgroundColor: client.isReady ? TOKENS.color.accent : '#374151'
          }}>
            <Text style={{ fontSize: isCompact ? 10 : 11, color: client.isReady ? '#070b18' : TOKENS.color.muted, fontWeight: '700' }}>
              4
            </Text>
          </View>
          <Text style={{ fontSize: isCompact ? 10 : 12, color: TOKENS.color.text }}>
            {(client.preferences?.intensity || 'Moderate').charAt(0).toUpperCase() + 
             (client.preferences?.intensity || 'Moderate').slice(1)} ({getExerciseCount(client.preferences?.intensity)})
          </Text>
        </View>
        </View>
      </View>
    </MattePanel>
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: TOKENS.color.bg }}>
        <ActivityIndicator size="large" color={TOKENS.color.accent} />
        <Text style={{ fontSize: 24, color: TOKENS.color.muted, marginTop: 16 }}>Loading preferences...</Text>
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
          onPress={handleContinue}
          focusable
          disabled={isGenerating}
        >
          {({ focused }) => (
            <MattePanel 
              focused={focused}
              style={{ 
                paddingHorizontal: 32,
                paddingVertical: 12,
                opacity: isGenerating ? 0.5 : 1,
                backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                borderWidth: focused ? 1 : 1,
                transform: focused ? [{ translateY: -1 }] : [],
              }}
            >
              <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>Continue</Text>
            </MattePanel>
          )}
        </Pressable>
      </View>

      {/* Client Cards Grid */}
      <View className="flex-1">
        {clients.length <= 4 ? (
          // Layout for 4 or fewer clients: 2 rows, first row always has 2 cards
          <View className="flex-1" style={{ gap: 12 }}>
            {/* First row - always 2 cards */}
            <View className="flex-row" style={{ flex: 1, gap: 12 }}>
              {clients.slice(0, 2).map((client) => (
                <View key={client.userId} style={{ flex: 1 }}>
                  {renderClientCard(client, false)}
                </View>
              ))}
            </View>
            {/* Second row - 0, 1, or 2 cards */}
            {clients.length > 2 && (
              <View className="flex-row" style={{ flex: 1, gap: 12 }}>
                {clients.slice(2, 4).map((client) => (
                  <View key={client.userId} style={{ flex: 1 }}>
                    {renderClientCard(client, false)}
                  </View>
                ))}
                {/* Add empty spacer if only 3 clients total */}
                {clients.length === 3 && <View style={{ flex: 1 }} />}
              </View>
            )}
          </View>
        ) : clients.length === 5 ? (
          // Special layout for 5 clients: 3 on top, 2 on bottom
          <View className="flex-1" style={{ gap: 12 }}>
            {/* Top row - 3 cards */}
            <View className="flex-row" style={{ flex: 1, gap: 12 }}>
              {clients.slice(0, 3).map((client) => (
                <View key={client.userId} style={{ flex: 1 }}>
                  {renderClientCard(client, true)}
                </View>
              ))}
            </View>
            {/* Bottom row - 2 cards */}
            <View className="flex-row" style={{ flex: 1, gap: 12, paddingHorizontal: '16.67%' }}>
              {clients.slice(3, 5).map((client) => (
                <View key={client.userId} style={{ flex: 1 }}>
                  {renderClientCard(client, true)}
                </View>
              ))}
            </View>
          </View>
        ) : (
          // Standard grid layout for more than 5 clients
          <View className="flex-1 flex-row flex-wrap items-center content-center" style={{ gap: 12 }}>
            {clients.map((client, index) => {
              const cardSizeClass = "w-1/3";
              const isCompact = true;
              
              return (
                <View key={client.userId} className={cardSizeClass} style={[
                  { padding: 6 },
                  { height: '55%' }
                ]}>
                  {renderClientCard(client, isCompact)}
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
            connectionStatus === 'connected' && statusConnectionStatus === 'connected' ? 'bg-green-400' : 'bg-gray-400'
          }`} />
          <Text style={{ fontSize: 16, color: TOKENS.color.text }}>
            {connectionStatus === 'connected' && statusConnectionStatus === 'connected' ? 'Live updates active' : 'Connecting...'}
          </Text>
        </View>
      </View>
      
      {/* Error Modal */}
      {generationError && (
        <View className="absolute inset-0 bg-black bg-opacity-50 items-center justify-center px-8">
          <MattePanel style={{ padding: 32, maxWidth: 500 }}>
            <Text style={{ fontSize: 20, fontWeight: '600', color: '#ef4444', marginBottom: 16 }}>Generation Failed</Text>
            <Text style={{ fontSize: 16, color: TOKENS.color.text, marginBottom: 24 }}>{generationError}</Text>
            <View className="flex-row justify-end space-x-4">
              <Pressable
                onPress={() => setGenerationError(null)}
                focusable
                style={({ focused }) => ({
                  paddingHorizontal: 24,
                  paddingVertical: 10,
                  backgroundColor: '#374151',
                  borderRadius: 8,
                  marginRight: 16,
                  transform: focused ? [{ scale: 1.05 }] : [{ scale: 1 }],
                  borderWidth: focused ? 2 : 0,
                  borderColor: focused ? TOKENS.color.focusRing : 'transparent',
                })}
              >
                <Text style={{ color: TOKENS.color.text, fontSize: 16 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setGenerationError(null);
                  // Reset and retry
                  setShouldGenerateBlueprint(false);
                  setTimeout(() => handleContinue(), 100);
                }}
                focusable
                style={({ focused }) => ({
                  paddingHorizontal: 24,
                  paddingVertical: 10,
                  backgroundColor: TOKENS.color.accent,
                  borderRadius: 8,
                  transform: focused ? [{ scale: 1.05 }] : [{ scale: 1 }],
                  borderWidth: focused ? 2 : 0,
                  borderColor: focused ? TOKENS.color.focusRing : 'transparent',
                })}
              >
                <Text style={{ color: '#070b18', fontWeight: '600', fontSize: 16 }}>Retry</Text>
              </Pressable>
            </View>
          </MattePanel>
        </View>
      )}
    </View>
  );
}