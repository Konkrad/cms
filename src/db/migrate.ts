import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { env } from "../env";

// Applies committed migrations from ./drizzle to the SQLite file at env.DB_PATH.
// Idempotent: tracked in __drizzle_migrations, a no-op when already up to date.
// Called from entry.node-server.tsx (prod) and vite.config.ts (dev) so it always
// runs whenever the server process starts, regardless of how it was launched.
export function runMigrations() {
	const sqlite = new Database(env.DB_PATH);
	// Set WAL before Litestream begins replicating.
	sqlite.pragma("journal_mode = WAL");
	sqlite.pragma("busy_timeout = 5000");

	const db = drizzle({ client: sqlite });
	migrate(db, { migrationsFolder: "./drizzle" });
	sqlite.close();
}
