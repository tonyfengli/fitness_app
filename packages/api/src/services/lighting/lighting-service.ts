/**
 * Unified lighting orchestrator service using provider abstraction
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import { createPresetProvider, getPresetForEvent } from './presets';
import { LightingProviderFactory } from './providers';
import type { ILightingProvider, Light, LightState, Scene, ConnectionStatus as ProviderConnectionStatus } from './providers';
import type {
  ConnectionStatus,
  HueLightState,
  LightCommand,
  LightingPreset,
  LightingStatus,
  PresetProvider as IPresetProvider,
  TimerEventData,
  WorkoutTemplate,
  LightingPresetType,
} from './types';
import type { FilePresetProvider } from './presets';

const logger = createLogger('LightingService');

export interface LightingServiceConfig {
  providers?: ILightingProvider[];
  enabled?: boolean;
  groupId?: string;
}

export class LightingService {
  private providers: ILightingProvider[];
  private activeProvider?: ILightingProvider;
  private presetProvider: IPresetProvider;
  private presets: any;
  private groupId: string;
  private enabled: boolean;
  
  // Command queue
  private commandQueue: LightCommand[] = [];
  private isProcessingQueue = false;
  private lastCommandTime = 0;
  private lastCommandId?: string;
  
  // Health monitoring
  private status: ConnectionStatus = 'disconnected';
  private lastError?: string;
  private degradedUntil?: Date;
  private healthCheckInterval?: ReturnType<typeof setInterval>;
  
  // State tracking
  private lastIntendedState?: HueLightState;
  private lastIntendedPreset?: string;
  private lastIntendedTemplate?: WorkoutTemplate;
  
  // Animation support
  private animationInterval?: ReturnType<typeof setInterval>;
  private animationType?: 'drift' | 'breathe' | 'countdown' | 'none';

  constructor(config: LightingServiceConfig = {}) {
    const { 
      providers,
      enabled = process.env.HUE_ENABLED === 'true' || process.env.HUE_REMOTE_ENABLED === 'true',
      groupId = process.env.HUE_GROUP_ID || '0',
    } = config;

    this.enabled = enabled;
    this.groupId = groupId;
    this.presetProvider = createPresetProvider();
    // Load presets into memory for direct access
    this.loadPresets();

    // Use provided providers or create from environment
    this.providers = providers || LightingProviderFactory.createFromEnvironment();
    
    if (!this.enabled) {
      logger.info('Lighting service disabled via configuration');
      return;
    }
    
    logger.info(`Initialized with ${this.providers.length} provider(s)`);
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    // Initial connection attempt
    this.connectToProvider();
  }

  /**
   * Try to connect to available providers in priority order
   */
  private async connectToProvider(retryCount = 0): Promise<void> {
    logger.info(`[LightingService] Available providers: ${this.providers.map(p => p.type).join(', ')}`);
    logger.info(`[LightingService] Environment config:`, {
      HUE_ENABLED: process.env.HUE_ENABLED,
      HUE_BRIDGE_IP: process.env.HUE_BRIDGE_IP,
      HUE_APP_KEY: process.env.HUE_APP_KEY ? 'SET' : 'NOT SET',
      HUE_REMOTE_ENABLED: process.env.HUE_REMOTE_ENABLED
    });
    
    // If no providers configured, set clear error
    if (this.providers.length === 0) {
      logger.error('[LightingService] No lighting providers configured');
      this.status = 'disconnected';
      this.lastError = 'No lighting providers configured. Please configure Hue bridge settings.';
      return;
    }
    
    for (const provider of this.providers) {
      try {
        logger.info(`[LightingService] Attempting to connect with ${provider.type} provider...`);
        await provider.connect();
        
        this.activeProvider = provider;
        this.status = 'connected';
        logger.info(`[LightingService] Connected successfully with ${provider.type} provider`);
        
        // Start health check if supported
        if (provider.capabilities.healthCheck && provider.startHealthCheck) {
          provider.startHealthCheck();
        }
        
        return;
      } catch (error) {
        logger.warn(`[LightingService] Failed to connect with ${provider.type}:`, error);
        continue;
      }
    }
    
    // All providers failed
    logger.error('[LightingService] Failed to connect to any lighting provider');
    this.status = 'disconnected';
    this.lastError = 'Unable to connect to lighting system. Check network and bridge settings.';
    
    // Implement retry logic with exponential backoff
    const maxRetries = 10;
    if (retryCount < maxRetries) {
      // First 3 retries: every 5 seconds
      // Next 3 retries: every 15 seconds  
      // Remaining retries: every 30 seconds
      let retryDelay = 5000;
      if (retryCount >= 3 && retryCount < 6) {
        retryDelay = 15000;
      } else if (retryCount >= 6) {
        retryDelay = 30000;
      }
      
      logger.info(`[LightingService] Retrying connection in ${retryDelay/1000} seconds... (attempt ${retryCount + 1}/${maxRetries})`);
      setTimeout(() => {
        this.connectToProvider(retryCount + 1);
      }, retryDelay);
    } else {
      logger.error('[LightingService] Max retry attempts reached. Will continue trying via health checks.');
    }
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<LightingStatus> {
    const providerStatus = this.activeProvider ? 
      await this.activeProvider.getStatus() : 
      { connected: false };

    return {
      enabled: this.enabled,
      status: this.status,
      lastConnected: providerStatus.lastConnected,
      lastError: this.lastError || providerStatus.lastError,
      bridgeInfo: providerStatus.details,
      degraded: this.isDegraded(),
      degradedUntil: this.degradedUntil,
      activeProvider: this.activeProvider?.type,
      availableProviders: this.providers.map(p => p.type),
    };
  }

  /**
   * Get available lights
   */
  async getLights() {
    // If no active provider, try to reconnect first
    if (!this.activeProvider) {
      logger.warn('[LightingService] No active provider for getLights, attempting to connect...');
      await this.connectToProvider();
    }
    
    // Check if we have a connected provider
    if (!this.activeProvider || this.status !== 'connected') {
      logger.warn('[LightingService] No connected provider available for getLights');
      return {};
    }

    try {
      const lights = await this.activeProvider.getLights();
      // Convert array to object format for backward compatibility
      return lights.reduce((acc, light) => {
        acc[light.id] = {
          name: light.name,
          state: {
            on: light.on,
            bri: light.brightness,
            reachable: light.reachable,
            hue: light.hue,
            sat: light.saturation,
          }
        };
        return acc;
      }, {} as Record<string, any>);
    } catch (error) {
      logger.error('Failed to get lights:', error);
      return {};
    }
  }

  /**
   * Get available scenes (if provider supports them)
   */
  async getScenes(): Promise<Scene[]> {
    logger.info('[LightingService] getScenes called:', {
      activeProvider: this.activeProvider?.type,
      hasSceneCapability: this.activeProvider?.capabilities.scenes
    });
    
    // If no active provider, try to reconnect first
    if (!this.activeProvider) {
      logger.warn('[LightingService] No active provider, attempting to connect...');
      await this.connectToProvider();
    }
    
    // Check if we have a provider with scene capability
    if (!this.activeProvider || !this.activeProvider.capabilities.scenes) {
      logger.warn('[LightingService] No provider or scene capability available', {
        hasProvider: !!this.activeProvider,
        hasSceneCapability: this.activeProvider?.capabilities?.scenes ?? false
      });
      return [];
    }

    try {
      const scenes = await this.activeProvider.getScenes!();
      logger.info('[LightingService] Scenes retrieved:', {
        provider: this.activeProvider.type,
        count: scenes.length,
        sceneIds: scenes.map(s => ({ id: s.id, name: s.name }))
      });
      return scenes;
    } catch (error) {
      logger.error('[LightingService] Failed to get scenes:', error);
      return [];
    }
  }

  /**
   * Activate a scene
   */
  async activateScene(sceneId: string, groupId?: string): Promise<void> {
    if (!this.activeProvider || !this.activeProvider.capabilities.scenes) {
      throw new Error('Current provider does not support scenes');
    }

    await this.activeProvider.activateScene!(sceneId, groupId || this.groupId);
  }

  /**
   * Apply a preset
   */
  async applyPreset(name: string, template?: WorkoutTemplate): Promise<void> {
    if (!this.enabled || !this.activeProvider || this.isDegraded()) {
      logger.debug(`Skipping preset ${name} - service not ready`);
      return;
    }

    // Store intended state for recovery
    this.lastIntendedPreset = name as string;
    this.lastIntendedTemplate = template;

    const preset = await this.getPresetByName(name, template);
    if (!preset) {
      logger.warn(`Unknown preset: ${name}`);
      return;
    }

    const state: HueLightState = {
      on: preset.on !== undefined ? preset.on : true,
      bri: preset.bri,
      hue: preset.hue,
      sat: preset.sat,
      transitiontime: preset.transitiontime,
    };

    await this.setState(state);
  }

  /**
   * Apply custom state
   */
  async setState(state: HueLightState): Promise<void> {
    if (!this.enabled || !this.activeProvider) {
      return;
    }

    // Store intended state
    this.lastIntendedState = state;

    const command: LightCommand = {
      id: uuidv4(),
      type: 'state',
      state,
      retries: 0,
      groupId: this.groupId,
      timestamp: new Date(),
    };

    await this.enqueueCommand(command);
  }

  /**
   * Clean shutdown
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.stopAnimation();
    
    if (this.activeProvider) {
      if (this.activeProvider.stopHealthCheck) {
        this.activeProvider.stopHealthCheck();
      }
      await this.activeProvider.disconnect();
    }
    
    this.commandQueue = [];
  }

  /**
   * Test connection
   */
  private async testConnection(): Promise<void> {
    if (!this.activeProvider) {
      await this.connectToProvider();
      return;
    }

    try {
      const connected = await this.activeProvider.testConnection();
      
      if (!connected) {
        logger.warn('Lost connection to provider, attempting reconnection...');
        this.status = 'disconnected';
        await this.connectToProvider();
      } else {
        this.status = 'connected';
        this.lastError = undefined;
      }
    } catch (error) {
      logger.error('Connection test failed:', error);
      this.status = 'error' as ConnectionStatus;
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      
      // Try to reconnect with next provider
      await this.connectToProvider();
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    // Check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.testConnection();
    }, 30000);
  }

  /**
   * Enqueue a command
   */
  private async enqueueCommand(command: LightCommand): Promise<void> {
    // Check for duplicate commands
    const isDuplicate = 
      this.lastCommandId === `${command.type}-${command.preset || JSON.stringify(command.state)}` &&
      Date.now() - this.lastCommandTime < 300;

    if (isDuplicate) {
      logger.debug('Dropping duplicate command', { command });
      return;
    }

    this.commandQueue.push(command);
    this.lastCommandId = `${command.type}-${command.preset || JSON.stringify(command.state)}`;

    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      await this.processQueue();
    }
  }

  /**
   * Process command queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift()!;

      try {
        await this.executeCommand(command);
        this.lastCommandTime = Date.now();
      } catch (error) {
        logger.error('Command execution failed', { command, error });
        
        // Retry once
        if (command.retries < 1) {
          command.retries++;
          await this.sleep(200);
          
          try {
            await this.executeCommand(command);
          } catch (retryError) {
            logger.error('Command retry failed', { command, error: retryError });
            this.handleCommandFailure();
          }
        }
      }

      // Small delay between commands
      if (this.commandQueue.length > 0) {
        await this.sleep(50);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute a single command
   */
  private async executeCommand(command: LightCommand): Promise<void> {
    if (!this.activeProvider) {
      throw new Error('No active provider');
    }

    switch (command.type) {
      case 'state':
        if (command.state) {
          await this.activeProvider.setGroupState(this.groupId, command.state);
        }
        break;
        
      case 'preset':
        // For preset commands, we need to convert to state
        if (command.preset) {
          const preset = await this.getPresetByName(command.preset!, command.template);
          if (preset) {
            const state: LightState = {
              on: preset.on !== undefined ? preset.on : true,
              bri: preset.bri,
              hue: preset.hue,
              sat: preset.sat,
              transitiontime: preset.transitiontime,
            };
            await this.activeProvider.setGroupState(this.groupId, state);
          }
        }
        break;
    }
  }

  /**
   * Handle command failure
   */
  private handleCommandFailure(): void {
    // Enter degraded mode for 5 minutes
    this.degradedUntil = new Date(Date.now() + 5 * 60 * 1000);
    logger.warn('Entering degraded mode due to command failures');
  }

  /**
   * Check if service is degraded
   */
  private isDegraded(): boolean {
    return !!this.degradedUntil && this.degradedUntil > new Date();
  }

  /**
   * Animation support
   */
  async startAnimation(type: 'drift' | 'breathe' | 'countdown'): Promise<void> {
    if (!this.activeProvider?.capabilities.animations) {
      logger.warn('Current provider does not support animations');
      return;
    }

    this.stopAnimation();
    this.animationType = type;

    // Implementation would depend on animation type
    // For now, just log
    logger.info(`Starting ${type} animation`);
  }

  /**
   * Stop animation
   */
  stopAnimation(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = undefined;
    }
    this.animationType = 'none';
  }

  /**
   * Get animation status
   */
  getAnimationStatus() {
    return {
      active: !!this.animationInterval,
      type: this.animationType || 'none',
    };
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Load presets into memory
   */
  private async loadPresets(): Promise<void> {
    try {
      this.presets = await this.presetProvider.getAllPresets();
    } catch (error) {
      logger.error('Failed to load presets:', error);
      this.presets = {};
    }
  }

  /**
   * Get preset by name
   */
  private async getPresetByName(name: string, template?: WorkoutTemplate): Promise<LightingPreset | null> {
    if (!template) {
      // Try to find preset in any template
      for (const tmpl of ['circuit', 'strength'] as WorkoutTemplate[]) {
        try {
          const preset = await this.presetProvider.getPreset(name, tmpl);
          if (preset) return preset;
        } catch (error) {
          continue;
        }
      }
      return null;
    }

    try {
      return await this.presetProvider.getPreset(name, template);
    } catch (error) {
      logger.warn(`Preset not found: ${name} for template ${template}`);
      return null;
    }
  }
}