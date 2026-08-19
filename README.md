# Audio Converter

A browser-based audio converter with drag-and-drop batch conversion. All
conversion happens locally via [ffmpeg.wasm](https://ffmpegwasm.netlify.app/)
— no backend, no uploads. Convert between MP3, AAC (.m4a), WAV, OGG, and FLAC.

It also has a **Catalog** tab for maintaining ALMA's `catalog.json` and
uploading tracks/images straight to Cloudflare R2 — see
[`context/spec/06-catalog-manager.md`](context/spec/06-catalog-manager.md)
for the full design.

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # production build to dist/
npm run preview   # serve the production build locally
npm run test      # run the Vitest unit tests
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

## Catalog tab — R2 setup

The Catalog tab uploads straight from the browser to Cloudflare R2 via a
SigV4-signed `fetch` (no AWS SDK, no backend — see §3 of the spec). Two
things to set up once per bucket:

1. **Credentials** — enter your R2 Account ID, bucket name, Access Key ID,
   and Secret Access Key in the Catalog tab's "R2 Settings" panel. They're
   kept only in this browser's `localStorage` and are sent nowhere except
   directly to `https://<accountId>.r2.cloudflarestorage.com`.
2. **CORS** — add this rule to the bucket (Cloudflare dashboard → R2 →
   your bucket → Settings → CORS Policy) so the browser is allowed to
   `GET`/`PUT` objects:

   ```json
   [
     {
       "AllowedOrigins": [
         "https://<your-tool-domain>",
         "http://localhost:5173"
       ],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

Without credentials (or if a PUT fails), the tab falls back to "Export
locally": it downloads `catalog.json` and every renamed sound/image file
for manual upload via the R2 dashboard.
