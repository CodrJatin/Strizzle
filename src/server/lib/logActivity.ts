import { activityLog } from '@/db/schema';

export interface LogActivityInput {
  hiveId: string;
  actorId: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

export async function logActivity(
  tx: {
    insert: (table: typeof activityLog) => {
      values: (values: typeof activityLog.$inferInsert) => {
        returning: () => Promise<Array<typeof activityLog.$inferSelect>>;
      };
    };
  },
  input: LogActivityInput
) {
  try {
    const [inserted] = await tx
      .insert(activityLog)
      .values({
        hiveId: input.hiveId,
        actorId: input.actorId,
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        meta: input.meta ?? null,
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}
