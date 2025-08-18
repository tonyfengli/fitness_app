import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation } from '../App';
import { useQuery } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import RoundView from './RoundView';

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
  
  // Get any passed organization data for efficiency
  const passedOrganization = navigation.getParam('organization');
  const passedWorkouts = navigation.getParam('workouts');
  const passedClients = navigation.getParam('clients');
  
  console.log('[WorkoutLiveScreen] Params:', {
    sessionId,
    round,
    hasOrganization: !!passedOrganization,
    hasWorkouts: !!passedWorkouts,
    workoutsCount: passedWorkouts?.length,
    hasClients: !!passedClients,
    clientsCount: passedClients?.length
  });
  
  // Fetch workout data - only if not passed via navigation
  const { data: sessionWorkouts, isLoading, error } = useQuery(
    sessionId && !passedWorkouts ? 
      api.workout.sessionWorkoutsWithExercises.queryOptions({ sessionId }) : {
        enabled: false,
        queryKey: ['disabled'],
        queryFn: () => Promise.resolve(passedWorkouts || []),
        initialData: passedWorkouts
      }
  );
  
  // Use passed data if available, otherwise use fetched data
  const workouts = passedWorkouts || sessionWorkouts || [];
  
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
    console.log('[WorkoutLiveScreen] Transforming data with organization:', !!passedOrganization);
    console.log('[WorkoutLiveScreen] Workouts:', workouts?.length);
    
    if (!passedOrganization || !workouts || workouts.length === 0) {
      console.log('[WorkoutLiveScreen] Missing organization or workouts');
      return [];
    }
    
    // Create a map to store round data
    const roundsList = [];
    
    // Process each round from the organization
    passedOrganization.rounds?.forEach(round => {
      const roundData = {
        label: round.name.split(' - ')[0], // "Round 1" from "Round 1 - Main Strength"
        workSeconds: 600, // 10 minutes
        restSeconds: 60,  // 1 minute rest
        phase: "work" as const,
        exercises: [] as any[]
      };
      
      // Create a map to store unique exercises for this round
      const exerciseMap = new Map();
      
      // Process each client's exercises for this round
      Object.entries(round.exercisesByClient).forEach(([clientId, clientExercises]) => {
        // Find the workout for this client
        const clientWorkout = workouts.find(w => w.userId === clientId);
        
        // Try to get client name from various sources
        // First check if we have clients data passed
        const clientData = passedClients?.find((c: any) => c.userId === clientId);
        const clientName = clientData?.name || 
                         clientWorkout?.userName || 
                         clientWorkout?.userEmail?.split('@')[0] || 
                         'Unknown';
        
        // Process each exercise for this client in this round
        (clientExercises as any[]).forEach(exercise => {
          const exerciseKey = exercise.exerciseId;
          
          if (!exerciseMap.has(exerciseKey)) {
            // Find the full exercise details from the workout exercises
            const fullExercise = clientWorkout?.exercises?.find(
              e => e.exerciseId === exercise.exerciseId
            );
            
            // Special handling for "Unknown" exercise names - try to get the real name
            let exerciseTitle = exercise.exerciseName;
            if (exerciseTitle === 'Unknown' && fullExercise?.exercise?.name) {
              console.log(`[WorkoutLiveScreen] Fixing Unknown exercise name for ${exercise.exerciseId}: ${fullExercise.exercise.name}`);
              exerciseTitle = fullExercise.exercise.name;
            } else if (!exerciseTitle || exerciseTitle === 'Unknown') {
              exerciseTitle = fullExercise?.exercise?.name || 'Unknown Exercise';
            }
            
            exerciseMap.set(exerciseKey, {
              exerciseId: exercise.exerciseId,
              title: exerciseTitle,
              meta: formatExerciseMetaFromScheme(exercise.scheme, fullExercise),
              assigned: []
            });
          }
          
          // Add this client to the exercise's assigned list
          exerciseMap.get(exerciseKey).assigned.push({
            clientName: clientName,
            tag: '' // No longer using tags
          });
        });
      });
      
      // Convert exercise map to array
      roundData.exercises = Array.from(exerciseMap.values());
      
      // Only add rounds that have exercises
      if (roundData.exercises.length > 0) {
        roundsList.push(roundData);
      }
    });
    
    console.log('[WorkoutLiveScreen] Transformed rounds:', roundsList.length, roundsList);
    return roundsList;
  }, [passedOrganization, workouts]);
  
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
  
  return <RoundView sessionId={sessionId} round={round} workouts={workouts} roundsData={roundsData} />;
}