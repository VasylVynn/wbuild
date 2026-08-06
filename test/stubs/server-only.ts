/**
 * `server-only` is not an npm dependency here — Next.js resolves that specifier
 * itself at build time to poison client bundles. Vitest has no such resolver,
 * so importing a real server module would fail on the bare specifier. This
 * empty stub is aliased in vitest.config.mts so server modules keep their
 * genuine `import "server-only"` guard in production AND stay unit-testable.
 */
export {};
