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
        
        const headers: Record<string, string> = {
          'x-trpc-source': 'tv-app',
          'Content-Type': 'application/json',
        };
        
        // Better Auth expects cookies, not Authorization headers
        // Send the session token as a cookie
        if (session?.token) {
          // Better Auth uses "better-auth.session" as the cookie name
          headers['Cookie'] = `better-auth.session=${session.token}`;
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

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}