/**
 * Lighting Configuration Types
 * These types define the structure for workout lighting configuration
 */

// Scene reference stored in config
export interface LightingScene {
  sceneId: string;
  sceneName: string;
}

// Phase types that can have lighting configuration
export type LightingPhaseType = 'work' | 'rest' | 'preview' | 'warning' | 'roundBreak';

// Global lighting defaults for all rounds
export type GlobalLightingDefaults = Partial<Record<LightingPhaseType, LightingScene>>;

// Round-specific lighting overrides
export interface RoundLightingOverrides {
  [roundId: string]: {
    [phaseType: string]: LightingScene;
  };
}

// Complete lighting configuration
export interface LightingConfig {
  enabled: boolean;
  globalDefaults: GlobalLightingDefaults;
  roundOverrides?: RoundLightingOverrides;
  targetGroup?: string; // default "0" for all lights
}

// Helper to create default lighting config
export function createDefaultLightingConfig(): LightingConfig {
  return {
    enabled: false,
    globalDefaults: {},
    roundOverrides: {},
    targetGroup: "0"
  };
}

// Helper to get scene for a specific round and phase
export function getLightingScene(
  config: LightingConfig | undefined,
  roundId: string,
  phaseType: LightingPhaseType
): LightingScene | undefined {
  if (!config || !config.enabled) return undefined;
  
  // Check for round-specific override first
  const override = config.roundOverrides?.[roundId]?.[phaseType];
  if (override) return override;
  
  // Fall back to global default
  return config.globalDefaults[phaseType];
}