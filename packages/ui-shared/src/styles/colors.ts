/**
 * Design System Colors
 * Based on the exact colors from test pages
 */

export const colors = {
  primary: {
    DEFAULT: '#4F46E5', // indigo-600
    light: '#E0E7FF',   // indigo-100
    dark: '#3730A3',    // indigo-800
  },
  blue: {
    DEFAULT: '#3B82F6', // blue-500
    dark: '#2563EB',    // blue-600
  },
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  status: {
    success: '#10B981', // green-500
    error: '#EF4444',   // red-500
    warning: '#F59E0B', // yellow-500
    info: '#3B82F6',    // blue-500
  },
  background: {
    primary: '#F9FAFB', // gray-50
    card: '#FFFFFF',
    disabled: '#F3F4F6', // gray-100
  },
  text: {
    primary: '#111827',  // gray-900
    secondary: '#6B7280', // gray-500
    muted: '#9CA3AF',    // gray-400
  },
  border: {
    DEFAULT: '#E5E7EB', // gray-200
    light: '#F3F4F6',   // gray-100
    dark: '#D1D5DB',    // gray-300
  },
} as const;

// Tailwind class mappings for consistency
export const colorClasses = {
  primary: {
    bg: 'bg-indigo-600',
    bgLight: 'bg-indigo-100',
    text: 'text-indigo-600',
    hover: 'hover:bg-indigo-700',
    hoverLight: 'hover:bg-indigo-200',
  },
  blue: {
    bg: 'bg-blue-500',
    bgDark: 'bg-blue-600',
    text: 'text-blue-600',
    hover: 'hover:bg-blue-700',
    hoverText: 'hover:text-blue-800',
  },
  gray: {
    bg50: 'bg-gray-50',
    bg100: 'bg-gray-100',
    bg200: 'bg-gray-200',
    text400: 'text-gray-400',
    text500: 'text-gray-500',
    text600: 'text-gray-600',
    text700: 'text-gray-700',
    text800: 'text-gray-800',
    text900: 'text-gray-900',
    border: 'border-gray-200',
  },
  status: {
    success: 'text-green-500',
    error: 'text-red-500',
    errorHover: 'hover:text-red-700',
  },
} as const;