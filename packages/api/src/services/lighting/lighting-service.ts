/**
 * Main lighting orchestrator service
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import { HueClient, MockHueClient } from './hue-client';
import { createPresetProvider, getPresetForEvent } from './presets';
import type {
  ConnectionStatus,
  HueLightState,
  LightCommand,
  LightingPreset,
  LightingStatus,
  PresetProvider,
  TimerEventData,
  WorkoutTemplate,
} from './types';

const logger = createLogger('LightingService');

export interface LightingServiceConfig {
  bridgeIp?: string;
  appKey?: string;
  groupId?: string;
  enabled?: boolean;
  useMock?: boolean;
}

export class LightingService {
  private hueClient: HueClient;
  private presetProvider: PresetProvider;
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

  constructor(config: LightingServiceConfig) {
    const { 
      bridgeIp = process.env.HUE_BRIDGE_IP,
      appKey = process.env.HUE_APP_KEY,
      groupId = process.env.HUE_GROUP_ID || '1',
      enabled = process.env.HUE_ENABLED === 'true',
      useMock = false,
    } = config;

    this.enabled = enabled;
    this.groupId = groupId;

    if (!enabled) {
      logger.info('Lighting service disabled via configuration');
      this.hueClient = new MockHueClient({ bridgeIp: 'mock', appKey: 'mock' });
      this.presetProvider = createPresetProvider();
      return;
    }

    if (!bridgeIp || !appKey) {
      logger.warn('Hue configuration missing, using mock client');
      this.hueClient = new MockHueClient({ bridgeIp: 'mock', appKey: 'mock' });
    } else {
      this.hueClient = useMock 
        ? new MockHueClient({ bridgeIp, appKey })
        : new HueClient({ bridgeIp, appKey });
    }

    this.presetProvider = createPresetProvider();
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    // Initial connection test
    this.testConnection();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (!this.enabled) return;

    try {
      const connected = await this.hueClient.testConnection();
      if (connected) {
        this.status = 'connected';
        logger.info('Lighting service initialized successfully');
        
        // Try to get available groups
        try {
          const groups = await this.hueClient.getGroups();
          logger.info('Available Hue groups', { 
            groups: Object.entries(groups).map(([id, group]) => ({ 
              id, 
              name: group.name, 
              type: group.type,
              lightsCount: group.lights.length 
            })) 
          });
          
          // Verify our configured group exists
          if (!groups[this.groupId]) {
            logger.warn(`Configured group ${this.groupId} not found. Available groups:`, {
              configured: this.groupId,
              available: Object.keys(groups)
            });
          }
        } catch (error) {
          logger.warn('Failed to get groups', { error });
        }
        
        // Apply default state
        await this.applyPreset('DEFAULT', 'strength');
      }
    } catch (error) {
      logger.error('Failed to initialize lighting service', { error });
      this.status = 'degraded';
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  /**
   * Apply a preset to the light group
   */
  async applyPreset(presetName: string, template: WorkoutTemplate): Promise<void> {
    if (!this.enabled) return;

    const command: LightCommand = {
      id: uuidv4(),
      type: 'preset',
      preset: presetName,
      template,
      groupId: this.groupId,
      timestamp: new Date(),
      retries: 0,
    };

    await this.enqueueCommand(command);
  }

  /**
   * Apply custom state to the light group
   */
  async applyState(state: HueLightState): Promise<void> {
    if (!this.enabled) return;

    const command: LightCommand = {
      id: uuidv4(),
      type: 'state',
      state,
      groupId: this.groupId,
      timestamp: new Date(),
      retries: 0,
    };

    await this.enqueueCommand(command);
  }

  /**
   * Handle timer event
   */
  async handleTimerEvent(eventData: TimerEventData): Promise<void> {
    if (!this.enabled) return;

    logger.info('Handling timer event', { 
      event: eventData.event,
      sessionId: eventData.sessionId,
    });

    // Map event to preset
    const presetName = getPresetForEvent(eventData.event);
    if (!presetName) {
      logger.warn('No preset mapped for event', { event: eventData.event });
      return;
    }

    // Determine template from event
    const template: WorkoutTemplate = eventData.event.startsWith('circuit:') 
      ? 'circuit' 
      : 'strength';

    await this.applyPreset(presetName, template);
  }

  /**
   * Get lighting status
   */
  async getStatus(): Promise<LightingStatus> {
    const bridgeInfo = this.status === 'connected' 
      ? await this.hueClient.getBridgeConfig().catch(() => undefined)
      : undefined;

    return {
      status: this.status,
      lastConnected: this.hueClient.getLastSuccessfulConnection(),
      lastError: this.lastError,
      bridgeInfo,
    };
  }

  /**
   * Get available lights
   */
  async getLights() {
    if (!this.enabled || this.status !== 'connected') {
      return {};
    }

    return await this.hueClient.getLights();
  }

  /**
   * Clean shutdown
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Apply default state before shutting down
    if (this.enabled && this.status === 'connected') {
      await this.applyPreset('DEFAULT', 'strength');
    }
  }

  /**
   * Add command to queue with deduplication
   */
  private async enqueueCommand(command: LightCommand): Promise<void> {
    // Check if degraded
    if (this.degradedUntil && new Date() < this.degradedUntil) {
      logger.warn('Lighting service degraded, dropping command', { command });
      return;
    }

    // Debounce duplicate commands
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
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute a single command
   */
  private async executeCommand(command: LightCommand): Promise<void> {
    let state: HueLightState;

    if (command.type === 'preset') {
      const preset = await this.presetProvider.getPreset(command.preset!, command.template!);
      state = preset;
      
      // Track intended state
      this.lastIntendedState = preset;
      this.lastIntendedPreset = command.preset;
      this.lastIntendedTemplate = command.template;
    } else {
      state = command.state!;
    }

    await this.hueClient.setGroupAction(command.groupId, state);
    this.status = 'connected';
    
    logger.info('Light command executed', {
      type: command.type,
      preset: command.preset,
      groupId: command.groupId,
    });
  }

  /**
   * Handle command failure
   */
  private handleCommandFailure(): void {
    this.status = 'degraded';
    this.degradedUntil = new Date(Date.now() + 60000); // 60 seconds
    this.lastError = 'Failed to execute light command';
    
    logger.warn('Marking lighting service as degraded for 60 seconds');
  }

  /**
   * Test connection to Hue Bridge
   */
  private async testConnection(): Promise<void> {
    try {
      const connected = await this.hueClient.testConnection();
      
      if (connected) {
        this.status = 'connected';
        this.degradedUntil = undefined;
        
        // Re-apply last intended state if recovering from degraded
        if (this.lastIntendedPreset && this.lastIntendedTemplate) {
          logger.info('Reapplying last intended state after recovery');
          await this.applyPreset(
            this.lastIntendedPreset,
            this.lastIntendedTemplate
          );
        }
      } else {
        this.status = 'disconnected';
      }
    } catch (error) {
      this.status = 'disconnected';
      this.lastError = error instanceof Error ? error.message : 'Connection test failed';
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    // Initial health check
    this.testConnection();

    // Set up periodic health checks
    this.healthCheckInterval = setInterval(() => {
      const checkInterval = this.status === 'degraded' ? 10000 : 60000; // 10s if degraded, 60s if healthy
      
      if (Date.now() - this.lastCommandTime > checkInterval) {
        this.testConnection();
      }
    }, 10000); // Check every 10 seconds if we need to run health check
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Animation state  
  private currentAnimation?: ReturnType<typeof setInterval>;
  private animationType?: string;

  /**
   * Start an animation effect
   */
  async startAnimation(type: 'drift' | 'breathe' | 'countdown'): Promise<void> {
    if (!this.enabled) return;

    // Stop any existing animation
    this.stopAnimation();

    logger.info('Starting animation', { type });
    this.animationType = type;

    switch (type) {
      case 'drift':
        await this.startDriftAnimation();
        break;
      case 'breathe':
        await this.startBreatheAnimation();
        break;
      case 'countdown':
        await this.startCountdownAnimation();
        break;
    }
  }

  /**
   * Stop any running animation
   */
  stopAnimation(): void {
    if (this.currentAnimation) {
      clearInterval(this.currentAnimation);
      this.currentAnimation = undefined;
      this.animationType = undefined;
      logger.info('Animation stopped');
    }
  }

  /**
   * Drift animation - gentle hue movement for work phase
   */
  private async startDriftAnimation(): Promise<void> {
    let currentHue = 47000;
    let direction = 1;
    const HUE_DRIFT = 1500;
    let stepCount = 0;

    logger.info('Starting drift animation interval');

    // Apply initial state
    await this.applyState({
      on: true,
      bri: 254,
      hue: currentHue,
      sat: 200,
      transitiontime: 20,
    });

    const intervalId = setInterval(async () => {
      stepCount++;
      logger.info(`Drift animation interval fired - step ${stepCount}`);
      if (!this.enabled || this.status !== 'connected') {
        this.stopAnimation();
        return;
      }

      currentHue += (HUE_DRIFT * direction);
      
      if (currentHue >= 47000 + HUE_DRIFT || currentHue <= 47000 - HUE_DRIFT) {
        direction *= -1;
      }

      // Wrap hue value
      if (currentHue < 0) currentHue += 65536;
      if (currentHue > 65535) currentHue -= 65536;

      logger.info('Drift animation step', { 
        currentHue: Math.round(currentHue), 
        direction,
        animationType: this.animationType 
      });

      await this.applyState({
        hue: Math.round(currentHue),
        transitiontime: 30,
      });
    }, 3000); // Every 3 seconds
    
    this.currentAnimation = intervalId;
    logger.info('Drift animation interval stored', { intervalId: !!intervalId });
  }

  /**
   * Breathe animation - brightness oscillation for rest phase
   */
  private async startBreatheAnimation(): Promise<void> {
    let currentBri = 100;
    let direction = 1;
    const BRI_RANGE = 20;

    // Apply initial state
    await this.applyState({
      on: true,
      bri: currentBri,
      hue: 25000,
      sat: 100,
      transitiontime: 10,
    });

    this.currentAnimation = setInterval(async () => {
      if (!this.enabled || this.status !== 'connected') {
        this.stopAnimation();
        return;
      }

      currentBri += (BRI_RANGE * direction);
      
      if (currentBri >= 120 || currentBri <= 80) {
        direction *= -1;
      }

      logger.info('Breathe animation step', { 
        currentBri, 
        direction,
        animationType: this.animationType 
      });

      await this.applyState({
        bri: currentBri,
        transitiontime: 20,
      });
    }, 2000); // Every 2 seconds
  }

  /**
   * Countdown animation - quick pulses
   */
  private async startCountdownAnimation(): Promise<void> {
    let count = 5;
    const baseBri = 180;

    this.currentAnimation = setInterval(async () => {
      if (!this.enabled || this.status !== 'connected' || count <= 0) {
        this.stopAnimation();
        return;
      }

      // Pulse up
      await this.applyState({
        on: true,
        bri: baseBri + 60,
        hue: 47000,
        sat: 200,
        transitiontime: 2,
      });

      // Return to base after 400ms
      setTimeout(async () => {
        await this.applyState({
          bri: baseBri,
          transitiontime: 3,
        });
      }, 400);

      count--;
    }, 1000); // Every second
  }
}

// Singleton instance
let lightingService: LightingService | null = null;

/**
 * Get or create lighting service instance
 */
export function getLightingService(config?: LightingServiceConfig): LightingService {
  if (!lightingService) {
    lightingService = new LightingService(config || {});
  }
  return lightingService;
}