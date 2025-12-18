/**
 * Singleton getter for the unified lighting service
 */

import { LightingService } from './lighting-service';

let lightingService: LightingService | undefined;

export function getLightingService(): LightingService {
  if (!lightingService) {
    lightingService = new LightingService();
  }
  
  return lightingService;
}

export async function shutdownLightingService(): Promise<void> {
  if (lightingService) {
    await lightingService.shutdown();
    lightingService = undefined;
  }
}