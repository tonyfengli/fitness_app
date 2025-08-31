import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { TRPCProvider } from './providers/TRPCProvider';
import { RealtimeProvider } from './providers/RealtimeProvider';
import { BusinessProvider } from './providers/BusinessProvider';
import { AuthProvider } from './providers/AuthProvider';
import { useAuthCleanup } from './hooks/useAuthCleanup';

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
import { MainScreen } from './screens/MainScreen';
import { SessionLobbyScreen } from './screens/SessionLobbyScreen';
import { GlobalPreferencesScreen } from './screens/GlobalPreferencesScreen';
import { WorkoutOverviewScreen } from './screens/WorkoutOverviewScreen';
import { WorkoutLiveScreen } from './screens/WorkoutLiveScreen';
import { WorkoutCompleteScreen } from './screens/WorkoutCompleteScreen';
import { SessionMonitorScreen } from './screens/SessionMonitorScreen';
import { TestTailwindScreen } from './screens/TestTailwindScreen';
import { CircuitPreferencesScreen } from './screens/CircuitPreferencesScreen';
import { CircuitWorkoutOverviewScreen } from './screens/CircuitWorkoutOverviewScreen';
import { CircuitWorkoutLiveScreen } from './screens/CircuitWorkoutLiveScreen';


type ScreenName = 'Main' | 'SessionLobby' | 'GlobalPreferences' | 'CircuitPreferences' | 'WorkoutOverview' | 'CircuitWorkoutOverview' | 'CircuitWorkoutLive' | 'WorkoutLive' | 'WorkoutComplete' | 'SessionMonitor' | 'TestTailwind';

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
    currentScreen: 'Main',
    sessionId: null,
    currentRound: 1,
  });
  
  const [navigationParams, setNavigationParams] = useState<any>({});
  const tvEventHandler = useRef<TVEventHandler | null>(null);
  
  const screenHistory = useRef<ScreenName[]>(['Main']);

  const navigate = (screen: ScreenName, params?: any) => {
    console.log('[Navigation] Navigating to:', screen, 'with params:', params);
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
      <View style={{ flex: 1 }}>
        {navigationState.currentScreen === 'Main' && (
          <MainScreen />
        )}
        {navigationState.currentScreen === 'SessionLobby' && (
          <SessionLobbyScreen />
        )}
        {navigationState.currentScreen === 'GlobalPreferences' && (
          <GlobalPreferencesScreen />
        )}
        {navigationState.currentScreen === 'CircuitPreferences' && (
          <CircuitPreferencesScreen />
        )}
        {navigationState.currentScreen === 'WorkoutOverview' && (
          <WorkoutOverviewScreen />
        )}
        {navigationState.currentScreen === 'CircuitWorkoutOverview' && (
          <CircuitWorkoutOverviewScreen />
        )}
        {navigationState.currentScreen === 'CircuitWorkoutLive' && (
          <CircuitWorkoutLiveScreen />
        )}
        {navigationState.currentScreen === 'WorkoutLive' && (
          <WorkoutLiveScreen />
        )}
        {navigationState.currentScreen === 'WorkoutComplete' && (
          <WorkoutCompleteScreen />
        )}
        {navigationState.currentScreen === 'SessionMonitor' && (
          <SessionMonitorScreen />
        )}
        {navigationState.currentScreen === 'TestTailwind' && (
          <TestTailwindScreen />
        )}
      </View>
    </NavigationContext.Provider>
  );
}

// Component that uses the auth cleanup hook
function AppWithCleanup() {
  // This hook must be called inside AuthProvider
  useAuthCleanup();
  
  return (
    <TRPCProvider>
      <BusinessProvider>
        <RealtimeProvider>
          <NavigationContainer>
            <View style={{ flex: 1 }} />
          </NavigationContainer>
        </RealtimeProvider>
      </BusinessProvider>
    </TRPCProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppWithCleanup />
    </AuthProvider>
  );
}