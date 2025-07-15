/**
 * Theme Configuration
 * Defines theme tokens that can be easily swapped
 */

export interface Theme {
  name: string;
  colors: {
    // Brand colors
    primary: string;
    primaryLight: string;
    primaryDark: string;
    secondary: string;
    secondaryLight: string;
    secondaryDark: string;
    
    // UI colors
    background: string;
    surface: string;
    surfaceHover: string;
    
    // Text colors
    text: string;
    textSecondary: string;
    textMuted: string;
    textInverse: string;
    
    // Border colors
    border: string;
    borderLight: string;
    borderDark: string;
    
    // Status colors
    success: string;
    error: string;
    warning: string;
    info: string;
  };
  
  // Component-specific tokens
  components: {
    button: {
      primary: {
        bg: string;
        text: string;
        hover: string;
      };
      secondary: {
        bg: string;
        text: string;
        hover: string;
      };
    };
    card: {
      bg: string;
      border: string;
      shadow: string;
    };
    input: {
      bg: string;
      border: string;
      focusBorder: string;
    };
  };
}

// Default theme matching current design
export const defaultTheme: Theme = {
  name: 'default',
  colors: {
    primary: '#4F46E5',
    primaryLight: '#E0E7FF',
    primaryDark: '#3730A3',
    secondary: '#3B82F6',
    secondaryLight: '#DBEAFE',
    secondaryDark: '#2563EB',
    
    background: '#F9FAFB',
    surface: '#FFFFFF',
    surfaceHover: '#F3F4F6',
    
    text: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    textInverse: '#FFFFFF',
    
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    borderDark: '#D1D5DB',
    
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  components: {
    button: {
      primary: {
        bg: '#4F46E5',
        text: '#FFFFFF',
        hover: '#4338CA',
      },
      secondary: {
        bg: '#E0E7FF',
        text: '#4F46E5',
        hover: '#C7D2FE',
      },
    },
    card: {
      bg: '#FFFFFF',
      border: '#E5E7EB',
      shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    },
    input: {
      bg: '#FFFFFF',
      border: '#D1D5DB',
      focusBorder: '#4F46E5',
    },
  },
};

// Example alternative theme
export const modernTheme: Theme = {
  name: 'modern',
  colors: {
    primary: '#7C3AED',
    primaryLight: '#EDE9FE',
    primaryDark: '#6D28D9',
    secondary: '#10B981',
    secondaryLight: '#D1FAE5',
    secondaryDark: '#059669',
    
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceHover: '#F5F5F5',
    
    text: '#171717',
    textSecondary: '#525252',
    textMuted: '#A3A3A3',
    textInverse: '#FFFFFF',
    
    border: '#E5E5E5',
    borderLight: '#F5F5F5',
    borderDark: '#D4D4D4',
    
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#7C3AED',
  },
  components: {
    button: {
      primary: {
        bg: '#7C3AED',
        text: '#FFFFFF',
        hover: '#6D28D9',
      },
      secondary: {
        bg: '#EDE9FE',
        text: '#7C3AED',
        hover: '#DDD6FE',
      },
    },
    card: {
      bg: '#FFFFFF',
      border: '#E5E5E5',
      shadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    },
    input: {
      bg: '#FFFFFF',
      border: '#D4D4D4',
      focusBorder: '#7C3AED',
    },
  },
};

// Theme utilities
export function generateCSSVariables(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  
  // Flatten theme object into CSS variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    vars[`--color-${key}`] = value;
  });
  
  // Component variables
  Object.entries(theme.components).forEach(([component, values]) => {
    Object.entries(values).forEach(([prop, value]) => {
      if (typeof value === 'string') {
        vars[`--${component}-${prop}`] = value;
      } else {
        Object.entries(value).forEach(([subProp, subValue]) => {
          vars[`--${component}-${prop}-${subProp}`] = subValue as string;
        });
      }
    });
  });
  
  return vars;
}

// Tailwind-compatible theme classes
export const themeClasses = {
  // Use CSS variables in Tailwind classes
  colors: {
    primary: '[--color-primary]',
    primaryLight: '[--color-primary-light]',
    secondary: '[--color-secondary]',
    background: '[--color-background]',
    surface: '[--color-surface]',
    text: '[--color-text]',
    textSecondary: '[--color-text-secondary]',
    border: '[--color-border]',
  },
  
  // Component classes using CSS variables
  components: {
    button: {
      primary: 'bg-[--button-primary-bg] text-[--button-primary-text] hover:bg-[--button-primary-hover]',
      secondary: 'bg-[--button-secondary-bg] text-[--button-secondary-text] hover:bg-[--button-secondary-hover]',
    },
    card: 'bg-[--card-bg] border-[--card-border]',
    input: 'bg-[--input-bg] border-[--input-border] focus:border-[--input-focus-border]',
  },
};