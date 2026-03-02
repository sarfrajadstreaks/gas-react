import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: true,
    external: ['webpack', 'html-webpack-plugin', 'esbuild'],
    onSuccess: 'cp src/index.d.ts dist/index.d.ts && echo "DTS dist/index.d.ts copied"',
  },
]);
