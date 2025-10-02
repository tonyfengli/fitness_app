import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useNavigation } from '../App';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { WorkoutGenerationLoader } from '../components/WorkoutGenerationLoader';
import { useSpotifySync } from '../hooks/useSpotifySync';
import { useRealtimeCircuitConfig } from '../hooks/useRealtimeCircuitConfig';

export function CircuitWorkoutGenerationScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const sessionId = navigation.getParam('sessionId');
  const [shouldGenerateBlueprint, setShouldGenerateBlueprint] = useState(true);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [realtimeConfig, setRealtimeConfig] = useState<any>(null);
  
  // Get circuit config (needed for Spotify sync)
  const { data: circuitConfig } = useQuery(
    sessionId ? api.circuitConfig.getBySession.queryOptions({ sessionId: sessionId || '' }) : {
      enabled: false,
      queryKey: ['disabled-circuit-config-gen'],
      queryFn: () => Promise.resolve(null)
    }
  );

  // Real-time updates for circuit config
  const { isConnected } = useRealtimeCircuitConfig({
    sessionId: sessionId || '',
    onConfigUpdate: (event) => {
      // Realtime config update received
      setRealtimeConfig(event.config);
    }
  });

  // Use realtime data if available
  const currentConfig = realtimeConfig || circuitConfig;
  
  // Initialize Spotify connection if device ID is available
  const { 
    isConnected: isSpotifyConnected,
    prefetchSetlistTracks,
    setlist
  } = useSpotifySync(
    sessionId || '', 
    currentConfig?.config?.spotifyDeviceId
  );
  
  // Prefetch tracks when Spotify is connected
  useEffect(() => {
    if (isSpotifyConnected && setlist && prefetchSetlistTracks) {
      prefetchSetlistTracks();
    }
  }, [isSpotifyConnected, setlist, prefetchSetlistTracks]);

  // Check for existing workout selections
  const { data: existingSelections } = useQuery(
    sessionId ? api.workoutSelections.getSelections.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ['disabled-selections-gen'],
      queryFn: () => Promise.resolve([])
    }
  );

  // Check session data for existing workout organization
  const { data: sessionData } = useQuery(
    sessionId ? api.trainingSession.getSession.queryOptions({ id: sessionId }) : {
      enabled: false,
      queryKey: ['disabled-session-gen'],
      queryFn: () => Promise.resolve(null)
    }
  );

  // Blueprint generation query
  const { data: blueprintResult, isLoading: isBlueprintLoading, error: blueprintError } = useQuery({
    ...api.trainingSession.generateGroupWorkoutBlueprint.queryOptions({
      sessionId: sessionId || '',
      options: {
        includeDiagnostics: true,
        phase1Only: true
      }
    }),
    enabled: shouldGenerateBlueprint && !!sessionId && 
             existingSelections !== undefined && existingSelections.length === 0,
    retry: false
  });

  // Save visualization mutation
  const saveVisualization = useMutation({
    ...api.trainingSession.saveVisualizationData.mutationOptions()
  });

  // Create workouts from blueprint mutation
  const createWorkoutsFromBlueprint = useMutation({
    ...api.trainingSession.createWorkoutsFromBlueprint.mutationOptions()
  });

  // Check for existing data on mount
  useEffect(() => {
    if (existingSelections && existingSelections.length > 0) {
      navigation.navigate('CircuitWorkoutOverview', { sessionId });
    } else if (sessionData?.templateConfig?.visualizationData?.llmResult?.exerciseSelection) {
      navigation.navigate('CircuitWorkoutOverview', { sessionId });
    }
  }, [existingSelections, sessionData, sessionId, navigation]);

  // Handle blueprint generation result
  useEffect(() => {
    let isMounted = true;
    
    const processBlueprint = async () => {
      if (blueprintResult && shouldGenerateBlueprint && isMounted) {
        try {
          setShouldGenerateBlueprint(false);
          
          // Save visualization data
          const llmResultWithDebug = {
            ...blueprintResult.llmResult,
            debug: {
              systemPromptsByClient: blueprintResult.llmResult?.systemPromptsByClient || {},
              llmResponsesByClient: blueprintResult.llmResult?.llmResponsesByClient || {}
            }
          };
          
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
          
          // Create the actual workouts
          const createWorkoutResult = await createWorkoutsFromBlueprint.mutateAsync({
            sessionId: sessionId!,
            blueprintData: blueprintResult
          });
          
          navigation.navigate('CircuitWorkoutOverview', { sessionId });
        } catch (error: any) {
          
          if (isMounted) {
            setGenerationError(error.message || 'Failed to generate workout.');
            Alert.alert(
              'Generation Error',
              'Failed to generate workout. Please try again.',
              [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack()
                }
              ]
            );
          }
        }
      }
    };
    
    processBlueprint();
    
    return () => {
      isMounted = false;
    };
  }, [blueprintResult, shouldGenerateBlueprint, sessionId, navigation, saveVisualization, createWorkoutsFromBlueprint]);
  
  // Handle blueprint error
  useEffect(() => {
    if (blueprintError && shouldGenerateBlueprint) {
      setGenerationError('Failed to generate workout.');
      setShouldGenerateBlueprint(false);
      Alert.alert(
        'Generation Error',
        'Failed to generate workout. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    }
  }, [blueprintError, shouldGenerateBlueprint, navigation]);

  // Show loading screen
  return (
    <WorkoutGenerationLoader
      clientNames={[]}
      durationMinutes={1}
      forceComplete={!!blueprintResult}
      onCancel={() => {
        setShouldGenerateBlueprint(false);
        navigation.goBack();
      }}
    />
  );
}