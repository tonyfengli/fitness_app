import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, createTRPCClient } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import superjson from 'superjson';
import type { AppRouter } from '@acme/api';
import { config } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getBaseUrl = () => {
  return config.apiUrl;
};

const [queryClient] = [new QueryClient()];

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      transformer: superjson,
      url: `${getBaseUrl()}/api/trpc`,
      async headers() {
        // Get the stored session for authentication
        const storedSession = await AsyncStorage.getItem('tv-auth-session');
        const session = storedSession ? JSON.parse(storedSession) : null;
        
        // Also check for token separately
        const storedToken = await AsyncStorage.getItem('tv-auth-token');
        
        const headers: Record<string, string> = {
          'x-trpc-source': 'tv-app',
          'Content-Type': 'application/json',
        };
        
        // Try to use token from session first, then fallback to stored token
        const token = session?.session?.token || storedToken;
        
        if (token) {
          // Add both cookie and authorization headers
          headers['Cookie'] = `better-auth.session=${token}`;
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          console.error('[TRPCProvider] ❌ No auth token available!');
        }
        
        return headers;
      },
    }),
  ],
});

export const api = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

// Export the raw client for direct mutations if needed
export { trpcClient };

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}