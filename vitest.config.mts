import { defineConfig } from "vitest/config";

/**
 * First test infra in the repo (spec 2026-08-05 §8) — deliberately narrow:
 * node environment, no jsdom, no Next plugin. It exists for pure modules where
 * a mistake costs money (payment signatures), not for component tests.
 * `@/*` mirrors the tsconfig path alias.
 *
 * `.mts` so Vite loads it as real ESM: the repo is CommonJS-by-default (adding
 * "type": "module" to package.json would change semantics for Next's own
 * config files), and a plain .ts config makes Vite warn on every run.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": import.meta.dirname,
      // Next.js resolves this specifier itself (it poisons client bundles);
      // it is not an installed package, so Vitest needs a stub to import any
      // module carrying the `import "server-only"` guard.
      "server-only": `${import.meta.dirname}/test/stubs/server-only.ts`,
    },
  },
});
