import React from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface TVButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function TVButton({ 
  onPress, 
  title, 
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  size = 'medium'
}: TVButtonProps) {
  
  const getColors = (focused: boolean) => {
    if (disabled) {
      return {
        background: '#9ca3af',
        border: 'transparent',
        text: '#ffffff'
      };
    }
    
    switch (variant) {
      case 'primary':
        return {
          background: focused ? '#0284c7' : '#0ea5e9',
          border: focused ? '#0c4a6e' : 'transparent',
          text: '#ffffff'
        };
      case 'secondary':
        return {
          background: focused ? '#e5e7eb' : '#ffffff',
          border: focused ? '#3b82f6' : '#e5e7eb',
          text: '#374151'
        };
      case 'danger':
        return {
          background: focused ? '#dc2626' : '#ef4444',
          border: focused ? '#991b1b' : 'transparent',
          text: '#ffffff'
        };
    }
  };
  
  const getSizes = () => {
    switch (size) {
      case 'small':
        return {
          paddingX: 12,
          paddingY: 6,
          fontSize: 14,
          iconSize: 16
        };
      case 'large':
        return {
          paddingX: 32,
          paddingY: 16,
          fontSize: 20,
          iconSize: 28
        };
      default:
        return {
          paddingX: 24,
          paddingY: 12,
          fontSize: 16,
          iconSize: 20
        };
    }
  };
  
  const sizes = getSizes();
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      tvParallaxProperties={{
        enabled: true,
        shiftDistanceX: 2,
        shiftDistanceY: 2,
      }}
      style={({ focused }) => {
        const colors = getColors(focused);
        return {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: sizes.paddingX,
          paddingVertical: sizes.paddingY,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: colors.border,
          backgroundColor: colors.background,
          transform: focused ? [{ scale: 1.05 }] : [{ scale: 1 }],
          opacity: disabled ? 0.6 : 1,
        };
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <>
          {icon && (
            <Icon 
              name={icon} 
              size={sizes.iconSize} 
              color={variant === 'secondary' ? '#374151' : '#ffffff'} 
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={{ 
            fontSize: sizes.fontSize, 
            fontWeight: '600',
            color: variant === 'secondary' ? '#374151' : '#ffffff'
          }}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}