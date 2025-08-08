import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, createTRPCClient } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import superjson from 'superjson';
import type { AppRouter } from '@acme/api';

export const { useTRPC, TRPCProvider: TRPCProviderContext } = createTRPCContext<AppRouter>();

import { config } from '../config';

const getBaseUrl = () => {
  return config.apiUrl;
};

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers() {
            return {
              'x-trpc-source': 'tv-app',
            };
          },
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProviderContext trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProviderContext>
    </QueryClientProvider>
  );
}