import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, createTRPCClient } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import superjson from 'superjson';
import type { AppRouter } from '@acme/api';
import { config } from '../config';
import { supabase } from '../lib/supabase';

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
        // Get the current session for authentication
        const { data: { session } } = await supabase.auth.getSession();
        
        return {
          'x-trpc-source': 'tv-app',
          // Include authorization header if session exists
          ...(session?.access_token && {
            'authorization': `Bearer ${session.access_token}`,
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