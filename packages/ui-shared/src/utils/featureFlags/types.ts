/**
 * Feature flags configuration
 * Add new feature flags here as needed
 */
export interface FeatureFlags {
  // Dashboard features
  enableNewDashboard: boolean;
  enableUnifiedDashboard: boolean;
  
  // Mobile optimizations
  enableMobileOptimizations: boolean;
  enableResponsiveLayouts: boolean;
  
  // Advanced features
  enableAdvancedFilters: boolean;
  enableBulkActions: boolean;
  enableRealTimeSync: boolean;
  
  // Experimental features
  enableBetaFeatures: boolean;
}