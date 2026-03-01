import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      'client/index': 'src/client/index.ts',
      'server/index': 'src/server/index.ts',
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
]);
