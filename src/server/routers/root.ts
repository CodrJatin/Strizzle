import { createTRPCRouter } from '../trpc';
import { userRouter } from './user';
import { materialRouter } from './material';
import { shelfRouter } from './shelf';
import { libraryRouter } from './library';
import { taskRouter } from './task';
import { hiveRouter } from './hive';
import { searchRouter } from './search';
import { memberRouter } from './member';
import { inviteRouter } from './invite';
import { activityRouter } from './activity';
import { announcementRouter } from './announcement';
import { hiveMaterialRouter } from './hiveMaterial';
import { folderRouter } from './folder';
import { syllabusRouter } from './syllabus';
import { calendarRouter } from './calendar';

export const appRouter = createTRPCRouter({
  user: userRouter,
  material: materialRouter,
  shelf: shelfRouter,
  library: libraryRouter,
  task: taskRouter,
  hive: hiveRouter,
  search: searchRouter,
  member: memberRouter,
  invite: inviteRouter,
  activity: activityRouter,
  announcement: announcementRouter,
  hiveMaterial: hiveMaterialRouter,
  folder: folderRouter,
  syllabus: syllabusRouter,
  calendar: calendarRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
