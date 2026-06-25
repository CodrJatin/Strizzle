import { initTRPC, TRPCError } from '@trpc/server';
import { db } from '@/db';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';
import { hiveMembers } from '@/db/schema';

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 * These allow you to access things like the database, the user session, etc.
 */
export async function createTRPCContext(opts: { req: Request }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return {
    db,
    supabase,
    user,
  };
}

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context.
 */
const t = initTRPC.context<typeof createTRPCContext>().create();

/**
 * 3. ROUTER & PROCEDURE CREATORS
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * in the "/src/server/routers" directory.
 */
export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const ROLES_ORDER = ['viewer', 'member', 'admin', 'owner'] as const;
export type HiveRole = (typeof ROLES_ORDER)[number];

export async function enforceRole(
  ctx: { db: typeof db; user: { id: string } | null },
  minRole: HiveRole,
  hiveId: string
) {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  const [member] = await ctx.db
    .select()
    .from(hiveMembers)
    .where(
      and(
        eq(hiveMembers.hiveId, hiveId),
        eq(hiveMembers.userId, ctx.user.id)
      )
    )
    .limit(1);

  if (!member) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You are not a member of this hive',
    });
  }

  const userRoleIndex = ROLES_ORDER.indexOf(member.role as HiveRole);
  const minRoleIndex = ROLES_ORDER.indexOf(minRole);

  if (userRoleIndex < minRoleIndex) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  }

  return member;
}
