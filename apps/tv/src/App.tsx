import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCProvider } from './providers/TRPCProvider';
import { RealtimeProvider } from './providers/RealtimeProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { Box } from './components';

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
import { NetworkTestScreen } from './screens/NetworkTestScreen';

const queryClient = new QueryClient();

type ScreenName = 'SessionLobby' | 'GlobalPreferences' | 'WorkoutOverview' | 'WorkoutLive' | 'SessionMonitor' | 'NetworkTest';

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
    currentScreen: 'NetworkTest', // Start with NetworkTest to debug connection
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
    if (TVEventHandler && typeof TVEventHandler === 'function') {
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
        // TVEventHandler might not be available on all platforms
        console.log('TV event handler not available');
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
      <Box style={{ flex: 1 }} backgroundColor="background">
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
        {navigationState.currentScreen === 'NetworkTest' && (
          <NetworkTestScreen />
        )}
      </Box>
    </NavigationContext.Provider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider>
        <RealtimeProvider>
          <ThemeProvider>
            <NavigationContainer>
              <Box style={{ flex: 1 }} />
            </NavigationContainer>
          </ThemeProvider>
        </RealtimeProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}