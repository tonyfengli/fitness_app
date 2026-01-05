/**
 * Low-level Philips Hue HTTP API v1 client
 */

import { createLogger } from '../../utils/logger';
import type {
  HueBridgeConfig,
  HueGroup,
  HueLight,
  HueLightState,
  HueConnectionError,
} from './types';

const logger = createLogger('HueClient');

export interface HueClientConfig {
  bridgeIp: string;
  appKey: string;
  timeout?: number;
}

export class HueClient {
  private bridgeIp: string;
  private apiKey: string;
  private timeout: number;
  private lastSuccessfulConnection?: Date;

  constructor(private config: HueClientConfig) {
    this.bridgeIp = config.bridgeIp;
    this.apiKey = config.appKey;
    this.timeout = config.timeout || 5000;
  }

  /**
   * Test connection to the Hue Bridge
   */
  async testConnection(): Promise<boolean> {
    try {
      const config = await this.getBridgeConfig();
      this.lastSuccessfulConnection = new Date();
      logger.info('Hue Bridge connection successful', {
        name: config.name,
        apiVersion: config.apiversion,
      });
      return true;
    } catch (error) {
      logger.error('Hue Bridge connection failed', { error });
      return false;
    }
  }

  /**
   * Get bridge configuration
   */
  async getBridgeConfig(): Promise<HueBridgeConfig> {
    const response = await this.makeRequest<HueBridgeConfig>('GET', '/config');
    return response;
  }

  /**
   * Get all lights
   */
  async getLights(): Promise<Record<string, HueLight>> {
    const lights = await this.makeRequest<Record<string, Omit<HueLight, 'id'>>>('GET', '/lights');
    
    // Add ID to each light object
    const lightsWithId: Record<string, HueLight> = {};
    for (const [id, light] of Object.entries(lights)) {
      lightsWithId[id] = { ...light, id };
    }
    
    return lightsWithId;
  }

  /**
   * Get a specific light
   */
  async getLight(lightId: string): Promise<HueLight> {
    const light = await this.makeRequest<Omit<HueLight, 'id'>>('GET', `/lights/${lightId}`);
    return { ...light, id: lightId };
  }

  /**
   * Set light state
   */
  async setLightState(lightId: string, state: HueLightState): Promise<void> {
    await this.makeRequest('PUT', `/lights/${lightId}/state`, state);
    logger.debug('Light state updated', { lightId, state });
  }

  /**
   * Get all groups
   */
  async getGroups(): Promise<Record<string, HueGroup>> {
    return await this.makeRequest<Record<string, HueGroup>>('GET', '/groups');
  }

  /**
   * Get a specific group
   */
  async getGroup(groupId: string): Promise<HueGroup> {
    return await this.makeRequest<HueGroup>('GET', `/groups/${groupId}`);
  }

  /**
   * Set group action (state for all lights in group)
   */
  async setGroupAction(groupId: string, action: HueLightState): Promise<void> {
    await this.makeRequest('PUT', `/groups/${groupId}/action`, action);
    logger.debug('Group action updated', { groupId, action });
  }
  
  /**
   * Get all scenes
   */
  async getScenes(): Promise<Record<string, any>> {
    return await this.makeRequest<Record<string, any>>('GET', '/scenes');
  }

  /**
   * Get last successful connection time
   */
  getLastSuccessfulConnection(): Date | undefined {
    return this.lastSuccessfulConnection;
  }

  /**
   * Make HTTP request to Hue Bridge
   */
  private async makeRequest<T>(
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    path: string,
    body?: any,
  ): Promise<T> {
    const url = `http://${this.bridgeIp}/api/${this.apiKey}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // Check for Hue API errors
      if (Array.isArray(data) && data[0]?.error) {
        const hueError = data[0].error;
        throw new Error(`Hue API Error ${hueError.type}: ${hueError.description}`);
      }

      this.lastSuccessfulConnection = new Date();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }
        throw error;
      }
      
      throw new Error('Unknown error occurred');
    }
  }
}

/**
 * Mock Hue client for testing
 */
export class MockHueClient extends HueClient {
  private mockLights: Record<string, HueLight> = {
    '1': {
      id: '1',
      name: 'Living Room Strip',
      type: 'Extended color light',
      modelid: 'LST002',
      manufacturername: 'Signify Netherlands B.V.',
      state: {
        on: true,
        bri: 254,
        hue: 8000,
        sat: 140,
        reachable: true,
      },
    },
  };

  private mockGroups: Record<string, HueGroup> = {
    '1': {
      name: 'Gym Lights',
      lights: ['1', '2', '3'],
      type: 'Room',
      state: {
        all_on: true,
        any_on: true,
      },
      action: {
        on: true,
        bri: 254,
        hue: 8000,
        sat: 140,
      },
    },
  };

  private mockConnected = true;

  setMockConnected(connected: boolean) {
    this.mockConnected = connected;
  }

  async testConnection(): Promise<boolean> {
    if (!this.mockConnected) {
      throw new Error('Mock bridge offline');
    }
    return true;
  }

  async getBridgeConfig(): Promise<HueBridgeConfig> {
    if (!this.mockConnected) {
      throw new Error('Mock bridge offline');
    }
    return {
      name: 'Mock Hue Bridge',
      ipaddress: '192.168.1.100',
      mac: '00:17:88:00:00:00',
      apiversion: '1.46.0',
    };
  }

  async getLights(): Promise<Record<string, HueLight>> {
    if (!this.mockConnected) {
      throw new Error('Mock bridge offline');
    }
    return this.mockLights;
  }

  async getLight(lightId: string): Promise<HueLight> {
    if (!this.mockConnected) {
      throw new Error('Mock bridge offline');
    }
    const light = this.mockLights[lightId];
    if (!light) {
      throw new Error(`Light ${lightId} not found`);
    }
    return light;
  }

  async setLightState(lightId: string, state: HueLightState): Promise<void> {
    if (!this.mockConnected) {
      throw new Error('Mock bridge offline');
    }
    const light = this.mockLights[lightId];
    if (!light) {
      throw new Error(`Light ${lightId} not found`);
    }
    // Update mock state
    Object.assign(light.state, state);
    logger.debug('[MOCK] Light state updated', { lightId, state });
  }

  async getGroups(): Promise<Record<string, HueGroup>> {
    if (!this.mockConnected) {
      throw new Error('Mock bridge offline');
    }
    return this.mockGroups;
  }

  async getGroup(groupId: string): Promise<HueGroup> {
    if (!this.mockConnected) {
      throw new Error('Mock bridge offline');
    }
    const group = this.mockGroups[groupId];
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }
    return group;
  }

  async setGroupAction(groupId: string, action: HueLightState): Promise<void> {
    if (!this.mockConnected) {
      throw new Error('Mock bridge offline');
    }
    const group = this.mockGroups[groupId];
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }
    // Update mock state
    Object.assign(group.action, action);
    logger.debug('[MOCK] Group action updated', { groupId, action });
  }
}