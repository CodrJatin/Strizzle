import postgres from 'postgres';

const databaseUrl = "postgresql://postgres.qloqhrsllhzgyvkquudi:jatin08@supabase@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";
// We use a connection pool to run tests. Since we use transaction SET LOCAL, we must use a single connection/client to ensure all statements in a test run on the same session.
const sql = postgres(databaseUrl, { max: 1 });

async function runTest() {
  console.log("Starting RLS Policies Verification Tests...");
  
  // Generate random IDs for test users and hives
  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";
  const hiveId = "99999999-9999-9999-9999-999999999999";
  const materialId = "77777777-7777-7777-7777-777777777777";
  
  try {
    // Run everything in a transaction that will be rolled back, keeping the DB clean!
    await sql.begin(async (tx) => {
      // 1. Insert mock users as superuser (since RLS isn't checked for superuser postgres)
      // First, create the auth.users mock rows
      await tx`INSERT INTO auth.users (id) VALUES (${userA}), (${userB}) ON CONFLICT DO NOTHING;`;
      await tx`INSERT INTO public.users (id, full_name) VALUES (${userA}, 'User A'), (${userB}, 'User B') ON CONFLICT (id) DO NOTHING;`;
      await tx`INSERT INTO public.user_preferences (user_id, theme) VALUES (${userA}, 'default'), (${userB}, 'default') ON CONFLICT (user_id) DO NOTHING;`;
      
      // Create a hive owned by User A
      await tx`INSERT INTO public.hives (id, owner_id, name) VALUES (${hiveId}, ${userA}, 'Test Hive') ON CONFLICT (id) DO NOTHING;`;
      // User A is a member of Hive A
      await tx`INSERT INTO public.hive_members (hive_id, user_id, role) VALUES (${hiveId}, ${userA}, 'owner') ON CONFLICT (hive_id, user_id) DO NOTHING;`;

      console.log("Mock data inserted successfully.");

      // Test 1: User A select own preferences (Should succeed)
      console.log("Test 1: User A select own preferences...");
      await tx.unsafe('SET ROLE authenticated');
      await tx.unsafe(`SET LOCAL "request.jwt.claim.sub" TO '${userA}'`);
      const prefA = await tx`SELECT * FROM public.user_preferences WHERE user_id = ${userA};`;
      if (prefA.length !== 1) throw new Error("User A could not select own preferences");

      // Test 2: User A select User B's preferences (Should return 0 rows)
      console.log("Test 2: User A select User B's preferences (expect 0 rows)...");
      const prefB = await tx`SELECT * FROM public.user_preferences WHERE user_id = ${userB};`;
      if (prefB.length !== 0) throw new Error("RLS FAILED: User A read User B's preferences!");

      // Test 3: User B select Hive A before joining (Should return 0 rows)
      console.log("Test 3: User B select Hive A before joining (expect 0 rows)...");
      await tx.unsafe(`SET LOCAL "request.jwt.claim.sub" TO '${userB}'`);
      const hiveBefore = await tx`SELECT * FROM public.hives WHERE id = ${hiveId};`;
      if (hiveBefore.length !== 0) throw new Error("RLS FAILED: User B select Hive A without being a member!");

      // Test 4: User B joins Hive A as viewer, and tries to select Hive A (Should succeed)
      console.log("Test 4: User B joins Hive A as viewer and selects Hive A...");
      // Revert to postgres superuser to add User B to hive
      await tx.unsafe('RESET ROLE');
      await tx`INSERT INTO public.hive_members (hive_id, user_id, role) VALUES (${hiveId}, ${userB}, 'viewer') ON CONFLICT (hive_id, user_id) DO NOTHING;`;
      
      // Now act as User B
      await tx.unsafe('SET ROLE authenticated');
      await tx.unsafe(`SET LOCAL "request.jwt.claim.sub" TO '${userB}'`);
      const hiveAfter = await tx`SELECT * FROM public.hives WHERE id = ${hiveId};`;
      if (hiveAfter.length !== 1) throw new Error("User B could not select Hive A after joining!");

      // Test 5: User B tries to update Hive details as viewer (Should fail / update 0 rows)
      console.log("Test 5: User B tries to update Hive details as viewer (expect 0 rows)...");
      await tx`UPDATE public.hives SET name = 'Hacked Hive' WHERE id = ${hiveId};`;
      // In PG RLS, an UPDATE that doesn't match the USING clause doesn't throw, it just updates 0 rows
      const updatedHive = await tx`SELECT * FROM public.hives WHERE id = ${hiveId};`;
      if (updatedHive[0].name === 'Hacked Hive') throw new Error("RLS FAILED: User B (viewer) updated hive name!");

      // Test 6: User A (owner) updates Hive details (Should succeed)
      console.log("Test 6: User A (owner) updates Hive details...");
      await tx.unsafe(`SET LOCAL "request.jwt.claim.sub" TO '${userA}'`);
      await tx`UPDATE public.hives SET name = 'Updated Hive A' WHERE id = ${hiveId};`;
      const updatedHiveA = await tx`SELECT * FROM public.hives WHERE id = ${hiveId};`;
      if (updatedHiveA[0].name !== 'Updated Hive A') throw new Error("User A (owner) could not update hive name");

      // Test 7: Material visibility testing
      console.log("Test 7: Material visibility (owner vs other member)...");
      // Revert to superuser to insert material owned by User A
      await tx.unsafe('RESET ROLE');
      await tx`INSERT INTO public.materials (id, owner_id, content_type, title, body) VALUES (${materialId}, ${userA}, 'text', 'Secret Notes', 'Very secret') ON CONFLICT (id) DO NOTHING;`;
      
      // Act as User B (member of Hive A, but material not shared yet)
      await tx.unsafe('SET ROLE authenticated');
      await tx.unsafe(`SET LOCAL "request.jwt.claim.sub" TO '${userB}'`);
      const matBeforeShare = await tx`SELECT * FROM public.materials WHERE id = ${materialId};`;
      if (matBeforeShare.length !== 0) throw new Error("RLS FAILED: User B could select User A's private material before it was shared!");

      // Share material to Hive A (revert to superuser first)
      await tx.unsafe('RESET ROLE');
      const shareInsert = await tx`INSERT INTO public.hive_material_shares (id, material_id, hive_id, shared_by) VALUES (gen_random_uuid(), ${materialId}, ${hiveId}, ${userA}) RETURNING *;`;
      console.log("Shared material details:", shareInsert);

      // Act as User B again (now that it is shared to Hive A)
      await tx.unsafe('SET ROLE authenticated');
      await tx.unsafe(`SET LOCAL "request.jwt.claim.sub" TO '${userB}'`);
      
      // DEBUG LOGGING
      const currentUid = await tx`SELECT auth.uid() as uid;`;
      console.log("Current auth.uid() as User B:", currentUid[0]?.uid);
      const isMember = await tx`SELECT public.is_hive_member(${hiveId}, auth.uid()) as is_member;`;
      console.log("is_hive_member result:", isMember[0]?.is_member);
      const allShares = await tx`SELECT * FROM public.hive_material_shares;`;
      console.log("All hive material shares visible to User B:", allShares);
      const allMembers = await tx`SELECT * FROM public.hive_members;`;
      console.log("All hive members visible to User B:", allMembers);

      const matAfterShare = await tx`SELECT * FROM public.materials WHERE id = ${materialId};`;
      if (matAfterShare.length !== 1) throw new Error("User B could not select Material A after it was shared to Hive A!");

      // Test 8: User B tries to delete User A's material (Should fail / delete 0 rows)
      console.log("Test 8: User B tries to delete User A's material...");
      await tx`DELETE FROM public.materials WHERE id = ${materialId};`;
      const checkMat = await tx`SELECT * FROM public.materials WHERE id = ${materialId};`;
      if (checkMat.length !== 1) throw new Error("RLS FAILED: User B deleted User A's material!");

      console.log("ALL RLS VERIFICATION TESTS PASSED SUCCESSFULLY!");
      
      // Rollback transaction to leave database clean
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
    await sql.end();
  }
}

runTest();
