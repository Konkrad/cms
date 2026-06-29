import { defineConfig } from "vitest/config";
import { qwikVite } from "@qwik.dev/core/optimizer";
import path from "path";

export default defineConfig({
  plugins: [qwikVite()],
  resolve: {
    alias: {
      // "~theme" must precede "~" so it isn't shadowed by the shorter prefix.
      "~theme": path.resolve(__dirname, "theme"),
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
