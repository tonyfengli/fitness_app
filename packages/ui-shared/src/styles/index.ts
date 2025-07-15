/**
 * Design System Exports
 * Central export point for all design tokens
 */

export * from './colors';
export * from './typography';
export * from './spacing';

// Common style combinations
export const commonStyles = {
  // Shadows
  shadow: {
    sm: 'shadow-sm',
    DEFAULT: 'shadow',
    md: 'shadow-md',
    lg: 'shadow-lg',
    none: 'shadow-none',
  },

  // Border radius
  rounded: {
    none: 'rounded-none',
    sm: 'rounded',
    DEFAULT: 'rounded-lg',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  },

  // Transitions
  transition: {
    DEFAULT: 'transition-all duration-200 ease-in-out',
    fast: 'transition-all duration-150 ease-in-out',
    slow: 'transition-all duration-300 ease-in-out',
    colors: 'transition-colors duration-200 ease-in-out',
    shadow: 'transition-shadow duration-200 ease-in-out',
  },

  // Focus styles
  focus: {
    ring: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
    outline: 'focus:outline-none focus:border-indigo-500',
  },

  // Hover states
  hover: {
    lift: 'hover:shadow-md hover:-translate-y-0.5',
    glow: 'hover:shadow-lg',
    dim: 'hover:opacity-80',
    brighten: 'hover:opacity-100',
  },

  // Disabled states
  disabled: {
    DEFAULT: 'disabled:opacity-50 disabled:cursor-not-allowed',
    subtle: 'disabled:opacity-40 disabled:cursor-not-allowed',
  },
} as const;