import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';
import { api } from '@/lib/trpc/client';
import { createCallerFactory, createTRPCContext } from '@/server/trpc';
import { appRouter } from '@/server/routers/root';
import { notFound, redirect } from 'next/navigation';
import { HiveLayoutClient } from './HiveLayoutClient';

interface HiveLayoutProps {
  children: React.ReactNode;
  params: Promise<{ hiveId: string }>;
}

export default async function HiveLayout({ children, params }: HiveLayoutProps) {
  const { hiveId } = await params;

  // 1. Create tRPC Context & Caller
  const context = await createTRPCContext({
    req: new Request('http://localhost'),
  });

  // Redirect to login if user session is not present
  if (!context.user) {
    redirect(`/login?returnUrl=/invite/${hiveId}`);
  }

  const createCaller = createCallerFactory(appRouter);
  const caller = createCaller(context);

  // 2. Fetch the Hive first to verify permissions and get header details
  let hiveData;
  try {
    hiveData = await caller.hive.getHive({ hiveId });
  } catch (error) {
    console.error('Error fetching hive details for layout:', error);
    notFound();
  }

  // 3. Initialize QueryClient
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 120000, // 2 minutes standard cache time
      },
    },
  });

  // 4. Prefetch Hive details & Overview concurrently using getQueryKey
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: getQueryKey(api.hive.getHive, { hiveId }),
      queryFn: () => caller.hive.getHive({ hiveId }),
    }),
    queryClient.prefetchQuery({
      queryKey: getQueryKey(api.hive.getHiveOverview, { hiveId }),
      queryFn: () => caller.hive.getHiveOverview({ hiveId }),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HiveLayoutClient
        hiveId={hiveId}
        hiveName={hiveData.name}
        courseCode={hiveData.courseCode}
        userRole={hiveData.role}
      >
        {children}
      </HiveLayoutClient>
    </HydrationBoundary>
  );
}
