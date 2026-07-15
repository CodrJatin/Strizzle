import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/root';
import { createTRPCContext } from '@/server/trpc';

const handler = (req: Request) =>
  fetchRequestHandler({
    req,
    endpoint: '/api/trpc',
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    onError({ path, error }) {
      console.error(`tRPC error on path "${path}":`, error.cause ?? error);
    },
  });

export { handler as GET, handler as POST };
