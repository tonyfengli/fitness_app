/**
 * Design System Spacing
 * Consistent spacing scale based on 4px base unit
 */

export const spacing = {
  // Base spacing values
  px: '1px',
  0: '0',
  0.5: '0.125rem', // 2px
  1: '0.25rem',    // 4px
  1.5: '0.375rem', // 6px
  2: '0.5rem',     // 8px
  2.5: '0.625rem', // 10px
  3: '0.75rem',    // 12px
  3.5: '0.875rem', // 14px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  7: '1.75rem',    // 28px
  8: '2rem',       // 32px
  9: '2.25rem',    // 36px
  10: '2.5rem',    // 40px
  11: '2.75rem',   // 44px
  12: '3rem',      // 48px
  14: '3.5rem',    // 56px
  16: '4rem',      // 64px
  20: '5rem',      // 80px
  24: '6rem',      // 96px
  28: '7rem',      // 112px
  32: '8rem',      // 128px
} as const;

// Common spacing patterns
export const spacingPatterns = {
  // Page margins
  pagePadding: 'px-4 md:px-6 lg:px-8',
  pageMargin: 'mx-auto max-w-7xl',

  // Section spacing
  sectionPadding: 'py-8 md:py-12 lg:py-16',
  sectionGap: 'space-y-6 md:space-y-8',

  // Component spacing
  cardPadding: 'p-4 md:p-6',
  cardGap: 'space-y-4',
  
  // Form spacing
  formGap: 'space-y-4',
  inputGap: 'space-y-2',
  
  // List spacing
  listGap: 'space-y-2',
  listItemPadding: 'py-2',
  
  // Button spacing
  buttonPadding: 'px-4 py-2',
  buttonGap: 'space-x-3',
  
  // Icon spacing
  iconTextGap: 'gap-2',
  iconSize: 'w-5 h-5',
} as const;

// Mobile-specific spacing adjustments
export const mobileSpacing = {
  pagePadding: 'px-4',
  sectionPadding: 'py-6',
  cardPadding: 'p-3',
  buttonPadding: 'px-3 py-2',
} as const;