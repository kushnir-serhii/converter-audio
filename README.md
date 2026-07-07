# Audio Converter

A browser-based audio converter with drag-and-drop batch conversion. All
conversion happens locally via [ffmpeg.wasm](https://ffmpegwasm.netlify.app/)
— no backend, no uploads. Convert between MP3, AAC (.m4a), WAV, OGG, and FLAC.

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

## Deploying

The build output in `dist/` is a static site — deploy it to any static host
(Vercel, Netlify, GitHub Pages, etc.).

For **GitHub Pages** under a repo subpath (e.g.
`https://username.github.io/converter-audio/`), set `base` in
`vite.config.js`:

```js
export default defineConfig({
  base: "/converter-audio/",
  // ...
});
```

For Vercel/Netlify (served from the domain root), leave `base` as the
default (`/`).
