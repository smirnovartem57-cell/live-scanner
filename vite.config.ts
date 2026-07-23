import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist-react",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(currentDirectory, "index.html")
    }
  }
});
