import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbLike = Db | Tx;

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10 });
  // Idle-client errors (e.g. the database restarting) must not crash the process.
  pool.on("error", (err) => console.error(`[db] idle client error: ${err.message}`));
  const db: Db = drizzle({ client: pool, schema });
  return { pool, db };
}

/** Throws a readable error (without the connection string) when the database is unreachable or unmigrated. */
export async function assertDatabaseReady(pool: pg.Pool): Promise<void> {
  try {
    await pool.query("select 1");
  } catch (err) {
    throw new Error(
      `Cannot connect to PostgreSQL (${(err as Error).message}). Is the database running? Try "npm run db:up".`,
      { cause: err },
    );
  }
  const { rows } = await pool.query<{ exists: boolean }>(
    "select to_regclass('public.rooms') is not null as exists",
  );
  if (!rows[0]?.exists) {
    throw new Error('Database tables are missing. Run "npm run db:migrate" first.');
  }
}
