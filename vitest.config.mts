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
    server: {
      deps: {
        // Ships a broken strict-ESM file (color_spec_2025.js imports
        // './dynamic_color' extensionless), so Node's native loader rejects it
        // when vitest externalizes the package. Inlining routes it through
        // Vite's bundler-style resolver — the same way Next/Turbopack loads it.
        inline: ["@material/material-color-utilities"],
      },
    },
  },
  // tsconfig sets jsx:"preserve" (Next transforms JSX itself), which makes the
  // oxc transform leave JSX untouched and vite's import analysis choke on any
  // .tsx in a test's import graph (hero-variant.test.ts → template wrappers).
  // The auto-discovered tsconfig wins over plain jsx options in the native
  // transform, so override it with an INLINE tsconfig for tests only; Next
  // never reads this config.
  oxc: { tsconfig: { compilerOptions: { jsx: "react-jsx" } } },
  // Same story for CSS in the import graph (wire.css etc.): stop vite from
  // loading postcss.config.mjs — the Tailwind-for-Next plugin there is not a
  // valid vite postcss plugin. Tests never assert on styles.
  css: { postcss: {} },
  resolve: {
    alias: {
      "@": import.meta.dirname,
      // Next.js resolves this specifier itself (it poisons client bundles);
      // it is not an installed package, so Vitest needs a stub to import any
      // module carrying the `import "server-only"` guard.
      "server-only": `${import.meta.dirname}/test/stubs/server-only.ts`,
      // Build-time font loaders can't run outside `next build`; the stub
      // returns the {className, variable, style} shape wrappers read.
      "next/font/google": `${import.meta.dirname}/test/stubs/next-font-google.ts`,
    },
  },
});
