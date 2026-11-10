import { readFileSync } from 'node:fs';
import esbuild from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/**
 * Third-party deps stay external (mongoose does dynamic resolution a bundler can't follow; the
 * Docker image gets a real node_modules via `pnpm deploy --prod`). `@vastu/*` WORKSPACE packages
 * are BUNDLED: they publish TypeScript source (`exports: ./src/index.ts`), and Node refuses to
 * import .ts from inside node_modules (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING).
 */
const external = Object.keys(pkg.dependencies ?? {}).filter((d) => !d.startsWith('@vastu/'));

await esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outdir: 'dist',
  sourcemap: true,
  external,
  // Bundled CJS-style deps need a `require` in ESM output.
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
