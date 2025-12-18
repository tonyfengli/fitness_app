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

export class MockProvider implements ILightingProvider {
  public readonly type: ProviderType = 'mock';
  public readonly capabilities: ProviderCapabilities = {
    scenes: true,
    directControl: true,
    groupControl: true,
    animations: true,
    healthCheck: true,
  };
  
  private connected = false;
  private lights: Record<string, Light> = {
    '1': { id: '1', name: 'Mock Light 1', on: true, brightness: 254, reachable: true },
    '2': { id: '2', name: 'Mock Light 2', on: false, brightness: 128, reachable: true },
    '3': { id: '3', name: 'Mock Light 3', on: true, brightness: 200, reachable: true },
  };
  
  private scenes: Scene[] = [
    { id: 'scene1', name: 'Energize', lights: ['1', '2', '3'] },
    { id: 'scene2', name: 'Relax', lights: ['1', '2', '3'] },
    { id: 'scene3', name: 'Concentrate', lights: ['1', '2', '3'] },
  ];
  
  constructor(config: ProviderConfig) {
    // Mock provider doesn't need config
  }
  
  async connect(): Promise<void> {
    console.log('[MockProvider] Connecting...');
    await this.delay(100); // Simulate connection delay
    this.connected = true;
    console.log('[MockProvider] Connected');
  }
  
  async disconnect(): Promise<void> {
    console.log('[MockProvider] Disconnecting...');
    this.connected = false;
  }
  
  async testConnection(): Promise<boolean> {
    await this.delay(50);
    return this.connected;
  }
  
  async getStatus(): Promise<ConnectionStatus> {
    return {
      connected: this.connected,
      lastConnected: this.connected ? new Date() : undefined,
      details: { mock: true }
    };
  }
  
  async getLights(): Promise<Light[]> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }
    
    await this.delay(100);
    return Object.values(this.lights);
  }
  
  async setLightState(lightId: string, state: LightState): Promise<void> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }
    
    await this.delay(50);
    
    if (this.lights[lightId]) {
      console.log(`[MockProvider] Setting light ${lightId} state:`, state);
      if (state.on !== undefined) this.lights[lightId].on = state.on;
      if (state.bri !== undefined) this.lights[lightId].brightness = state.bri;
    }
  }
  
  async setGroupState(groupId: string, state: LightState): Promise<void> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }
    
    await this.delay(50);
    console.log(`[MockProvider] Setting group ${groupId} state:`, state);
    
    // Apply to all lights for group "0"
    if (groupId === "0") {
      for (const light of Object.values(this.lights)) {
        if (state.on !== undefined) light.on = state.on;
        if (state.bri !== undefined) light.brightness = state.bri;
      }
    }
  }
  
  async getScenes(): Promise<Scene[]> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }
    
    await this.delay(100);
    return [...this.scenes];
  }
  
  async activateScene(sceneId: string, groupId: string = "0"): Promise<void> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }
    
    await this.delay(50);
    console.log(`[MockProvider] Activating scene ${sceneId} for group ${groupId}`);
  }
  
  startHealthCheck(): void {
    console.log('[MockProvider] Health check started');
  }
  
  stopHealthCheck(): void {
    console.log('[MockProvider] Health check stopped');
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}