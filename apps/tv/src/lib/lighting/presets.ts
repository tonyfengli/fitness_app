import { getColorForPreset, getHuePresetForColor } from './colorMappings';

export const LIGHTING_PRESETS = {
  circuit: {
    WARMUP: { bri: 150, hue: 8000, sat: 100, transitiontime: 20 },   // Keep original orange
    WORK: { bri: 150, hue: 8000, sat: 100, transitiontime: 2 },      // Use warmup color for work
    REST: { bri: 100, hue: 25000, sat: 100, transitiontime: 2 },     // Keep original green
    ROUND: { bri: 200, hue: 10000, sat: 140, transitiontime: 5 },
    COOLDOWN: { bri: 120, hue: 35000, sat: 80, transitiontime: 20 },
    DEFAULT: { bri: 180, hue: 8000, sat: 140, transitiontime: 10 }
  },
  strength: {
    WARMUP: { bri: 150, hue: 8000, sat: 100, transitiontime: 20 },
    ROUND_START: { bri: 254, hue: 47000, sat: 200, transitiontime: 10 },
    ROUND_REST: { bri: 120, hue: 8000, sat: 140, transitiontime: 10 },
    COOLDOWN: { bri: 120, hue: 35000, sat: 80, transitiontime: 20 },
    DEFAULT: { bri: 180, hue: 8000, sat: 140, transitiontime: 10 }
  }
};

// Map timer events to presets using saved colors
export async function getPresetForEvent(template: 'circuit' | 'strength', event: string) {
  if (template === 'circuit') {
    // Map event to preset key
    let presetKey = '';
    switch (event) {
      case 'warmup': 
        presetKey = 'circuit_round_preview';
        break;
      case 'work': 
        presetKey = 'circuit_exercise_round';
        break;
      case 'rest': 
        presetKey = 'circuit_rest';
        break;
      case 'cooldown': 
        presetKey = 'circuit_cooldown';
        break;
      default:
        return null;
    }
    
    // Get saved color for this preset
    const color = await getColorForPreset(presetKey);
    return getHuePresetForColor(color);
  }
  
  // For strength, use original presets (not updated yet)
  const presets = LIGHTING_PRESETS[template];
  switch (event) {
    case 'warmup': return presets.WARMUP;
    case 'work': return presets.ROUND_START;
    case 'rest': return presets.ROUND_REST;
    case 'round_start': return presets.DEFAULT;
    case 'cooldown': return presets.COOLDOWN;
    case 'complete': return presets.DEFAULT;
    default: return null;
  }
}