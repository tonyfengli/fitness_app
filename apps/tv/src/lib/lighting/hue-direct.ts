import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXPO_PUBLIC_HUE_BRIDGE_IP, EXPO_PUBLIC_HUE_APP_KEY, EXPO_PUBLIC_HUE_GROUP_ID } from '../../env.generated';

// Configuration from environment
const HUE_BRIDGE_IP = EXPO_PUBLIC_HUE_BRIDGE_IP || '192.168.8.192';
const HUE_APP_KEY = EXPO_PUBLIC_HUE_APP_KEY || '';
const HUE_GROUP_ID = EXPO_PUBLIC_HUE_GROUP_ID || '0';

console.log('[HUE-DIRECT] Environment config:', {
  HUE_BRIDGE_IP,
  HUE_APP_KEY: HUE_APP_KEY ? `${HUE_APP_KEY.substring(0, 10)}...` : 'EMPTY',
  HUE_GROUP_ID,
});

// State tracking for recovery
let lastAppliedPreset: any = null;
let lastHealthCheck = 0;
let isHealthyCache = true;
let wasHealthy = true;

// Status tracking for UI
let statusListeners: ((status: 'unknown' | 'success' | 'slow' | 'failed') => void)[] = [];
let currentStatus: 'unknown' | 'success' | 'slow' | 'failed' = 'unknown';

export function subscribeLightingStatus(listener: (status: typeof currentStatus) => void) {
  statusListeners.push(listener);
  listener(currentStatus);
  
  return () => {
    statusListeners = statusListeners.filter(l => l !== listener);
  };
}

function updateStatus(status: typeof currentStatus) {
  currentStatus = status;
  statusListeners.forEach(l => l(status));
}

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
    
    if (response.ok) {
      console.log('[HUE-HEALTH] ✅ Bridge is healthy');
    } else {
      console.warn('[HUE-HEALTH] ❌ Bridge returned error:', response.status);
    }
    
    // Handle recovery - reapply last preset when bridge comes back
    if (!wasHealthy && isHealthyCache && lastAppliedPreset) {
      console.log('[HUE-HEALTH] 🔄 Bridge recovered! Reapplying last preset:', lastAppliedPreset);
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
  const startTime = Date.now();
  
  console.log('[HUE-DIRECT] setHueLights called:', {
    preset: { on: true, ...preset },
    skipCache,
    timestamp: new Date().toISOString()
  });
  
  // Simple deduplication (300ms window)
  if (!skipCache) {
    const presetKey = `${preset.bri}-${preset.hue}-${preset.sat}`;
    const lastTime = recentCommands.get(presetKey);
    if (lastTime && Date.now() - lastTime < 300) {
      console.log('[HUE-DIRECT] Skipping duplicate command:', {
        presetKey,
        timeSinceLastCommand: Date.now() - lastTime
      });
      return true;
    }
    recentCommands.set(presetKey, Date.now());
    
    // Clean old entries
    const cutoff = Date.now() - 5000;
    for (const [key, time] of recentCommands.entries()) {
      if (time < cutoff) recentCommands.delete(key);
    }
  }
  
  const url = `http://${HUE_BRIDGE_IP}/api/${HUE_APP_KEY}/groups/${HUE_GROUP_ID}/action`;
  console.log('[HUE-DIRECT] Making request to:', url);
  
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
      console.log('[HUE-DIRECT] Success response:', {
        status: response.status,
        latency,
        response: responseText
      });
      
      // Store for recovery
      lastAppliedPreset = preset;
      await AsyncStorage.setItem('lastHuePreset', JSON.stringify(preset));
      
      // Update status based on latency
      const status = latency <= 1500 ? 'success' : 'slow';
      updateStatus(status);
      console.log(`[HUE-DIRECT] ✅ Hue lights updated in ${latency}ms (status: ${status})`);
      return true;
    } else {
      const errorText = await response.text();
      updateStatus('failed');
      console.warn('[HUE-DIRECT] ❌ Hue API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return false;
    }
  } catch (error) {
    updateStatus('failed');
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
    console.log('[HUE-HEALTH] Health check already running');
    return;
  }
  
  console.log('[HUE-HEALTH] Starting health check monitor...');
  console.log('[HUE-HEALTH] Config:', {
    HUE_BRIDGE_IP,
    HUE_APP_KEY: HUE_APP_KEY ? `${HUE_APP_KEY.substring(0, 10)}...` : 'NOT SET',
    HUE_GROUP_ID
  });
  
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
        console.log('[HUE-HEALTH] Loaded last preset from storage:', lastAppliedPreset);
      } catch (e) {
        console.error('[HUE-HEALTH] Failed to parse stored preset:', e);
      }
    } else {
      console.log('[HUE-HEALTH] No stored preset found');
    }
  });
}

export function stopHealthCheck() {
  if (healthCheckInterval) {
    console.log('[HUE-HEALTH] Stopping health check monitor');
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

// Fetch all scenes from Hue Bridge
export async function fetchHueScenes(): Promise<Array<{ id: string; name: string; group?: string }>> {
  const url = `https://${HUE_BRIDGE_IP}/clip/v2/resource/scene`;
  
  console.log('[HUE-SCENES] Fetching scenes from:', url);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'hue-application-key': HUE_APP_KEY,
        'Accept': 'application/json'
      },
      signal: controller.signal,
      // @ts-ignore - React Native fetch doesn't type this properly
      rejectUnauthorized: false  // For self-signed certificates
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      console.log('[HUE-SCENES] Raw response:', data);
      
      // Extract relevant scene data
      const scenes = data.data?.map((scene: any) => ({
        id: scene.id,
        name: scene.metadata?.name || 'Unnamed Scene',
        group: scene.group?.rid
      })) || [];
      
      console.log('[HUE-SCENES] Found', scenes.length, 'scenes');
      return scenes;
    } else {
      console.error('[HUE-SCENES] Failed to fetch scenes:', response.status);
      return [];
    }
  } catch (error) {
    console.error('[HUE-SCENES] Error fetching scenes:', error);
    return [];
  }
}

// Activate a scene
export async function activateHueScene(sceneId: string): Promise<boolean> {
  const url = `https://${HUE_BRIDGE_IP}/clip/v2/resource/scene/${sceneId}`;
  
  console.log('[HUE-SCENES] Activating scene:', sceneId);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 
        'hue-application-key': HUE_APP_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recall: { 
          action: 'active' 
        }
      }),
      signal: controller.signal,
      // @ts-ignore
      rejectUnauthorized: false
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      console.log('[HUE-SCENES] Scene activated successfully');
      updateStatus('success');
      return true;
    } else {
      const errorText = await response.text();
      console.error('[HUE-SCENES] Failed to activate scene:', response.status, errorText);
      updateStatus('failed');
      return false;
    }
  } catch (error) {
    console.error('[HUE-SCENES] Error activating scene:', error);
    updateStatus('failed');
    return false;
  }
}