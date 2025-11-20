import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { subscribeLightingStatus } from '../lib/lighting';

const TOKENS = {
  color: {
    text: '#ffffff',
    muted: '#9cb0ff',
  },
};

// Helper function to format time in 12-hour format with AM/PM
function formatTime12Hour(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  
  return `${hours12}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
}

interface LightingDotWithTimestampProps {
  position?: 'footer' | 'absolute';
  style?: any;
}

export function LightingDotWithTimestamp({ position = 'footer', style }: LightingDotWithTimestampProps) {
  const [lightingStatus, setLightingStatus] = useState<'unknown' | 'success' | 'slow' | 'failed'>('unknown');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const unsubscribe = subscribeLightingStatus(setLightingStatus);
    
    // Update timestamp every second for live feel
    const timer = setInterval(() => {
      setLastUpdate(new Date());
    }, 1000);
    
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const getDotClassName = () => {
    switch (lightingStatus) {
      case 'success': return 'bg-green-400';
      case 'slow': return 'bg-yellow-400';  
      case 'failed': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    const timestamp = formatTime12Hour(lastUpdate);
    switch (lightingStatus) {
      case 'success': return `Live - ${timestamp}`;
      case 'slow': return `Slow - ${timestamp}`;
      case 'failed': return `Lighting offline - ${timestamp}`;
      default: return `Checking... - ${timestamp}`;
    }
  };

  if (position === 'absolute') {
    return (
      <View style={[{
        position: 'absolute',
        bottom: -35,
        left: 50,
        flexDirection: 'row',
        alignItems: 'center',
      }, style]}>
        <View className={`w-3 h-3 rounded-full mr-2 ${getDotClassName()}`} />
        <Text style={{ fontSize: 14, color: TOKENS.color.muted }}>
          {getStatusText()}
        </Text>
      </View>
    );
  }

  // Footer position
  return (
    <View style={[{
      flexDirection: 'row',
      alignItems: 'center',
    }, style]}>
      <View className={`w-3 h-3 rounded-full mr-2 ${getDotClassName()}`} />
      <Text style={{ fontSize: 16, color: TOKENS.color.text }}>
        {getStatusText()}
      </Text>
    </View>
  );
}