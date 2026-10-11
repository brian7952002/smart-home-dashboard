import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r("./client"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": r("./client/src"),
      "@shared": r("./shared"),
    },
  },
  build: {
    outDir: r("./dist/public"),
    emptyOutDir: true,
  },
});
