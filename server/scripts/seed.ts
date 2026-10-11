import { loadConfig } from "../config";
import { assertDatabaseReady, createDb } from "../db";
import { resetDemoData, seedIfEmpty } from "../seed";

/** `npm run db:seed` seeds an empty database; `npm run db:reset` wipes and reseeds. */
async function main() {
  const reset = process.argv.includes("--reset");
  const url = process.argv.includes("--test") ? process.env.TEST_DATABASE_URL : loadConfig().databaseUrl;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const { pool, db } = createDb(url);
  try {
    await assertDatabaseReady(pool);
    if (reset) {
      await resetDemoData(db);
      console.log("[db] demo data reset");
    } else {
      console.log((await seedIfEmpty(db)) ? "[db] seeded demo data" : "[db] rooms already exist; nothing seeded");
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`[db] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
