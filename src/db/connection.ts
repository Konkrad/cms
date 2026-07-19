import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "../env";
import * as schema from "./schema";

const sqlite = new Database(env.DB_PATH);

// WAL is required by Litestream (continuous backup) and lets reads run concurrently
// with the single writer. busy_timeout retries briefly instead of erroring on lock
// contention; foreign_keys enforces referential integrity (off by default in SQLite).
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("foreign_keys = ON");

const db = drizzle({
	client: sqlite,
	relations: schema.schemaRelations,
});

export { db, sqlite };
