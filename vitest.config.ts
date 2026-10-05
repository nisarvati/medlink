import { defineConfig } from "vitest/config";

// Load .env (if present) so DB tests see DATABASE_URL.
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env: rely on the ambient environment */
}

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "tests/**/*.test.ts"],
    // DB tests share one database; run files serially.
    fileParallelism: false,
  },
});
