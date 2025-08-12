import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

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

// Temporary auth credentials for TV app
const TV_APP_EMAIL = 'tv@d33b41e2-f700-4a08-9489-cb6e3daa7f20.local';
const TV_APP_PASSWORD = 'tv-app-temp-password-2024';

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setIsLoading(false);
      } else {
        // Auto sign in with TV app credentials
        signInTvApp();
      }
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const signInTvApp = async () => {
    try {
      console.log('[TV Auth] Attempting to sign in with TV app credentials');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: TV_APP_EMAIL,
        password: TV_APP_PASSWORD,
      });

      if (error) {
        console.error('[TV Auth] Sign in error:', error);
        // For now, we'll continue without auth
        // In production, this should be handled properly
      } else {
        console.log('[TV Auth] Successfully signed in');
        setSession(data.session);
      }
    } catch (err) {
      console.error('[TV Auth] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  };

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