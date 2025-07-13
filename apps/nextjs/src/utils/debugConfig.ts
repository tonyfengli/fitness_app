/**
 * Centralized debug configuration
 * 
 * Enable debug mode by:
 * 1. Setting localStorage.debug = 'true' in the browser console
 * 2. Adding ?debug=true to the URL
 */

export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  
  return (
    localStorage.getItem('debug') === 'true' || 
    window.location.search.includes('debug=true')
  );
}

// Helper to enable/disable debug mode programmatically
export function setDebugMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  
  if (enabled) {
    localStorage.setItem('debug', 'true');
    console.log('Debug mode enabled. Refresh the page to see debug logs.');
  } else {
    localStorage.removeItem('debug');
    console.log('Debug mode disabled. Refresh the page to hide debug logs.');
  }
}

// Make it available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as any).setDebugMode = setDebugMode;
}