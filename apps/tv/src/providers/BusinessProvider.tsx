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

// Temporary hardcoded business ID until better-auth is integrated
const HARDCODED_BUSINESS_ID = 'd33b41e2-f700-4a08-9489-cb6e3daa7f20';

export function BusinessProvider({ children }: BusinessProviderProps) {
  const { session } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.businessId) {
      setBusinessId(session.user.businessId);
      console.log('[TV Business] Loaded business ID from session:', session.user.businessId);
    } else {
      // Fallback to hardcoded business ID for now
      setBusinessId(HARDCODED_BUSINESS_ID);
      console.log('[TV Business] Using hardcoded business ID:', HARDCODED_BUSINESS_ID);
    }
    setIsLoading(false);
  }, [session]);

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