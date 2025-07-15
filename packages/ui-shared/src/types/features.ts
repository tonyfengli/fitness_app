/**
 * Common feature flags that can be applied to components
 * to control their behavior and appearance
 */
export interface FeatureProps {
  // Navigation features
  showNotifications?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  
  // Action features
  showAddButton?: boolean;
  showEditButton?: boolean;
  showDeleteButton?: boolean;
  
  // Layout features
  compactMode?: boolean;
  showSidebar?: boolean;
  
  // Responsive overrides
  forceDesktopView?: boolean;
  forceMobileView?: boolean;
}