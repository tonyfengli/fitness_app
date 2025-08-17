import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';

interface BusinessContextType {
  businessId: string | null;
  isLoading: boolean;
}

const BusinessContext = createContext<BusinessContextType | null>(null);

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within BusinessProvider');
  }
  return context;
};

interface BusinessProviderProps {
  children: React.ReactNode;
}

export function BusinessProvider({ children }: BusinessProviderProps) {
  const { session, isLoading: authLoading } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('[BusinessProvider] 🔍 Session change detected');
    console.log('[BusinessProvider] Session user:', session?.user?.email || 'No user');
    console.log('[BusinessProvider] Session businessId:', session?.user?.businessId || 'No businessId');
    
    if (session?.user?.businessId) {
      console.log('[BusinessProvider] ✅ Setting businessId from session:', session.user.businessId);
      setBusinessId(session.user.businessId);
    } else if (session) {
      // Session exists but no businessId - this is an error state
      console.error('[BusinessProvider] ❌ Session exists but no businessId!');
      setBusinessId(null);
    } else {
      // No session yet
      console.log('[BusinessProvider] ⏳ No session yet, businessId is null');
      setBusinessId(null);
    }
    
    // Only set loading to false if auth is also done loading
    if (!authLoading) {
      setIsLoading(false);
    }
    
    console.log('[BusinessProvider] 🏁 BusinessId updated to:', session?.user?.businessId || 'null');
  }, [session, authLoading]);

  const value: BusinessContextType = {
    businessId,
    isLoading,
  };

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
}