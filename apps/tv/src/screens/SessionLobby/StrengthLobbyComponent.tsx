import React from 'react';
import { ScrollView, View, Text, Image, ActivityIndicator, Pressable, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../providers/TRPCProvider';
import { useNavigation } from '../../App';

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

// Helper function to format time in 12-hour format with AM/PM
function formatTime12Hour(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  
  return `${hours12}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
}

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

interface StrengthLobbyProps {
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

export function StrengthLobbyComponent({
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
}: StrengthLobbyProps) {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

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
      console.error('[StrengthLobby] Critical error: Failed to update session status:', error);
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
        console.error('[StrengthLobby] Critical error: Failed to update status on back:', error);
      }
    }
    
    navigation.navigate('Main', {});
  };

  // Send session start messages mutation
  const sendStartMessagesMutation = useMutation({
    ...api.trainingSession.sendSessionStartMessages.mutationOptions(),
    onSuccess: (data) => {
      // Navigate to preferences screen for strength sessions
      navigation.navigate('GlobalPreferences', { sessionId });
    },
    onError: (error: any) => {
      console.error('[TV StrengthLobby] Critical error: Failed to send start messages:', error);
      setIsStartingSession(false);
      Alert.alert(
        'Error',
        'Failed to send start messages. Would you like to continue anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => {
              navigation.navigate('GlobalPreferences', { sessionId });
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
    if (!sessionId) return;
    
    setIsStartingSession(true);
    
    // Send start messages (SMS) to checked-in clients
    sendStartMessagesMutation.mutate({ sessionId });
  };

  return (
    <View className="flex-1" style={{ backgroundColor: TOKENS.color.bg, padding: 24 }}>
      {/* Header */}
      <View className="mb-6">
        <View className="flex-row justify-between items-center">
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
          
          <Pressable
            onPress={handleStartSession}
            disabled={isStartingSession || clients.length === 0}
            focusable={!isStartingSession && clients.length > 0}
            hasTVPreferredFocus={!isStartingSession && clients.length > 0}
          >
            {({ focused }) => {
              const isDisabled = isStartingSession || clients.length === 0;
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
                  <View className="flex-row items-center">
                    {isStartingSession ? (
                      <>
                        <ActivityIndicator size="small" color={TOKENS.color.accent} />
                        <Text style={{ color: TOKENS.color.text, fontSize: 18, marginLeft: 8 }}>
                          Starting...
                        </Text>
                      </>
                    ) : (
                      <>
                        <Icon name="play-arrow" size={24} color={TOKENS.color.accent} />
                        <Text style={{ color: TOKENS.color.text, fontSize: 18, marginLeft: 4 }}>
                          Start Session
                        </Text>
                      </>
                    )}
                  </View>
                </MattePanel>
              );
            }}
          </Pressable>
        </View>
      </View>

      {/* Main Content */}
      <View className="flex-1">
        {/* Clients Area */}
        <MattePanel style={{ flex: 1, padding: 16 }}>
              {fetchError ? (
                <View className="flex-1 items-center justify-center p-12">
                  {/* Error icon */}
                  <View className="bg-gray-800 rounded-full w-20 h-20 items-center justify-center mb-4">
                    <Icon 
                      name={
                        fetchError.message?.toLowerCase().includes('network') || 
                        fetchError.message?.toLowerCase().includes('fetch failed') ||
                        fetchError.message?.toLowerCase().includes('failed to fetch')
                          ? "wifi-off" 
                          : "error-outline"
                      } 
                      size={40} 
                      color="#ef4444" 
                    />
                  </View>
                  
                  <Text style={{ fontSize: 20, color: '#ef4444', fontWeight: '600', marginBottom: 8 }}>
                    {fetchError.message?.toLowerCase().includes('network') || 
                     fetchError.message?.toLowerCase().includes('fetch failed') ||
                     fetchError.message?.toLowerCase().includes('failed to fetch')
                      ? 'No Internet Connection'
                      : fetchError.message?.toLowerCase().includes('timeout')
                      ? 'Connection Timed Out'
                      : 'Unable to Load Clients'}
                  </Text>
                  <Text style={{ color: TOKENS.color.muted, fontSize: 16, textAlign: 'center', paddingHorizontal: 24 }}>
                    {fetchError.message?.toLowerCase().includes('network') || 
                     fetchError.message?.toLowerCase().includes('fetch failed') ||
                     fetchError.message?.toLowerCase().includes('failed to fetch')
                      ? 'Please check your internet connection'
                      : fetchError.message?.toLowerCase().includes('timeout')
                      ? 'The request took too long. Please check your connection.'
                      : fetchError.message || 'Something went wrong while loading clients'}
                  </Text>
                </View>
              ) : (isLoading || !hasLoadedInitialData) && !isNewSession ? (
                <View className="flex-1 items-center justify-center">
                  <Text style={{ color: TOKENS.color.muted }}>Loading clients...</Text>
                </View>
              ) : clients.length === 0 ? (
                <View className="flex-1 items-center justify-center p-12">
                  {/* Icon placeholder - smaller size */}
                  <View className="bg-gray-800 rounded-full w-20 h-20 items-center justify-center mb-4">
                    <Icon name="group-off" size={40} color={TOKENS.color.muted} />
                  </View>
                  
                  <Text style={{ fontSize: 16, color: TOKENS.color.muted, textAlign: 'center' }}>
                    No one is checked in yet
                  </Text>
                </View>
              ) : (
                <ScrollView className="flex-1">
                  {clients.map((client) => (
                    <View 
                      key={client.userId} 
                      style={{
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: TOKENS.color.borderGlass,
                        backgroundColor: client.isNew ? 'rgba(124, 255, 181, 0.1)' : 'transparent',
                        marginHorizontal: -16,
                        paddingHorizontal: 40,
                      }}
                    >
                      <View className="flex-row items-center">
                        {/* DiceBear Avatar - using PNG format */}
                        <Image
                          source={{ uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${client.userId}&size=128` }}
                          style={{ width: 32, height: 32, borderRadius: 16, marginRight: 12, alignSelf: 'center' }}
                        />
                        
                        {/* Name only - extract first name */}
                        <View className="flex-1">
                          <Text style={{ fontSize: 16, fontWeight: '600', color: TOKENS.color.text }}>
                            {client.userName ? client.userName.split(' ')[0] : 'Unknown'}
                          </Text>
                        </View>
                        
                        {/* Checked in status */}
                        <View className="flex-row items-center">
                          <View className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                          <Text style={{ fontSize: 14, color: TOKENS.color.text }}>Checked in</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
        </MattePanel>
      </View>

      {/* Footer text without container */}
      <View className="mt-6">
        <View className="flex-row items-center justify-between">
          {/* Connection status */}
          <View className="flex-row items-center">
            <View 
              className={`w-3 h-3 rounded-full mr-2 ${
                connectionState === 'connecting' ? 'bg-gray-400' :
                connectionState === 'connected' ? 'bg-green-400' : 'bg-red-400'
              }`} 
            />
            <Text style={{ fontSize: 16, color: TOKENS.color.text }}>
              {connectionState === 'connecting' ? 'Connecting...' :
               connectionState === 'connected' ? `Live - ${lastSuccessfulFetch ? formatTime12Hour(lastSuccessfulFetch) : 'connecting'}` :
               `Last connected: ${lastSuccessfulFetch ? formatTime12Hour(lastSuccessfulFetch) : 'never'}`}
            </Text>
          </View>
          
          {/* Check-in instructions */}
          <View className="flex-row items-center">
            <Text style={{ fontSize: 16, color: TOKENS.color.text }}>
              Text <Text style={{ fontWeight: '600', color: TOKENS.color.text }}>'here'</Text> to{' '}
              <Text style={{ fontWeight: '600', color: TOKENS.color.text }}>714-902-2495</Text>
            </Text>
            <Text className="text-base ml-2">🎉</Text>
          </View>
        </View>
      </View>
    </View>
  );
}