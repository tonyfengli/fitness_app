import React, { useState, useEffect } from 'react';
import { ScrollView, Alert, View } from 'react-native';
import { useNavigation } from '../App';
import { Box, Text, TVButton } from '../components';
import { useBusiness } from '../providers/BusinessProvider';
import { supabase } from '../lib/supabase';

interface CheckedInClient {
  id: string;
  name: string;
  preferences?: {
    intensity?: string;
    muscle_targets?: string[];
    session_goal?: string;
  };
}

export function SessionLobbyScreen() {
  const navigation = useNavigation();
  const { businessId } = useBusiness();
  const sessionId = navigation.getParam('sessionId');
  const [clients, setClients] = useState<CheckedInClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('connected');

  useEffect(() => {
    if (!sessionId) return;

    // Load initial clients
    const loadClients = async () => {
      try {
        // This is a simplified version - the actual query would join multiple tables
        const { data, error } = await supabase
          .from('user_training_session')
          .select('*')
          .eq('training_session_id', sessionId)
          .eq('status', 'checked_in');

        if (data && !error) {
          // For now, using simplified data structure
          setClients(data.map(d => ({ 
            id: d.user_id, 
            name: `Client ${d.user_id.slice(0, 6)}`,
            preferences: {}
          })));
        }
      } catch (error) {
        console.error('[SessionLobby] Error loading clients:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadClients();

    // Set up real-time subscription for check-ins
    const channel = supabase
      .channel(`session-lobby-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_training_session',
          filter: `training_session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('[SessionLobby] Check-in update:', payload);
          // Handle real-time updates here
        }
      )
      .subscribe((status) => {
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 'disconnected');
      });

    return () => {
      channel.unsubscribe();
    };
  }, [sessionId]);

  const handleStartSession = () => {
    // Navigate to preferences or workout overview
    navigation.navigate('GlobalPreferences', { sessionId });
  };

  const handleCloseSession = async () => {
    if (!sessionId) return;
    
    Alert.alert(
      'Close Session',
      'Are you sure you want to close this session? This will cancel the session and return to the welcome screen.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Close Session',
          style: 'destructive',
          onPress: async () => {
            try {
              // Update session status to 'cancelled' directly via Supabase
              const { error } = await supabase
                .from('training_session')
                .update({ status: 'cancelled' })
                .eq('id', sessionId)
                .eq('business_id', businessId)
                .eq('status', 'open'); // Only cancel if it's currently open
              
              if (error) {
                throw error;
              }
              
              // Navigate back to main screen
              navigation.navigate('Main');
            } catch (error) {
              console.error('[SessionLobby] Error cancelling session:', error);
              Alert.alert('Error', 'Failed to close the session. Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <Box style={{ flex: 1 }} backgroundColor="gray50">
      {/* Header */}
      <Box 
        backgroundColor="white" 
        paddingX="xl" 
        paddingY="l"
        borderBottomWidth={1}
        borderColor="gray200"
      >
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Box flexDirection="row" alignItems="center">
            <TVButton
              onPress={handleCloseSession}
              variant="ghost"
              size="small"
              style={{ marginRight: 12 }}
            >
              <Text variant="h4" color="gray500">✕</Text>
            </TVButton>
            <Text variant="h4" color="gray800">
              Close Session
            </Text>
          </Box>
          <TVButton
            onPress={handleStartSession}
            variant="primary"
            size="medium"
            style={{ 
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 8
            }}
          >
            Start Session
          </TVButton>
        </Box>
      </Box>

      {/* Main Content */}
      <Box style={{ flex: 1 }} padding="xl">
        {/* Check-in Instructions */}
        <Box 
          backgroundColor="white"
          padding="l"
          borderRadius="md"
          marginBottom="l"
          borderWidth={1}
          borderColor="gray200"
        >
          <Text variant="body" color="gray700" textAlign="center">
            Text <Text variant="bodySemibold" color="indigo600">'here'</Text> to{' '}
            <Text variant="bodySemibold" color="indigo600">562-608-1666</Text> to check in.
          </Text>
        </Box>

        {/* Clients Area */}
        <Box 
          backgroundColor="white"
          borderRadius="lg"
          borderWidth={1}
          borderColor="gray200"
          style={{
            flex: 1,
            shadowColor: 'black',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.03,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          {isLoading ? (
            <Box alignItems="center" justifyContent="center" style={{ flex: 1 }}>
              <Text variant="body" color="gray600">Loading clients...</Text>
            </Box>
          ) : clients.length === 0 ? (
            <Box alignItems="center" justifyContent="center" style={{ flex: 1 }} padding="3xl">
              {/* Icon placeholder */}
              <Box 
                backgroundColor="gray100" 
                borderRadius="full" 
                width={120} 
                height={120}
                alignItems="center"
                justifyContent="center"
                marginBottom="xl"
              >
                <Text variant="h1" color="gray400" style={{ fontSize: 64 }}>
                  👥
                </Text>
              </Box>
              
              <Text variant="h2" color="gray800" marginBottom="m" textAlign="center">
                No clients checked in yet
              </Text>
              
              <Text 
                variant="body" 
                color="gray500" 
                textAlign="center"
                style={{ maxWidth: 400, lineHeight: 24 }}
              >
                Clients who check in will appear here. Once they join, you can start the session.
              </Text>
            </Box>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {clients.map((client) => (
                <Box 
                  key={client.id} 
                  padding="m" 
                  borderBottomWidth={1} 
                  borderColor="gray100"
                >
                  <Box flexDirection="row" alignItems="center">
                    <Box 
                      width={40} 
                      height={40} 
                      borderRadius="full" 
                      backgroundColor="indigo100" 
                      marginRight="m"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text variant="h5" color="indigo600">
                        {client.name.charAt(0).toUpperCase()}
                      </Text>
                    </Box>
                    
                    <Box style={{ flex: 1 }}>
                      <Text variant="h5" color="gray900">{client.name}</Text>
                      {client.preferences?.intensity && (
                        <Text variant="bodySmall" color="gray600">
                          Intensity: {client.preferences.intensity}
                        </Text>
                      )}
                    </Box>
                  </Box>
                </Box>
              ))}
            </ScrollView>
          )}
        </Box>
      </Box>

      {/* Footer with Connection Status */}
      <Box 
        backgroundColor="white" 
        paddingY="s" 
        paddingX="xl"
        borderTopWidth={1}
        borderColor="gray200"
      >
        <Box flexDirection="row" alignItems="center">
          <Box 
            width={10} 
            height={10} 
            borderRadius="full" 
            backgroundColor={connectionStatus === 'connected' ? 'green500' : 'red500'} 
            marginRight="s" 
          />
          <Text variant="bodySmall" color="gray600">
            {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}