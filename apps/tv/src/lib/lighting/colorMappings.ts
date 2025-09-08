import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for persisting color selections
export const LIGHTING_PRESETS_STORAGE_KEY = '@lighting_presets_circuit';

// Default color mappings for circuit presets
export const DEFAULT_CIRCUIT_COLORS: Record<string, string> = {
  'circuit_app_start': '#fb923c',      // Orange
  'circuit_round_preview': '#a855f7',  // Purple
  'circuit_exercise_round': '#3b82f6', // Blue
  'circuit_rest': '#22c55e',          // Green
  'circuit_cooldown': '#06b6d4',      // Cyan
};

// Map colors to Hue values
export const COLOR_TO_HUE_MAP: Record<string, { hue: number; sat: number; bri: number }> = {
  '#ef4444': { hue: 0, sat: 200, bri: 180 },      // Red
  '#fb923c': { hue: 8000, sat: 180, bri: 180 },   // Orange
  '#eab308': { hue: 10000, sat: 200, bri: 180 },  // Yellow
  '#22c55e': { hue: 25000, sat: 180, bri: 150 },  // Green
  '#3b82f6': { hue: 45000, sat: 200, bri: 180 },  // Blue
  '#a855f7': { hue: 50000, sat: 180, bri: 180 },  // Purple
};

// Get Hue preset for a color
export function getHuePresetForColor(color: string) {
  const mapping = COLOR_TO_HUE_MAP[color];
  if (!mapping) {
    // Fallback to orange if color not found
    return { hue: 8000, sat: 140, bri: 180, on: true, transitiontime: 10 };
  }
  return { ...mapping, on: true, transitiontime: 10 };
}

// Load saved color mappings from AsyncStorage
export async function loadColorMappings(): Promise<Record<string, string>> {
  try {
    const saved = await AsyncStorage.getItem(LIGHTING_PRESETS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading color mappings:', error);
  }
  return DEFAULT_CIRCUIT_COLORS;
}

// Save color mappings to AsyncStorage
export async function saveColorMappings(mappings: Record<string, string>) {
  try {
    await AsyncStorage.setItem(LIGHTING_PRESETS_STORAGE_KEY, JSON.stringify(mappings));
  } catch (error) {
    console.error('Error saving color mappings:', error);
  }
}

// Get color for a specific preset
export async function getColorForPreset(presetKey: string): Promise<string> {
  const mappings = await loadColorMappings();
  return mappings[presetKey] || DEFAULT_CIRCUIT_COLORS[presetKey] || '#fb923c';
}