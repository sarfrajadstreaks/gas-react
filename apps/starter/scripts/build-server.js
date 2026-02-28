/**
 * Server build script
 *
 * Bundles all server TypeScript into a single Code.js that GAS can execute.
 * Top-level exported functions become GAS global functions via esbuild-gas-plugin.
 */

import { build } from 'esbuild';
import { GasPlugin } from 'esbuild-gas-plugin';

await build({
  entryPoints: ['src/server/index.ts'],
  bundle: true,
  outfile: 'dist/Code.js',
  format: 'esm',
  target: 'es2020',
  plugins: [GasPlugin],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

console.log('✅ Server build complete → dist/Code.js');
