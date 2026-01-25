/**
 * Music Trigger System
 *
 * Centralized infrastructure for workout music triggers.
 * Provides controller, state machine, and shared types.
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Energy types
  PlayableEnergy,
  EnergyLevel,
  MusicSegment,

  // Phase types
  PhaseType,
  PhaseKey,

  // Trigger configuration
  CountdownType,
  MusicTrigger,
  RoundMusicConfig,

  // Trigger actions
  NoAction,
  PlayAction,
  RiseCountdownAction,
  HighCountdownAction,
  RiseFromRestAction,
  TriggerAction,

  // Countdown state
  CountdownState,
  CountdownPhase,
  CountdownContext,
  CountdownEvent,
} from './types';

export {
  serializePhaseKey,
  parsePhaseKey,
  inferCountdownType,
  hasCountdownOverlay,
} from './types';

// =============================================================================
// Controller (Stateless Functions)
// =============================================================================

// New stateless functions - use these with workout machine context
export {
  createPhaseKey,
  serializeKey,
  getTriggerConfig,
  evaluateTrigger,
  shouldTriggerCountdown,
  getCountdownInfo,
} from './MusicTriggerController';

// Legacy singleton - deprecated, kept for backwards compatibility
export { MusicTriggerController, musicTriggerController } from './MusicTriggerController';

// =============================================================================
// State Machine
// =============================================================================

export { countdownMachine, isCountdownActive } from './countdownMachine';
export type {
  CountdownMachineContext,
  CountdownMachineEvent,
  CountdownMachineState,
} from './countdownMachine';
