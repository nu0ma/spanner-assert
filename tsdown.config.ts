import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  dts: true,
  minify: true,
  sourcemap: false,
  treeshake: true,
  publint: true,
  onSuccess: "sort-package-json",
  // tsdown v0.16.0+ defaults fixedExtension to true for node platform,
  // which generates .mjs/.d.mts files. Set to false to keep .js/.d.ts
  // for compatibility with existing package.json exports.
  fixedExtension: false,
});
