/*
 * Production migration runner.
 *
 * Applies committed Drizzle migrations from ./drizzle to the SQLite file at DB_PATH.
 * Runs at container startup (see docker/entrypoint.sh) before the server boots.
 * Uses only `better-sqlite3` + `drizzle-orm` (both prod deps) so the runtime image
 * does not need drizzle-kit or tsx. Idempotent: tracked in __drizzle_migrations,
 * a no-op when already up to date.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const dbPath = process.env.DB_PATH ?? "my-database.db";

const sqlite = new Database(dbPath);
// Set WAL before Litestream begins replicating (entrypoint runs migrate first).
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");

const db = drizzle({ client: sqlite });
migrate(db, { migrationsFolder: "./drizzle" });
sqlite.close();

console.log(`Migrations applied to ${dbPath}`);
