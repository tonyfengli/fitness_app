import React, { createContext, useContext, useEffect, useState } from 'react';
import { authClient, signIn } from '../auth/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Auto-login credentials for TV app
const TV_APP_EMAIL = 'tony.li.feng@gmail.com';
const TV_APP_PASSWORD = '123456';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  businessId: string;
}

interface Session {
  user: User;
  token: string;
}

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAndSignIn = async () => {
    try {
      console.log('[TV Auth] Checking for existing session...');
      
      // First check if we have a stored session
      const storedSession = await AsyncStorage.getItem('tv-auth-session');
      if (storedSession) {
        const parsedSession = JSON.parse(storedSession);
        console.log('[TV Auth] Found stored session for:', parsedSession.user.email);
        setSession(parsedSession);
        setIsLoading(false);
        return;
      }

      // No stored session, attempt auto sign-in
      console.log('[TV Auth] No stored session, attempting auto sign-in...');
      console.log('[TV Auth] Using email:', TV_APP_EMAIL);
      
      const result = await signIn({
        email: TV_APP_EMAIL,
        password: TV_APP_PASSWORD,
      });

      console.log('[TV Auth] Sign in result:', JSON.stringify(result, null, 2));

      if (result.error) {
        console.error('[TV Auth] Sign in error:', result.error);
        // Log more details about the error
        if (result.error.status) {
          console.error('[TV Auth] Error status:', result.error.status);
        }
        if (result.error.message) {
          console.error('[TV Auth] Error message:', result.error.message);
        }
        setIsLoading(false);
      } else if (result.data) {
        // Transform better-auth response to our session format
        const session: Session = {
          user: result.data.user as User,
          token: result.data.token,
        };
        
        console.log('[TV Auth] Successfully signed in as:', session.user.email);
        console.log('[TV Auth] User data:', JSON.stringify(session.user, null, 2));
        setSession(session);
        
        // Store session for next app launch
        await AsyncStorage.setItem('tv-auth-session', JSON.stringify(session));
        setIsLoading(false);
      } else {
        console.error('[TV Auth] No data or error in response');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[TV Auth] Unexpected error:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAndSignIn();
  }, []);

  const value: AuthContextType = {
    session,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}