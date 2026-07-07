import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  // GitHub Pages serves this repo under /converter-audio/; the dev server
  // still runs at the root so `npm run dev` behaves normally.
  base: command === "build" ? "/converter-audio/" : "/",
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // ffmpeg.wasm spawns a Web Worker internally; Vite pre-bundling
    // breaks the worker's URL resolution. Must be excluded.
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
}));
