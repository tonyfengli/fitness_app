import { HueRemoteClient } from '../hue-remote-client';
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

export class HueRemoteProvider implements ILightingProvider {
  public readonly type: ProviderType = 'hue-remote';
  public readonly capabilities: ProviderCapabilities = {
    scenes: true,
    directControl: false, // Remote API doesn't support individual lights
    groupControl: true,
    animations: false, // Would require continuous polling
    healthCheck: false, // OAuth handles connection state
  };
  
  private client: HueRemoteClient | null = null;
  private config: ProviderConfig;
  
  constructor(config: ProviderConfig) {
    this.config = config;
  }
  
  async connect(): Promise<void> {
    // Try to create client from environment
    this.client = await HueRemoteClient.fromEnv();
    
    if (!this.client) {
      throw new Error('Remote Hue API not configured. Please set up OAuth tokens.');
    }
    
    // Test connection
    const connected = await this.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Hue Remote API');
    }
  }
  
  async disconnect(): Promise<void> {
    this.client = null;
  }
  
  async testConnection(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      // Try to fetch lights as a connection test
      await this.client.getLights();
      return true;
    } catch (error) {
      console.error('Remote connection test failed:', error);
      return false;
    }
  }
  
  async getStatus(): Promise<ConnectionStatus> {
    const connected = await this.testConnection();
    
    return {
      connected,
      details: {
        type: 'remote',
        authenticated: !!this.client,
      }
    };
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
    // Remote API doesn't support individual light control
    throw new Error('Remote API does not support individual light control. Use setGroupState instead.');
  }
  
  async setGroupState(groupId: string, state: LightState): Promise<void> {
    if (!this.client) {
      throw new Error('Provider not connected');
    }
    
    await this.client.setGroupState(groupId, state);
  }
  
  async getScenes(): Promise<Scene[]> {
    if (!this.client) {
      throw new Error('Provider not connected');
    }
    
    const scenes = await this.client.getScenes();
    
    // Convert to our standard Scene format
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
  }
  
  async activateScene(sceneId: string, groupId: string = "0"): Promise<void> {
    if (!this.client) {
      throw new Error('Provider not connected');
    }
    
    await this.client.activateScene(sceneId, groupId);
  }
}