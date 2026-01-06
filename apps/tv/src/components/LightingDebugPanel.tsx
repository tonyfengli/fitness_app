import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { API_URL, EXPO_PUBLIC_HUE_BRIDGE_IP, EXPO_PUBLIC_HUE_APP_KEY, EXPO_PUBLIC_HUE_GROUP_ID } from '../env.generated';

export function LightingDebugPanel() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [serverDebug, setServerDebug] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // Gather client-side debug info
    setDebugInfo({
      timestamp: new Date().toISOString(),
      environment: {
        API_URL,
        HUE_BRIDGE_IP: EXPO_PUBLIC_HUE_BRIDGE_IP || 'NOT SET',
        HUE_APP_KEY: EXPO_PUBLIC_HUE_APP_KEY ? 'SET' : 'NOT SET', 
        HUE_GROUP_ID: EXPO_PUBLIC_HUE_GROUP_ID || 'NOT SET',
      }
    });
  }, []);
  
  const testServerConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/lighting-debug`);
      const data = await response.json();
      setServerDebug(data);
    } catch (error) {
      setServerDebug({ 
        error: error instanceof Error ? error.message : String(error),
        apiUrl: API_URL 
      });
    }
    setLoading(false);
  };
  
  return (
    <View style={{ 
      position: 'absolute', 
      bottom: 20, 
      right: 20, 
      backgroundColor: 'rgba(0,0,0,0.8)', 
      padding: 20,
      borderRadius: 10,
      maxWidth: 400
    }}>
      <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
        Lighting Debug Panel
      </Text>
      
      <ScrollView style={{ maxHeight: 300 }}>
        <Text style={{ color: 'white', fontSize: 12, fontFamily: 'monospace' }}>
          {JSON.stringify(debugInfo, null, 2)}
        </Text>
        
        {serverDebug && (
          <>
            <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold', marginTop: 10 }}>
              Server Debug:
            </Text>
            <Text style={{ color: 'white', fontSize: 12, fontFamily: 'monospace' }}>
              {JSON.stringify(serverDebug, null, 2)}
            </Text>
          </>
        )}
      </ScrollView>
      
      <Pressable
        onPress={testServerConnection}
        disabled={loading}
        style={{
          backgroundColor: loading ? '#666' : '#007AFF',
          padding: 10,
          borderRadius: 5,
          marginTop: 10,
          alignItems: 'center'
        }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>
          {loading ? 'Testing...' : 'Test Server Connection'}
        </Text>
      </Pressable>
    </View>
  );
}