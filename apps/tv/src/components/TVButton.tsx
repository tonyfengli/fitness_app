import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { useTheme } from '@shopify/restyle';
import { Theme } from '../theme';
import { Box } from './Box';
import { Text } from './Text';

type ButtonSize = 'large' | 'medium' | 'small';
type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';

interface TVButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  loading?: boolean;
}

export function TVButton({ 
  variant = 'primary',
  size = 'large', 
  children, 
  loading = false,
  disabled,
  ...props 
}: TVButtonProps) {
  const theme = useTheme<Theme>();
  
  const getTextColor = () => {
    switch (variant) {
      case 'primary':
      case 'destructive':
        return 'primaryForeground';
      case 'secondary':
        return 'secondaryForeground';
      case 'outline':
      case 'ghost':
        return 'textPrimary';
      default:
        return 'primaryForeground';
    }
  };

  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary':
        return 'primary';
      case 'secondary':
        return 'secondary';
      case 'destructive':
        return 'destructive';
      case 'ghost':
        return 'transparent';
      case 'outline':
        return 'transparent';
      default:
        return 'primary';
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'large':
        return { paddingVertical: 'l' as const, paddingHorizontal: '4xl' as const };
      case 'medium':
        return { paddingVertical: 'm' as const, paddingHorizontal: 'xl' as const };
      case 'small':
        return { paddingVertical: 's' as const, paddingHorizontal: 'l' as const };
    }
  };

  const getTextVariant = () => {
    switch (size) {
      case 'large':
        return 'h3' as const;
      case 'medium':
        return 'h5' as const;
      case 'small':
        return 'buttonMedium' as const;
    }
  };

  const padding = getPadding();
  
  return (
    <TouchableOpacity 
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      <Box 
        backgroundColor={getBackgroundColor()}
        borderRadius="2xl"
        alignItems="center"
        justifyContent="center"
        opacity={disabled || loading ? 0.5 : 1}
        borderWidth={variant === 'outline' ? 1 : 0}
        borderColor={variant === 'outline' ? 'border' : undefined}
        {...padding}
      >
        {loading ? (
          <ActivityIndicator 
            size="large"
            color={variant === 'primary' || variant === 'destructive' ? theme.colors.white : theme.colors.gray600} 
          />
        ) : (
          <Text variant={getTextVariant()} color={getTextColor()} fontWeight="600">
            {children}
          </Text>
        )}
      </Box>
    </TouchableOpacity>
  );
}