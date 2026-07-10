import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist-react",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "react/index.html")
    }
  }
});
