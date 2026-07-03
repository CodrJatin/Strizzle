import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';
import { api } from '@/lib/trpc/client';
import { createCallerFactory, createTRPCContext } from '@/server/trpc';
import { appRouter } from '@/server/routers/root';
import { redirect } from 'next/navigation';
import { AppLayoutClient } from './AppLayoutClient';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  // 1. Create tRPC Context & Caller
  const context = await createTRPCContext({
    req: new Request('http://localhost'),
  });

  // Redirect to login if user session is not present
  if (!context.user) {
    redirect(`/login?returnUrl=/dashboard`);
  }

  const createCaller = createCallerFactory(appRouter);
  const caller = createCaller(context);

  // 2. Initialize QueryClient
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 120000, // 2 minutes standard cache time
      },
    },
  });

  // 3. Prefetch layout queries concurrently
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: getQueryKey(api.user.getMe),
      queryFn: () => caller.user.getMe(),
    }),
    queryClient.prefetchQuery({
      queryKey: getQueryKey(api.hive.getUserHives),
      queryFn: () => caller.hive.getUserHives(),
    }),
    queryClient.prefetchQuery({
      queryKey: getQueryKey(api.task.getMyTasks),
      queryFn: () => caller.task.getMyTasks(),
    }),
    queryClient.prefetchQuery({
      queryKey: getQueryKey(api.library.getLibraryMaterials, { starredOnly: true, limit: 10 }),
      queryFn: () => caller.library.getLibraryMaterials({ starredOnly: true, limit: 10 }),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppLayoutClient>
        {children}
      </AppLayoutClient>
    </HydrationBoundary>
  );
}
