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
  onSuccess: "sort-package-json",
});
