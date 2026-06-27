import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';
import { api } from '@/lib/trpc/client';
import { createCallerFactory, createTRPCContext } from '@/server/trpc';
import { appRouter } from '@/server/routers/root';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  // 1. Create tRPC Context & Caller
  const context = await createTRPCContext({
    req: new Request('http://localhost'),
  });

  const createCaller = createCallerFactory(appRouter);
  const caller = createCaller(context);

  // 2. Initialize QueryClient
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 120000, // Matches standard data staleTime reference
      },
    },
  });

  // 3. Prefetch User Hives and Starred Materials (Concurrent) using getQueryKey
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: getQueryKey(api.hive.getUserHives),
      queryFn: () => caller.hive.getUserHives(),
    }),
    queryClient.prefetchQuery({
      queryKey: getQueryKey(api.library.getLibraryMaterials, { starredOnly: true, limit: 10 }),
      queryFn: () => caller.library.getLibraryMaterials({ starredOnly: true, limit: 10 }),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
