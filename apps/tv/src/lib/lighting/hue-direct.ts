import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXPO_PUBLIC_HUE_BRIDGE_IP, EXPO_PUBLIC_HUE_APP_KEY, EXPO_PUBLIC_HUE_GROUP_ID } from '../../env.generated';

// Configuration from environment
const HUE_BRIDGE_IP = EXPO_PUBLIC_HUE_BRIDGE_IP || '192.168.8.192';
const HUE_APP_KEY = EXPO_PUBLIC_HUE_APP_KEY || '';
const HUE_GROUP_ID = EXPO_PUBLIC_HUE_GROUP_ID || '0';

// Environment config loaded

// State tracking for recovery
let lastAppliedPreset: any = null;
let lastHealthCheck = 0;
let isHealthyCache = true;
let wasHealthy = true;

// Status tracking removed - now handled by Supabase real-time

// Check Hue Bridge health
async function checkHueHealth(): Promise<boolean> {
  // Cache health check for 5 seconds
  if (Date.now() - lastHealthCheck < 5000) {
    return isHealthyCache;
  }

  // Removed performance-impacting log
  const url = `http://${HUE_BRIDGE_IP}/api/${HUE_APP_KEY}/config`;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    
    const response = await fetch(url, { signal: controller.signal });
    
    clearTimeout(timeout);
    
    isHealthyCache = response.ok;
    lastHealthCheck = Date.now();
    
    if (!response.ok) {
      console.warn('[HUE-HEALTH] Bridge returned error:', response.status);
    }
    
    // Handle recovery - reapply last preset when bridge comes back
    if (!wasHealthy && isHealthyCache && lastAppliedPreset) {
      setTimeout(() => {
        setHueLights(lastAppliedPreset, true); // skipCache flag
      }, 100);
    }
    
    wasHealthy = isHealthyCache;
    return isHealthyCache;
  } catch (error) {
    // Silently handle health check failures
    isHealthyCache = false;
    lastHealthCheck = Date.now();
    wasHealthy = false;
    return false;
  }
}

// Deduplication cache
const recentCommands = new Map<string, number>();

export async function setHueLights(
  preset: {
    bri: number;
    hue: number;
    sat: number;
    transitiontime?: number;
  },
  skipCache = false
): Promise<boolean> {
  // Check if lighting is enabled
  const lightingEnabled = await AsyncStorage.getItem('lightingEnabled');
  if (lightingEnabled === 'false') {
    // Lighting is disabled
    return true; // Return success to avoid breaking the flow
  }
  
  const startTime = Date.now();
  
  // Setting Hue lights with preset
  
  // Simple deduplication (300ms window)
  if (!skipCache) {
    const presetKey = `${preset.bri}-${preset.hue}-${preset.sat}`;
    const lastTime = recentCommands.get(presetKey);
    if (lastTime && Date.now() - lastTime < 300) {
      return true; // Skip duplicate command
    }
    recentCommands.set(presetKey, Date.now());
    
    // Clean old entries
    const cutoff = Date.now() - 5000;
    for (const [key, time] of recentCommands.entries()) {
      if (time < cutoff) recentCommands.delete(key);
    }
  }
  
  const url = `http://${HUE_BRIDGE_IP}/api/${HUE_APP_KEY}/groups/${HUE_GROUP_ID}/action`;
  // Making request to Hue API
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        on: true,  // Always turn lights on when changing colors
        ...preset
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      const responseText = await response.text();
      
      // Store for recovery
      lastAppliedPreset = preset;
      await AsyncStorage.setItem('lastHuePreset', JSON.stringify(preset));
      
      // Status now tracked via Supabase real-time
      return true;
    } else {
      const errorText = await response.text();
      // Status now tracked via Supabase real-time
      console.warn('[HUE-DIRECT] ❌ Hue API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return false;
    }
  } catch (error) {
    // Status now tracked via Supabase real-time
    console.warn('[HUE-DIRECT] ❌ Failed to update Hue lights:', {
      error: error.message,
      url,
      preset
    });
    return false;
  }
}

// Initialize health check interval
let healthCheckInterval: NodeJS.Timeout;

export function startHealthCheck() {
  if (healthCheckInterval) {
    return; // Health check already running
  }
  
  // Starting health check monitor
  
  // Check every 10 seconds
  healthCheckInterval = setInterval(() => {
    checkHueHealth();
  }, 10000);
  
  // Initial check
  checkHueHealth();
  
  // Load last preset from storage
  AsyncStorage.getItem('lastHuePreset').then((stored) => {
    if (stored) {
      try {
        lastAppliedPreset = JSON.parse(stored);
        // Loaded last preset from storage
      } catch (e) {
        console.error('[HUE-HEALTH] Failed to parse stored preset:', e);
      }
    } else {
      // No stored preset found
    }
  });
}

export function stopHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}