import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/db/schema';
import { enforceRole } from '../src/server/trpc';
import { TRPCError } from '@trpc/server';
import { sql } from 'drizzle-orm';

const databaseUrl = "postgresql://postgres.qloqhrsllhzgyvkquudi:jatin08@supabase@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";
const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client, { schema });

async function runTest() {
  console.log("Starting enforceRole Verification Tests...");
  
  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";
  const hiveId = "99999999-9999-9999-9999-999999999999";
  
  try {
    await db.transaction(async (tx) => {
      // Setup mock data using Drizzle transaction client directly
      await tx.execute(sql`INSERT INTO auth.users (id) VALUES (${userA}), (${userB}) ON CONFLICT DO NOTHING;`);
      await tx.execute(sql`INSERT INTO public.users (id, full_name) VALUES (${userA}, 'User A'), (${userB}, 'User B') ON CONFLICT (id) DO NOTHING;`);
      await tx.execute(sql`INSERT INTO public.hives (id, owner_id, name) VALUES (${hiveId}, ${userA}, 'Test Hive') ON CONFLICT (id) DO NOTHING;`);
      await tx.execute(sql`INSERT INTO public.hive_members (hive_id, user_id, role) VALUES (${hiveId}, ${userA}, 'owner') ON CONFLICT (hive_id, user_id) DO NOTHING;`);
      await tx.execute(sql`INSERT INTO public.hive_members (hive_id, user_id, role) VALUES (${hiveId}, ${userB}, 'viewer') ON CONFLICT (hive_id, user_id) DO NOTHING;`);

      console.log("Mock data setup done.");

      // Test 1: User not logged in (null user)
      console.log("Test 1: User not logged in...");
      try {
        await enforceRole({ db: tx as any, user: null }, 'viewer', hiveId);
        throw new Error("Test 1 FAILED: Did not throw UNAUTHORIZED");
      } catch (error: any) {
        if (!(error instanceof TRPCError && error.code === 'UNAUTHORIZED')) {
          throw error;
        }
        console.log("Test 1 Passed: Threw UNAUTHORIZED");
      }

      // Test 2: User logged in but not a member of the hive
      console.log("Test 2: Non-member user...");
      const nonMemberId = "33333333-3333-3333-3333-333333333333";
      await tx.execute(sql`INSERT INTO auth.users (id) VALUES (${nonMemberId}) ON CONFLICT DO NOTHING;`);
      await tx.execute(sql`INSERT INTO public.users (id, full_name) VALUES (${nonMemberId}, 'Non Member') ON CONFLICT (id) DO NOTHING;`);
      try {
        await enforceRole({ db: tx as any, user: { id: nonMemberId } }, 'viewer', hiveId);
        throw new Error("Test 2 FAILED: Did not throw FORBIDDEN");
      } catch (error: any) {
        if (!(error instanceof TRPCError && error.code === 'FORBIDDEN' && error.message === 'You are not a member of this hive')) {
          throw error;
        }
        console.log("Test 2 Passed: Threw FORBIDDEN (not a member)");
      }

      // Test 3: User B has viewer role, requests viewer (Should succeed)
      console.log("Test 3: Viewer requesting viewer...");
      const memberB = await enforceRole({ db: tx as any, user: { id: userB } }, 'viewer', hiveId);
      if (memberB.role !== 'viewer') throw new Error("Test 3 FAILED: Succeeded but returned incorrect role");
      console.log("Test 3 Passed: Viewer succeeded requesting viewer");

      // Test 4: User B has viewer role, requests member (Should fail with FORBIDDEN: Insufficient permissions)
      console.log("Test 4: Viewer requesting member...");
      try {
        await enforceRole({ db: tx as any, user: { id: userB } }, 'member', hiveId);
        throw new Error("Test 4 FAILED: Succeeded but should have failed");
      } catch (error: any) {
        if (!(error instanceof TRPCError && error.code === 'FORBIDDEN' && error.message === 'Insufficient permissions')) {
          throw error;
        }
        console.log("Test 4 Passed: Threw FORBIDDEN (insufficient permissions)");
      }

      // Test 5: User A has owner role, requests admin (Should succeed)
      console.log("Test 5: Owner requesting admin...");
      const memberA = await enforceRole({ db: tx as any, user: { id: userA } }, 'admin', hiveId);
      if (memberA.role !== 'owner') throw new Error("Test 5 FAILED: Incorrect role returned");
      console.log("Test 5 Passed: Owner succeeded requesting admin");

      console.log("ALL enforceRole VERIFICATION TESTS PASSED SUCCESSFULLY!");
      throw new Error("ROLLBACK_ON_PURPOSE");
    });
  } catch (error: any) {
    if (error.message === "ROLLBACK_ON_PURPOSE") {
      console.log("Transaction rolled back successfully. Database is clean.");
    } else {
      console.error("Test failed with error:", error);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

runTest();
