import "dotenv/config";
import { runMigrations } from "../../server/scripts/migrate";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set. See .env.example.");
  if (url === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL: tests wipe the database.");
  }
  await runMigrations(url);
}
