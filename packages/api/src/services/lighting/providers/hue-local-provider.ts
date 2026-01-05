import { HueClient } from '../hue-client';
import type { 
  ILightingProvider, 
  ProviderType, 
  ProviderCapabilities, 
  ConnectionStatus,
  Light,
  LightState,
  Scene,
  ProviderConfig
} from './types';

export class HueLocalProvider implements ILightingProvider {
  public readonly type: ProviderType = 'hue-local';
  public readonly capabilities: ProviderCapabilities = {
    scenes: true, // Enable scenes for local provider
    directControl: true,
    groupControl: true,
    animations: true,
    healthCheck: true,
  };
  
  private client: HueClient | null = null;
  private config: ProviderConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private connectionStatus: ConnectionStatus = {
    connected: false,
  };
  
  constructor(config: ProviderConfig) {
    if (!config.bridgeIp || !config.appKey) {
      throw new Error('Local provider requires bridgeIp and appKey');
    }
    this.config = config;
  }
  
  async connect(): Promise<void> {
    this.client = new HueClient({
      bridgeIp: this.config.bridgeIp!,
      appKey: this.config.appKey!,
      timeout: 5000,
    });
    
    const connected = await this.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to local Hue Bridge');
    }
    
    this.connectionStatus = {
      connected: true,
      lastConnected: new Date(),
    };
  }
  
  async disconnect(): Promise<void> {
    this.stopHealthCheck();
    this.client = null;
    this.connectionStatus.connected = false;
  }
  
  async testConnection(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      console.log('[HueLocalProvider] Testing connection to bridge at:', this.config.bridgeIp);
      const result = await this.client.testConnection();
      console.log('[HueLocalProvider] Connection test result:', result);
      return result; // Fix: testConnection returns boolean directly, not an object
    } catch (error) {
      console.error('[HueLocalProvider] Local connection test failed:', error);
      this.connectionStatus.lastError = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }
  
  async getStatus(): Promise<ConnectionStatus> {
    return { ...this.connectionStatus };
  }
  
  async getLights(): Promise<Light[]> {
    if (!this.client) {
      throw new Error('Provider not connected');
    }
    
    const lights = await this.client.getLights();
    
    // Convert to our standard Light format
    return Object.entries(lights).map(([id, light]: [string, any]) => ({
      id,
      name: light.name,
      on: light.state?.on || false,
      brightness: light.state?.bri || 0,
      reachable: light.state?.reachable || false,
      hue: light.state?.hue,
      saturation: light.state?.sat,
    }));
  }
  
  async setLightState(lightId: string, state: LightState): Promise<void> {
    if (!this.client) {
      throw new Error('Provider not connected');
    }
    
    await this.client.setLightState(lightId, state);
  }
  
  async setGroupState(groupId: string, state: LightState): Promise<void> {
    if (!this.client) {
      throw new Error('Provider not connected');
    }
    
    await this.client.setGroupAction(groupId, state);
  }
  
  async getScenes(): Promise<Scene[]> {
    if (!this.client) {
      throw new Error('Provider not connected');
    }
    
    try {
      const scenes = await this.client.getScenes();
      
      // Convert Hue API format to our Scene format
      return Object.entries(scenes).map(([id, scene]: [string, any]) => ({
        id,
        name: scene.name,
        lights: scene.lights || [],
        lastUpdated: scene.lastupdated,
        owner: scene.owner,
        type: scene.type,
        lightstates: scene.lightstates,
        group: scene.group,
      }));
    } catch (error) {
      console.error('[HueLocalProvider] Failed to get scenes:', error);
      return [];
    }
  }
  
  async activateScene(sceneId: string, groupId: string = "0"): Promise<void> {
    if (!this.client) {
      throw new Error('Provider not connected');
    }
    
    // For local provider, we can activate scenes via group action
    // Philips Hue V1 API supports scene recall via group action
    await this.client.setGroupAction(groupId, {
      scene: sceneId
    } as any);
  }
  
  startHealthCheck(): void {
    if (this.healthCheckInterval) return;
    
    // Check connection every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      const connected = await this.testConnection();
      this.connectionStatus.connected = connected;
      
      if (connected) {
        this.connectionStatus.lastConnected = new Date();
      }
    }, 30000);
  }
  
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
}