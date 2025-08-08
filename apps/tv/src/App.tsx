import React from 'react';
import { View, TVEventHandler, HWEvent } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCProvider } from './providers/TRPCProvider';
import { useTVNavigation } from './lib/tv-navigation';

// Screens
import { SessionLobbyScreen } from './screens/SessionLobbyScreen';
import { GlobalPreferencesScreen } from './screens/GlobalPreferencesScreen';
import { WorkoutOverviewScreen } from './screens/WorkoutOverviewScreen';
import { WorkoutLiveScreen } from './screens/WorkoutLiveScreen';

// Import global styles
// import './global.css'; // Temporarily disabled for build

const Stack = createStackNavigator();
const queryClient = new QueryClient();

export type RootStackParamList = {
  SessionLobby: undefined;
  GlobalPreferences: { sessionId: string };
  WorkoutOverview: { sessionId: string };
  WorkoutLive: { sessionId: string; round: number };
};

function AppContent() {
  // Set up TV remote control handling
  useTVNavigation();

  return (
    <View className="flex-1 bg-gray-50">
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="SessionLobby"
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: 'transparent' },
            // TV-specific transitions
            animationEnabled: true,
            gestureEnabled: false,
          }}
        >
          <Stack.Screen name="SessionLobby" component={SessionLobbyScreen} />
          <Stack.Screen name="GlobalPreferences" component={GlobalPreferencesScreen} />
          <Stack.Screen name="WorkoutOverview" component={WorkoutOverviewScreen} />
          <Stack.Screen name="WorkoutLive" component={WorkoutLiveScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider>
        <AppContent />
      </TRPCProvider>
    </QueryClientProvider>
  );
}