import { signR2Request } from "./sigv4.js";

const CREDENTIALS_KEY = "catalog.r2Credentials";

export function loadR2Credentials() {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveR2Credentials(creds) {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
}

export function clearR2Credentials() {
  localStorage.removeItem(CREDENTIALS_KEY);
}

export function hasR2Credentials(creds) {
  return Boolean(creds && creds.accountId && creds.accessKeyId && creds.secretAccessKey && creds.bucket);
}

/** GETs an object; returns null on 404, throws on other failures. */
export async function getObject(creds, key) {
  const { url, headers } = await signR2Request({ method: "GET", ...creds, key });
  const res = await fetch(url, { method: "GET", headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 GET ${key} failed: ${res.status} ${await safeText(res)}`);
  return res;
}

export async function getJson(creds, key) {
  const res = await getObject(creds, key);
  if (!res) return null;
  return res.json();
}

/** PUTs an object. body: Blob | ArrayBuffer | string. */
export async function putObject(creds, key, body, contentType) {
  const bodyForSigning = body instanceof Blob ? await body.arrayBuffer() : body;
  const { url, headers } = await signR2Request({
    method: "PUT",
    ...creds,
    key,
    body: bodyForSigning,
    contentType,
  });
  const res = await fetch(url, { method: "PUT", headers, body: bodyForSigning });
  if (!res.ok) throw new Error(`R2 PUT ${key} failed: ${res.status} ${await safeText(res)}`);
  return res;
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export function contentTypeFor(key) {
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return (
    {
      m4a: "audio/mp4",
      webp: "image/webp",
      png: "image/png",
      jpg: "image/jpeg",
      json: "application/json",
    }[ext] || "application/octet-stream"
  );
}

/** Uploads a queue of {key, body} objects sequentially, reporting per-item progress via onItem. */
export async function uploadAll(creds, items, onItem) {
  for (const item of items) {
    onItem(item.key, "uploading");
    try {
      await putObject(creds, item.key, item.body, item.contentType || contentTypeFor(item.key));
      onItem(item.key, "done");
    } catch (err) {
      onItem(item.key, "error", err);
      throw err;
    }
  }
}

/** Fallback: triggers a browser download instead of uploading to R2. */
export function downloadLocally(filename, blobOrString) {
  const blob = blobOrString instanceof Blob ? blobOrString : new Blob([blobOrString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
