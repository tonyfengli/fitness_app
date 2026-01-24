/**
 * Music Countdown State Machine
 *
 * XState machine managing countdown state for Rise and High countdowns.
 * Handles state transitions and timing, but NOT the actual timer scheduling.
 * Timer scheduling remains in the overlay component for precision.
 */

import { createMachine, assign } from 'xstate';
import type { CountdownType, CountdownPhase } from './types';

// =============================================================================
// Context
// =============================================================================

export interface CountdownMachineContext {
  /** Type of countdown in progress */
  countdownType: CountdownType | null;

  /** Absolute timestamp (ms) when the drop should hit - source of truth for timing */
  dropTime: number | null;

  /** Optional specific track ID to play */
  trackId: string | undefined;

  /** Current display phase for the overlay */
  displayPhase: CountdownPhase;

  /** Whether the countdown needs to start workout when complete (from preview) */
  needsStartWorkout: boolean;

  /** Original volume before ducking (for High countdown) */
  originalVolume: number;
}

// =============================================================================
// Events
// =============================================================================

export type CountdownMachineEvent =
  | {
      type: 'START_RISE';
      dropTime: number;
      trackId?: string;
      needsStartWorkout: boolean;
    }
  | {
      type: 'START_HIGH';
      dropTime: number;
      trackId?: string;
      durationMs: number;
      needsStartWorkout: boolean;
    }
  | { type: 'UPDATE_PHASE'; phase: CountdownPhase }
  | { type: 'SKIP' }
  | { type: 'COMPLETE' }
  | { type: 'RESET' };

// =============================================================================
// Initial Context
// =============================================================================

const initialContext: CountdownMachineContext = {
  countdownType: null,
  dropTime: null,
  trackId: undefined,
  displayPhase: 'ready',
  needsStartWorkout: false,
  originalVolume: 0.8,
};

// =============================================================================
// Machine Definition
// =============================================================================

export const countdownMachine = createMachine(
  {
    id: 'countdown',
    initial: 'idle',
    context: initialContext,
    types: {} as {
      context: CountdownMachineContext;
      events: CountdownMachineEvent;
    },
    states: {
      idle: {
        entry: 'resetContext',
        on: {
          START_RISE: {
            target: 'active',
            actions: 'setRiseContext',
          },
          START_HIGH: {
            target: 'active',
            actions: 'setHighContext',
          },
        },
      },

      active: {
        // Countdown is running - overlay is visible
        // Timer scheduling is handled externally (in overlay component)
        on: {
          UPDATE_PHASE: {
            actions: 'updateDisplayPhase',
          },
          SKIP: {
            target: 'completing',
            actions: 'markSkipped',
          },
          COMPLETE: {
            target: 'completing',
          },
          RESET: {
            target: 'idle',
          },
        },
      },

      completing: {
        // Brief state for cleanup before returning to idle
        // Allows parent to react to completion
        always: {
          target: 'idle',
        },
      },
    },
  },
  {
    actions: {
      resetContext: assign(() => initialContext),

      setRiseContext: assign(({ event }) => {
        if (event.type !== 'START_RISE') return {};
        return {
          countdownType: 'rise' as CountdownType,
          dropTime: event.dropTime,
          trackId: event.trackId,
          displayPhase: 'ready' as CountdownPhase,
          needsStartWorkout: event.needsStartWorkout,
        };
      }),

      setHighContext: assign(({ event }) => {
        if (event.type !== 'START_HIGH') return {};
        return {
          countdownType: 'high' as CountdownType,
          dropTime: event.dropTime,
          trackId: event.trackId,
          displayPhase: 'ready' as CountdownPhase,
          needsStartWorkout: event.needsStartWorkout,
        };
      }),

      updateDisplayPhase: assign(({ event }) => {
        if (event.type !== 'UPDATE_PHASE') return {};
        return {
          displayPhase: event.phase,
        };
      }),

      markSkipped: assign(() => ({
        displayPhase: 'complete' as CountdownPhase,
      })),
    },
  }
);

// =============================================================================
// Helper Types
// =============================================================================

export type CountdownMachineState = 'idle' | 'active' | 'completing';

export function isCountdownActive(state: CountdownMachineState): boolean {
  return state === 'active';
}
