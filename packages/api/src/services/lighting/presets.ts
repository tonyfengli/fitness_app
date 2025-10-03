/**
 * Lighting preset configurations
 */

import type { LightingPreset, PresetConfig, PresetProvider, WorkoutTemplate } from './types';

/**
 * Default preset configurations for different workout types
 * 
 * Color values (hue):
 * - Red: 0 or 65535
 * - Orange: 5000-10000
 * - Yellow: 12000-16000
 * - Green: 20000-28000
 * - Blue: 43000-48000
 * - Purple: 50000-55000
 * 
 * Brightness (bri): 1-254 (254 = maximum)
 * Saturation (sat): 0-254 (254 = most colorful, 0 = white)
 * Transition time: In deciseconds (10 = 1 second)
 */
export const DEFAULT_PRESETS: PresetConfig = {
  circuit: {
    WORK: {
      bri: 254,  // Maximum brightness
      hue: 47000,  // Bright blue
      sat: 220,
      transitiontime: 2,  // 0.2 second snap
      on: true,
    },
    REST: {
      bri: 100,  // Dim
      hue: 25000,  // Soft green
      sat: 140,
      transitiontime: 2,  // 0.2 second snap
      on: true,
    },
    COOLDOWN: {
      bri: 80,
      hue: 12000,  // Dim amber
      sat: 100,
      transitiontime: 30,  // 3 second fade
      on: true,
    },
    DEFAULT: {
      bri: 200,
      hue: 8000,  // Neutral warm
      sat: 140,
      transitiontime: 10,  // 1 second
      on: true,
    },
  },
  strength: {
    ROUND_START: {
      bri: 254,  // Maximum brightness
      hue: 47000,  // Energizing blue
      sat: 200,
      transitiontime: 10,  // 1 second smooth transition
      on: true,
    },
    ROUND_REST: {
      bri: 120,
      hue: 8000,  // Warm orange for recovery
      sat: 140,
      transitiontime: 10,  // 1 second smooth transition
      on: true,
    },
    COOLDOWN: {
      bri: 80,
      hue: 12000,  // Dim amber
      sat: 100,
      transitiontime: 30,  // 3 second fade
      on: true,
    },
    DEFAULT: {
      bri: 200,
      hue: 8000,  // Neutral warm
      sat: 140,
      transitiontime: 10,  // 1 second
      on: true,
    },
  },
};

/**
 * File-based preset provider
 */
export class FilePresetProvider implements PresetProvider {
  private presets: PresetConfig;

  constructor(customPresets?: PresetConfig) {
    this.presets = customPresets || DEFAULT_PRESETS;
  }

  async getPreset(name: string, template: WorkoutTemplate): Promise<LightingPreset> {
    const templatePresets = this.presets[template];
    if (!templatePresets) {
      throw new Error(`Unknown workout template: ${template}`);
    }

    const preset = templatePresets[name as keyof typeof templatePresets];
    if (!preset) {
      throw new Error(`Unknown preset "${name}" for template "${template}"`);
    }

    return preset;
  }

  async listPresets(template: WorkoutTemplate): Promise<string[]> {
    const templatePresets = this.presets[template];
    if (!templatePresets) {
      throw new Error(`Unknown workout template: ${template}`);
    }

    return Object.keys(templatePresets);
  }

  async getAllPresets(): Promise<PresetConfig> {
    return this.presets;
  }
}

/**
 * Future database preset provider (stub for Phase 2)
 */
export class DatabasePresetProvider implements PresetProvider {
  constructor(private dbClient: any) {
    // Will be implemented in Phase 2
  }

  async getPreset(name: string, template: WorkoutTemplate): Promise<LightingPreset> {
    // TODO: Implement database fetching
    throw new Error('Database preset provider not implemented yet');
  }

  async listPresets(template: WorkoutTemplate): Promise<string[]> {
    // TODO: Implement database fetching
    throw new Error('Database preset provider not implemented yet');
  }

  async getAllPresets(): Promise<PresetConfig> {
    // TODO: Implement database fetching
    throw new Error('Database preset provider not implemented yet');
  }
}

/**
 * Create preset provider based on environment
 */
export function createPresetProvider(): PresetProvider {
  // For now, always return file-based provider
  // In Phase 2, this can check for database config and return DatabasePresetProvider
  return new FilePresetProvider();
}

/**
 * Map timer events to preset names
 */
export function getPresetForEvent(event: string): string | null {
  const eventPresetMap: Record<string, string> = {
    // Circuit events
    'circuit:round:start': 'DEFAULT',
    'circuit:interval:work:start': 'WORK',
    'circuit:interval:rest:start': 'REST',
    'circuit:round:end': 'DEFAULT',
    'circuit:workout:complete': 'COOLDOWN',
    
    // Strength events
    'strength:round:start': 'ROUND_START',
    'strength:round:rest:start': 'ROUND_REST',
    'strength:round:end': 'DEFAULT',
    'strength:workout:complete': 'COOLDOWN',
  };

  return eventPresetMap[event] || null;
}