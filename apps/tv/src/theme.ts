import { createTheme } from '@shopify/restyle';

const palette = {
  // Grays
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  
  // Blues (Primary)
  blue50: '#EFF6FF',
  blue100: '#DBEAFE',
  blue200: '#BFDBFE',
  blue300: '#93C5FD',
  blue400: '#60A5FA',
  blue500: '#3B82F6',
  blue600: '#2563EB',
  blue700: '#1D4ED8',
  blue800: '#1E40AF',
  blue900: '#1E3A8A',
  
  // Indigo
  indigo50: '#EEF2FF',
  indigo100: '#E0E7FF',
  indigo200: '#C7D2FE',
  indigo300: '#A5B4FC',
  indigo400: '#818CF8',
  indigo500: '#6366F1',
  indigo600: '#4F46E5',
  indigo700: '#4338CA',
  indigo800: '#3730A3',
  indigo900: '#312E81',
  
  // Greens
  green50: '#F0FDF4',
  green100: '#DCFCE7',
  green200: '#BBF7D0',
  green300: '#86EFAC',
  green400: '#4ADE80',
  green500: '#22C55E',
  green600: '#16A34A',
  green700: '#15803D',
  green800: '#166534',
  green900: '#14532D',
  
  // Reds
  red50: '#FEF2F2',
  red100: '#FEE2E2',
  red200: '#FECACA',
  red300: '#FCA5A5',
  red400: '#F87171',
  red500: '#EF4444',
  red600: '#DC2626',
  red700: '#B91C1C',
  red800: '#991B1B',
  red900: '#7F1D1D',
  
  // Others
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

const theme = createTheme({
  colors: {
    ...palette,
    
    // Semantic colors
    background: palette.white,
    foreground: palette.gray900,
    
    // Card colors
    cardBackground: palette.white,
    cardBorder: palette.gray200,
    
    // Primary colors
    primary: palette.indigo600,
    primaryHover: palette.indigo700,
    primaryForeground: palette.white,
    
    // Secondary colors
    secondary: palette.gray100,
    secondaryHover: palette.gray200,
    secondaryForeground: palette.gray900,
    
    // Muted colors
    muted: palette.gray100,
    mutedForeground: palette.gray500,
    
    // Accent colors
    accent: palette.blue100,
    accentForeground: palette.blue900,
    
    // Destructive colors
    destructive: palette.red600,
    destructiveHover: palette.red700,
    destructiveForeground: palette.white,
    
    // Border colors
    border: palette.gray300,
    input: palette.gray300,
    ring: palette.indigo600,
    
    // Text colors
    textPrimary: palette.gray900,
    textSecondary: palette.gray600,
    textMuted: palette.gray500,
    textLight: palette.gray400,
  },
  
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 40,
    '3xl': 48,
    '4xl': 64,
    '5xl': 80,
    '6xl': 96,
  },
  
  borderRadii: {
    none: 0,
    sm: 2,
    base: 4,
    md: 6,
    lg: 8,
    xl: 12,
    '2xl': 16,
    '3xl': 24,
    full: 9999,
  },
  
  textVariants: {
    // Headings
    h1: {
      fontSize: 36,
      lineHeight: 44,
      fontWeight: 'bold',
      color: 'textPrimary',
    },
    h2: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: 'bold',
      color: 'textPrimary',
    },
    h3: {
      fontSize: 24,
      lineHeight: 32,
      fontWeight: 'bold',
      color: 'textPrimary',
    },
    h4: {
      fontSize: 20,
      lineHeight: 28,
      fontWeight: '600',
      color: 'textPrimary',
    },
    h5: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '600',
      color: 'textPrimary',
    },
    h6: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600',
      color: 'textPrimary',
    },
    
    // Body text
    body: {
      fontSize: 16,
      lineHeight: 24,
      color: 'textPrimary',
    },
    bodyMedium: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '500',
      color: 'textPrimary',
    },
    bodySemibold: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '600',
      color: 'textPrimary',
    },
    bodySmall: {
      fontSize: 14,
      lineHeight: 20,
      color: 'textSecondary',
    },
    bodySmallMedium: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      color: 'textSecondary',
    },
    
    // Labels
    label: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      color: 'textPrimary',
    },
    caption: {
      fontSize: 12,
      lineHeight: 16,
      color: 'textMuted',
    },
    
    // Special
    buttonLarge: {
      fontSize: 18,
      lineHeight: 28,
      fontWeight: '600',
      color: 'primaryForeground',
    },
    buttonMedium: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '600',
      color: 'primaryForeground',
    },
    buttonSmall: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      color: 'primaryForeground',
    },
    
    defaults: {
      fontSize: 16,
      lineHeight: 24,
      color: 'textPrimary',
    },
  },
  
  cardVariants: {
    defaults: {
      backgroundColor: 'cardBackground',
      borderRadius: 'lg',
      padding: 'm',
    },
    elevated: {
      backgroundColor: 'cardBackground',
      borderRadius: 'lg',
      padding: 'm',
      shadowColor: 'black',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    outlined: {
      backgroundColor: 'cardBackground',
      borderRadius: 'lg',
      borderWidth: 1,
      borderColor: 'border',
      padding: 'm',
    },
  },
  
  buttonVariants: {
    defaults: {
      backgroundColor: 'primary',
      borderRadius: 'md',
      paddingVertical: 's',
      paddingHorizontal: 'm',
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: {
      backgroundColor: 'primary',
      borderRadius: 'md',
      paddingVertical: 's',
      paddingHorizontal: 'm',
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondary: {
      backgroundColor: 'secondary',
      borderRadius: 'md',
      paddingVertical: 's',
      paddingHorizontal: 'm',
      alignItems: 'center',
      justifyContent: 'center',
    },
    destructive: {
      backgroundColor: 'destructive',
      borderRadius: 'md',
      paddingVertical: 's',
      paddingHorizontal: 'm',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghost: {
      backgroundColor: 'transparent',
      borderRadius: 'md',
      paddingVertical: 's',
      paddingHorizontal: 'm',
      alignItems: 'center',
      justifyContent: 'center',
    },
    outline: {
      backgroundColor: 'transparent',
      borderRadius: 'md',
      borderWidth: 1,
      borderColor: 'border',
      paddingVertical: 's',
      paddingHorizontal: 'm',
      alignItems: 'center',
      justifyContent: 'center',
    },
  },
});

export type Theme = typeof theme;
export default theme;