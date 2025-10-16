import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useMachine } from '@xstate/react';
import { workoutMachine } from '../machines/workoutMachine';
import { useQuery } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useNavigation } from '../App';

// Basic test component to verify XState works
export function CircuitWorkoutLiveScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  
  // Get circuit config with polling
  const { data: circuitConfig } = useQuery(
    sessionId ? {
      ...api.circuitConfig.getBySession.queryOptions({ sessionId: sessionId || '' }),
      refetchInterval: 7000 // Poll every 7 seconds
    } : {
      enabled: false,
      queryKey: ['disabled-circuit-config'],
      queryFn: () => Promise.resolve(null)
    }
  );

  // Initialize state machine with test data
  const [state, send] = useMachine(workoutMachine, {
    devTools: true, // Enable dev tools if available
    context: {
      circuitConfig,
      timeRemaining: 0,
      currentRoundIndex: 0,
      currentExerciseIndex: 0,
      currentSetNumber: 1,
      rounds: [
        {
          roundName: 'Round 1',
          exercises: [
            { exerciseName: 'Push-ups', id: 1 },
            { exerciseName: 'Squats', id: 2 },
            { exerciseName: 'Lunges', id: 3 }
          ]
        },
        {
          roundName: 'Round 2',
          exercises: [
            { exerciseName: 'Burpees', id: 4 },
            { exerciseName: 'Mountain Climbers', id: 5 }
          ]
        }
      ],
      selections: []
    }
  });

  // Log state changes
  useEffect(() => {
    console.log('[XState] State changed:', {
      state: state.value,
      context: {
        timeRemaining: state.context.timeRemaining,
        currentRoundIndex: state.context.currentRoundIndex,
        currentExerciseIndex: state.context.currentExerciseIndex,
        currentSetNumber: state.context.currentSetNumber,
        hasConfig: !!state.context.circuitConfig
      }
    });
  }, [state]);

  // Update config when it changes
  useEffect(() => {
    if (circuitConfig) {
      console.log('[XState] Config updated:', circuitConfig);
      send({ type: 'CONFIG_UPDATED', config: circuitConfig });
    }
  }, [circuitConfig, send]);

  // Basic timer
  useEffect(() => {
    if (state.context.timeRemaining > 0) {
      const interval = setInterval(() => {
        send({ type: 'TIMER_TICK' });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.context.timeRemaining, send]);

  // Timer tick handling
  useEffect(() => {
    if (state.context.timeRemaining === 1) {
      send({ type: 'TIMER_COMPLETE' });
    }
  }, [state.context.timeRemaining, send]);

  return (
    <View style={{ flex: 1, backgroundColor: '#070b18', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: 'white', fontSize: 48, marginBottom: 20 }}>
        State: {state.value}
      </Text>
      
      <Text style={{ color: 'white', fontSize: 24, marginBottom: 20 }}>
        Time: {state.context.timeRemaining}
      </Text>
      
      <Text style={{ color: 'white', fontSize: 20, marginBottom: 20 }}>
        Round {state.context.currentRoundIndex + 1} | Exercise {state.context.currentExerciseIndex + 1}
      </Text>
      
      {state.matches('exercise') && (
        <Text style={{ color: '#5de1ff', fontSize: 32, marginBottom: 40 }}>
          {state.context.rounds[state.context.currentRoundIndex]?.exercises[state.context.currentExerciseIndex]?.exerciseName}
        </Text>
      )}
      
      {state.matches('roundPreview') && state.context.currentRoundIndex === 0 && (
        <Pressable
          onPress={() => send({ type: 'START_WORKOUT' })}
          style={{
            padding: 20,
            backgroundColor: '#333',
            borderRadius: 10
          }}
        >
          <Text style={{ color: 'white', fontSize: 18 }}>Start Workout</Text>
        </Pressable>
      )}
      
      {(state.matches('exercise') || state.matches('rest')) && (
        <Pressable
          onPress={() => send({ type: 'SKIP' })}
          style={{
            padding: 20,
            backgroundColor: '#333',
            borderRadius: 10
          }}
        >
          <Text style={{ color: 'white', fontSize: 18 }}>Skip</Text>
        </Pressable>
      )}
    </View>
  );
}