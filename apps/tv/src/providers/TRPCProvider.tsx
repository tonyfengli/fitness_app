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
        console.log('[TRPCProvider] 🔐 Building headers for request');
        
        // Get the stored session for authentication
        const storedSession = await AsyncStorage.getItem('tv-auth-session');
        console.log('[TRPCProvider] Stored session exists:', !!storedSession);
        
        const session = storedSession ? JSON.parse(storedSession) : null;
        
        // Also check for token separately
        const storedToken = await AsyncStorage.getItem('tv-auth-token');
        console.log('[TRPCProvider] Stored token exists:', !!storedToken);
        
        // Debug session structure
        if (session) {
          console.log('[TRPCProvider] Session keys:', Object.keys(session));
          console.log('[TRPCProvider] Session.user exists:', !!session.user);
          console.log('[TRPCProvider] Session.session exists:', !!session.session);
          if (session.session) {
            console.log('[TRPCProvider] Session.session keys:', Object.keys(session.session));
            console.log('[TRPCProvider] Session.session.token exists:', !!session.session.token);
            console.log('[TRPCProvider] Session.session.token type:', typeof session.session.token);
            if (session.session.token) {
              console.log('[TRPCProvider] Token length:', session.session.token.length);
              console.log('[TRPCProvider] Token starts with:', session.session.token.substring(0, 20));
            }
          }
        }
        
        const headers: Record<string, string> = {
          'x-trpc-source': 'tv-app',
          'Content-Type': 'application/json',
        };
        
        // Try to use token from session first, then fallback to stored token
        const token = session?.session?.token || storedToken;
        
        if (token) {
          console.log('[TRPCProvider] ✅ Found token, adding to headers');
          console.log('[TRPCProvider] Token preview:', token.substring(0, 30) + '...');
          console.log('[TRPCProvider] Token type:', typeof token);
          console.log('[TRPCProvider] Token length:', token.length);
          
          // Add both cookie and authorization headers
          headers['Cookie'] = `better-auth.session=${token}`;
          headers['Authorization'] = `Bearer ${token}`;
          
          console.log('[TRPCProvider] Headers being sent:');
          console.log('[TRPCProvider] - Cookie:', headers['Cookie'].substring(0, 50) + '...');
          console.log('[TRPCProvider] - Authorization:', headers['Authorization'].substring(0, 50) + '...');
        } else {
          console.error('[TRPCProvider] ❌ No auth token available!');
          console.log('[TRPCProvider] Session structure:', session ? Object.keys(session) : 'null');
          if (session) {
            console.log('[TRPCProvider] Session.session:', session.session ? Object.keys(session.session) : 'null');
          }
        }
        
        console.log('[TRPCProvider] Final headers keys:', Object.keys(headers));
        
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