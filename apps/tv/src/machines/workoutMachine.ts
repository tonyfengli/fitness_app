import { createMachine, assign } from 'xstate';
import type { CircuitConfig } from '@acme/db';

// Types for our machine
export interface WorkoutContext {
  // Config
  circuitConfig: CircuitConfig | null;
  
  // Timing
  timeRemaining: number;
  isPaused: boolean;
  
  // Navigation state
  currentRoundIndex: number;
  currentExerciseIndex: number;
  currentSetNumber: number;
  
  // Data
  rounds: any[]; // Will type this properly later
  selections: any[]; // Will type this properly later
  
  // UI state
  isStarted: boolean;
}

export type WorkoutEvent = 
  | { type: 'START_WORKOUT' }
  | { type: 'TIMER_TICK' }
  | { type: 'TIMER_COMPLETE' }
  | { type: 'SKIP' }
  | { type: 'BACK' }
  | { type: 'CONFIG_UPDATED'; config: CircuitConfig }
  | { type: 'SELECTIONS_UPDATED'; selections: any[] }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };

export const workoutMachine = createMachine({
  id: 'workout',
  types: {
    context: {} as WorkoutContext,
    events: {} as WorkoutEvent,
  },
  initial: 'roundPreview',
  context: {
    circuitConfig: null,
    timeRemaining: 0,
    isPaused: false,
    currentRoundIndex: 0,
    currentExerciseIndex: 0,
    currentSetNumber: 1,
    rounds: [],
    selections: [],
    isStarted: false
  },
  states: {
    roundPreview: {
      entry: assign({
        timeRemaining: ({ context }) => {
          // First round has no timer, others use restBetweenRounds
          if (context.currentRoundIndex === 0) return 0;
          return context.circuitConfig?.config?.restBetweenRounds || 60;
        },
        isPaused: false
      }),
      on: {
        START_WORKOUT: 'exercise',
        SKIP: [
          {
            // If there are more rounds, skip to the next round preview
            target: 'roundPreview',
            guard: ({ context }) => context.currentRoundIndex < context.rounds.length - 1,
            actions: assign({
              currentRoundIndex: ({ context }) => context.currentRoundIndex + 1,
              currentExerciseIndex: 0,
              currentSetNumber: 1
            }),
            reenter: true
          },
          {
            // If this is the last round, go to workout complete
            target: 'workoutComplete',
            guard: ({ context }) => context.currentRoundIndex >= context.rounds.length - 1
          }
        ],
        TIMER_COMPLETE: 'exercise',
        TIMER_TICK: {
          guard: ({ context }) => context.timeRemaining > 0 && !context.isPaused,
          actions: assign({
            timeRemaining: ({ context }) => context.timeRemaining - 1
          })
        },
        CONFIG_UPDATED: {
          actions: assign({
            circuitConfig: ({ event }) => {
              if (event.type === 'CONFIG_UPDATED') {
                return event.config;
              }
              return null;
            }
          })
        },
        PAUSE: {
          actions: assign({ isPaused: true })
        },
        RESUME: {
          actions: assign({ isPaused: false })
        },
        BACK: [
          {
            target: 'roundPreview',
            guard: ({ context }) => context.currentRoundIndex > 0,
            actions: assign({
              currentRoundIndex: ({ context }) => context.currentRoundIndex - 1,
              currentExerciseIndex: 0,
              currentSetNumber: 1
            })
          }
        ],
        SELECTIONS_UPDATED: {
          actions: assign({
            rounds: ({ event }) => {
              if (event.type === 'SELECTIONS_UPDATED') {
                return event.selections;
              }
              return [];
            }
          })
        }
      }
    },
    
    exercise: {
      entry: assign({
        timeRemaining: ({ context }) => {
          // Get work duration from current round template
          const config = context.circuitConfig?.config;
          const roundTemplates = config?.roundTemplates;
          
          if (!roundTemplates || !config) {
            return config?.workDuration || 45; // Use global config or 45
          }
          
          const currentTemplate = roundTemplates.find(
            rt => rt.roundNumber === context.currentRoundIndex + 1
          );
          
          if (currentTemplate?.template.type === 'circuit_round') {
            return currentTemplate.template.workDuration ?? config.workDuration ?? 45;
          } else if (currentTemplate?.template.type === 'stations_round') {
            return (currentTemplate.template as any).workDuration ?? config.workDuration ?? 60;
          } else if (currentTemplate?.template.type === 'amrap_round') {
            return (currentTemplate.template as any).totalDuration || 300; // AMRAP uses totalDuration
          }
          
          return config.workDuration || 45;
        }
      }),
      on: {
        TIMER_COMPLETE: [
          {
            // For AMRAP, timer complete means round complete
            target: 'roundComplete',
            guard: ({ context }) => {
              const config = context.circuitConfig?.config;
              const roundTemplates = config?.roundTemplates;
              if (!roundTemplates) return false;
              
              const currentTemplate = roundTemplates.find(
                rt => rt.roundNumber === context.currentRoundIndex + 1
              );
              
              return currentTemplate?.template.type === 'amrap_round';
            }
          },
          {
            target: 'rest',
            guard: 'shouldGoToRest'
          },
          {
            target: 'exercise',
            guard: 'hasMoreExercisesInRound',
            actions: assign({
              currentExerciseIndex: ({ context }) => context.currentExerciseIndex + 1
            }),
            reenter: true
          },
          {
            target: 'roundComplete',
            guard: 'isLastExerciseInRound'
          }
        ],
        SKIP: [
          {
            // For AMRAP, skip the entire round
            target: 'roundComplete',
            guard: ({ context }) => {
              const config = context.circuitConfig?.config;
              const roundTemplates = config?.roundTemplates;
              if (!roundTemplates) return false;
              
              const currentTemplate = roundTemplates.find(
                rt => rt.roundNumber === context.currentRoundIndex + 1
              );
              
              return currentTemplate?.template.type === 'amrap_round';
            }
          },
          {
            target: 'rest',
            guard: 'shouldGoToRest'
          },
          {
            target: 'exercise',
            guard: 'hasMoreExercisesInRound',
            actions: assign({
              currentExerciseIndex: ({ context }) => context.currentExerciseIndex + 1
            }),
            // Force re-entry to reset timer for stations
            reenter: true
          },
          {
            target: 'roundComplete',
            guard: 'isLastExerciseInRound'
          }
        ],
        CONFIG_UPDATED: {
          actions: assign({
            circuitConfig: ({ event }) => {
              if (event.type === 'CONFIG_UPDATED') {
                return event.config;
              }
              return null;
            }
          })
        },
        TIMER_TICK: {
          guard: ({ context }) => context.timeRemaining > 0 && !context.isPaused,
          actions: assign({
            timeRemaining: ({ context }) => context.timeRemaining - 1
          })
        },
        PAUSE: {
          actions: assign({ isPaused: true })
        },
        RESUME: {
          actions: assign({ isPaused: false })
        },
        BACK: [
          {
            // For circuit rounds with no rest, go directly to previous exercise
            target: 'exercise',
            guard: ({ context }) => {
              const config = context.circuitConfig?.config;
              const roundTemplates = config?.roundTemplates;
              if (!roundTemplates) return false;
              
              const currentTemplate = roundTemplates.find(
                rt => rt.roundNumber === context.currentRoundIndex + 1
              );
              
              // Check if it's a circuit round with 0 rest duration
              if (currentTemplate?.template.type === 'circuit_round' && context.currentExerciseIndex > 0) {
                const restDuration = currentTemplate.template.restDuration ?? config?.restDuration ?? 0;
                return restDuration === 0;
              }
              
              return false;
            },
            actions: assign({
              currentExerciseIndex: ({ context }) => context.currentExerciseIndex - 1
            }),
            reenter: true // Reset timer
          },
          {
            // For stations and circuit rounds with rest, go back to previous rest
            target: 'rest',
            guard: ({ context }) => {
              const config = context.circuitConfig?.config;
              const roundTemplates = config?.roundTemplates;
              if (!roundTemplates) return false;
              
              const currentTemplate = roundTemplates.find(
                rt => rt.roundNumber === context.currentRoundIndex + 1
              );
              
              return (currentTemplate?.template.type === 'stations_round' || 
                      currentTemplate?.template.type === 'circuit_round') && 
                     context.currentExerciseIndex > 0;
            },
            actions: assign({
              currentExerciseIndex: ({ context }) => context.currentExerciseIndex - 1
            }),
            reenter: true // Reset timer
          },
          {
            // For AMRAP rounds, go back to previous exercise
            target: 'exercise',
            guard: ({ context }) => {
              const config = context.circuitConfig?.config;
              const roundTemplates = config?.roundTemplates;
              if (!roundTemplates) return false;
              
              const currentTemplate = roundTemplates.find(
                rt => rt.roundNumber === context.currentRoundIndex + 1
              );
              
              return currentTemplate?.template.type === 'amrap_round' && 
                     context.currentExerciseIndex > 0;
            },
            actions: assign({
              currentExerciseIndex: ({ context }) => context.currentExerciseIndex - 1
            }),
            reenter: true // Reset timer
          },
          {
            target: 'roundPreview',
            guard: ({ context }) => context.currentExerciseIndex === 0 && context.currentSetNumber === 1,
            actions: assign({
              currentSetNumber: 1
            })
          },
          {
            target: 'setBreak',
            guard: ({ context }) => context.currentExerciseIndex === 0 && context.currentSetNumber > 1,
            actions: assign({
              currentSetNumber: ({ context }) => context.currentSetNumber - 1,
              currentExerciseIndex: ({ context }) => {
                const currentRound = context.rounds[context.currentRoundIndex];
                return currentRound ? currentRound.exercises.length - 1 : 0;
              }
            }),
            reenter: true // Reset timer
          }
        ],
        SELECTIONS_UPDATED: {
          actions: assign({
            rounds: ({ event }) => {
              if (event.type === 'SELECTIONS_UPDATED') {
                return event.selections;
              }
              return [];
            }
          })
        }
      }
    },
    
    rest: {
      entry: assign({
        timeRemaining: ({ context }) => {
          // Get rest duration from current round template
          const config = context.circuitConfig?.config;
          const roundTemplates = config?.roundTemplates;
          
          if (!roundTemplates || !config) {
            return config?.restDuration || 0; // Use global config or 0
          }
          
          const currentTemplate = roundTemplates.find(
            rt => rt.roundNumber === context.currentRoundIndex + 1
          );
          
          if (currentTemplate?.template.type === 'circuit_round') {
            return currentTemplate.template.restDuration ?? config.restDuration ?? 0;
          } else if (currentTemplate?.template.type === 'stations_round') {
            return (currentTemplate.template as any).restDuration ?? config.restDuration ?? 0;
          } else if (currentTemplate?.template.type === 'amrap_round') {
            return 0; // AMRAP has no rest between exercises
          }
          
          return config.restDuration || 0;
        },
        isPaused: false
      }),
      on: {
        TIMER_COMPLETE: {
          target: 'exercise',
          actions: assign({
            currentExerciseIndex: ({ context }) => context.currentExerciseIndex + 1
          }),
          reenter: true
        },
        SKIP: {
          target: 'exercise',
          actions: assign({
            currentExerciseIndex: ({ context }) => context.currentExerciseIndex + 1
          }),
          reenter: true
        },
        CONFIG_UPDATED: {
          actions: assign({
            circuitConfig: ({ event }) => {
              if (event.type === 'CONFIG_UPDATED') {
                return event.config;
              }
              return null;
            }
          })
        },
        SELECTIONS_UPDATED: {
          actions: assign({
            rounds: ({ event }) => {
              if (event.type === 'SELECTIONS_UPDATED') {
                return event.selections;
              }
              return [];
            }
          })
        },
        TIMER_TICK: {
          guard: ({ context }) => context.timeRemaining > 0 && !context.isPaused,
          actions: assign({
            timeRemaining: ({ context }) => context.timeRemaining - 1
          })
        },
        PAUSE: {
          actions: assign({ isPaused: true })
        },
        RESUME: {
          actions: assign({ isPaused: false })
        },
        BACK: [
          {
            // For stations and circuit rounds during rest, go back to current exercise (not previous)
            target: 'exercise',
            guard: ({ context }) => {
              const config = context.circuitConfig?.config;
              const roundTemplates = config?.roundTemplates;
              if (!roundTemplates) return false;
              
              const currentTemplate = roundTemplates.find(
                rt => rt.roundNumber === context.currentRoundIndex + 1
              );
              
              return currentTemplate?.template.type === 'stations_round' ||
                     currentTemplate?.template.type === 'circuit_round';
            },
            // Don't change the exercise index for stations/circuit
            reenter: true // Reset timer
          },
          {
            // For AMRAP rounds, go back to previous exercise
            target: 'exercise',
            actions: assign({
              currentExerciseIndex: ({ context }) => Math.max(0, context.currentExerciseIndex - 1)
            }),
            reenter: true // Reset timer
          }
        ]
      }
    },
    
    roundComplete: {
      always: [
        {
          target: 'setBreak',
          guard: 'hasMoreSets'
        },
        {
          target: 'roundPreview',
          guard: 'hasMoreRounds',
          actions: assign({
            currentRoundIndex: ({ context }) => context.currentRoundIndex + 1,
            currentExerciseIndex: () => 0,
            currentSetNumber: () => 1
          })
        },
        {
          target: 'workoutComplete'
        }
      ]
    },
    
    setBreak: {
      entry: assign({
        timeRemaining: ({ context }) => {
          // Get rest between sets from current round template
          const roundTemplates = context.circuitConfig?.config?.roundTemplates;
          if (!roundTemplates) return 30; // fallback
          
          const currentTemplate = roundTemplates.find(
            rt => rt.roundNumber === context.currentRoundIndex + 1
          );
          
          if (currentTemplate?.template.type === 'circuit_round') {
            return (currentTemplate.template as any).restBetweenSets || 30;
          }
          return 30;
        },
        currentSetNumber: ({ context }) => context.currentSetNumber + 1,
        currentExerciseIndex: () => 0, // Reset to first exercise
        isPaused: false
      }),
      on: {
        TIMER_COMPLETE: {
          target: 'exercise',
          reenter: true
        },
        SKIP: {
          target: 'exercise',
          reenter: true
        },
        TIMER_TICK: {
          guard: ({ context }) => context.timeRemaining > 0 && !context.isPaused,
          actions: assign({
            timeRemaining: ({ context }) => context.timeRemaining - 1
          })
        },
        PAUSE: {
          actions: assign({ isPaused: true })
        },
        RESUME: {
          actions: assign({ isPaused: false })
        },
        BACK: [
          {
            // For stations and circuit rounds, go back to the last exercise of the previous set
            target: 'exercise',
            guard: ({ context }) => {
              const config = context.circuitConfig?.config;
              const roundTemplates = config?.roundTemplates;
              if (!roundTemplates) return false;
              
              const currentTemplate = roundTemplates.find(
                rt => rt.roundNumber === context.currentRoundIndex + 1
              );
              
              return currentTemplate?.template.type === 'stations_round' ||
                     currentTemplate?.template.type === 'circuit_round';
            },
            actions: assign({
              currentSetNumber: ({ context }) => context.currentSetNumber - 1,
              currentExerciseIndex: ({ context }) => {
                const currentRound = context.rounds[context.currentRoundIndex];
                return currentRound ? currentRound.exercises.length - 1 : 0;
              }
            }),
            reenter: true // Reset timer
          },
          {
            // For AMRAP rounds, maintain existing behavior
            target: 'roundComplete',
            actions: assign({
              currentSetNumber: ({ context }) => context.currentSetNumber - 1,
              currentExerciseIndex: ({ context }) => {
                const currentRound = context.rounds[context.currentRoundIndex];
                return currentRound ? currentRound.exercises.length - 1 : 0;
              }
            })
          }
        ]
      }
    },
    
    workoutComplete: {
      type: 'final'
    }
  }
},
{
  guards: {
    shouldGoToRest: ({ context }) => {
      const currentRound = context.rounds[context.currentRoundIndex];
      if (!currentRound) return false;
      
      const isLastExercise = context.currentExerciseIndex === currentRound.exercises.length - 1;
      if (isLastExercise) return false;
      
      // Check if rest duration > 0
      const config = context.circuitConfig?.config;
      const roundTemplates = config?.roundTemplates;
      if (!roundTemplates || !config) return false;
      
      const currentTemplate = roundTemplates.find(
        rt => rt.roundNumber === context.currentRoundIndex + 1
      );
      
      if (currentTemplate?.template.type === 'circuit_round') {
        return (currentTemplate.template.restDuration ?? 0) > 0;
      } else if (currentTemplate?.template.type === 'stations_round') {
        // Stations can have rest between stations
        const restDuration = (currentTemplate.template as any).restDuration ?? config.restDuration ?? 0;
        return restDuration > 0;
      }
      
      return false;
    },
    
    hasMoreExercisesInRound: ({ context }) => {
      const currentRound = context.rounds[context.currentRoundIndex];
      if (!currentRound) return false;
      
      return context.currentExerciseIndex < currentRound.exercises.length - 1;
    },
    
    isLastExerciseInRound: ({ context }) => {
      const currentRound = context.rounds[context.currentRoundIndex];
      if (!currentRound) return false;
      
      return context.currentExerciseIndex === currentRound.exercises.length - 1;
    },
    
    hasMoreSets: ({ context }) => {
      const roundTemplates = context.circuitConfig?.config?.roundTemplates;
      if (!roundTemplates) return false;
      
      const currentTemplate = roundTemplates.find(
        rt => rt.roundNumber === context.currentRoundIndex + 1
      );
      
      if (currentTemplate?.template.type === 'circuit_round' || 
          currentTemplate?.template.type === 'stations_round') {
        const repeatTimes = (currentTemplate.template as any).repeatTimes || 1;
        return context.currentSetNumber < repeatTimes;
      }
      
      return false;
    },
    
    hasMoreRounds: ({ context }) => {
      return context.currentRoundIndex < context.rounds.length - 1;
    }
  }
});