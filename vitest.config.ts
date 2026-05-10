import { defineConfig } from "vitest/config";
import { qwikVite } from "@qwik.dev/core/optimizer";
import path from "path";

export default defineConfig({
  plugins: [qwikVite()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    globalSetup: "./tests/vitest-global-setup.ts",
    include: ["src/**/*.spec.{ts,tsx}", "tests/unit/**/*.spec.{ts,tsx}"],
    exclude: ["tests/e2e/**", "tests/*.spec.ts"],
  },
});
