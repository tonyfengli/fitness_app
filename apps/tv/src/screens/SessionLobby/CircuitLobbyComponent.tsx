import React from 'react';
import { View, Text } from 'react-native';

// Design tokens
const TOKENS = {
  color: {
    bg: '#070b18',
    card: '#111928',
    text: '#ffffff',
    muted: '#9cb0ff',
    accent: '#7cffb5',
    accent2: '#5de1ff',
    focusRing: 'rgba(124,255,181,0.6)',
    borderGlass: 'rgba(255,255,255,0.08)',
    cardGlass: 'rgba(255,255,255,0.04)',
  },
  radius: {
    card: 16,
    chip: 999,
  },
};

interface CircuitLobbyProps {
  sessionId: string;
  currentSession: any;
  clients: Array<{
    userId: string;
    userName: string | null;
    userEmail: string;
    checkedInAt: Date | null;
    status?: string;
    preferences?: any;
    isNew?: boolean;
  }>;
  isLoading: boolean;
  fetchError: any;
  hasLoadedInitialData: boolean;
  isNewSession: boolean;
  connectionState: 'connecting' | 'connected' | 'error';
  lastSuccessfulFetch: Date | null;
  isConnected: boolean;
  isStartingSession: boolean;
  setIsStartingSession: (value: boolean) => void;
}

export function CircuitLobbyComponent({
  sessionId,
  currentSession,
  clients,
  isLoading,
  fetchError,
  hasLoadedInitialData,
  isNewSession,
  connectionState,
  lastSuccessfulFetch,
  isConnected,
  isStartingSession,
  setIsStartingSession,
}: CircuitLobbyProps) {
  
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ 
        fontSize: 32, 
        fontWeight: '700', 
        color: TOKENS.color.text,
        marginBottom: 16 
      }}>
        Circuit Session
      </Text>
      
      <Text style={{ 
        fontSize: 20, 
        color: TOKENS.color.muted,
        marginBottom: 32 
      }}>
        {currentSession?.name || 'Training Session'}
      </Text>
      
      <View style={{
        backgroundColor: TOKENS.color.card,
        borderColor: TOKENS.color.borderGlass,
        borderWidth: 1,
        borderRadius: TOKENS.radius.card,
        padding: 32,
        alignItems: 'center'
      }}>
        <Text style={{ 
          fontSize: 18, 
          color: TOKENS.color.accent,
          marginBottom: 8 
        }}>
          Session ID: {sessionId}
        </Text>
        
        <Text style={{ 
          fontSize: 16, 
          color: TOKENS.color.text 
        }}>
          {clients.length} athlete{clients.length !== 1 ? 's' : ''} checked in
        </Text>
      </View>
      
      <Text style={{ 
        fontSize: 14, 
        color: TOKENS.color.muted,
        marginTop: 32,
        textAlign: 'center',
        fontStyle: 'italic'
      }}>
        Circuit lobby implementation coming soon...
      </Text>
    </View>
  );
}