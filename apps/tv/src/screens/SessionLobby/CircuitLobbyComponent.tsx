import React, { useMemo } from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { API_URL } from '../../env.generated';

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
  
  // Generate QR code URL - this will be the check-in URL
  const qrCodeUrl = useMemo(() => {
    // Use the API_URL from env.generated.ts which points to the Next.js app
    const baseUrl = API_URL || 'http://localhost:3001';
    return `${baseUrl}/checkin?sessionId=${sessionId}`;
  }, [sessionId]);

  // Generate QR code image URL using a web service
  const qrCodeImageUrl = useMemo(() => {
    const encodedUrl = encodeURIComponent(qrCodeUrl);
    // Using qr-server.com API which generates QR codes without dependencies
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodedUrl}&bgcolor=FFFFFF&color=070b18`;
  }, [qrCodeUrl]);
  
  return (
    <View style={{ flex: 1, backgroundColor: TOKENS.color.bg, padding: 24 }}>
      {/* Header */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ 
          fontSize: 32, 
          fontWeight: '700', 
          color: TOKENS.color.text,
          marginBottom: 8,
          textAlign: 'center' 
        }}>
          {currentSession?.name || 'Circuit Training Session'}
        </Text>
        
        <Text style={{ 
          fontSize: 18, 
          color: TOKENS.color.muted,
          textAlign: 'center' 
        }}>
          Session ID: {sessionId.slice(0, 8)}
        </Text>
      </View>
      
      {/* Main content with QR code and checked-in athletes */}
      <View style={{ flex: 1, flexDirection: 'row', gap: 32 }}>
        {/* Left side - QR Code */}
        <View style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <View style={{
            backgroundColor: TOKENS.color.card,
            borderColor: TOKENS.color.borderGlass,
            borderWidth: 1,
            borderRadius: TOKENS.radius.card,
            padding: 48,
            alignItems: 'center',
            elevation: 8,
            shadowColor: '#000',
            shadowOpacity: 0.40,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 8 },
          }}>
            <Text style={{ 
              fontSize: 24, 
              fontWeight: '600', 
              color: TOKENS.color.text,
              marginBottom: 24 
            }}>
              Scan to Check In
            </Text>
            
            <View style={{
              backgroundColor: '#FFFFFF',
              padding: 16,
              borderRadius: 12,
              width: 312,
              height: 312,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Image
                source={{ uri: qrCodeImageUrl }}
                style={{ 
                  width: 280, 
                  height: 280,
                }}
                resizeMode="contain"
              />
            </View>
            
            <Text style={{ 
              fontSize: 16, 
              color: TOKENS.color.muted,
              marginTop: 24,
              textAlign: 'center' 
            }}>
              Scan with your phone camera{'\n'}to check into this session
            </Text>
          </View>
        </View>
        
        {/* Right side - Checked-in athletes */}
        <View style={{ flex: 1 }}>
          <View style={{
            backgroundColor: TOKENS.color.card,
            borderColor: TOKENS.color.borderGlass,
            borderWidth: 1,
            borderRadius: TOKENS.radius.card,
            padding: 24,
            flex: 1,
            elevation: 8,
            shadowColor: '#000',
            shadowOpacity: 0.40,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 8 },
          }}>
            <Text style={{ 
              fontSize: 20, 
              fontWeight: '600', 
              color: TOKENS.color.text,
              marginBottom: 16 
            }}>
              Checked In Athletes ({clients.length})
            </Text>
            
            {clients.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16, color: TOKENS.color.muted, textAlign: 'center' }}>
                  No athletes checked in yet.{'\n'}
                  They can scan the QR code to join!
                </Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }}>
                {clients.map((client, index) => (
                  <View 
                    key={client.userId} 
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      borderBottomWidth: index < clients.length - 1 ? 1 : 0,
                      borderBottomColor: TOKENS.color.borderGlass,
                    }}
                  >
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: TOKENS.color.accent2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}>
                      <Text style={{ color: TOKENS.color.bg, fontWeight: '600' }}>
                        {client.userName?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                    
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, color: TOKENS.color.text, fontWeight: '500' }}>
                        {client.userName || 'Unknown'}
                      </Text>
                      {client.checkedInAt && (
                        <Text style={{ fontSize: 14, color: TOKENS.color.muted }}>
                          Checked in at {new Date(client.checkedInAt).toLocaleTimeString()}
                        </Text>
                      )}
                    </View>
                    
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: TOKENS.color.accent,
                    }} />
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}