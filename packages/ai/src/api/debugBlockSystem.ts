/**
 * Debug API for block system
 * Provides access to block transformation logs
 */

import { BlockDebugger } from "../utils/blockDebugger";

export interface DebugResponse {
  enabled: boolean;
  logs: any[];
  report?: string;
}

/**
 * Get current debug logs
 */
export function getDebugLogs(): DebugResponse {
  return {
    enabled: true,
    logs: BlockDebugger.getLogs(),
  };
}

/**
 * Get formatted debug report
 */
export function getDebugReport(): DebugResponse {
  return {
    enabled: true,
    logs: BlockDebugger.getLogs(),
    report: BlockDebugger.generateReport(),
  };
}

/**
 * Clear debug logs
 */
export function clearDebugLogs(): { success: boolean } {
  BlockDebugger.clearLogs();
  return { success: true };
}

/**
 * Enable/disable debugging
 */
export function setDebugEnabled(enabled: boolean): { enabled: boolean } {
  if (enabled) {
    BlockDebugger.enable();
  } else {
    BlockDebugger.disable();
  }
  return { enabled };
}
