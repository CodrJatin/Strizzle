import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';

async function run() {
  loadEnvConfig(process.cwd());
  const connectionString = process.env.DATABASE_URL!;
  const encodedString = connectionString.replace('jatin08@supabase', 'jatin08%40supabase');

  console.log("Connecting to inspect pg_net...");
  const sql = postgres(encodedString, { prepare: false });

  try {
    const result = await sql`
      SELECT p.proname, pg_get_function_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'net' AND p.proname = 'http_post';
    `;
    console.log("Found pg_net functions:", result);
  } catch (error) {
    console.error("Failed to inspect pg_net:", error);
  } finally {
    await sql.end();
  }
}

run();
