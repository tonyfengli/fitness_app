import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { createRestyleComponent, createVariant, VariantProps, useTheme } from '@shopify/restyle';
import { Theme } from '../theme';
import { Box } from './Box';
import { Text } from './Text';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';

const ButtonBox = createRestyleComponent<
  VariantProps<Theme, 'buttonVariants'> & React.ComponentProps<typeof Box>,
  Theme
>([createVariant({ themeKey: 'buttonVariants' })], Box);

interface ButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  children: React.ReactNode;
  loading?: boolean;
}

export function Button({ 
  variant = 'primary', 
  children, 
  loading = false,
  disabled,
  ...props 
}: ButtonProps) {
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
  
  return (
    <TouchableOpacity 
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      <ButtonBox 
        variant={variant} 
        opacity={disabled || loading ? 0.5 : 1}
      >
        {loading ? (
          <ActivityIndicator 
            color={variant === 'primary' || variant === 'destructive' ? theme.colors.white : theme.colors.gray600} 
          />
        ) : (
          <Text variant="buttonMedium" color={getTextColor()}>
            {children}
          </Text>
        )}
      </ButtonBox>
    </TouchableOpacity>
  );
}