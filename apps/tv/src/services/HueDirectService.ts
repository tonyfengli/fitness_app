import { EXPO_PUBLIC_HUE_BRIDGE_IP, EXPO_PUBLIC_HUE_APP_KEY, EXPO_PUBLIC_HUE_GROUP_ID } from '../env.generated';

export interface HueScene {
  id: string;
  name: string;
  lights?: string[];
  owner?: string;
  lastupdated?: string;
}

export interface HueLightState {
  on?: boolean;
  bri?: number;
  hue?: number;
  sat?: number;
  transitiontime?: number;
  scene?: string;
}

export interface HueServiceStatus {
  available: boolean;
  lastChecked: number;
  error?: string;
}

class HueDirectService {
  private baseUrl: string;
  private appKey: string;
  private groupId: string;
  private status: HueServiceStatus = {
    available: false,
    lastChecked: 0,
  };
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly TIMEOUT_MS = 2000; // 2 seconds for local network

  constructor() {
    if (!EXPO_PUBLIC_HUE_BRIDGE_IP || !EXPO_PUBLIC_HUE_APP_KEY) {
      console.warn('[HueDirectService] Missing Hue configuration');
    }
    
    this.baseUrl = EXPO_PUBLIC_HUE_BRIDGE_IP ? `http://${EXPO_PUBLIC_HUE_BRIDGE_IP}/api/${EXPO_PUBLIC_HUE_APP_KEY}` : '';
    this.appKey = EXPO_PUBLIC_HUE_APP_KEY || '';
    this.groupId = EXPO_PUBLIC_HUE_GROUP_ID || '0';
  }

  /**
   * Check if we can reach the Hue Bridge
   * Caches result for 30 seconds to avoid excessive pinging
   */
  async checkConnection(forceCheck = false): Promise<boolean> {
    const now = Date.now();
    
    // Return cached result if still fresh
    if (!forceCheck && this.status.lastChecked && (now - this.status.lastChecked < this.CACHE_DURATION)) {
      return this.status.available;
    }

    if (!this.baseUrl) {
      this.status = {
        available: false,
        lastChecked: now,
        error: 'Hue Bridge not configured',
      };
      return false;
    }

    try {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(`${this.baseUrl}/config`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        // Check if it's actually a Hue bridge response
        if (data.name && data.bridgeid) {
          this.status = {
            available: true,
            lastChecked: now,
          };
          return true;
        }
      }
      
      throw new Error(`Invalid response from bridge: ${response.status}`);
    } catch (error: any) {
      const errorMessage = error.name === 'AbortError' 
        ? 'Connection timeout - not on same network'
        : error.message;
      
      console.log('[HueDirectService] Bridge connection check failed:', errorMessage);
      
      this.status = {
        available: false,
        lastChecked: now,
        error: errorMessage,
      };
      return false;
    }
  }

  /**
   * Get current connection status without checking
   */
  getStatus(): HueServiceStatus {
    return { ...this.status };
  }

  /**
   * Get all scenes from the bridge
   */
  async getScenes(): Promise<HueScene[]> {
    if (!(await this.checkConnection())) {
      throw new Error(this.status.error || 'Hue Bridge not available');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(`${this.baseUrl}/scenes`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to get scenes: HTTP ${response.status}`);
      }

      const scenes = await response.json();
      
      // Convert Hue API format to our format
      return Object.entries(scenes).map(([id, scene]: [string, any]) => ({
        id,
        name: scene.name || 'Unnamed',
        lights: scene.lights,
        owner: scene.owner,
        lastupdated: scene.lastupdated,
      }));
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - bridge may be slow or unreachable');
      }
      throw error;
    }
  }

  /**
   * Activate a specific scene
   */
  async activateScene(sceneId: string, groupId?: string): Promise<void> {
    if (!(await this.checkConnection())) {
      throw new Error(this.status.error || 'Hue Bridge not available - not on gym network');
    }

    const targetGroup = groupId || this.groupId;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(`${this.baseUrl}/groups/${targetGroup}/action`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: sceneId }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to activate scene: HTTP ${response.status}`);
      }

      const results = await response.json();
      
      // Hue API returns array of results, check for errors
      const errors = results.filter((r: any) => r.error);
      if (errors.length > 0) {
        throw new Error(`Hue API error: ${JSON.stringify(errors[0].error)}`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - bridge may be slow or unreachable');
      }
      throw error;
    }
  }

  /**
   * Set light state (on/off, brightness, color, etc)
   */
  async setState(state: HueLightState, groupId?: string): Promise<void> {
    if (!(await this.checkConnection())) {
      throw new Error(this.status.error || 'Hue Bridge not available - not on gym network');
    }

    const targetGroup = groupId || this.groupId;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(`${this.baseUrl}/groups/${targetGroup}/action`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to set state: HTTP ${response.status}`);
      }

      const results = await response.json();
      
      // Check for errors in response
      const errors = results.filter((r: any) => r.error);
      if (errors.length > 0) {
        throw new Error(`Hue API error: ${JSON.stringify(errors[0].error)}`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - bridge may be slow or unreachable');
      }
      throw error;
    }
  }

  /**
   * Force a fresh connection check
   */
  async refreshConnection(): Promise<boolean> {
    return this.checkConnection(true);
  }
}

// Export singleton instance
export const hueDirectService = new HueDirectService();