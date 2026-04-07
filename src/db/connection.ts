import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const db = drizzle(process.env.DB_PATH ?? "my-database.db", { schema });

export { db };
