import type { FeatureFlags } from "./types";

/**
 * Default feature flag values
 * These can be overridden by environment variables or provider props
 */
export const defaultFeatureFlags: FeatureFlags = {
  // Dashboard features
  enableNewDashboard: true,
  enableUnifiedDashboard: true,
  
  // Mobile optimizations
  enableMobileOptimizations: true,
  enableResponsiveLayouts: true,
  
  // Advanced features
  enableAdvancedFilters: false,
  enableBulkActions: false,
  enableRealTimeSync: false,
  
  // Experimental features
  enableBetaFeatures: false,
};