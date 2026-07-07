import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // ffmpeg.wasm spawns a Web Worker internally; Vite pre-bundling
    // breaks the worker's URL resolution. Must be excluded.
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
});
