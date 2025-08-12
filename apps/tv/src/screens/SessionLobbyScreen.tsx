import React from 'react';
import { useNavigation } from '../App';
import { Box, Text, TVButton } from '../components';

export function SessionLobbyScreen() {
  const navigation = useNavigation();

  const handleStartSession = () => {
    // Navigate with a demo session ID
    navigation.navigate('GlobalPreferences', { sessionId: 'demo-session-123' });
  };

  return (
    <Box style={{ flex: 1 }} backgroundColor="gray900" padding="3xl">
      <Box style={{ flex: 1 }} alignItems="center" justifyContent="center">
        <Text variant="h1" color="white" marginBottom="m" fontSize={72} lineHeight={80}>
          Fitness Session
        </Text>
        
        <Text variant="h3" color="gray300" marginBottom="3xl">
          Welcome to today's workout
        </Text>

        <TVButton
          onPress={handleStartSession}
          variant="primary"
          size="large"
        >
          Start Session
        </TVButton>

        <Box marginTop="4xl">
          <Text variant="h5" color="gray400">
            Press Enter or click to begin
          </Text>
        </Box>
      </Box>
    </Box>
  );
}