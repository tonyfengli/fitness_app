import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface LightingStatusIndicatorProps {
  bridgeAvailable: boolean | null;
  connectionError: string | null;
  onRefresh?: () => void;
  style?: any;
}

export function LightingStatusIndicator({ 
  bridgeAvailable, 
  connectionError, 
  onRefresh,
  style 
}: LightingStatusIndicatorProps) {
  // Loading state
  if (bridgeAvailable === null) {
    return (
      <View style={[{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
      }, style]}>
        <ActivityIndicator size="small" color="#FFF" />
        <Text style={{ 
          color: '#FFF', 
          marginLeft: 8,
          fontSize: 12,
          opacity: 0.7
        }}>
          Checking lights...
        </Text>
      </View>
    );
  }

  // Connected state
  if (bridgeAvailable) {
    return (
      <View style={[{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(76, 175, 80, 0.3)',
      }, style]}>
        <Icon name="check-circle" size={16} color="#4CAF50" />
        <Text style={{ 
          color: '#4CAF50', 
          marginLeft: 8,
          fontSize: 12,
          fontWeight: '600'
        }}>
          Lights connected
        </Text>
      </View>
    );
  }

  // Disconnected state with retry button
  return (
    <Pressable
      onPress={onRefresh}
      focusable
      style={({ focused }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: focused ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.15)',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: focused ? 'rgba(244, 67, 54, 0.5)' : 'rgba(244, 67, 54, 0.3)',
          transform: focused ? [{ scale: 1.02 }] : [],
        },
        style
      ]}
    >
      <Icon name="error-outline" size={16} color="#F44336" />
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={{ 
          color: '#F44336', 
          fontSize: 12,
          fontWeight: '600'
        }}>
          {connectionError || 'Not on gym network'}
        </Text>
        {onRefresh && (
          <Text style={{ 
            color: '#F44336', 
            fontSize: 10,
            opacity: 0.8,
            marginTop: 2
          }}>
            Tap to retry
          </Text>
        )}
      </View>
      {onRefresh && <Icon name="refresh" size={16} color="#F44336" style={{ marginLeft: 8 }} />}
    </Pressable>
  );
}