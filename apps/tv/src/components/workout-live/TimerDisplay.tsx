import React from 'react';
import { Text } from 'react-native';
import { formatTime } from './types';

interface TimerDisplayProps {
  timeRemaining: number;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  color?: string;
  style?: any;
}

export function TimerDisplay({ 
  timeRemaining, 
  size = 'large', 
  color = '#ffffff',
  style 
}: TimerDisplayProps) {
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          fontSize: 48,
          fontWeight: '700' as const,
          letterSpacing: -1
        };
      case 'medium':
        return {
          fontSize: 80,
          fontWeight: '900' as const,
          letterSpacing: -1
        };
      case 'large':
        return {
          fontSize: 120,
          fontWeight: '900' as const,
          letterSpacing: -2
        };
      case 'xlarge':
        return {
          fontSize: 180,
          fontWeight: '900' as const,
          letterSpacing: -2
        };
      default:
        return {
          fontSize: 120,
          fontWeight: '900' as const,
          letterSpacing: -2
        };
    }
  };

  return (
    <Text 
      style={[
        getSizeStyles(),
        { color },
        style
      ]}
    >
      {formatTime(timeRemaining)}
    </Text>
  );
}