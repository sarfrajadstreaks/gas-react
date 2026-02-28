import { defineConfig } from 'tsup';

export default defineConfig([
  // Server bundle — runs in GAS V8 runtime
  {
    entry: { 'server/index': 'src/server/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: [],
  },
  // Client bundle — runs in browser (React)
  {
    entry: { 'client/index': 'src/client/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    external: ['react', 'react-dom'],
  },
  // Config types
  {
    entry: { 'types/config': 'src/types/config.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
  },
  // Build tools
  {
    entry: { 'build/index': 'src/build/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
  },
]);
