/**
 * Provider interface for lighting integrations
 */

export type ProviderType = 'hue-local' | 'hue-remote';

export interface ProviderCapabilities {
  scenes: boolean;
  directControl: boolean;
  groupControl: boolean;
  animations: boolean;
  healthCheck: boolean;
}

export interface Light {
  id: string;
  name: string;
  on: boolean;
  brightness: number;
  reachable: boolean;
  hue?: number;
  saturation?: number;
}

export interface LightState {
  on?: boolean;
  bri?: number;
  hue?: number;
  sat?: number;
  transitiontime?: number;
}

export interface Scene {
  id: string;
  name: string;
  lights: string[];
  lastUpdated?: string;
  owner?: string;
  type?: string;
  lightstates?: Record<string, any>;
  group?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  lastConnected?: Date;
  lastError?: string;
  details?: any;
}

export interface ILightingProvider {
  readonly type: ProviderType;
  readonly capabilities: ProviderCapabilities;
  
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;
  getStatus(): Promise<ConnectionStatus>;
  
  // Core operations
  getLights(): Promise<Light[]>;
  setLightState(lightId: string, state: LightState): Promise<void>;
  setGroupState(groupId: string, state: LightState): Promise<void>;
  
  // Optional operations (check capabilities first)
  getScenes?(): Promise<Scene[]>;
  activateScene?(sceneId: string, groupId?: string): Promise<void>;
  
  // Health monitoring
  startHealthCheck?(): void;
  stopHealthCheck?(): void;
}

// Provider configuration
export interface ProviderConfig {
  type: ProviderType;
  // Local provider config
  bridgeIp?: string;
  appKey?: string;
  // Remote provider config  
  accessToken?: string;
  refreshToken?: string;
  username?: string;
  // Common config
  groupId?: string;
}