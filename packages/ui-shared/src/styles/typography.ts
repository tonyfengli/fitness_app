/**
 * Design System Typography
 * Consistent text styles across the application
 */

export const typography = {
  // Font families
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    mono: ['Menlo', 'Monaco', 'Consolas', 'monospace'],
  },

  // Font sizes with line heights
  fontSize: {
    xs: { size: '0.75rem', lineHeight: '1rem' },     // 12px
    sm: { size: '0.875rem', lineHeight: '1.25rem' }, // 14px
    base: { size: '1rem', lineHeight: '1.5rem' },    // 16px
    lg: { size: '1.125rem', lineHeight: '1.75rem' }, // 18px
    xl: { size: '1.25rem', lineHeight: '1.75rem' },  // 20px
    '2xl': { size: '1.5rem', lineHeight: '2rem' },   // 24px
    '3xl': { size: '1.875rem', lineHeight: '2.25rem' }, // 30px
  },

  // Font weights
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Letter spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
  },
} as const;

// Tailwind class mappings for typography
export const typographyClasses = {
  // Headings
  h1: 'text-3xl font-bold text-gray-900',
  h2: 'text-2xl font-bold text-gray-900',
  h3: 'text-xl font-semibold text-gray-800',
  h4: 'text-lg font-semibold text-gray-800',
  h5: 'text-base font-semibold text-gray-800',

  // Body text
  body: 'text-base text-gray-700',
  bodySmall: 'text-sm text-gray-600',
  bodyLarge: 'text-lg text-gray-700',

  // Special text
  label: 'text-sm font-medium text-gray-700',
  caption: 'text-xs text-gray-500',
  muted: 'text-sm text-gray-500',
  
  // Interactive text
  link: 'text-blue-600 hover:text-blue-800 underline-offset-4 hover:underline',
  linkSubtle: 'text-gray-600 hover:text-gray-900',
} as const;