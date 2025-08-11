import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCProvider } from './providers/TRPCProvider';
import { RealtimeProvider } from './providers/RealtimeProvider';

// TVEventHandler might be in a different location for react-native-tvos
let TVEventHandler: any;
let HWEvent: any;
try {
  const RN = require('react-native');
  TVEventHandler = RN.TVEventHandler;
  HWEvent = RN.HWEvent;
} catch (e) {
  // TVEventHandler might not be available
  console.log('TVEventHandler not available');
}

// Screens
import { SessionLobbyScreen } from './screens/SessionLobbyScreen';
import { GlobalPreferencesScreen } from './screens/GlobalPreferencesScreen';
import { WorkoutOverviewScreen } from './screens/WorkoutOverviewScreen';
import { WorkoutLiveScreen } from './screens/WorkoutLiveScreen';
import { SessionMonitorScreen } from './screens/SessionMonitorScreen';

const queryClient = new QueryClient();

type ScreenName = 'SessionLobby' | 'GlobalPreferences' | 'WorkoutOverview' | 'WorkoutLive' | 'SessionMonitor';

interface NavigationState {
  currentScreen: ScreenName;
  sessionId: string | null;
  currentRound: number;
}

// Create a simple navigation context
const NavigationContext = React.createContext<{
  navigate: (screen: ScreenName, params?: any) => void;
  goBack: () => void;
  getParam: (key: string) => any;
}>({
  navigate: () => {},
  goBack: () => {},
  getParam: () => null,
});

export const useNavigation = () => React.useContext(NavigationContext);

function NavigationContainer({ children }: { children: React.ReactNode }) {
  const [navigationState, setNavigationState] = useState<NavigationState>({
    currentScreen: 'SessionMonitor', // Start with SessionMonitor to see real-time updates
    sessionId: null,
    currentRound: 1,
  });
  
  const [navigationParams, setNavigationParams] = useState<any>({});
  const tvEventHandler = useRef<TVEventHandler | null>(null);
  
  const screenHistory = useRef<ScreenName[]>(['SessionLobby']);

  const navigate = (screen: ScreenName, params?: any) => {
    screenHistory.current.push(screen);
    setNavigationState(prev => ({ ...prev, currentScreen: screen }));
    if (params) {
      setNavigationParams(params);
      if (params.sessionId) {
        setNavigationState(prev => ({ ...prev, sessionId: params.sessionId }));
      }
      if (params.round) {
        setNavigationState(prev => ({ ...prev, currentRound: params.round }));
      }
    }
  };

  const goBack = () => {
    if (screenHistory.current.length > 1) {
      screenHistory.current.pop();
      const previousScreen = screenHistory.current[screenHistory.current.length - 1];
      setNavigationState(prev => ({ ...prev, currentScreen: previousScreen }));
    }
  };

  const getParam = (key: string) => navigationParams[key];

  // TV Remote handling
  useEffect(() => {
    if (TVEventHandler) {
      try {
        tvEventHandler.current = new TVEventHandler();
        
        const handleTVEvent = (evt: any) => {
          if (evt && (evt.eventType === 'menu' || evt.eventType === 'back')) {
            goBack();
          }
        };

        tvEventHandler.current.enable(undefined, handleTVEvent);

        return () => {
          if (tvEventHandler.current) {
            tvEventHandler.current.disable();
          }
        };
      } catch (error) {
        console.log('Error setting up TV event handler:', error);
      }
    }
  }, []);

  const navigationValue = {
    navigate,
    goBack,
    getParam,
  };

  return (
    <NavigationContext.Provider value={navigationValue}>
      <View className="flex-1 bg-gray-50">
        {navigationState.currentScreen === 'SessionLobby' && (
          <SessionLobbyScreen />
        )}
        {navigationState.currentScreen === 'GlobalPreferences' && (
          <GlobalPreferencesScreen />
        )}
        {navigationState.currentScreen === 'WorkoutOverview' && (
          <WorkoutOverviewScreen />
        )}
        {navigationState.currentScreen === 'WorkoutLive' && (
          <WorkoutLiveScreen />
        )}
        {navigationState.currentScreen === 'SessionMonitor' && (
          <SessionMonitorScreen />
        )}
      </View>
    </NavigationContext.Provider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider>
        <RealtimeProvider>
          <NavigationContainer>
            <View className="flex-1" />
          </NavigationContainer>
        </RealtimeProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}