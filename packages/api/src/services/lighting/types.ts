/**
 * Types for the lighting automation system
 */

// Philips Hue API Types
export interface HueLightState {
  on?: boolean;
  bri?: number; // 1-254
  hue?: number; // 0-65535
  sat?: number; // 0-254
  ct?: number; // Color temperature (153-500 mireds)
  transitiontime?: number; // Transition time in deciseconds (10 = 1 second)
  alert?: 'none' | 'select' | 'lselect';
  effect?: 'none' | 'colorloop';
}

export interface HueLight {
  id: string;
  name: string;
  state: HueLightState & {
    reachable: boolean;
  };
  type: string;
  modelid: string;
  manufacturername: string;
}

export interface HueGroup {
  name: string;
  lights: string[];
  type: string;
  state: {
    all_on: boolean;
    any_on: boolean;
  };
  action: HueLightState;
}

export interface HueBridgeConfig {
  name: string;
  ipaddress: string;
  mac: string;
  apiversion: string;
}

// Lighting Preset Types
export interface LightingPreset {
  bri: number;
  hue: number;
  sat: number;
  transitiontime?: number;
  on?: boolean;
}

export type WorkoutTemplate = 'circuit' | 'strength';

export interface PresetConfig {
  circuit: {
    WORK: LightingPreset;
    REST: LightingPreset;
    COOLDOWN: LightingPreset;
    DEFAULT: LightingPreset;
  };
  strength: {
    ROUND_START: LightingPreset;
    ROUND_REST: LightingPreset;
    COOLDOWN: LightingPreset;
    DEFAULT: LightingPreset;
  };
}

// Service Types
export interface PresetProvider {
  getPreset(name: string, template: WorkoutTemplate): Promise<LightingPreset>;
  listPresets(template: WorkoutTemplate): Promise<string[]>;
  getAllPresets(): Promise<PresetConfig>;
}

export type ConnectionStatus = 'connected' | 'degraded' | 'disconnected';

export interface LightingStatus {
  status: ConnectionStatus;
  lastConnected?: Date;
  lastError?: string;
  bridgeInfo?: HueBridgeConfig;
}

// Command Queue Types
export interface LightCommand {
  id: string;
  type: 'preset' | 'state';
  preset?: string;
  state?: HueLightState;
  template?: WorkoutTemplate;
  groupId: string;
  timestamp: Date;
  retries: number;
}

// Timer Event Types
export const CIRCUIT_EVENTS = {
  ROUND_START: 'circuit:round:start',
  INTERVAL_WORK_START: 'circuit:interval:work:start',
  INTERVAL_REST_START: 'circuit:interval:rest:start',
  ROUND_END: 'circuit:round:end',
  WORKOUT_COMPLETE: 'circuit:workout:complete',
} as const;

export const STRENGTH_EVENTS = {
  ROUND_START: 'strength:round:start',
  ROUND_REST_START: 'strength:round:rest:start',
  ROUND_END: 'strength:round:end',
  WORKOUT_COMPLETE: 'strength:workout:complete',
} as const;

export type TimerEvent = 
  | typeof CIRCUIT_EVENTS[keyof typeof CIRCUIT_EVENTS]
  | typeof STRENGTH_EVENTS[keyof typeof STRENGTH_EVENTS];

export interface TimerEventData {
  sessionId: string;
  event: TimerEvent;
  timestamp: Date;
  metadata?: {
    round?: number;
    totalRounds?: number;
    exerciseName?: string;
    clientCount?: number;
  };
}

// Error Types
export class HueConnectionError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'HueConnectionError';
  }
}

export class HueCommandError extends Error {
  constructor(message: string, public command: LightCommand, public cause?: Error) {
    super(message);
    this.name = 'HueCommandError';
  }
}