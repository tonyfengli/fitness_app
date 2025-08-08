import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/tanstack-react-query';
import superjson from 'superjson';
import type { AppRouter } from '@acme/api';

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // Use ngrok URL for development
  const debuggerHost = 'https://7ae3e6ccbcf5.ngrok-free.app';
  return debuggerHost;
};

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers() {
            return {
              'ngrok-skip-browser-warning': 'true',
            };
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      {children}
    </trpc.Provider>
  );
}

export function useTRPC() {
  return trpc;
}