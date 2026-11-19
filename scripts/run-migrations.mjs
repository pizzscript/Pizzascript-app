// One-off runner: applies supabase/migrations/*.sql in order against SUPABASE_DB_URL.
// Usage: node --env-file=.env.local scripts/run-migrations.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("SUPABASE_DB_URL is not set in .env.local");
  process.exit(1);
}

const dir = join(import.meta.dirname, "..", "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

for (const file of files) {
  const sql = readFileSync(join(dir, file), "utf8");
  console.log(`\n=== ${file} ===`);
  try {
    await client.query(sql);
    console.log(`  applied OK`);
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("\nAll migrations applied.");
