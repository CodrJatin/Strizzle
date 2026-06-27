import { createTRPCRouter } from '../trpc';
import { userRouter } from './user';
import { materialRouter } from './material';
import { shelfRouter } from './shelf';
import { libraryRouter } from './library';
import { taskRouter } from './task';
import { hiveRouter } from './hive';
import { searchRouter } from './search';

export const appRouter = createTRPCRouter({
  user: userRouter,
  material: materialRouter,
  shelf: shelfRouter,
  library: libraryRouter,
  task: taskRouter,
  hive: hiveRouter,
  search: searchRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
