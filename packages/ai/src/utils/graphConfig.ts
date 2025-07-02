/**
 * Modern configuration utilities for LangGraph workflows
 */

export const GRAPH_CONFIG = {
  // Runtime settings
  maxRetries: 3,
  timeoutMs: 30000, // 30 seconds
  
  // Node execution settings
  nodeTimeout: 10000, // 10 seconds per node
  
  // Logging configuration
  enableDebugLogs: process.env.NODE_ENV === 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
} as const;

/**
 * Standard graph compilation options
 */
export const getGraphCompileOptions = () => ({
  checkpointer: undefined, // Add checkpointer for state persistence if needed
  debug: GRAPH_CONFIG.enableDebugLogs,
});

/**
 * Standard graph invocation options
 */
export const getGraphInvokeOptions = () => ({
  configurable: {},
  recursionLimit: 10,
  streamMode: "values" as const,
});