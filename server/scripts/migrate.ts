import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadConfig } from "../config";
import { createDb } from "../db";

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

/** Applies committed migrations. `--test` targets TEST_DATABASE_URL. */
export async function runMigrations(url: string) {
  const { pool, db } = createDb(url);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const useTest = process.argv.includes("--test");
  const url = useTest ? process.env.TEST_DATABASE_URL : loadConfig().databaseUrl;
  if (!url) {
    console.error(`${useTest ? "TEST_DATABASE_URL" : "DATABASE_URL"} is not set.`);
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log(`[db] migrations applied${useTest ? " (test database)" : ""}`))
    .catch((err) => {
      console.error(`[db] migration failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}
