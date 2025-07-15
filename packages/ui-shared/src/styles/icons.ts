/**
 * Icon styling utilities
 * Ensures consistent icon sizing across the application
 */

export const iconSizes = {
  xs: 'text-xs',    // 12px
  sm: 'text-sm',    // 14px
  base: 'text-base', // 16px
  lg: 'text-lg',    // 18px
  xl: 'text-xl',    // 20px
} as const;

// Material Icons specific classes to ensure proper alignment
export const materialIconBase = "material-icons align-middle";

// Icon size mapping for button sizes
export const buttonIconSizes = {
  sm: iconSizes.sm,
  md: iconSizes.base,
  lg: iconSizes.lg,
  icon: iconSizes.base,
} as const;