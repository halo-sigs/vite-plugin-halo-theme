import path from "node:path";

import { haloThemePlugin } from "@halo-dev/vite-plugin-halo-theme";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), haloThemePlugin() as Plugin],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
