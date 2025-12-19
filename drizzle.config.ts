import type { Config } from "drizzle-kit";

export default {
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	driver: "turso",
	dbCredentials: {
		url: process.env.VITE_TURSO_DATABASE_URL as string,
		authToken: process.env.VITE_TURSO_AUTH_TOKEN as string,
	},
} satisfies Config;
