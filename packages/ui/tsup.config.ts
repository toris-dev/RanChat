import { resolve } from "path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  external: ["react"],
  esbuildOptions(options) {
    options.alias = {
      "@": resolve(__dirname, "./src"),
    };
  },
});
