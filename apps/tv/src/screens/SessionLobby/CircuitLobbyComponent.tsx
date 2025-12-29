import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, Pressable, ActivityIndicator, Alert, Switch } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../providers/TRPCProvider';
import { useNavigation } from '../../App';
import { API_URL } from '../../env.generated';
import { useLightingControl } from '../../hooks/useLightingControl';

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

// Matte panel helper component
function MattePanel({
  children,
  style,
  focused = false,
  radius = TOKENS.radius.card,
}: {
  children: React.ReactNode;
  style?: any;
  focused?: boolean;
  radius?: number;
}) {
  const BASE_SHADOW = {
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.40,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
  };
  const FOCUS_SHADOW = {
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.36,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 12 },
  };

  return (
    <View
      style={[
        {
          backgroundColor: TOKENS.color.card,
          borderColor: TOKENS.color.borderGlass,
          borderWidth: 1,
          borderRadius: radius,
        },
        focused ? FOCUS_SHADOW : BASE_SHADOW,
        style,
      ]}
    >
      {children}
    </View>
  );
}

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
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  
  // State for isStarted toggle
  const [isStartedOverride, setIsStartedOverride] = useState(false);
  
  // Initialize lighting control
  const { isLightingOn, turnOn, turnOff, getSceneForPhase } = useLightingControl({ sessionId });
  
  // Log lighting state changes
  useEffect(() => {
    console.log('[CircuitLobby] Lighting state changed:', { isLightingOn });
  }, [isLightingOn]);

  // Update session status mutation
  const updateSessionStatusMutation = useMutation({
    ...api.trainingSession.updateSessionStatus.mutationOptions(),
    onSuccess: (data) => {
      // Invalidate queries to ensure MainScreen shows updated status
      queryClient.invalidateQueries({ 
        queryKey: api.trainingSession.list.queryOptions({ limit: 6, offset: 0 }).queryKey 
      });
    },
    onError: (error: any) => {
      console.error('[CircuitLobby] Critical error: Failed to update session status:', error);
    },
  });

  const handleBack = async () => {
    // Update session status back to open if it's not completed
    if (currentSession && currentSession.status !== 'completed' && currentSession.status !== 'cancelled') {
      try {
        await updateSessionStatusMutation.mutateAsync({
          sessionId: sessionId || '',
          status: 'open' as const
        });
      } catch (error) {
        console.error('[CircuitLobby] Critical error: Failed to update status on back:', error);
      }
    }
    
    navigation.navigate('Main', {});
  };

  // Send session start messages mutation
  const sendStartMessagesMutation = useMutation({
    ...api.trainingSession.sendSessionStartMessages.mutationOptions(),
    onSuccess: (data) => {
      // Navigate directly to circuit workout overview screen with isStarted override
      navigation.navigate('CircuitWorkoutOverview', { sessionId, isStartedOverride });
    },
    onError: (error: any) => {
      console.error('[TV CircuitLobby] Critical error: Failed to send start messages:', error);
      console.error('[TV CircuitLobby] Error details:', error.message, error.stack);
      setIsStartingSession(false);
      Alert.alert(
        'Error',
        'Failed to send start messages. Would you like to continue anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => {
              navigation.navigate('CircuitWorkoutOverview', { sessionId, isStartedOverride });
            }
          }
        ]
      );
    },
    onSettled: () => {
      setIsStartingSession(false);
    }
  });

  const handleStartSession = async () => {
    if (!sessionId) {
      console.error('[CircuitLobby] No sessionId, returning');
      return;
    }
    
    setIsStartingSession(true);
    
    // Send start messages (SMS) to checked-in clients
    sendStartMessagesMutation.mutate({ sessionId });
  };
  
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable
            onPress={handleBack}
            focusable
          >
            {({ focused }) => (
              <MattePanel 
                focused={focused}
                style={{ 
                  paddingHorizontal: 32,
                  paddingVertical: 12,
                  backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                  borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                  borderWidth: focused ? 1 : 1,
                  transform: focused ? [{ translateY: -1 }] : [],
                }}
              >
                <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>Back</Text>
              </MattePanel>
            )}
          </Pressable>
          
          {/* isStarted Toggle - World Class Design */}
          <View style={{ 
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 32,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            padding: 6,
            marginHorizontal: 20,
            elevation: 4,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}>
            <Pressable
              onPress={async () => {
                const newState = !isStartedOverride;
                setIsStartedOverride(newState);
                
                try {
                  if (newState) {
                    // Turn on with Round 1 preview scene if available
                    const previewScene = getSceneForPhase(0, 'preview');
                    await turnOn(previewScene || undefined);
                  } else {
                    await turnOff();
                  }
                } catch (error) {
                  console.error('[CircuitLobby] Failed to control lights:', error);
                }
              }}
              focusable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              {({ focused }) => (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: focused ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                  borderRadius: 26,
                  borderWidth: focused ? 1.5 : 0,
                  borderColor: focused ? 'rgba(255,255,255,0.3)' : 'transparent',
                  paddingHorizontal: 14,
                  height: 44,
                  minWidth: 140,
                  elevation: focused ? 6 : 3,
                  shadowColor: '#000',
                  shadowOpacity: focused ? 0.3 : 0.2,
                  shadowRadius: focused ? 20 : 10,
                  shadowOffset: { width: 0, height: focused ? 6 : 3 },
                }}>
                  {/* Label Section */}
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ 
                      fontSize: 13, 
                      color: TOKENS.color.text,
                      fontWeight: '700',
                      letterSpacing: 0.3,
                      textTransform: 'uppercase',
                    }}>
                      Lights
                    </Text>
                  </View>
                  
                  {/* Toggle Indicator */}
                  <View style={{
                    width: 48,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: isStartedOverride ? TOKENS.color.accent : 'rgba(255,255,255,0.2)',
                    padding: 2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: isStartedOverride ? 'flex-end' : 'flex-start',
                  }}>
                    <View style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: '#ffffff',
                      elevation: 2,
                      shadowColor: '#000',
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                    }}>
                      {isStartedOverride && (
                        <View style={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: TOKENS.color.accent,
                        }} />
                      )}
                    </View>
                  </View>
                </View>
              )}
            </Pressable>
          </View>
          
          {/* Center content - Session info */}
          <View style={{ flex: 2, alignItems: 'center' }}>
            <Text style={{ 
              fontSize: 24, 
              fontWeight: '700', 
              color: TOKENS.color.text,
              marginBottom: 4,
              textAlign: 'center' 
            }}>
              Scan to Check In
            </Text>
            <Text style={{ 
              fontSize: 14, 
              color: TOKENS.color.muted,
              textAlign: 'center',
              fontWeight: '500'
            }}>
              {currentSession?.name || 'Circuit Training Session'}
            </Text>
          </View>
          
          <Pressable
            onPress={handleStartSession}
            disabled={isStartingSession}
            focusable={!isStartingSession}
            hasTVPreferredFocus={!isStartingSession}
          >
            {({ focused }) => {
              const isDisabled = isStartingSession;
              return (
                <MattePanel 
                  focused={focused}
                  style={{ 
                    paddingHorizontal: 32,
                    paddingVertical: 12,
                    opacity: isDisabled ? 0.5 : 1,
                    backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                    borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                    borderWidth: focused ? 1 : 1,
                    transform: focused ? [{ translateY: -1 }] : [],
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {isStartingSession ? (
                      <>
                        <ActivityIndicator size="small" color={TOKENS.color.accent} />
                        <Text style={{ color: TOKENS.color.text, fontSize: 18, marginLeft: 8 }}>
                          Starting...
                        </Text>
                      </>
                    ) : (
                      <Text style={{ color: TOKENS.color.text, fontSize: 18 }}>
                        Start Session
                      </Text>
                    )}
                  </View>
                </MattePanel>
              );
            }}
          </Pressable>
        </View>
      </View>

      {/* Main content with QR code and checked-in athletes */}
      <View style={{ flex: 1, flexDirection: 'row', gap: 32 }}>
        {/* Left side - QR Code */}
        <View style={{
          flex: 1,
        }}>
          <View style={{
            backgroundColor: TOKENS.color.card,
            borderColor: TOKENS.color.borderGlass,
            borderWidth: 1,
            borderRadius: TOKENS.radius.card,
            padding: 48,
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            elevation: 8,
            shadowColor: '#000',
            shadowOpacity: 0.40,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 8 },
          }}>
            <View style={{
              backgroundColor: '#FFFFFF',
              padding: 4,
              borderRadius: 12,
              width: 312,
              height: 312,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Image
                source={{ uri: qrCodeImageUrl }}
                style={{ 
                  width: 304, 
                  height: 304,
                }}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>
        
        {/* Right side - Checked-in athletes */}
        <View style={{ 
          flex: 1,
        }}>
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
              marginBottom: 4 
            }}>
              Checked In ({clients.length})
            </Text>
            
            {clients.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16, color: TOKENS.color.muted, textAlign: 'center' }}>
                  No one is checked in yet
                </Text>
              </View>
            ) : (
              <View style={{ 
                flex: 1,
                flexDirection: 'row',
                gap: 16,
                paddingBottom: 40,
              }}>
                {/* Left Column - First half of clients */}
                <View style={{ flex: 1 }}>
                  {clients.slice(0, Math.ceil(clients.length / 2)).map((client, index) => (
                    <View 
                      key={client.userId} 
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        marginBottom: 4,
                        backgroundColor: client.isNew ? 'rgba(124, 255, 181, 0.06)' : 'transparent',
                        borderRadius: 6,
                        minHeight: 40,
                      }}
                    >
                      <View style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: TOKENS.color.accent2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 8,
                      }}>
                        <Text style={{ 
                          color: TOKENS.color.bg, 
                          fontWeight: '600',
                          fontSize: 10,
                        }}>
                          {client.userName?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                      
                      <Text style={{ 
                        fontSize: 20, 
                        color: TOKENS.color.text, 
                        fontWeight: '500',
                        flex: 1,
                      }} 
                      numberOfLines={1}
                      ellipsizeMode="tail">
                        {client.userName?.split(' ')[0] || 'Unknown'}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Right Column - Second half of clients */}
                <View style={{ flex: 1 }}>
                  {clients.slice(Math.ceil(clients.length / 2)).map((client, index) => (
                    <View 
                      key={client.userId} 
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        marginBottom: 4,
                        backgroundColor: client.isNew ? 'rgba(124, 255, 181, 0.06)' : 'transparent',
                        borderRadius: 6,
                        minHeight: 40,
                      }}
                    >
                      <View style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: TOKENS.color.accent2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 8,
                      }}>
                        <Text style={{ 
                          color: TOKENS.color.bg, 
                          fontWeight: '600',
                          fontSize: 10,
                        }}>
                          {client.userName?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                      
                      <Text style={{ 
                        fontSize: 20, 
                        color: TOKENS.color.text, 
                        fontWeight: '500',
                        flex: 1,
                      }} 
                      numberOfLines={1}
                      ellipsizeMode="tail">
                        {client.userName?.split(' ')[0] || 'Unknown'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}