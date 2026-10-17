"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { qk } from "@/lib/cache";
import { Toaster } from "@/components/ui/sonner";

function makeQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Client errors (401, 403, 404, 422...) won't change on retry.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
  // Pinned just-created posts live for the whole page load, even with no feed mounted.
  client.setQueryDefaults(qk.pinned, { gcTime: Infinity });
  return client;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="bottom-center" offset={{ bottom: 88 }} mobileOffset={{ bottom: 88 }} />
    </QueryClientProvider>
  );
}
