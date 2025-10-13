import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  target: 'node18',
  dts: true,
  minify: true,
  splitting: false,
  sourcemap: true,
});
