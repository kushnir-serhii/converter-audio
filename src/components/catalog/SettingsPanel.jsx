import { useState } from "react";

export default function SettingsPanel({ credentials, onChange }) {
  const [open, setOpen] = useState(!credentials.accountId);
  const [draft, setDraft] = useState(credentials);

  const field = (key, label, type = "text") => (
    <label className="flex flex-col gap-1 text-sm text-zinc-600">
      {label}
      <input
        type={type}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
        autoComplete="off"
      />
    </label>
  );

  return (
    <div className="rounded-2xl bg-white shadow-sm p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm font-medium text-zinc-700"
      >
        <span>R2 Settings {credentials.accountId ? "✓" : "(required to upload)"}</span>
        <span className="text-zinc-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-zinc-500">
            Kept only in this browser's <code>localStorage</code> — never sent anywhere except
            directly to your R2 bucket. Leave blank to use the local-export fallback instead.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field("accountId", "Account ID")}
            {field("bucket", "Bucket name")}
            {field("accessKeyId", "Access Key ID")}
            {field("secretAccessKey", "Secret Access Key", "password")}
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Save
            </button>
          </div>
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer select-none">One-time bucket CORS setup</summary>
            <p className="mt-2">
              Add this CORS rule to your R2 bucket (Cloudflare dashboard → R2 → bucket → Settings
              → CORS Policy) so the browser can GET/PUT directly:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-50 p-2">
{`[
  {
    "AllowedOrigins": [
      "https://<your-tool-domain>",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]`}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
