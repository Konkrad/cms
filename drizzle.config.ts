import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  url: process.env.DB_PATH ?? "my-database.db",
} satisfies Config;
