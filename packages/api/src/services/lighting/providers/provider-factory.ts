import { HueLocalProvider } from './hue-local-provider';
import { HueRemoteProvider } from './hue-remote-provider';
import { MockProvider } from './mock-provider';
import type { ILightingProvider, ProviderConfig, ProviderType } from './types';

export class LightingProviderFactory {
  /**
   * Create a lighting provider based on configuration
   */
  static create(config: ProviderConfig): ILightingProvider {
    switch (config.type) {
      case 'hue-local':
        return new HueLocalProvider(config);
        
      case 'hue-remote':
        return new HueRemoteProvider(config);
        
      case 'mock':
        return new MockProvider(config);
        
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }
  
  /**
   * Create providers based on environment configuration
   * Returns array of providers in priority order
   */
  static createFromEnvironment(): ILightingProvider[] {
    const providers: ILightingProvider[] = [];
    
    // Check for local Hue configuration
    // Only add local provider if explicitly enabled to avoid timeout errors
    if (process.env.HUE_ENABLED === 'true' && process.env.HUE_BRIDGE_IP && process.env.HUE_APP_KEY) {
      providers.push(this.create({
        type: 'hue-local',
        bridgeIp: process.env.HUE_BRIDGE_IP,
        appKey: process.env.HUE_APP_KEY,
        groupId: process.env.HUE_GROUP_ID || '0',
      }));
    }
    
    // Check for remote Hue configuration
    if (process.env.HUE_REMOTE_ENABLED === 'true') {
      providers.push(this.create({
        type: 'hue-remote',
        groupId: process.env.HUE_GROUP_ID || '0',
      }));
    }
    
    // Always add mock provider as fallback
    providers.push(this.create({ type: 'mock' }));
    
    return providers;
  }
  
  /**
   * Determine provider type from environment
   */
  static getConfiguredType(): ProviderType {
    // Priority: local > remote > mock
    if (process.env.HUE_BRIDGE_IP && process.env.HUE_APP_KEY && process.env.HUE_ENABLED === 'true') {
      return 'hue-local';
    }
    
    if (process.env.HUE_REMOTE_ENABLED === 'true') {
      return 'hue-remote';
    }
    
    return 'mock';
  }
}