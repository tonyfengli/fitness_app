import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService, type Session, type User } from '../auth/auth-service';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isTrainer: boolean;
  isClient: boolean;
  error: Error | null;
  retry: () => Promise<void>;
  signOut: () => Promise<void>;
  switchAccount: (env: 'gym' | 'developer') => Promise<void>;
  currentEnvironment: 'gym' | 'developer';
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
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [currentEnvironment, setCurrentEnvironment] = useState<'gym' | 'developer'>('gym');

  const initializeAuth = useCallback(async () => {
    try {
      console.log('[AuthProvider] 🔄 Initializing authentication...');
      console.log('[AuthProvider] Current session state:', session?.user?.email || 'No session');
      setIsLoading(true);
      setError(null);

      // Get session (will auto-login if needed)
      const authSession = await authService.getSession();
      
      if (authSession) {
        console.log('[AuthProvider] ✅ Authentication successful');
        console.log('[AuthProvider] User:', {
          id: authSession.user.id,
          email: authSession.user.email,
          role: authSession.user.role,
          businessId: authSession.user.businessId,
        });
        console.log('[AuthProvider] 🏢 BusinessId from session:', authSession.user.businessId);
        setSession(authSession);
      } else {
        console.error('[AuthProvider] ❌ Authentication failed');
        setError(new Error('Failed to authenticate'));
      }
    } catch (err) {
      console.error('[AuthProvider] Authentication error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
      console.log('[AuthProvider] 🏁 Auth initialization complete');
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    // Load environment and then initialize auth
    const loadEnvironmentAndAuth = async () => {
      const env = await authService.getCurrentEnvironment();
      setCurrentEnvironment(env);
      await initializeAuth();
    };
    loadEnvironmentAndAuth();
  }, []);

  // Retry function with exponential backoff
  const retry = useCallback(async () => {
    console.log('[AuthProvider] Retrying authentication...');
    setRetryCount(prev => prev + 1);
    
    // Exponential backoff: 1s, 2s, 4s, 8s, then stay at 10s
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    
    setTimeout(() => {
      initializeAuth();
    }, delay);
  }, [initializeAuth, retryCount]);

  // Sign out function
  const signOut = useCallback(async () => {
    console.log('[AuthProvider] 🚪 Signing out...');
    console.log('[AuthProvider] Current user before signout:', session?.user?.email, 'BusinessId:', session?.user?.businessId);
    setIsLoading(true);
    
    try {
      await authService.signOut();
      console.log('[AuthProvider] ✅ Sign out complete, clearing session');
      setSession(null);
      setError(null);
      
      // After sign out, auto-login again (TV app requirement)
      console.log('[AuthProvider] 🔄 Auto-login after sign out...');
      await initializeAuth();
    } catch (err) {
      console.error('[AuthProvider] Sign out error:', err);
      setError(err instanceof Error ? err : new Error('Sign out failed'));
    } finally {
      setIsLoading(false);
    }
  }, [initializeAuth]);

  // Switch account function
  const switchAccount = useCallback(async (env: 'gym' | 'developer') => {
    console.log('[AuthProvider] 🔄 Switching account to:', env);
    setIsLoading(true);
    setError(null);
    
    try {
      const newSession = await authService.switchAccount(env);
      
      if (newSession) {
        console.log('[AuthProvider] ✅ Account switch successful');
        setSession(newSession);
        setCurrentEnvironment(env);
      } else {
        throw new Error('Failed to switch account');
      }
    } catch (err) {
      console.error('[AuthProvider] Account switch error:', err);
      setError(err instanceof Error ? err : new Error('Account switch failed'));
      // Environment should already be restored by authService.switchAccount
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Compute derived state (matching web app pattern)
  const user = session?.user || null;
  const isAuthenticated = !!user;
  const isTrainer = user?.role === 'trainer';
  const isClient = user?.role === 'client';

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated,
    isTrainer,
    isClient,
    error,
    retry,
    signOut,
    switchAccount,
    currentEnvironment,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}