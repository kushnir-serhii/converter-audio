// Minimal AWS SigV4 signer for R2's S3-compatible API — WebCrypto only, no
// AWS SDK. R2 uses region "auto" and service "s3". See §3 of the spec: no
// backend exists, so PUT/GET must be signed straight from the browser.

const ENCODER = new TextEncoder();

async function sha256Hex(data) {
  const bytes = typeof data === "string" ? ENCODER.encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(digest);
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? ENCODER.encode(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, ENCODER.encode(data));
}

function amzTimestamp(date) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/** Path-style encodes each `/`-separated segment; the slashes themselves stay literal. */
function encodePath(path) {
  return path
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
}

/**
 * Signs an S3-compatible request for Cloudflare R2.
 *
 * @param {object} opts
 * @param {string} opts.method
 * @param {string} opts.accountId
 * @param {string} opts.accessKeyId
 * @param {string} opts.secretAccessKey
 * @param {string} opts.bucket
 * @param {string} opts.key - object key (no leading slash)
 * @param {BodyInit|null} opts.body
 * @param {string} [opts.contentType]
 * @returns {Promise<{url: string, headers: Record<string,string>}>}
 */
export async function signR2Request({
  method,
  accountId,
  accessKeyId,
  secretAccessKey,
  bucket,
  key,
  body = null,
  contentType,
}) {
  const region = "auto";
  const service = "s3";
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${bucket}/${encodePath(key)}`;
  const { amzDate, dateStamp } = amzTimestamp(new Date());

  const bodyBytes =
    body == null ? new Uint8Array(0) : typeof body === "string" ? ENCODER.encode(body) : body;
  const payloadHash = await sha256Hex(bodyBytes);

  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) headers["content-type"] = contentType;

  const sortedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderNames.map((h) => `${h}:${headers[h]}\n`).join("");
  const signedHeaders = sortedHeaderNames.join(";");

  const canonicalRequest = [
    method,
    canonicalUri,
    "", // no query string for GET/PUT of a single object
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = await hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(await hmac(kSigning, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${host}${canonicalUri}`,
    headers: {
      ...headers,
      Authorization: authorization,
    },
  };
}
