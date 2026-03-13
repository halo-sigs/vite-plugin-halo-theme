import { defineConfig } from "vite-plus/pack";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm"],
  dts: {
    tsgo: true,
  },
  exports: true,
});
