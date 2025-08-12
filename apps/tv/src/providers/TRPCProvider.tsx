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
        
        return {
          'x-trpc-source': 'tv-app',
          // Include authorization header if session exists
          ...(session?.token && {
            'Authorization': `Bearer ${session.token}`,
          }),
        };
      },
    }),
  ],
});

export const api = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}