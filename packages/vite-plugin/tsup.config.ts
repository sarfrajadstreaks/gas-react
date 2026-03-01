import { defineConfig } from 'tsup';

export default defineConfig([
  // Build tools — Vite plugin + build helpers for GAS apps
  // DTS is manually maintained (peer deps like vite/esbuild aren't available at DTS generation).
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: true,
    external: [
      'vite',
      '@vitejs/plugin-react',
      'esbuild',
    ],
    onSuccess: 'cp src/index.d.ts dist/index.d.ts && echo "DTS dist/index.d.ts copied"',
  },
]);
