import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useNavigation } from '../App';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimeCircuitConfig } from '../hooks/useRealtimeCircuitConfig';
import { WorkoutGenerationLoader } from '../components/WorkoutGenerationLoader';
import { useSpotifySync } from '../hooks/useSpotifySync';
import type { CircuitConfig } from '@acme/db';

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

// Format duration in MM:SS format
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function CircuitPreferencesScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const sessionId = navigation.getParam('sessionId');
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<Date | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [realtimeConfig, setRealtimeConfig] = useState<CircuitConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [shouldGenerateBlueprint, setShouldGenerateBlueprint] = useState(false);

  // Poll for circuit config every 10 seconds as fallback
  const { data: pollingData, isLoading, error: fetchError } = useQuery({
    ...api.circuitConfig.getBySession.queryOptions({ sessionId: sessionId || '' }),
    enabled: !!sessionId,
    refetchInterval: 10000, // Poll every 10 seconds
    refetchIntervalInBackground: true,
  });

  // Real-time updates
  const { isConnected } = useRealtimeCircuitConfig({
    sessionId: sessionId || '',
    onConfigUpdate: (event) => {
      // Realtime config update received
      setRealtimeConfig(event.config);
    },
    onError: (err) => {
    }
  });

  // Use realtime data if available, otherwise fall back to polling
  const circuitConfig = realtimeConfig || pollingData;
  
  // Initialize Spotify connection if device ID is available
  const { 
    isConnected: isSpotifyConnected,
    connectionState: spotifyConnectionState,
    currentDevice: spotifyDevice,
    error: spotifyError,
    prefetchSetlistTracks,
    setlist
  } = useSpotifySync(
    sessionId || '', 
    circuitConfig?.config?.spotifyDeviceId
  );
  
  // Track Spotify connection state changes
  useEffect(() => {
    // Spotify connection state updated
  }, [sessionId, circuitConfig?.config?.spotifyDeviceId, isSpotifyConnected, spotifyConnectionState, spotifyDevice, spotifyError, setlist]);

  // Prefetch tracks when Spotify is connected and setlist is available
  useEffect(() => {
    if (isSpotifyConnected && setlist && prefetchSetlistTracks) {
      // Prefetching setlist tracks
      prefetchSetlistTracks();
    }
  }, [isSpotifyConnected, setlist, prefetchSetlistTracks]);

  // Check for existing workout selections
  const { data: existingSelections } = useQuery(
    sessionId ? api.workoutSelections.getSelections.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ['disabled-selections'],
      queryFn: () => Promise.resolve([])
    }
  );

  // Check session data for existing workout organization
  const { data: sessionData } = useQuery(
    sessionId ? api.trainingSession.getSession.queryOptions({ id: sessionId }) : {
      enabled: false,
      queryKey: ['disabled-session'],
      queryFn: () => Promise.resolve(null)
    }
  );

  // Blueprint generation query - triggered manually
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
    }
  });

  // Create workouts from blueprint mutation
  const createWorkoutsFromBlueprint = useMutation({
    ...api.trainingSession.createWorkoutsFromBlueprint.mutationOptions(),
    onError: (error) => {
    }
  });

  // Update connection state based on polling success
  useEffect(() => {
    if (pollingData !== undefined && !isLoading) {
      if (!fetchError) {
        const now = new Date();
        setLastSuccessfulFetch(now);
        setConnectionState('connected');
      }
    }
  }, [pollingData, isLoading, fetchError]);

  // Handle fetch errors
  useEffect(() => {
    if (fetchError && !isLoading) {
      // Connection error detected
      setConnectionState('error');
    }
  }, [fetchError, isLoading]);

  // Format time in 12-hour format
  function formatTime12Hour(date: Date): string {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    
    return `${hours12}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
  }

  const handleContinue = async () => {
    // Handle continue button
    
    // Check if we already have workout exercises
    if (existingSelections && existingSelections.length > 0) {
      // Found existing selections, navigating to WorkoutOverview
      // Skip loading screen and navigate directly
      navigation.navigate('CircuitWorkoutOverview', { sessionId });
      return;
    }
    
    // If no selections but session has visualization data (Phase 1 completed), something is wrong - still go to overview
    if (sessionData?.templateConfig?.visualizationData?.llmResult?.exerciseSelection) {
      // Found visualization data, navigating to WorkoutOverview
      // Skip loading screen and navigate directly
      navigation.navigate('CircuitWorkoutOverview', { sessionId });
      return;
    }
    
    // No existing data, starting blueprint generation
    // No existing exercises, proceed with generation
    setIsGenerating(true);
    setGenerationError(null);
    setShouldGenerateBlueprint(true);
  };

  // Handle blueprint generation result
  useEffect(() => {
    let isMounted = true;
    
    const processBlueprint = async () => {
      // Process blueprint effect triggered
      
      if (blueprintResult && isGenerating && shouldGenerateBlueprint && isMounted) {
        // Processing blueprint result
        
        try {
          // Immediately mark as processing to prevent re-runs
          setShouldGenerateBlueprint(false);
          
          // Save visualization data
          const llmResultWithDebug = {
            ...blueprintResult.llmResult,
            // Wrap debug data if it exists
            debug: {
              systemPromptsByClient: blueprintResult.llmResult?.systemPromptsByClient || {},
              llmResponsesByClient: blueprintResult.llmResult?.llmResponsesByClient || {}
            }
          };
          
          // Saving visualization data
          
          await saveVisualization.mutateAsync({
            sessionId: sessionId!,
            visualizationData: {
              blueprint: blueprintResult.blueprint,
              groupContext: blueprintResult.groupContext,
              llmResult: llmResultWithDebug,
              summary: blueprintResult.summary,
              exerciseMetadata: blueprintResult.blueprint?.clientExercisePools || undefined,
              sharedExerciseIds: blueprintResult.blueprint?.sharedExercisePool?.map((e: any) => e.id) || undefined
            }
          });
          // Visualization data saved successfully
          
          // Now create the actual workouts
          
          const createWorkoutResult = await createWorkoutsFromBlueprint.mutateAsync({
            sessionId: sessionId!,
            blueprintData: blueprintResult
          });
          
          // Workouts created successfully
          
          setIsGenerating(false);
          
          // Navigate to WorkoutOverview
          navigation.navigate('CircuitWorkoutOverview', { sessionId });
        } catch (error: any) {
          
          if (isMounted) {
            setGenerationError(error.message || 'Failed to generate workout. Please try again.');
            setIsGenerating(false);
          }
        }
      }
    };
    
    processBlueprint();
    
    return () => {
      isMounted = false;
    };
  }, [blueprintResult, isGenerating, shouldGenerateBlueprint, sessionId, navigation, saveVisualization]);
  
  // Handle blueprint error
  useEffect(() => {
    if (blueprintError && isGenerating) {
      setGenerationError('Failed to generate workout. Please try again.');
      setIsGenerating(false);
      setShouldGenerateBlueprint(false);
    }
  }, [blueprintError, isGenerating]);

  if (isLoading && !circuitConfig) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: TOKENS.color.bg }}>
        <ActivityIndicator size="large" color={TOKENS.color.accent} />
        <Text style={{ fontSize: 24, color: TOKENS.color.muted, marginTop: 16 }}>Loading circuit configuration...</Text>
      </View>
    );
  }

  // Show loading screen when generating workout
  if (isGenerating) {
    return (
      <WorkoutGenerationLoader
        clientNames={[]} // Circuit workouts don't need client names for now
        durationMinutes={1}
        forceComplete={!!blueprintResult}
        onCancel={() => {
          setIsGenerating(false);
          setShouldGenerateBlueprint(false);
          setGenerationError(null);
        }}
      />
    );
  }

  // Format duration for display (e.g., "40s" instead of "0:40")
  const formatDurationShort = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    if (minutes === 0) {
      return `${seconds}s`;
    }
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: TOKENS.color.bg }}>
      {/* Top Bar */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 48,
        paddingVertical: 16
      }}>
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
                backgroundColor: focused ? 'rgba(124,255,181,0.2)' : TOKENS.color.card,
                borderColor: focused ? TOKENS.color.accent : TOKENS.color.borderGlass,
                borderWidth: 1,
                transform: focused ? [{ translateY: -1 }] : [],
              }}
            >
              <Text style={{ 
                color: focused ? TOKENS.color.accent : TOKENS.color.text, 
                fontSize: 18,
                fontWeight: focused ? '600' : '400'
              }}>
                Continue
              </Text>
            </MattePanel>
          )}
        </Pressable>
      </View>

      {/* Center Stage */}
      <View style={{ flex: 1, paddingHorizontal: 48, justifyContent: 'center' }}>
        <MattePanel style={{ maxWidth: 624, width: '100%', alignSelf: 'center', padding: 24 }}>
          {/* Title */}
          <Text style={{ 
            fontSize: 26, 
            fontWeight: '700', 
            color: TOKENS.color.text,
            marginBottom: 24,
          }}>
            Session Configuration
          </Text>

          {/* Configuration Grid */}
          <View style={{ gap: 16 }}>
            {/* Row 1 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: TOKENS.color.accent2 
                }} />
                <Text style={{ fontSize: 16, color: TOKENS.color.text }}># of Rounds</Text>
              </View>
              <View style={{ 
                padding: 8, 
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: '#254063',
                borderStyle: 'dashed',
                borderRadius: 10,
                backgroundColor: 'rgba(12,28,47,0.25)',
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '800',
                  color: TOKENS.color.text 
                }}>
                  {(() => {
                    const baseRounds = circuitConfig?.config?.rounds || circuitConfig?.rounds || 3;
                    const repeatEnabled = circuitConfig?.config?.repeatRounds || false;
                    return repeatEnabled ? baseRounds * 2 : baseRounds;
                  })()}
                </Text>
              </View>
            </View>

            {/* Row 2 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: TOKENS.color.accent2 
                }} />
                <Text style={{ fontSize: 16, color: TOKENS.color.text }}># of Exercises per Round</Text>
              </View>
              <View style={{ 
                padding: 8, 
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: '#254063',
                borderStyle: 'dashed',
                borderRadius: 10,
                backgroundColor: 'rgba(12,28,47,0.25)',
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '800',
                  color: TOKENS.color.text 
                }}>
                  {circuitConfig?.config?.exercisesPerRound || circuitConfig?.exercisesPerRound || 6}
                </Text>
              </View>
            </View>

            {/* Row 3 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: TOKENS.color.accent2 
                }} />
                <Text style={{ fontSize: 16, color: TOKENS.color.text }}>Exercise Duration</Text>
              </View>
              <View style={{ 
                padding: 8, 
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: '#254063',
                borderStyle: 'dashed',
                borderRadius: 10,
                backgroundColor: 'rgba(12,28,47,0.25)',
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '800',
                  color: TOKENS.color.text 
                }}>
                  {formatDuration(circuitConfig?.config?.workDuration || circuitConfig?.workDuration || 45)}
                </Text>
              </View>
            </View>

            {/* Row 4 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: TOKENS.color.accent2 
                }} />
                <Text style={{ fontSize: 16, color: TOKENS.color.text }}>Rest Duration</Text>
              </View>
              <View style={{ 
                padding: 8, 
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: '#254063',
                borderStyle: 'dashed',
                borderRadius: 10,
                backgroundColor: 'rgba(12,28,47,0.25)',
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '800',
                  color: TOKENS.color.text 
                }}>
                  {formatDuration(circuitConfig?.config?.restDuration || circuitConfig?.restDuration || 15)}
                </Text>
              </View>
            </View>

            {/* Row 5 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: TOKENS.color.accent2 
                }} />
                <Text style={{ fontSize: 16, color: TOKENS.color.text }}>Rest Between Rounds</Text>
              </View>
              <View style={{ 
                padding: 8, 
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: '#254063',
                borderStyle: 'dashed',
                borderRadius: 10,
                backgroundColor: 'rgba(12,28,47,0.25)',
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '800',
                  color: TOKENS.color.text 
                }}>
                  {formatDuration(circuitConfig?.config?.restBetweenRounds || circuitConfig?.restBetweenRounds || 60)}
                </Text>
              </View>
            </View>

            {/* Row 6 - Spotify Connection */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: TOKENS.color.accent2 
                }} />
                <Text style={{ fontSize: 16, color: TOKENS.color.text }}>Spotify Connection</Text>
              </View>
              <View style={{ 
                padding: 8, 
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: (() => {
                  if (!circuitConfig?.config?.spotifyDeviceId) return '#254063';
                  return isSpotifyConnected ? '#10b981' : '#6b7280';
                })(),
                borderStyle: 'dashed',
                borderRadius: 10,
                backgroundColor: (() => {
                  if (!circuitConfig?.config?.spotifyDeviceId) return 'rgba(12,28,47,0.25)';
                  return isSpotifyConnected ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)';
                })(),
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '800',
                  color: (() => {
                    if (!circuitConfig?.config?.spotifyDeviceId) return TOKENS.color.text;
                    return isSpotifyConnected ? '#10b981' : '#6b7280';
                  })()
                }}>
                  {(() => {
                    if (!circuitConfig?.config?.spotifyDeviceId) return 'Disconnected';
                    const deviceName = circuitConfig?.config?.spotifyDeviceName || 'Device';
                    if (spotifyConnectionState === 'connecting') return `Connecting to ${deviceName}...`;
                    if (isSpotifyConnected) return deviceName;
                    // Don't show error if we're still in early loading states
                    if (spotifyError && spotifyConnectionState !== 'disconnected') return `${deviceName} (Searching...)`;
                    if (spotifyError) return `${deviceName} (Offline)`;
                    return `${deviceName} (Stored)`;
                  })()}
                </Text>
              </View>
            </View>
          </View>
        </MattePanel>
      </View>

      {/* Footer Bar */}
      <View style={{ 
        paddingHorizontal: 48,
        paddingVertical: 24,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View 
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              marginRight: 2,
              backgroundColor: connectionState === 'connecting' ? '#9ca3af' :
                            connectionState === 'connected' ? '#4ade80' : '#ef4444',
              shadowColor: connectionState === 'connected' ? '#4ade80' : '#ef4444',
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            }} 
          />
          <Text style={{ fontSize: 15, color: TOKENS.color.muted }}>
            {connectionState === 'connecting' ? 'Connecting...' :
             connectionState === 'connected' ? `Live - ${lastSuccessfulFetch ? formatTime12Hour(lastSuccessfulFetch) : 'connecting'}` :
             `Disconnected`}
          </Text>
        </View>
      </View>
    </View>
  );
}