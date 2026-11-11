'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ApiError } from '@/lib/api/client';
import { AuthProvider } from '@/lib/auth';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            refetchOnWindowFocus: true,
            // A 4xx is an answer, not a glitch: do not hammer the API. One retry for network blips.
            retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        {children}
        <Toaster position="bottom-right" duration={3000} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
