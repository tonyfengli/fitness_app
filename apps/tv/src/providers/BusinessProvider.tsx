import React, { createContext, useContext } from 'react';

interface BusinessContextType {
  businessId: string;
  // Future: Add more business-related data here
  // businessName?: string;
  // businessSettings?: BusinessSettings;
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

// TODO: Replace with actual authentication when ready
const HARDCODED_BUSINESS_ID = 'd33b41e2-f700-4a08-9489-cb6e3daa7f20';

export function BusinessProvider({ children }: BusinessProviderProps) {
  // In the future, this will fetch the business ID from auth context
  // const { user } = useAuth();
  // const businessId = user?.businessId || '';

  const value: BusinessContextType = {
    businessId: HARDCODED_BUSINESS_ID,
  };

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
}