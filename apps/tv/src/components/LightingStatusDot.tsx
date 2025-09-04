import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { subscribeLightingStatus } from '../lib/lighting';

export function LightingStatusDot() {
  const [status, setStatus] = useState<'unknown' | 'success' | 'slow' | 'failed'>('unknown');
  const [showTooltip, setShowTooltip] = useState(false);
  
  useEffect(() => {
    const unsubscribe = subscribeLightingStatus(setStatus);
    
    // Show tooltip for 3 seconds on failure
    if (status === 'failed') {
      setShowTooltip(true);
      const timer = setTimeout(() => setShowTooltip(false), 3000);
      return () => {
        unsubscribe();
        clearTimeout(timer);
      };
    }
    
    return unsubscribe;
  }, [status]);
  
  const getColor = () => {
    switch (status) {
      case 'success': return '#10b981'; // green
      case 'slow': return '#f59e0b';    // yellow
      case 'failed': return '#ef4444';   // red
      default: return '#9ca3af';         // gray
    }
  };
  
  return (
    <>
      <View
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: getColor(),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      />
      {showTooltip && status === 'failed' && (
        <View
          style={{
            position: 'absolute',
            bottom: 40,
            left: 20,
            backgroundColor: 'rgba(0,0,0,0.8)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 4,
          }}
        >
          <Text style={{ color: 'white', fontSize: 12 }}>
            Lighting offline
          </Text>
        </View>
      )}
    </>
  );
}