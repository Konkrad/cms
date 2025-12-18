import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const db = drizzle("my-database.db", { schema });

export { db };
