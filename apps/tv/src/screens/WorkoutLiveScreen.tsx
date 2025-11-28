import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation } from '../App';
import { useQuery } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import RoundView from './RoundView';
import { transformWorkoutDataForLiveView } from '../utils/workoutDataTransformer';
import { setHueLights, startHealthCheck, stopHealthCheck } from '../lib/lighting';
import { getColorForPreset, getHuePresetForColor } from '../lib/lighting/colorMappings';
import { LightingStatusDot } from '../components/LightingStatusDot';

// Design tokens - matching other screens
const TOKENS = {
  color: {
    bg: '#070b18',
    card: '#111928',
    text: '#ffffff',
    muted: '#9cb0ff',
    accent: '#7cffb5',
    accent2: '#5de1ff',
  },
};

export function WorkoutLiveScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const round = navigation.getParam('round') || 1;
  
  // Store initial params to prevent double mount issues
  const initialParams = React.useRef({
    organization: navigation.getParam('organization'),
    workouts: navigation.getParam('workouts'),
    clients: navigation.getParam('clients'),
    isPhase2Loading: navigation.getParam('isPhase2Loading'),
    phase2Error: navigation.getParam('phase2Error')
  });
  
  console.log('[WorkoutLiveScreen] Initial mount:', {
    sessionId,
    hasData: !!initialParams.current.workouts
  });
  
  // Get any passed organization data for efficiency
  const [passedOrganization, setPassedOrganization] = useState(initialParams.current.organization);
  const [passedWorkouts, setPassedWorkouts] = useState(initialParams.current.workouts);
  const [passedClients] = useState(initialParams.current.clients);
  const [isPhase2Loading, setIsPhase2Loading] = useState(initialParams.current.isPhase2Loading || false);
  const [phase2Error, setPhase2Error] = useState(initialParams.current.phase2Error);
  
  // Lighting state
  const [lastLightingEvent, setLastLightingEvent] = useState<string>('');
  const currentLightingZoneRef = useRef<string>('');
  
  // Update state when params change
  useEffect(() => {
    const org = navigation.getParam('organization');
    const workouts = navigation.getParam('workouts');
    const loading = navigation.getParam('isPhase2Loading');
    const error = navigation.getParam('phase2Error');
    
    if (org !== passedOrganization) setPassedOrganization(org);
    if (workouts !== passedWorkouts) setPassedWorkouts(workouts);
    if (loading !== isPhase2Loading) setIsPhase2Loading(loading || false);
    if (error !== phase2Error) setPhase2Error(error);
  }, [navigation]);
  
  
  // Fetch workout data - only if not passed via navigation
  const { data: sessionWorkouts, isLoading: workoutsLoading, error: workoutsError } = useQuery(
    sessionId && !passedWorkouts ? {
      ...api.workout.sessionWorkoutsWithExercises.queryOptions({ sessionId }),
      // Poll every 5 seconds to detect exercise replacements or order changes
      refetchInterval: 5000,
      // Always compare with server data even if we have passed workouts
      refetchIntervalInBackground: true
    } : {
        enabled: false,
        queryKey: ['disabled'],
        queryFn: () => Promise.resolve(passedWorkouts || []),
        initialData: passedWorkouts
      }
  );
  
  // Fetch clients data - only if not passed via navigation
  const { data: fetchedClients, isLoading: clientsLoading, error: clientsError } = useQuery(
    sessionId && !passedClients ? 
      api.trainingSession.getCheckedInClients.queryOptions({ sessionId }) : {
        enabled: false,
        queryKey: ['disabled-clients'],
        queryFn: () => Promise.resolve(passedClients || []),
        initialData: passedClients
      }
  );
  
  // Use passed data if available, otherwise use fetched data
  const workouts = passedWorkouts || sessionWorkouts || [];
  const clients = passedClients || fetchedClients || [];
  
  // Extract user-exercise pairs for performance query
  const userExercisePairs = React.useMemo(() => {
    console.log('[WorkoutLiveScreen] Building user-exercise pairs from workouts:', workouts.length);
    if (workouts.length > 0) {
      console.log('[WorkoutLiveScreen] Sample workout object:', workouts[0]);
    }
    
    const pairs = workouts.map(w => ({
      userId: w.clientId,
      exerciseId: w.exerciseId,
      workoutExerciseId: w.id
    })).filter(p => p.userId && p.exerciseId && p.workoutExerciseId);
    
    if (pairs.length > 0) {
      console.log('[WorkoutLiveScreen] Performance query enabled with', pairs.length, 'user-exercise pairs');
      console.log('[WorkoutLiveScreen] First few pairs:', pairs.slice(0, 3));
    }
    return pairs;
  }, [workouts]);

  // Fetch performance metrics using TRPC pattern - now queries by user+exercise
  const { 
    data: performanceMetrics, 
    isLoading: performanceLoading,
    error: performanceError 
  } = useQuery({
    ...api.postWorkoutFeedback.getLatestPerformanceByUserExercises.queryOptions({ 
      userExercisePairs 
    }),
    enabled: userExercisePairs.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Log only when performance data loads
  React.useEffect(() => {
    if (!performanceLoading && performanceMetrics) {
      console.log('[WorkoutLiveScreen] Performance data loaded:', performanceMetrics.length, 'records');
      console.log('[WorkoutLiveScreen] Performance data details:', performanceMetrics);
    }
  }, [performanceLoading, performanceMetrics]);

  // Create performance lookup map
  const performanceByWorkoutExerciseId = React.useMemo(() => {
    const map = new Map();
    performanceMetrics?.forEach(metric => {
      map.set(metric.workoutExerciseId, metric);
    });
    console.log('[WorkoutLiveScreen] Performance lookup map created:', {
      size: map.size,
      entries: Array.from(map.entries()).map(([key, value]) => ({
        workoutExerciseId: key,
        weight: value.weight,
        userId: value.userId,
        exerciseId: value.exerciseId
      }))
    });
    
    // Also log current workout exercise IDs for comparison
    console.log('[WorkoutLiveScreen] Current workout exercise IDs:', 
      workouts.map(w => ({ id: w.id, clientId: w.clientId, exerciseId: w.exerciseId }))
    );
    
    return map;
  }, [performanceMetrics, workouts]);
  
  const isLoading = workoutsLoading || clientsLoading;
  const error = workoutsError || clientsError;
  
  
  // Poll for session data to detect Phase 2 completion
  const { data: sessionData, isLoading: sessionLoading, error: sessionError } = useQuery({
    ...api.trainingSession.getById.queryOptions({ id: sessionId }),
    enabled: !!sessionId && isPhase2Loading,
    refetchInterval: 2000, // Poll every 2 seconds while Phase 2 is loading
    refetchIntervalInBackground: true,
  });
  
  // Update organization when Phase 2 completes
  useEffect(() => {
    if (sessionData?.workoutOrganization && isPhase2Loading && !sessionLoading) {
      
      // Transform the complete organization
      const completeOrganization = transformWorkoutDataForLiveView(
        sessionData.workoutOrganization,
        passedWorkouts || []
      );
      
      // Update local state
      setPassedOrganization(completeOrganization);
      setIsPhase2Loading(false);
    }
  }, [sessionData, isPhase2Loading, sessionLoading, passedWorkouts]);
  
  // Start health check on mount and apply App Start color
  useEffect(() => {
    startHealthCheck();
    // Apply App Start color on mount
    getColorForPreset('app_start').then(color => {
      const preset = getHuePresetForColor(color);
      setHueLights(preset);
    });
    return () => {
      stopHealthCheck();
      // Apply App Start color when leaving
      getColorForPreset('app_start').then(color => {
        const preset = getHuePresetForColor(color);
        setHueLights(preset);
      });
    };
  }, []);

  // Track current round to detect round changes
  const currentRoundRef = useRef<number>(-1);
  
  // Handle timer updates from RoundView
  const handleTimerUpdate = useCallback(async (timeRemaining: number, roundIndex: number) => {
    // Check if round changed and reset zone
    if (roundIndex !== currentRoundRef.current) {
      currentRoundRef.current = roundIndex;
      currentLightingZoneRef.current = ''; // Reset zone to force update
      console.log(`Round changed to ${roundIndex + 1}, resetting lighting zone`);
    }
    
    // Timer counts DOWN from 600 (10:00) to 0 (0:00)
    let zone = '';
    
    if (timeRemaining >= 300) { // 10:00 to 5:00 (first 5 minutes)
      zone = 'strength_0_5_min';
    } else if (timeRemaining >= 60) { // 4:59 to 1:00 (next ~4 minutes)
      zone = 'strength_5_9_min';
    } else if (timeRemaining > 0) { // 0:59 to 0:01 (last minute)
      zone = 'strength_9_10_min';
    } else { // 0:00 - timer expired
      zone = 'strength_9_10_min'; // Keep red at 0
    }
    
    // Use ref to track current zone without causing callback recreation
    if (zone !== currentLightingZoneRef.current) {
      currentLightingZoneRef.current = zone;
      const color = await getColorForPreset(zone);
      const preset = getHuePresetForColor(color);
      await setHueLights(preset);
      const mins = Math.floor(timeRemaining / 60);
      const secs = timeRemaining % 60;
      console.log(`Strength lighting: ${zone} at ${mins}:${secs.toString().padStart(2, '0')} remaining`);
    }
  }, []); // No dependencies needed since we use refs
  
  // Helper function to format exercise metadata
  const formatExerciseMeta = (exercise: any): string => {
    const parts = [];
    
    // Add muscle group
    if (exercise.exercise?.primaryMuscle) {
      parts.push(exercise.exercise.primaryMuscle);
    }
    
    // Add scheme info
    if (exercise.scheme) {
      if (exercise.scheme.type === 'reps') {
        parts.push(`${exercise.scheme.sets}×${exercise.scheme.reps}`);
      } else if (exercise.scheme.type === 'time') {
        parts.push(`${exercise.scheme.work}/${exercise.scheme.rest} × ${exercise.scheme.rounds}`);
      }
    }
    
    // Add phase as intensity indicator
    if (exercise.phase === 'main_strength') {
      parts.push('Heavy');
    } else if (exercise.phase === 'accessory') {
      parts.push('Moderate');
    } else if (exercise.phase === 'core') {
      parts.push('Core');
    } else if (exercise.phase === 'power_conditioning') {
      parts.push('Conditioning');
    }
    
    return parts.join(' • ');
  };

  // Helper function to format exercise metadata from scheme data
  const formatExerciseMetaFromScheme = (scheme: any, fullExercise?: any): string => {
    if (!scheme) return '';
    
    if (scheme.type === 'reps') {
      const setWord = scheme.sets === 1 ? 'set' : 'sets';
      const repWord = scheme.reps === 1 ? 'rep' : 'reps';
      return `${scheme.sets} ${setWord}, ${scheme.reps} ${repWord}`;
    } else if (scheme.type === 'time') {
      const roundWord = scheme.rounds === 1 ? 'round' : 'rounds';
      return `${scheme.rounds} ${roundWord}, ${scheme.work} work / ${scheme.rest} rest`;
    }
    
    return '';
  };

  // Transform workouts data into rounds format for RoundView
  const roundsData = React.useMemo(() => {
    if (!passedOrganization || !workouts || workouts.length === 0) {
      return [];
    }
    
    // Create a map to store round data
    const roundsList = [];
    
    // Process each round from the organization
    passedOrganization.rounds?.forEach(round => {
      // Extract round number and name
      const roundMatch = round.name.match(/Round (\d+) - (.+)/);
      const roundNumber = roundMatch ? roundMatch[1] : '1';
      const roundName = roundMatch ? roundMatch[2] : round.name;
      
      const roundData = {
        label: roundName, // "Heavy Lower Strength"
        workSeconds: 600, // 10 minutes
        restSeconds: 60,  // 1 minute rest
        phase: "work" as const,
        exercises: [] as any[]
      };
      
      // First, group exercises by exercise ID to handle shared exercises
      const exerciseGroups = new Map();
      
      // Process all clients' exercises to group by exercise
      Object.entries(round.exercisesByClient).forEach(([clientId, clientExercises]) => {
        (clientExercises as any[]).forEach(exercise => {
          const key = exercise.exerciseId;
          
          if (!exerciseGroups.has(key)) {
            exerciseGroups.set(key, {
              exerciseId: exercise.exerciseId,
              exerciseName: exercise.exerciseName,
              isShared: exercise.isShared || false,
              clients: [],
              scheme: exercise.scheme
            });
          }
          
          // Find client info
          const clientData = clients?.find((c: any) => c.userId === clientId);
          const clientWorkout = workouts.find(w => {
            if (w.userId === clientId) return true;
            if (w.user?.id === clientId) return true;
            if (w.workout?.userId === clientId) return true;
            return false;
          });
          
          const clientName = clientData?.userName || 
                           clientWorkout?.user?.name ||
                           clientWorkout?.userName || 
                           clientWorkout?.user?.email?.split('@')[0] ||
                           clientWorkout?.userEmail?.split('@')[0] || 
                           'Unknown';
          
          exerciseGroups.get(key).clients.push({
            clientId,
            clientName
          });
        });
      });
      
      // Now create exercise cards - one per unique exercise (shared exercises will have multiple clients)
      exerciseGroups.forEach(exerciseGroup => {
        // For non-shared exercises, create individual cards for each client
        if (!exerciseGroup.isShared || exerciseGroup.clients.length === 1) {
          exerciseGroup.clients.forEach(client => {
            // Find this client's specific exercises (for supersets)
            const clientExercises = (round.exercisesByClient[client.clientId] || [])
              .filter(ex => ex.exerciseId === exerciseGroup.exerciseId);
            
            if (clientExercises.length > 0) {
              const exerciseDetails = clientExercises.map(ex => ({
                exerciseId: ex.exerciseId,
                title: ex.exerciseName || exerciseGroup.exerciseName || 'Unknown Exercise',
                meta: formatExerciseMetaFromScheme(ex.scheme || exerciseGroup.scheme),
              }));
              
              roundData.exercises.push({
                title: exerciseDetails.map(e => e.title).join(' + '),
                meta: exerciseDetails.map(e => e.meta).filter(m => m).join(' | '),
                assigned: [{ 
                  clientName: client.clientName, 
                  tag: (() => {
                    // Find the workout exercise for this client/exercise combo
                    const workoutExercise = workouts.find(w => 
                      w.clientId === client.clientId && 
                      w.exerciseId === exerciseGroup.exerciseId
                    );
                    
                    if (!workoutExercise) {
                      console.log('[WorkoutLiveScreen] Tag - No workout exercise found for:', {
                        clientName: client.clientName,
                        exerciseName: exerciseGroup.exerciseName,
                        clientId: client.clientId,
                        exerciseId: exerciseGroup.exerciseId
                      });
                      return '';
                    }
                    
                    const metric = performanceByWorkoutExerciseId.get(workoutExercise.id);
                    console.log('[WorkoutLiveScreen] Tag assignment:', {
                      clientName: client.clientName,
                      exerciseName: exerciseGroup.exerciseName,
                      workoutExerciseId: workoutExercise.id,
                      hasMetric: !!metric,
                      weight: metric?.weight
                    });
                    
                    if (!metric?.weight) return '';
                    
                    return `${metric.weight} lbs`;
                  })()
                }],
                exerciseDetails: exerciseDetails
              });
            }
          });
        } else {
          // For shared exercises, create one card with all clients
          const exerciseDetails = [{
            exerciseId: exerciseGroup.exerciseId,
            title: exerciseGroup.exerciseName || 'Unknown Exercise',
            meta: formatExerciseMetaFromScheme(exerciseGroup.scheme),
          }];
          
          roundData.exercises.push({
            title: exerciseDetails[0].title,
            meta: exerciseDetails[0].meta,
            assigned: exerciseGroup.clients.map(client => ({ 
              clientName: client.clientName, 
              tag: (() => {
                // Find the workout exercise for this client/exercise combo
                const workoutExercise = workouts.find(w => 
                  w.clientId === client.clientId && 
                  w.exerciseId === exerciseGroup.exerciseId
                );
                
                if (!workoutExercise) {
                  console.log('[WorkoutLiveScreen] Shared tag - No workout exercise found for:', {
                    clientName: client.clientName,
                    exerciseName: exerciseGroup.exerciseName,
                    clientId: client.clientId,
                    exerciseId: exerciseGroup.exerciseId
                  });
                  return '';
                }
                
                const metric = performanceByWorkoutExerciseId.get(workoutExercise.id);
                console.log('[WorkoutLiveScreen] Shared tag assignment:', {
                  clientName: client.clientName,
                  exerciseName: exerciseGroup.exerciseName,
                  workoutExerciseId: workoutExercise.id,
                  hasMetric: !!metric,
                  weight: metric?.weight
                });
                
                if (!metric?.weight) return '';
                
                return `${metric.weight} lbs`;
              })()
            })),
            exerciseDetails: exerciseDetails,
            isShared: true
          });
        }
      });
      
      // Only add rounds that have exercises
      if (roundData.exercises.length > 0) {
        roundsList.push(roundData);
      }
    });
    
    return roundsList;
  }, [passedOrganization, workouts, performanceByWorkoutExerciseId]);
  
  // Show loading state
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: TOKENS.color.bg }}>
        <ActivityIndicator size="large" color={TOKENS.color.accent} />
        <Text style={{ fontSize: 24, color: TOKENS.color.muted, marginTop: 16 }}>Loading workout...</Text>
      </View>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: TOKENS.color.bg }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
        <Text style={{ fontSize: 24, color: TOKENS.color.text, marginBottom: 8 }}>Unable to Load Workout</Text>
        <Text style={{ fontSize: 18, color: TOKENS.color.muted }}>Please try again</Text>
      </View>
    );
  }
  
  
  return (
    <View style={{ flex: 1, backgroundColor: TOKENS.color.bg }}>
      <RoundView 
        sessionId={sessionId} 
        round={round} 
        workouts={workouts} 
        roundsData={roundsData} 
        organization={passedOrganization}
        clients={clients}
        isPhase2Loading={isPhase2Loading}
        phase2Error={phase2Error}
        onTimerUpdate={handleTimerUpdate}
      />
      
      {/* Lighting Status Indicator */}
      <LightingStatusDot />
    </View>
  );
}